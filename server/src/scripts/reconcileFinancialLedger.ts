import prisma from "../config/prisma";
import logger from "../utils/logger";
import { 
    calculateOrderDue, 
    calculateCustomerDues 
} from "../services/dueCalculationService";

interface FinancialDiscrepancy {
    type: "ORDER_STATUS_MISMATCH" | "CUSTOMER_DUE_MISMATCH" | "DUPLICATE_PAYMENT" | "SUSPICIOUS_AMOUNT";
    entityId: string;
    details: any;
}

export const runFinancialAuditAndReconciliation = async (commit: boolean = false) => {
    logger.info(`[Financial Audit] Starting ledger reconciliation... Mode: ${commit ? "COMMIT" : "DRY-RUN"}`);

    const discrepancies: FinancialDiscrepancy[] = [];
    const adjustments: any[] = [];

    // ─── 1. AUDIT DUPLICATE PAYMENTS ──────────────────────────────────────────
    const duplicateTxns = await prisma.payment.groupBy({
        by: ["orderId", "transactionId"],
        where: { status: "SUCCESS", transactionId: { not: null } },
        _count: { id: true },
        having: { id: { _count: { gt: 1 } } }
    });

    for (const group of duplicateTxns) {
        if (!group.transactionId || !group.orderId) continue;
        const payments = await prisma.payment.findMany({
            where: { orderId: group.orderId, transactionId: group.transactionId, status: "SUCCESS" },
            orderBy: { createdAt: "asc" }
        });

        if (payments.length > 1) {
            discrepancies.push({
                type: "DUPLICATE_PAYMENT",
                entityId: `${group.orderId}_${group.transactionId}`,
                details: {
                    orderId: group.orderId,
                    transactionId: group.transactionId,
                    count: payments.length,
                    amounts: payments.map(p => Number(p.amount))
                }
            });

            if (commit) {
                // Keep the first (earliest) verified payment record, archive & delete duplicates
                const duplicatesToDelete = payments.slice(1);
                for (const dup of duplicatesToDelete) {
                    await (prisma.auditLog.create as any)({
                        data: {
                            entityType: "PAYMENT",
                            entityId: dup.id,
                            action: "FINANCIAL_RECON_PURGE_DUPLICATE",
                            oldValue: {
                                id: dup.id,
                                orderId: dup.orderId,
                                amount: Number(dup.amount),
                                method: dup.method,
                                transactionId: dup.transactionId,
                                status: dup.status
                            },
                            newValue: {
                                reason: "IDENTICAL_TRANSACTION_ID_DUPLICATE_ON_ORDER",
                                retainedPaymentId: payments[0].id
                            }
                        }
                    });
                    await prisma.payment.delete({ where: { id: dup.id } });
                    adjustments.push({
                        type: "PURGED_DUPLICATE_PAYMENT",
                        paymentId: dup.id,
                        orderId: dup.orderId,
                        amount: Number(dup.amount)
                    });
                }
            }
        }
    }

    // ─── 2. AUDIT INVOICE TOTALS VS NET COLLECTIONS ───────────────────────────
    const orders = await prisma.order.findMany({
        where: { status: { notIn: ["CANCELLED", "FAILED"] } },
        include: {
            payments: true,
            user: { select: { id: true, name: true, phone: true } }
        }
    });

    for (const order of orders) {
        const orderTotal = Number(order.totalAmount);
        const dueResult = calculateOrderDue(order);
        const netCollections = dueResult.paidAmount;
        const calculatedRemainingDue = dueResult.dueAmount;

        const expectedIsPaid = !dueResult.isEligible;
        const expectedPaymentStatus = netCollections <= 0 ? "PENDING" : (expectedIsPaid ? "COMPLETED" : "PARTIAL");

        const statusMismatch = order.isPaid !== expectedIsPaid || (order.paymentStatus !== expectedPaymentStatus && !(expectedIsPaid && (order.paymentStatus === "PAID" || order.paymentStatus === "SETTLED")));

        if (statusMismatch) {
            discrepancies.push({
                type: "ORDER_STATUS_MISMATCH",
                entityId: order.id,
                details: {
                    orderTotal,
                    netCollections,
                    currentIsPaid: order.isPaid,
                    expectedIsPaid,
                    currentPaymentStatus: order.paymentStatus,
                    expectedPaymentStatus,
                    user: order.user?.name || order.user?.phone
                }
            });

            if (commit) {
                await (prisma.auditLog.create as any)({
                    data: {
                        entityType: "ORDER",
                        entityId: order.id,
                        action: "FINANCIAL_RECON_CORRECT_STATUS",
                        oldValue: { isPaid: order.isPaid, paymentStatus: order.paymentStatus },
                        newValue: {
                            isPaid: expectedIsPaid,
                            paymentStatus: expectedPaymentStatus,
                            netCollections,
                            orderTotal
                        }
                    }
                });

                await prisma.order.update({
                    where: { id: order.id },
                    data: {
                        isPaid: expectedIsPaid,
                        paymentStatus: expectedPaymentStatus
                    }
                });

                adjustments.push({
                    type: "ORDER_STATUS_CORRECTED",
                    orderId: order.id,
                    oldStatus: order.paymentStatus,
                    newStatus: expectedPaymentStatus,
                    remainingDue: calculatedRemainingDue
                });
            }
        }
    }

    // ─── 3. AUDIT CUSTOMER OUTSTANDING BALANCES ───────────────────────────────
    const customers = await prisma.user.findMany({
        where: { role: "USER" },
        include: {
            orders: {
                where: { status: { notIn: ["CANCELLED", "FAILED"] } },
                include: { payments: true }
            }
        }
    });

    for (const customer of customers) {
        const summary = calculateCustomerDues(customer.orders);
        const expectedTotalSpend = summary.totalSpend;
        const expectedTotalPaid = summary.totalPaid;
        const expectedTotalDue = summary.totalDue;

        const storedDue = Number(customer.totalDue || 0);

        if (Math.abs(storedDue - expectedTotalDue) > 0.01) {
            discrepancies.push({
                type: "CUSTOMER_DUE_MISMATCH",
                entityId: customer.id,
                details: {
                    customerName: customer.name,
                    customerPhone: customer.phone,
                    storedDue,
                    expectedTotalDue,
                    totalSpend: expectedTotalSpend,
                    totalPaid: expectedTotalPaid,
                    activeOrdersCount: customer.orders.length
                }
            });

            if (commit) {
                await (prisma.auditLog.create as any)({
                    data: {
                        entityType: "USER",
                        entityId: customer.id,
                        action: "FINANCIAL_RECON_CORRECT_CUSTOMER_DUE",
                        oldValue: { totalDue: storedDue },
                        newValue: {
                            totalDue: expectedTotalDue,
                            totalSpend: expectedTotalSpend,
                            totalPaid: expectedTotalPaid
                        }
                    }
                });

                await prisma.user.update({
                    where: { id: customer.id },
                    data: { totalDue: expectedTotalDue }
                });

                adjustments.push({
                    type: "CUSTOMER_DUE_SYNCHRONIZED",
                    customerId: customer.id,
                    customerName: customer.name,
                    oldDue: storedDue,
                    correctedDue: expectedTotalDue
                });
            }
        }
    }

    // ─── 4. TRACE SUSPICIOUS ₹1.00 TRANSACTIONS ────────────────────────────────
    const suspiciousOrders = await prisma.order.findMany({
        where: {
            totalAmount: { lte: 1.00 },
            status: { notIn: ["CANCELLED"] }
        },
        include: {
            items: { include: { product: { select: { name: true, sku: true } } } },
            payments: true,
            user: { select: { id: true, name: true, phone: true } },
            staff: { select: { id: true, name: true } }
        },
        orderBy: { createdAt: "desc" }
    });

    const suspiciousReport = suspiciousOrders.map(o => ({
        orderId: o.id,
        channel: o.channel,
        createdAt: o.createdAt,
        totalAmount: Number(o.totalAmount),
        customer: `${o.user?.name || "N/A"} (${o.user?.phone || "N/A"})`,
        staff: o.staff?.name || "System",
        paymentStatus: o.paymentStatus,
        isPaid: o.isPaid,
        items: o.items.map(i => ({
            productName: i.product?.name || "Custom/Manual Item",
            quantity: Number(i.quantity),
            sellingPrice: Number(i.sellingPrice)
        })),
        payments: o.payments.map(p => ({
            method: p.method,
            amount: Number(p.amount),
            status: p.status,
            transactionId: p.transactionId
        }))
    }));

    return {
        mode: commit ? "COMMIT" : "DRY_RUN",
        totalOrdersAudited: orders.length,
        totalCustomersAudited: customers.length,
        totalDiscrepanciesFound: discrepancies.length,
        discrepancies,
        totalAdjustmentsMade: adjustments.length,
        adjustments,
        suspiciousOrdersReport: {
            totalFound: suspiciousOrders.length,
            records: suspiciousReport
        }
    };
};

if (require.main === module) {
    const isCommit = process.argv.includes("--commit");
    runFinancialAuditAndReconciliation(isCommit)
        .then(result => {
            console.log("=== FINANCIAL RECONCILIATION RESULT ===");
            console.log(JSON.stringify(result, null, 2));
            process.exit(0);
        })
        .catch(err => {
            console.error("Reconciliation error:", err);
            process.exit(1);
        });
}
