"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPaymentEligibility = exports.calculateUserTrustScore = void 0;
const prisma_1 = __importDefault(require("../config/prisma"));
/**
 * Calculates the trust score (0 - 100) of a customer.
 * Trust Score = round((Delivered / (Delivered + Cancelled/Failed/Returned)) * 100)
 */
const calculateUserTrustScore = (prismaInstance, userId) => __awaiter(void 0, void 0, void 0, function* () {
    const orders = yield prismaInstance.order.findMany({
        where: { userId },
        select: { status: true }
    });
    const totalCount = orders.length;
    if (totalCount === 0)
        return 100; // Perfect score for new users
    const deliveredCount = orders.filter((o) => o.status === "DELIVERED").length;
    const negativeCount = orders.filter((o) => ["CANCELLED", "FAILED", "RETURNED"].includes(o.status)).length;
    if (deliveredCount + negativeCount === 0)
        return 100;
    const score = Math.round((deliveredCount / (deliveredCount + negativeCount)) * 100);
    return Math.max(0, Math.min(100, score));
});
exports.calculateUserTrustScore = calculateUserTrustScore;
/**
 * Computes dynamic payment eligibility for a customer placing a new order.
 * Follows the 4-step sequence rules based on successful orders since the last reset:
 * - 1st order: Full online
 * - 2nd order: Partial COD (advance = max(40, 10%))
 * - 3rd order: Partial COD (advance = max(20, 5%))
 * - 4th order+: Full COD
 */
const getPaymentEligibility = (userId, totalAmount) => __awaiter(void 0, void 0, void 0, function* () {
    const pastOrders = yield prisma_1.default.order.findMany({
        where: { userId },
        orderBy: { createdAt: "asc" }
    });
    let successfulCountSinceReset = 0;
    for (const order of pastOrders) {
        const isFailedOrCancelled = ["CANCELLED", "FAILED", "RETURNED"].includes(order.status);
        if (isFailedOrCancelled) {
            successfulCountSinceReset = 0;
        }
        else if (order.status === "DELIVERED") {
            successfulCountSinceReset += 1;
        }
    }
    const nextOrderIndex = successfulCountSinceReset;
    let codAllowed = false;
    let advanceAmount = 0;
    let codAmount = 0;
    const reasons = [];
    if (nextOrderIndex === 0) {
        codAllowed = false;
        advanceAmount = totalAmount;
        codAmount = 0;
        reasons.push("Online payment is required for your 1st order.");
    }
    else if (nextOrderIndex === 1) {
        codAllowed = true;
        const requiredAdvance = Math.max(40, Number((totalAmount * 0.1).toFixed(2)));
        if (totalAmount <= requiredAdvance) {
            advanceAmount = totalAmount;
            codAmount = 0;
            reasons.push(`Order value is less than the required advance amount of ₹${requiredAdvance}.`);
        }
        else {
            advanceAmount = requiredAdvance;
            codAmount = Number((totalAmount - requiredAdvance).toFixed(2));
        }
    }
    else if (nextOrderIndex === 2) {
        codAllowed = true;
        const requiredAdvance = Math.max(20, Number((totalAmount * 0.05).toFixed(2)));
        if (totalAmount <= requiredAdvance) {
            advanceAmount = totalAmount;
            codAmount = 0;
            reasons.push(`Order value is less than the required advance amount of ₹${requiredAdvance}.`);
        }
        else {
            advanceAmount = requiredAdvance;
            codAmount = Number((totalAmount - requiredAdvance).toFixed(2));
        }
    }
    else {
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
});
exports.getPaymentEligibility = getPaymentEligibility;
