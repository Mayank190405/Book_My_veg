"use strict";
/**
 * Auto-Cancel Queue
 * Schedules order cancellation + inventory restore after 12 minutes
 * if payment is still PENDING (i.e. user abandoned the payment flow).
 *
 * Usage: call scheduleOrderAutoCancel(orderId) immediately after creating
 * a PAYMENT_PENDING order.
 */
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
exports.autoCancelQueue = void 0;
exports.scheduleOrderAutoCancel = scheduleOrderAutoCancel;
const bull_1 = __importDefault(require("bull"));
const prisma_1 = __importDefault(require("../config/prisma"));
const logger_1 = __importDefault(require("../utils/logger"));
const inventoryService_1 = require("../services/inventoryService");
// ── Queue definition ──────────────────────────────────────────────────────────
exports.autoCancelQueue = new bull_1.default("order-auto-cancel", {
    redis: {
        host: process.env.REDIS_HOST || "localhost",
        port: Number(process.env.REDIS_PORT) || 6379,
    },
});
const AUTO_CANCEL_DELAY_MS = 12 * 60 * 1000; // 12 minutes
// ── Schedule ──────────────────────────────────────────────────────────────────
function scheduleOrderAutoCancel(orderId) {
    return __awaiter(this, void 0, void 0, function* () {
        yield exports.autoCancelQueue.add({ orderId }, {
            delay: AUTO_CANCEL_DELAY_MS,
            attempts: 3,
            backoff: { type: "fixed", delay: 5000 },
            jobId: `auto-cancel:${orderId}`, // deduplicate retries
            removeOnComplete: true,
            removeOnFail: false,
        });
        logger_1.default.info("Auto-cancel scheduled", { orderId, delayMs: AUTO_CANCEL_DELAY_MS });
    });
}
// ── Worker ────────────────────────────────────────────────────────────────────
exports.autoCancelQueue.process((job) => __awaiter(void 0, void 0, void 0, function* () {
    const { orderId } = job.data;
    logger_1.default.info("Auto-cancel job triggered", { orderId });
    const order = yield prisma_1.default.order.findUnique({
        where: { id: orderId },
        include: { items: true, payments: true },
    });
    if (!order) {
        logger_1.default.warn("Auto-cancel: order not found", { orderId });
        return;
    }
    // Only cancel if still unpaid
    if (order.paymentStatus !== "PENDING") {
        logger_1.default.info("Auto-cancel skipped — already paid/failed", {
            orderId,
            paymentStatus: order.paymentStatus,
        });
        return;
    }
    const isCod = order.payments.some((p) => p.method === "COD");
    if (isCod) {
        logger_1.default.info("Auto-cancel skipped — COD order", { orderId });
        return;
    }
    yield prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
        var _a;
        // Mark order FAILED
        yield tx.order.update({
            where: { id: orderId },
            data: {
                status: "FAILED",
                paymentStatus: "FAILED",
            },
        });
        // Record status history
        yield tx.orderStatusHistory.create({
            data: {
                orderId,
                status: "FAILED",
                remark: "Auto-cancelled: payment not received within 12 minutes",
                changedBy: "SYSTEM",
            },
        });
        // Restore inventory via locked wrapper
        const locationId = (_a = order.shippingAddress) === null || _a === void 0 ? void 0 : _a.locationId;
        if (locationId) {
            yield inventoryService_1.InventoryService.restoreStock({
                items: order.items.map(i => ({ productId: i.productId, variantId: i.variantId || undefined, quantity: i.quantity })),
                locationId,
                staffId: "SYSTEM",
                referenceId: `AUTO_CANCEL_${orderId}`
            }, tx);
        }
    }));
    logger_1.default.info("Auto-cancel complete — stock restored", {
        orderId,
        itemCount: order.items.length,
    });
}));
// ── Queue-level error logging ─────────────────────────────────────────────────
exports.autoCancelQueue.on("failed", (job, err) => {
    logger_1.default.error("Auto-cancel job failed", { jobId: job.id, orderId: job.data.orderId, err: err.message });
});
exports.autoCancelQueue.on("error", (err) => {
    logger_1.default.error("Auto-cancel queue error", { err: err.message });
});
