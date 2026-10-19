import Decimal from "decimal.js";
import prisma from "../config/prisma";
import logger from "../utils/logger";

export type DecimalLike = number | string | { toString(): string } | any;

export interface PaymentLike {
    id?: string;
    amount: DecimalLike;
    method?: string | null;
    status?: string | null;
    createdAt?: Date | string;
}

export interface OrderLike {
    id: string;
    totalAmount: DecimalLike;
    isPaid?: boolean;
    paymentStatus?: string | null;
    status?: string;
    locationId?: string | null;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    payments?: PaymentLike[];
    user?: any;
    [key: string]: any;
}

export interface OrderDueResult {
    orderId: string;
    isEligible: boolean;
    totalAmount: number;
    paidAmount: number;
    dueAmount: number;
    ineligibilityReason?: string;
}

export interface CustomerDueSummary {
    totalDue: number;
    totalDueFormatted: string;
    eligibleOrdersCount: number;
    eligibleOrders: Array<OrderLike & { dueAmount: number; paidAmount: number }>;
    totalPaid: number;
    totalSpend: number;
}

/**
 * Supported payment statuses that represent successfully settled money.
 * Case-insensitive comparison.
 */
export const VALID_PAYMENT_STATUSES = new Set(["SUCCESS", "COMPLETED", "PAID"]);

/**
 * Payment statuses that explicitly represent incomplete or non-money states.
 */
export const INVALID_PAYMENT_STATUSES = new Set(["PENDING", "FAILED", "REFUNDED", "USER_DROPPED", "CANCELLED"]);

/**
 * Order-level payment statuses that represent a fully settled bill.
 */
export const FULLY_SETTLED_ORDER_PAYMENT_STATUSES = new Set(["COMPLETED", "PAID", "SETTLED"]);

/**
 * Order-level statuses that negate any outstanding balance collection.
 */
export const INELIGIBLE_ORDER_STATUSES = new Set(["CANCELLED", "FAILED"]);

/**
 * Determines whether an individual payment record represents collected funds.
 * Rules:
 * 1. Amount must be positive (> 0).
 * 2. Method must not be CREDIT (credit ledger note is not cash/money collected).
 * 3. Status must be SUCCESS, COMPLETED, PAID, or null/undefined (legacy records).
 *    Status must NOT be PENDING, FAILED, REFUNDED, etc.
 */
export const isValidPaymentRecord = (payment: PaymentLike): boolean => {
    if (!payment) return false;

    // Check amount
    const amtVal = payment.amount !== undefined && payment.amount !== null && typeof payment.amount === "object" && "toString" in payment.amount
        ? payment.amount.toString()
        : (payment.amount || 0);
    const amt = new Decimal(amtVal);
    if (amt.lessThanOrEqualTo(0)) return false;

    // Credit method is an issuance of credit, not money received
    if (payment.method && String(payment.method).trim().toUpperCase() === "CREDIT") {
        return false;
    }

    // Check status
    if (!payment.status || String(payment.status).trim() === "") {
        // Legacy payment records with null or empty status are counted as successful
        return true;
    }

    const normStatus = String(payment.status).trim().toUpperCase();
    if (INVALID_PAYMENT_STATUSES.has(normStatus)) {
        return false;
    }

    return VALID_PAYMENT_STATUSES.has(normStatus);
};

/**
 * Sums all valid payment records for an order using high-precision Decimal arithmetic.
 */
export const calculateOrderPaidAmountDecimal = (payments?: PaymentLike[]): any => {
    if (!Array.isArray(payments) || payments.length === 0) {
        return new Decimal(0);
    }

    return payments.reduce((sum: any, p: PaymentLike) => {
        if (isValidPaymentRecord(p)) {
            return sum.plus(new Decimal(p.amount ? p.amount.toString() : 0));
        }
        return sum;
    }, new Decimal(0));
};

/**
 * Formats a monetary number to exactly two decimal places.
 */
export const formatCurrencyAmount = (amount: DecimalLike): string => {
    const val = amount !== undefined && amount !== null && typeof amount === "object" && "toString" in amount 
        ? amount.toString() 
        : (amount || 0);
    const d = new Decimal(val);
    return d.toFixed(2);
};

export const calculateOrderDue = (order: OrderLike): OrderDueResult => {
    const totalVal = order.totalAmount !== undefined && order.totalAmount !== null && typeof order.totalAmount === "object" && "toString" in order.totalAmount
        ? order.totalAmount.toString()
        : (order.totalAmount || 0);
    const orderTotalDec = new Decimal(totalVal);
    const orderTotal = Number(orderTotalDec.toFixed(2));

    // 1. Check order status (Cancelled/Failed orders have 0 due)
    const normStatus = String(order.status || "").trim().toUpperCase();
    if (INELIGIBLE_ORDER_STATUSES.has(normStatus)) {
        return {
            orderId: order.id,
            isEligible: false,
            totalAmount: orderTotal,
            paidAmount: 0,
            dueAmount: 0,
            ineligibilityReason: `Order status is ${normStatus}`
        };
    }

    // 2. Check if explicitly marked isPaid: true
    if (order.isPaid === true) {
        return {
            orderId: order.id,
            isEligible: false,
            totalAmount: orderTotal,
            paidAmount: orderTotal,
            dueAmount: 0,
            ineligibilityReason: "Order marked isPaid: true"
        };
    }

    // 3. Check if paymentStatus indicates fully settled
    const normPaymentStatus = String(order.paymentStatus || "").trim().toUpperCase();
    if (FULLY_SETTLED_ORDER_PAYMENT_STATUSES.has(normPaymentStatus)) {
        return {
            orderId: order.id,
            isEligible: false,
            totalAmount: orderTotal,
            paidAmount: orderTotal,
            dueAmount: 0,
            ineligibilityReason: `Order paymentStatus is ${normPaymentStatus}`
        };
    }

    // 4. Calculate actual valid paid amount
    const paidDec = calculateOrderPaidAmountDecimal(order.payments);
    const paidAmount = Number(paidDec.toFixed(2));

    // 5. Calculate remaining balance: Math.max(0, total - paid)
    const remainingDec = Decimal.max(0, orderTotalDec.minus(paidDec));
    const dueAmount = Number(remainingDec.toFixed(2));

    // 6. If due is zero or negative (paid in full despite isPaid flag not updated)
    if (remainingDec.lessThanOrEqualTo(new Decimal(0.005))) {
        return {
            orderId: order.id,
            isEligible: false,
            totalAmount: orderTotal,
            paidAmount,
            dueAmount: 0,
            ineligibilityReason: "Fully paid via transactions"
        };
    }

    return {
        orderId: order.id,
        isEligible: true,
        totalAmount: orderTotal,
        paidAmount,
        dueAmount
    };
};

/**
 * Authoritative aggregator for customer dues across a set of orders.
 * Accurately tracks total outstanding due, bill count, total spend, and total payments.
 */
export const calculateCustomerDues = (orders: OrderLike[]): CustomerDueSummary => {
    let totalSpendDec = new Decimal(0);
    let totalPaidDec = new Decimal(0);
    let totalDueDec = new Decimal(0);
    const eligibleOrders: Array<OrderLike & { dueAmount: number; paidAmount: number }> = [];

    for (const order of orders) {
        const normStatus = String(order.status || "").trim().toUpperCase();
        if (INELIGIBLE_ORDER_STATUSES.has(normStatus)) {
            continue;
        }

        const dueResult = calculateOrderDue(order);

        totalSpendDec = totalSpendDec.plus(new Decimal(dueResult.totalAmount));
        totalPaidDec = totalPaidDec.plus(new Decimal(dueResult.paidAmount));

        if (dueResult.isEligible && dueResult.dueAmount > 0) {
            totalDueDec = totalDueDec.plus(new Decimal(dueResult.dueAmount));
            eligibleOrders.push({
                ...order,
                dueAmount: dueResult.dueAmount,
                paidAmount: dueResult.paidAmount
            });
        }
    }

    const roundedTotalDue = Number(totalDueDec.toFixed(2));

    return {
        totalDue: roundedTotalDue,
        totalDueFormatted: totalDueDec.toFixed(2),
        eligibleOrdersCount: eligibleOrders.length,
        eligibleOrders,
        totalPaid: Number(totalPaidDec.toFixed(2)),
        totalSpend: Number(totalSpendDec.toFixed(2))
    };
};

/**
 * Centralized Prisma 'where' clause generator for eligible unpaid orders.
 * Ensures identical filtering criteria across worker, POS, and sync handlers.
 */
export const getEligibleOrdersWhereClause = (options?: {
    customerId?: string;
    customerIds?: string[];
    locationId?: string | null;
}) => {
    return {
        status: { notIn: ["CANCELLED", "FAILED"] as any },
        isPaid: false,
        paymentStatus: { notIn: ["COMPLETED", "PAID", "SETTLED"] },
        ...(options?.customerId ? { userId: options.customerId } : {}),
        ...(options?.customerIds && options.customerIds.length > 0 ? { userId: { in: options.customerIds } } : {}),
        ...(options?.locationId ? { locationId: options.locationId } : {})
    };
};

/**
 * Scalable cursor-based batch processor for customers with dues.
 * Eliminates silent truncation from arbitrary limits like `take: 200`.
 */
export const processCustomersWithDuesInBatches = async (
    options: {
        batchSize?: number;
        locationId?: string | null;
        handler: (customerSummary: {
            customer: { id: string; name: string | null; phone: string };
            summary: CustomerDueSummary;
        }) => Promise<void>;
    }
): Promise<{ totalProcessed: number; totalWithDues: number }> => {
    const batchSize = options.batchSize || 100;
    let cursor: string | undefined = undefined;
    let totalProcessed = 0;
    let totalWithDues = 0;

    const baseWhere = {
        isActive: true,
        phone: { not: "" },
        orders: {
            some: getEligibleOrdersWhereClause({ locationId: options.locationId })
        }
    };

    while (true) {
        const customers: any[] = await prisma.user.findMany({
            where: baseWhere,
            select: {
                id: true,
                name: true,
                phone: true,
                orders: {
                    where: getEligibleOrdersWhereClause({ locationId: options.locationId }),
                    include: { payments: true },
                    orderBy: { createdAt: "desc" }
                }
            },
            take: batchSize,
            skip: cursor ? 1 : 0,
            cursor: cursor ? { id: cursor } : undefined,
            orderBy: { id: "asc" }
        });

        if (customers.length === 0) break;

        for (const customer of customers) {
            totalProcessed++;
            const summary = calculateCustomerDues(customer.orders);

            if (summary.eligibleOrdersCount > 0 && summary.totalDue > 0) {
                totalWithDues++;
                await options.handler({
                    customer: {
                        id: customer.id,
                        name: customer.name,
                        phone: customer.phone
                    },
                    summary
                });
            }
        }

        cursor = customers[customers.length - 1].id;
        if (customers.length < batchSize) break;
    }

    return { totalProcessed, totalWithDues };
};

/**
 * Checks whether an incoming bill ID / order ID string is actually a display label
 * such as "All Dues (16 Bills)" rather than a true database ID.
 */
export const isAllDuesDisplayLabel = (str?: string | null): boolean => {
    if (!str) return false;
    const trimmed = String(str).trim();
    return /^all\s*dues/i.test(trimmed);
};

export interface RawLedgerEventInput {
    id: string;
    type: "CHARGE" | "PAYMENT";
    date: Date;
    amount: number;
    referenceId?: string;
    description: string;
    details?: any;
}

export interface ChronologicalLedgerEvent extends RawLedgerEventInput {
    runningBalance: number;
}

/**
 * Reconciles chronological ledger events with high-precision Decimal arithmetic
 * and deterministic tie-breaking (timestamps, CHARGE before PAYMENT, then ID).
 */
export const calculateChronologicalLedger = (
    events: RawLedgerEventInput[]
): {
    ledger: ChronologicalLedgerEvent[];
    totalSpend: number;
    totalPaid: number;
    outstandingDue: number;
} => {
    // 1. Deterministic sort: chronological ascending
    const sorted = [...events].sort((a, b) => {
        const timeA = a.date instanceof Date ? a.date.getTime() : new Date(a.date).getTime();
        const timeB = b.date instanceof Date ? b.date.getTime() : new Date(b.date).getTime();
        const timeDiff = timeA - timeB;
        if (timeDiff !== 0) return timeDiff;

        // Charges processed before Payments for the same timestamp so balance doesn't falsely dip negative
        if (a.type === "CHARGE" && b.type === "PAYMENT") return -1;
        if (a.type === "PAYMENT" && b.type === "CHARGE") return 1;

        return a.id.localeCompare(b.id);
    });

    let runningBalanceDec = new Decimal(0);
    let totalSpendDec = new Decimal(0);
    let totalPaidDec = new Decimal(0);

    const ledger: ChronologicalLedgerEvent[] = sorted.map((event) => {
        const amountDec = new Decimal(event.amount || 0);
        if (event.type === "CHARGE") {
            totalSpendDec = totalSpendDec.plus(amountDec);
            runningBalanceDec = runningBalanceDec.plus(amountDec);
        } else {
            totalPaidDec = totalPaidDec.plus(amountDec);
            runningBalanceDec = runningBalanceDec.minus(amountDec);
        }

        return {
            ...event,
            amount: Number(amountDec.toFixed(2)),
            runningBalance: Number(runningBalanceDec.toFixed(2))
        };
    });

    const totalSpend = Number(totalSpendDec.toFixed(2));
    const totalPaid = Number(totalPaidDec.toFixed(2));
    const outstandingDue = Number(Decimal.max(0, runningBalanceDec).toFixed(2));

    return {
        ledger,
        totalSpend,
        totalPaid,
        outstandingDue
    };
};

/**
 * Pure function to simulate or compute multi-bill payment allocation.
 * Guarantees zero floating-point drift and enforces exact bill limits.
 */
export const allocateBulkPaymentAcrossBills = (
    bills: Array<{ id: string; totalAmount: DecimalLike; payments?: PaymentLike[] }>,
    availableAmount: DecimalLike
): {
    allocations: Array<{ orderId: string; allocatedAmount: number; previousPaid: number; remainingDue: number; isFullyPaid: boolean }>;
    totalAllocated: number;
    excessAmount: number;
} => {
    let remaining = new Decimal(availableAmount !== undefined && availableAmount !== null ? availableAmount.toString() : 0);
    let totalAllocatedDec = new Decimal(0);
    const allocations: Array<{ orderId: string; allocatedAmount: number; previousPaid: number; remainingDue: number; isFullyPaid: boolean }> = [];

    for (const bill of bills) {
        if (remaining.lessThanOrEqualTo(0)) {
            const billDue = calculateOrderDue(bill);
            allocations.push({
                orderId: bill.id,
                allocatedAmount: 0,
                previousPaid: billDue.paidAmount,
                remainingDue: billDue.dueAmount,
                isFullyPaid: billDue.dueAmount <= 0
            });
            continue;
        }

        const billTotalDec = new Decimal(bill.totalAmount ? bill.totalAmount.toString() : 0);
        const paidDec = calculateOrderPaidAmountDecimal(bill.payments);
        const dueDec = Decimal.max(0, billTotalDec.minus(paidDec));

        if (dueDec.lessThanOrEqualTo(0.005)) {
            allocations.push({
                orderId: bill.id,
                allocatedAmount: 0,
                previousPaid: Number(paidDec.toFixed(2)),
                remainingDue: 0,
                isFullyPaid: true
            });
            continue;
        }

        const toApplyDec = Decimal.min(remaining, dueDec);
        const toApply = Number(toApplyDec.toFixed(2));

        remaining = remaining.minus(toApplyDec);
        totalAllocatedDec = totalAllocatedDec.plus(toApplyDec);

        const newPaidDec = paidDec.plus(toApplyDec);
        const newRemainingDec = Decimal.max(0, billTotalDec.minus(newPaidDec));
        const isFull = newRemainingDec.lessThanOrEqualTo(0.005);

        allocations.push({
            orderId: bill.id,
            allocatedAmount: toApply,
            previousPaid: Number(paidDec.toFixed(2)),
            remainingDue: Number(newRemainingDec.toFixed(2)),
            isFullyPaid: isFull
        });
    }

    return {
        allocations,
        totalAllocated: Number(totalAllocatedDec.toFixed(2)),
        excessAmount: Number(remaining.toFixed(2))
    };
};

