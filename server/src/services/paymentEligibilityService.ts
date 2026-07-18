import prisma from "../config/prisma";

export interface PaymentEligibility {
    codAllowed: boolean;
    reasons: string[];
    onlineAllowed: boolean;
    nextOrderIndex: number; // 0 for 1st order, 1 for 2nd, etc.
    advanceAmount: number;
    codAmount: number;
}

/**
 * Calculates the trust score (0 - 100) of a customer.
 * Trust Score = round((Delivered / (Delivered + Cancelled/Failed/Returned)) * 100)
 */
export const calculateUserTrustScore = async (
    prismaInstance: any,
    userId: string
): Promise<number> => {
    const orders = await prismaInstance.order.findMany({
        where: { userId },
        select: { status: true }
    });

    const totalCount = orders.length;
    if (totalCount === 0) return 100; // Perfect score for new users

    const deliveredCount = orders.filter((o: any) => o.status === "DELIVERED").length;
    const negativeCount = orders.filter((o: any) => ["CANCELLED", "FAILED", "RETURNED"].includes(o.status)).length;

    if (deliveredCount + negativeCount === 0) return 100;

    const score = Math.round((deliveredCount / (deliveredCount + negativeCount)) * 100);
    return Math.max(0, Math.min(100, score));
};

/**
 * Computes dynamic payment eligibility for a customer placing a new order.
 * Follows the 4-step sequence rules based on successful orders since the last reset:
 * - 1st order: Full online
 * - 2nd order: Partial COD (advance = max(40, 10%))
 * - 3rd order: Partial COD (advance = max(20, 5%))
 * - 4th order+: Full COD
 */
export const getPaymentEligibility = async (
    userId: string,
    totalAmount: number
): Promise<PaymentEligibility> => {
    const pastOrders = await prisma.order.findMany({
        where: { userId },
        orderBy: { createdAt: "asc" }
    });

    let successfulCountSinceReset = 0;

    for (const order of pastOrders) {
        const isFailedOrCancelled = ["CANCELLED", "FAILED", "RETURNED"].includes(order.status);
        if (isFailedOrCancelled) {
            successfulCountSinceReset = 0;
        } else if (order.status === "DELIVERED") {
            successfulCountSinceReset += 1;
        }
    }

    const nextOrderIndex = successfulCountSinceReset;

    let codAllowed = false;
    let advanceAmount = 0;
    let codAmount = 0;
    const reasons: string[] = [];

    if (nextOrderIndex === 0) {
        codAllowed = false;
        advanceAmount = totalAmount;
        codAmount = 0;
        reasons.push("Online payment is required for your 1st order.");
    } else if (nextOrderIndex === 1) {
        codAllowed = true;
        const requiredAdvance = Math.max(40, Number((totalAmount * 0.1).toFixed(2)));
        if (totalAmount <= requiredAdvance) {
            advanceAmount = totalAmount;
            codAmount = 0;
            reasons.push(`Order value is less than the required advance amount of ₹${requiredAdvance}.`);
        } else {
            advanceAmount = requiredAdvance;
            codAmount = Number((totalAmount - requiredAdvance).toFixed(2));
        }
    } else if (nextOrderIndex === 2) {
        codAllowed = true;
        const requiredAdvance = Math.max(20, Number((totalAmount * 0.05).toFixed(2)));
        if (totalAmount <= requiredAdvance) {
            advanceAmount = totalAmount;
            codAmount = 0;
            reasons.push(`Order value is less than the required advance amount of ₹${requiredAdvance}.`);
        } else {
            advanceAmount = requiredAdvance;
            codAmount = Number((totalAmount - requiredAdvance).toFixed(2));
        }
    } else {
        codAllowed = true;
        advanceAmount = 0;
        codAmount = totalAmount;
    }

    return {
        codAllowed,
        reasons,
        onlineAllowed: true,
        nextOrderIndex,
        advanceAmount,
        codAmount
    };
};
