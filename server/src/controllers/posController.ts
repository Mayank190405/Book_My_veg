import { Request, Response, NextFunction } from "express";
import prisma from "../config/prisma";
import { AppError } from "../utils/errors";
import { Prisma, OrderStatus, Channel } from "@prisma/client";
import { getIo } from "../sockets/io";
import { generateOrderId } from "../utils/idGenerator";
import { InventoryService, InventoryLogType } from "../services/inventoryService";
import { SearchService } from "../services/searchService";

interface AuthenticatedRequest extends Request {
    user?: { userId: string; role: string; locationId?: string };
}

// ─── Customer Management ──────────────────────────────────────────────────────

export const searchCustomer = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const { query } = req.query;
    try {
        const customers = await prisma.user.findMany({
            where: {
                role: "USER",
                OR: [
                    { name: { contains: query as string, mode: 'insensitive' } },
                    { phone: { contains: query as string } },
                    { email: { contains: query as string, mode: 'insensitive' } }
                ]
            },
            take: 10,
            select: { 
                id: true, 
                name: true, 
                phone: true, 
                email: true,
                profileAddress: true,
                addresses: {
                    where: { isDefault: true },
                    take: 1
                }
            }
        });
        res.json(customers);
    } catch (error) {
        next(error);
    }
};

// ─── Web Orders for POS ───────────────────────────────────────────────────────

export const getWebOrders = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const orders = await prisma.order.findMany({
            where: {
                channel: Channel.WEB,
                status: { in: ["PENDING", "CONFIRMED"] },
            },
            include: {
                user: { select: { id: true, name: true, phone: true } },
                items: { include: { product: { select: { name: true } } } },
            },
            orderBy: { createdAt: "desc" },
            take: 50,
        });

        // Map to a shape the POS UI expects
        const mapped = orders.map(o => ({
            id: o.id,
            customerName: o.user?.name || "Walk-In",
            customerPhone: o.user?.phone || "",
            items: o.items,
            totalAmount: o.totalAmount,
            status: o.status,
            createdAt: o.createdAt,
            user: o.user,
        }));

        res.json(mapped);
    } catch (error) {
        next(error);
    }
};

export const createOrUpdateCustomer = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const { id, name, phone, email, address } = req.body;
    // Treat empty email as null to avoid unique constraint violations
    const sanitizedEmail = email && email.trim() !== "" ? email.trim() : null;
    try {
        if (id) {
            const customer = await prisma.user.update({
                where: { id },
                data: { 
                    name, 
                    phone, 
                    email: sanitizedEmail,
                    ...(address && {
                        addresses: {
                            upsert: {
                                where: { id: (await prisma.address.findFirst({ where: { userId: id, isDefault: true } }))?.id || 'new-address-id' },
                                update: { fullAddress: address },
                                create: { fullAddress: address, isDefault: true }
                            }
                        }
                    })
                },
                include: { addresses: { where: { isDefault: true } } }
            });
            return res.json({ message: "Customer updated", customer });
        } else {
            // Check if customer with the same phone already exists
            const existingCustomer = await prisma.user.findFirst({
                where: { phone }
            });

            if (existingCustomer) {
                // Update the existing customer instead
                const customer = await prisma.user.update({
                    where: { id: existingCustomer.id },
                    data: {
                        name,
                        email: sanitizedEmail,
                        ...(address && {
                            addresses: {
                                upsert: {
                                    where: { id: (await prisma.address.findFirst({ where: { userId: existingCustomer.id, isDefault: true } }))?.id || 'new-address-id' },
                                    update: { fullAddress: address },
                                    create: { fullAddress: address, isDefault: true }
                                }
                            }
                        })
                    },
                    include: { addresses: { where: { isDefault: true } } }
                });
                return res.json({ message: "Customer updated", customer });
            } else {
                // New Customer
                const customer = await prisma.user.create({
                    data: {
                        name,
                        phone,
                        email: sanitizedEmail,
                        role: "USER",
                        password: "POS_AUTO_GENERATED_" + Math.random().toString(36).slice(-8),
                        ...(address && {
                            addresses: {
                                create: {
                                    fullAddress: address,
                                    isDefault: true
                                }
                            }
                        })
                    },
                    include: { addresses: { where: { isDefault: true } } }
                });

                // Trigger welcome registration WhatsApp notification!
                try {
                    const { sendRegistrationThankYouViaWhatsapp } = require("../services/mbgcard");
                    sendRegistrationThankYouViaWhatsapp(customer.phone, customer.name || "Customer").catch((err: any) => {
                        console.error("[POS] Welcome WhatsApp dispatch failure:", err);
                    });
                } catch (err) {
                    console.error("[POS] Failed to send welcome WhatsApp:", err);
                }

                return res.json({ message: "Customer created", customer });
            }
        }
    } catch (error) {
        next(error);
    }
};

// ─── POS Order Processing ─────────────────────────────────────────────────────

export const processPOSOrder = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const { 
        customerId, 
        items, 
        paymentMethod, 
        paymentDetails, 
        discountAmount, 
        couponId,
        packerId,
        duePaymentAmount = 0,
        paidAmount = 0, // NEW: Amount paid specifically for THIS bill
        suspend = false,
        denominations,
        orderId // NEW: Edit Bill support
    } = req.body;
    
    const staffId = req.user?.userId;
    const locationId = req.user?.locationId;

    if (!staffId || !locationId) {
        return next(new AppError("Operational context missing (Staff/Location)", 401));
    }

    try {
        let existingOrder = null;
        let existingPaidTotal = 0;
        if (orderId) {
            existingOrder = await prisma.order.findUnique({
                where: { id: orderId },
                include: { items: true, payments: true }
            });
            if (!existingOrder) {
                return next(new AppError("Order not found for editing", 404));
            }
            existingPaidTotal = existingOrder.payments
                .filter((p: any) => p.status === "SUCCESS")
                .reduce((sum: number, p: any) => sum + Number(p.amount), 0);
        }

        // Fetch current due BEFORE processing
        const prevOrders = await prisma.order.findMany({
            where: { 
                userId: customerId, 
                channel: Channel.POS,
                paymentStatus: { in: ["PENDING", "PARTIAL"] }, 
                status: { notIn: ["CANCELLED", "FAILED", "PAYMENT_PENDING"] } 
            },
            include: { payments: true }
        });
        const previousDue = prevOrders.reduce((acc, o) => acc + (Number(o.totalAmount) - o.payments.reduce((pAcc, p) => pAcc + Number(p.amount), 0)), 0);
        
        // 🛡️ RECOVERY: Verify Staff Existence (Avoid P2003 if DB was wiped/re-seeded)
        let validatedStaffId = staffId;
        const staffExists = await prisma.user.findUnique({ where: { id: staffId } });
        if (!staffExists) {
            console.warn(`[POS] Invalid Staff Session ID ${staffId}. Falling back to Root Admin.`);
            const rootAdmin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
            validatedStaffId = rootAdmin?.id || staffId; // Fallback to root or keep original if absolutely zero users (though unlikely)
        }

        const result = await (prisma as any).$transaction(async (tx: any) => {
            const itemTotals = items.reduce((acc: number, item: any) => acc + (item.price * item.quantity), 0);
            const totalAmount = itemTotals - (discountAmount || 0);

            // Determine payment status for THIS bill
            const effectivePaid = paymentMethod === "CREDIT" ? 0 : Number(paidAmount || totalAmount);
            const totalPaidAmount = existingPaidTotal + effectivePaid;
            const isFull = totalPaidAmount >= totalAmount;
            const pStatus = totalPaidAmount <= 0 ? "PENDING" : (isFull ? "COMPLETED" : "PARTIAL");

            let order;
            if (existingOrder) {
                // 1. Restore stock first if not cancelled or pending
                if (existingOrder.status !== "PENDING" && existingOrder.status !== "CANCELLED") {
                    await InventoryService.restoreStock({
                        items: existingOrder.items.map((i: any) => ({
                            productId: i.productId,
                            variantId: i.variantId || null,
                            quantity: Number(i.quantity)
                        })),
                        locationId,
                        staffId,
                        referenceId: existingOrder.id
                    }, tx);
                }

                // 2. Delete old order items
                await tx.orderItem.deleteMany({
                    where: { orderId: existingOrder.id }
                });

                // 3. Update order fields and create new items
                order = await tx.order.update({
                    where: { id: existingOrder.id },
                    data: {
                        totalAmount: new Prisma.Decimal(totalAmount),
                        discountAmount: new Prisma.Decimal(discountAmount || 0),
                        status: (suspend ? "PENDING" : (existingOrder.status === "PENDING" ? "CONFIRMED" : existingOrder.status)) as OrderStatus,
                        paymentStatus: pStatus,
                        isPaid: isFull,
                        packerId,
                        staffId: validatedStaffId,
                        items: {
                            create: items.map((item: any) => ({
                                productId: item.productId,
                                variantId: item.variantId,
                                quantity: item.quantity,
                                sellingPrice: new Prisma.Decimal(item.price),
                                locationId
                            }))
                        }
                    }
                });
            } else {
                order = await tx.order.create({
                    data: {
                        id: generateOrderId(),
                        userId: customerId,
                        locationId,
                        totalAmount: new Prisma.Decimal(totalAmount),
                        discountAmount: new Prisma.Decimal(discountAmount || 0),
                        status: (suspend ? "PENDING" : "CONFIRMED") as OrderStatus,
                        paymentStatus: pStatus,
                        isPaid: isFull,
                        shippingAddress: { type: "POS_IN_STORE", note: "Handover at Counter" } as any,
                        channel: Channel.POS,
                        notes: `POS Transaction by ${staffId}${!staffExists ? " (SESSION_RECOVERED)" : ""}`,
                        packerId,
                        staffId: validatedStaffId, // Use validated ID
                        items: {
                            create: items.map((item: any) => ({
                                productId: item.productId,
                                variantId: item.variantId,
                                quantity: item.quantity,
                                sellingPrice: new Prisma.Decimal(item.price),
                                locationId
                            }))
                        },
                        statusHistory: {
                            create: {
                                status: (suspend ? "PENDING" : "CONFIRMED") as OrderStatus,
                                remark: `POS Checkout (${pStatus})`,
                                changedBy: staffId
                            }
                        }
                    }
                });
            }

            if (!suspend) {
                await InventoryService.deductStock({
                    items: items.map((i: any) => ({ productId: i.productId, variantId: i.variantId, quantity: i.quantity })),
                    locationId,
                    type: InventoryLogType.SALE,
                    staffId
                }, tx);
            }

            if (effectivePaid > 0 && !suspend) {
                await tx.payment.create({
                    data: {
                        orderId: order.id,
                        amount: new Prisma.Decimal(effectivePaid),
                        method: paymentMethod,
                        status: "SUCCESS",
                        transactionId: paymentDetails?.transactionId || `POS_${Date.now()}`,
                        denominations: denominations || null
                    }
                });

                if (paymentMethod === "CASH" && denominations && locationId) {
                    const activeShift = await tx.cashierShift.findFirst({
                        where: { locationId, status: "OPEN" }
                    });
                    if (activeShift) {
                        const shiftDenominations = activeShift.currentDenominations 
                            ? (typeof activeShift.currentDenominations === "string" 
                                ? JSON.parse(activeShift.currentDenominations) 
                                : activeShift.currentDenominations as Record<string, number>)
                            : {} as Record<string, number>;
                        
                        const received = denominations.received || {};
                        const change = denominations.change || {};
                        
                        const denominationsKeys = ["500", "200", "100", "50", "20", "10", "5", "2", "1"];
                        const updatedDenominations: Record<string, number> = {};
                        for (const key of denominationsKeys) {
                            const currentCount = Number(shiftDenominations[key] || 0);
                            const receivedCount = Number(received[key] || 0);
                            const changeCount = Number(change[key] || 0);
                            updatedDenominations[key] = Math.max(0, currentCount + receivedCount - changeCount);
                        }
                        
                        await tx.cashierShift.update({
                            where: { id: activeShift.id },
                            data: {
                                currentDenominations: updatedDenominations
                            }
                        });
                    }
                }
            }

            return order;
        });

        // ─── SETTLE OLD DUES ────────────────────────────────────────────────
        let settledFromOld = 0;
        if (duePaymentAmount > 0) {
            let remaining = Number(duePaymentAmount);
            const unpaidOrders = await prisma.order.findMany({
                where: { 
                    userId: customerId, 
                    channel: Channel.POS,
                    id: { not: (result as any).id },
                    paymentStatus: { in: ["PENDING", "PARTIAL"] },
                    status: { notIn: ["CANCELLED", "FAILED", "PAYMENT_PENDING"] }
                },
                orderBy: { createdAt: "asc" },
                include: { payments: true }
            });

            for (const oldOrder of unpaidOrders) {
                if (remaining <= 0) break;
                const paid = oldOrder.payments.reduce((acc, p) => acc + Number(p.amount), 0);
                const due = Number(oldOrder.totalAmount) - paid;
                const toApply = Math.min(remaining, due);

                if (toApply > 0) {
                    await prisma.payment.create({
                        data: {
                            orderId: oldOrder.id,
                            amount: new Prisma.Decimal(toApply),
                            method: paymentMethod || "CASH",
                            status: "SUCCESS",
                            transactionId: `POS_SETTLE_${Date.now()}`
                        }
                    });
                    const fullyPaid = (paid + toApply) >= Number(oldOrder.totalAmount);
                    await prisma.order.update({
                        where: { id: oldOrder.id },
                        data: { isPaid: fullyPaid, paymentStatus: fullyPaid ? "COMPLETED" : "PARTIAL" }
                    });
                    remaining -= toApply;
                    settledFromOld += toApply;
                }
            }
        }

        const finalOrder: any = await prisma.order.findUnique({ 
            where: { id: (result as any).id }, 
            include: { 
                payments: true,
                staff: { select: { name: true } }
            } 
        });
        const currentBillPaid = finalOrder.payments.reduce((acc: number, p: any) => acc + Number(p.amount), 0);
        const currentBillDue = Number(finalOrder.totalAmount) - currentBillPaid;

        res.status(201).json({ 
            message: "POS Order Processed", 
            order: finalOrder,
            dueSummary: {
                previousDue,
                settledFromOld,
                currentBillDue,
                netOutstanding: previousDue - settledFromOld + currentBillDue
            }
        });



        // 🔔 Alert Packer if assigned
        if (packerId && !suspend) {
            getIo().to(packerId).emit("OP_NEW_ORDER", { 
                id: (result as any).id, 
                status: "CONFIRMED",
                type: "PACKING"
            });
        }

        // ── WhatsApp Notification Dispatch ────────────────────────────────
        if (customerId && !suspend) {
            try {
                const user = await prisma.user.findUnique({ where: { id: customerId }, select: { name: true, phone: true } });
                if (user?.phone) {
                    const orderId = (result as any).id;
                    const totalAmount = Number((result as any).totalAmount);
                    const paymentMode = paymentMethod === "CASH" ? "CASH" : (paymentMethod === "CREDIT" ? "DUE ON ACCOUNT" : "DIGITAL PAY");
                    const isPaid = (result as any).isPaid || (result as any).paymentStatus === "COMPLETED" || (result as any).paymentStatus === "PAID";

                    const { sendInvoicePaidViaWhatsapp, sendInvoiceDueViaWhatsapp } = require("../services/mbgcard");
                    
                    if (isPaid) {
                        sendInvoicePaidViaWhatsapp(user.phone, user.name || "Customer", orderId, totalAmount, paymentMode, orderId).catch((err: any) => {
                            console.error("[POSController] WhatsApp Invoice Paid dispatch failure:", err);
                        });
                    } else {
                        const dueAmount = totalAmount;
                        sendInvoiceDueViaWhatsapp(user.phone, user.name || "Customer", orderId, totalAmount, paymentMode, dueAmount, customerId, orderId).catch((err: any) => {
                            console.error("[POSController] WhatsApp Invoice Due dispatch failure:", err);
                        });
                    }
                }
            } catch (err) {
                console.error("[POSController] Failed to send WhatsApp:", err);
            }
        }
    } catch (error: any) {
        if (error.message?.includes("stock")) {
            return res.status(409).json({ message: error.message });
        }
        next(error);
    }
};

export const getStoreProducts = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    let locationId = req.user?.locationId;
    
    if (!locationId && (req.user?.role === "ADMIN")) {
        const firstStore = await prisma.location.findFirst();
        locationId = firstStore?.id;
    }

    if (!locationId) return next(new AppError("Store context required.", 400));

    const { search } = req.query;

    try {
        let productIds: string[] | null = null;
        if (search) {
            const searchResults = await SearchService.getInstance().search(search as string, {
                locationId: locationId,
                isActive: true,
                limit: 50
            });
            productIds = searchResults.hits.map((h: any) => h.id);
            if (!productIds || productIds.length === 0) return res.json([]);
        }

        const products = await prisma.product.findMany({
            where: {
                isActive: true,
                inventory: { some: { locationId } },
                ...(productIds ? { id: { in: productIds } } : {})
            },
            select: {
                id: true,
                name: true,
                sku: true,
                slug: true,
                description: true,
                images: true,
                weightUnit: true,
                categoryId: true,
                inventory: { where: { locationId } },
                variants: {
                    include: {
                        pricing: { where: { channel: Channel.WEB, isActive: true } }
                    }
                },
                pricing: { where: { channel: Channel.WEB, isActive: true } }
            }
        });
        res.json(products);
    } catch (error) { next(error); }
};

export const getCustomerHistory = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const customerId = req.params.customerId as string;
    try {
        const orders = await prisma.order.findMany({
            where: { userId: customerId, channel: "POS" as Channel },
            include: {
                items: { include: { product: { select: { name: true, sku: true } } } },
                payments: true,
                staff: { select: { name: true } },
                location: { select: { name: true } }
            },
            orderBy: { createdAt: "desc" },
            take: 50
        });

        // 🛡️ ACCURATE DUE: amount - SUM(payments) where paymentStatus != COMPLETED
        const dueOrders = orders.filter(o => o.paymentStatus !== "COMPLETED" && o.status !== "CANCELLED" && o.status !== "FAILED" && o.status !== "PAYMENT_PENDING");
        const totalDue = dueOrders.reduce((acc, o) => {
            const paid = o.payments.reduce((pAcc, p) => pAcc + Number(p.amount), 0);
            return acc + (Number(o.totalAmount) - paid);
        }, 0);
        
        const totalSpend = orders.filter(o => o.status !== "CANCELLED" && o.status !== "FAILED" && o.status !== "PAYMENT_PENDING").reduce((acc, o) => acc + Number(o.totalAmount), 0);
        const lastVisit = orders[0]?.createdAt || null;

        res.json({
            orders,
            summary: { totalOrders: orders.length, totalSpend, totalDue, lastVisit }
        });
    } catch (error) { next(error); }
};

export const cancelPOSOrder = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const orderId = req.params.orderId as string;
    const { reason, refundMode } = req.body;
    const staffId = req.user?.userId;

    if (!staffId) return next(new AppError("Unauthorized", 401));

    try {
        const order = await (prisma.order.findUnique as any)({
            where: { id: orderId },
            include: { items: true }
        }) as any;

        if (!order) return next(new AppError("Order not found", 404));

        const daysSinceOrder = (Date.now() - order.createdAt.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceOrder > 7) return next(new AppError("Cancellation window expired.", 400));
        if (order.status === "CANCELLED") return next(new AppError("Order is already cancelled", 400));

        await (prisma as any).$transaction(async (tx: any) => {
            await InventoryService.restoreStock({
                items: order.items.map((i: any) => ({
                    productId: i.productId,
                    variantId: i.variantId,
                    quantity: i.quantity
                })),
                locationId: order.locationId || "MAIN_WAREHOUSE",
                staffId,
                referenceId: `POS_CANCEL_${order.id}`
            }, tx);

            await tx.order.update({
                where: { id: orderId },
                data: {
                    status: "CANCELLED" as OrderStatus,
                    statusHistory: {
                        create: { status: "CANCELLED" as OrderStatus, remark: `POS Cancellation: ${reason}.`, changedBy: staffId }
                    }
                }
            });
        });

        res.json({ message: "Order cancelled." });
    } catch (error) { next(error); }
};

export const getStoreConfig = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    let locationId = req.user?.locationId;
    const isGlobal = req.user?.role === "ADMIN" || req.user?.role === "SUPER_ADMIN";

    if (!locationId && isGlobal) {
        const loc = await prisma.location.findFirst();
        locationId = loc?.id;
    }
    
    if (!locationId) {
        return next(new AppError(`No store context assigned to user ${req.user?.userId}. Please link this account to a Regional Hub.`, 400));
    }
    try {
        const location = await prisma.location.findUnique({ where: { id: locationId } });
        res.json(location);
    } catch (error) { next(error); }
};

export const collectDuePayment = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const orderId = req.params.orderId as string;
    const { amount, method } = req.body;
    const staffId = req.user?.userId;

    if (!staffId) return next(new AppError("Unauthorized", 401));

    try {
        const order = await prisma.order.findUnique({ where: { id: orderId }, include: { payments: true } });
        if (!order) return next(new AppError("Order not found", 404));

        const paidAlready = order.payments.reduce((acc, p) => acc + Number(p.amount), 0);
        const payingNow = Number(amount || (Number(order.totalAmount) - paidAlready));
        const totalPaid = paidAlready + payingNow;
        const isFull = totalPaid >= Number(order.totalAmount);

        await prisma.$transaction(async (tx) => {
            await tx.payment.create({
                data: {
                    orderId,
                    amount: new Prisma.Decimal(payingNow),
                    method: method || "CASH",
                    status: "SUCCESS",
                    transactionId: `DUE_COLLECT_${Date.now()}`
                }
            });

            await tx.order.update({
                where: { id: orderId },
                data: {
                    isPaid: isFull,
                    paymentStatus: isFull ? "COMPLETED" : "PARTIAL",
                    statusHistory: {
                        create: {
                            status: order.status,
                            remark: `Due payment collected: ₹${payingNow} via ${method || "CASH"}. Total Paid: ₹${totalPaid}`,
                            changedBy: staffId
                        }
                    }
                }
            });
        });

        res.json({ message: "Payment recorded successfully", isFull });
    } catch (error) { next(error); }
};

export const settleAccountBalance = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const { customerId } = req.params;
    const { amount, method, transactionId, denominations } = req.body;
    const staffId = req.user?.userId;
    const locationId = req.user?.locationId;

    if (!staffId) return next(new AppError("Unauthorized", 401));

    try {
        let remaining = Number(amount);
        const result = await prisma.$transaction(async (tx) => {
            const unpaid = await (tx as any).order.findMany({
                where: { 
                    userId: customerId, 
                    channel: Channel.POS,
                    paymentStatus: { in: ["PENDING", "PARTIAL"] }, 
                    status: { notIn: ["CANCELLED", "FAILED", "PAYMENT_PENDING"] } 
                },
                orderBy: { createdAt: "asc" },
                include: { payments: true }
            }) as any[];

            let firstPaymentSaved = false;

            for (const order of unpaid) {
                if (remaining <= 0) break;
                const paid = (order.payments as any[]).reduce((acc: number, p: any) => acc + Number(p.amount), 0);
                const due = Number(order.totalAmount) - paid;
                const toApply = Math.min(remaining, due);

                if (toApply > 0) {
                    await tx.payment.create({
                        data: {
                            orderId: order.id,
                            amount: new Prisma.Decimal(toApply),
                            method: method || "CASH",
                            status: "SUCCESS",
                            transactionId: transactionId || `SETTLE_${Date.now()}`,
                            denominations: (!firstPaymentSaved && method === "CASH") ? (denominations || null) : null
                        }
                    });
                    firstPaymentSaved = true;
                    const isFull = (paid + toApply) >= Number(order.totalAmount);
                    await tx.order.update({ where: { id: order.id }, data: { isPaid: isFull, paymentStatus: isFull ? "COMPLETED" : "PARTIAL" } });
                    remaining -= toApply;
                }
            }

            if (method === "CASH" && denominations && locationId) {
                const activeShift = await tx.cashierShift.findFirst({
                    where: { locationId, status: "OPEN" }
                });
                if (activeShift) {
                    const shiftDenominations = activeShift.currentDenominations 
                        ? (typeof activeShift.currentDenominations === "string" 
                            ? JSON.parse(activeShift.currentDenominations) 
                            : activeShift.currentDenominations as Record<string, number>)
                        : {} as Record<string, number>;
                    
                    const received = denominations.received || {};
                    const change = denominations.change || {};
                    
                    const denominationsKeys = ["500", "200", "100", "50", "20", "10", "5", "2", "1"];
                    const updatedDenominations: Record<string, number> = {};
                    for (const key of denominationsKeys) {
                        const currentCount = Number(shiftDenominations[key] || 0);
                        const receivedCount = Number(received[key] || 0);
                        const changeCount = Number(change[key] || 0);
                        updatedDenominations[key] = Math.max(0, currentCount + receivedCount - changeCount);
                    }
                    
                    await tx.cashierShift.update({
                        where: { id: activeShift.id },
                        data: {
                            currentDenominations: updatedDenominations
                        }
                    });
                }
            }

            return { settled: Number(amount) - remaining };
        });
        res.json(result);
    } catch (error) { next(error); }
};
