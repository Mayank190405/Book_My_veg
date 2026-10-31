"use strict";
/**
 * Book My Veg — Canonical Payment Reminder Service
 * Enforces universal 24-hour reminder cooldown, atomic mutex claims, and durable audit logs.
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
exports.ReminderService = void 0;
const prisma_1 = __importDefault(require("../../../config/prisma"));
const dueCalculationService_1 = require("../../../services/dueCalculationService");
const notification_repository_1 = require("../infrastructure/repositories/notification.repository");
const notification_dispatcher_service_1 = require("./notification-dispatcher.service");
const template_mapper_1 = require("../templates/template-mapper");
const recipient_service_1 = require("./recipient.service");
const logger_1 = __importDefault(require("../../../utils/logger"));
class ReminderService {
    constructor() {
        this.repository = notification_repository_1.NotificationRepository.getInstance();
        this.dispatcher = notification_dispatcher_service_1.NotificationDispatcherService.getInstance();
    }
    static getInstance() {
        if (!ReminderService.instance) {
            ReminderService.instance = new ReminderService();
        }
        return ReminderService.instance;
    }
    /**
     * Sends payment-due reminders with strict universal 24-hour cooldown and atomic claims.
     * Works identically whether customerIds has 1 customer or 100 customers.
     */
    sendDueReminders(options) {
        return __awaiter(this, void 0, void 0, function* () {
            const { customerIds, locationId, actorId, triggerSource = "POS_MANUAL" } = options;
            const origin = process.env.CLIENT_URL || "https://bookmyveg.co.in";
            const orders = yield prisma_1.default.order.findMany({
                where: (0, dueCalculationService_1.getEligibleOrdersWhereClause)({ customerIds, locationId }),
                include: { user: true, payments: true },
                orderBy: { createdAt: "desc" }
            });
            const customerOrdersMap = {};
            for (const order of orders) {
                if (!order.user || !order.user.phone)
                    continue;
                const uId = order.user.id;
                if (!customerOrdersMap[uId]) {
                    customerOrdersMap[uId] = { user: order.user, orders: [] };
                }
                customerOrdersMap[uId].orders.push(order);
            }
            const summary = {
                totalAttempted: Object.keys(customerOrdersMap).length,
                sentCount: 0,
                skippedCount: 0,
                failedCount: 0,
                results: []
            };
            for (const entry of Object.values(customerOrdersMap)) {
                const dues = (0, dueCalculationService_1.calculateCustomerDues)(entry.orders);
                if (dues.eligibleOrdersCount <= 0 || dues.totalDue <= 0) {
                    continue;
                }
                const customer = entry.user;
                const cleanPhone = recipient_service_1.RecipientService.sanitizePhone(customer.phone);
                const totalDue = dues.totalDue;
                const orderCount = dues.eligibleOrdersCount;
                const latestOrderId = dues.eligibleOrders[0].id;
                const includedOrderIds = dues.eligibleOrders.map((o) => o.id);
                const invoiceLabel = orderCount > 1
                    ? `All Dues (${orderCount} Bills)`
                    : latestOrderId;
                // 1. UNIVERSAL COOLDOWN & ATOMIC MUTEX CLAIM (Applied to EVERY send, single or bulk)
                const claimResult = yield this.repository.claimCustomerReminder(customer.id, {
                    totalDue,
                    orderCount,
                    invoiceLabel,
                    trigger: triggerSource,
                    actorId
                });
                if (!claimResult.claimed) {
                    const isCooldown = claimResult.reason === "COOLDOWN_ACTIVE";
                    const reasonText = isCooldown
                        ? `Reminder sent within last 24h. Remaining cooldown: ${Math.round((claimResult.cooldownRemainingMs || 0) / 60000)} mins.`
                        : "Concurrent reminder claim in progress. Skipped to prevent duplicate send.";
                    logger_1.default.info(`[ReminderService] Skipped customer ${cleanPhone} (${customer.name}): ${reasonText}`);
                    summary.skippedCount++;
                    summary.results.push({
                        customerId: customer.id,
                        customerName: customer.name || "Customer",
                        phone: cleanPhone,
                        totalDue,
                        status: isCooldown ? "SKIPPED_COOLDOWN" : "CLAIM_CONFLICT",
                        reason: reasonText
                    });
                    continue;
                }
                const claimId = claimResult.claimId;
                // 2. Prepare Meta-approved template variables
                let payLink = `${origin}/pay?number=${cleanPhone.replace(/\D/g, "")}`;
                if (customer.id)
                    payLink += `&userid=${customer.id}`;
                const templateData = template_mapper_1.TemplateMapper.mapPaymentReminder(customer.name || "Customer", invoiceLabel, totalDue, payLink);
                // 3. Dispatch through notification dispatcher
                try {
                    const sendResult = yield this.dispatcher.dispatch({
                        idempotencyKey: `remind:${customer.id}:${claimId}`,
                        notificationType: "PAYMENT_REMINDER",
                        channel: "WHATSAPP",
                        recipientPhone: cleanPhone,
                        recipientName: customer.name || "Customer",
                        recipientId: customer.id,
                        referenceId: latestOrderId,
                        templateName: templateData.templateName,
                        variables: templateData.variables,
                        triggerSource,
                        actorId,
                        locationId,
                        metadata: {
                            totalDue,
                            orderCount,
                            includedOrderIds,
                            invoiceLabel,
                            payLink
                        }
                    });
                    // 4. Finalize atomic claim
                    yield this.repository.finalizeCustomerReminderClaim(customer.id, claimId, {
                        success: sendResult.success,
                        providerStatus: sendResult.status,
                        providerMessageId: sendResult.providerMessageId,
                        totalDue,
                        orderCount,
                        invoiceLabel,
                        includedOrderIds,
                        trigger: triggerSource,
                        actorId,
                        locationId,
                        error: sendResult.error
                    });
                    if (sendResult.success) {
                        summary.sentCount++;
                        summary.results.push({
                            customerId: customer.id,
                            customerName: customer.name || "Customer",
                            phone: cleanPhone,
                            totalDue,
                            status: "SENT"
                        });
                    }
                    else {
                        summary.failedCount++;
                        summary.results.push({
                            customerId: customer.id,
                            customerName: customer.name || "Customer",
                            phone: cleanPhone,
                            totalDue,
                            status: "FAILED",
                            reason: sendResult.error
                        });
                    }
                }
                catch (dispatchErr) {
                    logger_1.default.error(`[ReminderService] Error sending reminder to ${cleanPhone}:`, dispatchErr);
                    yield this.repository.finalizeCustomerReminderClaim(customer.id, claimId, {
                        success: false,
                        totalDue,
                        orderCount,
                        invoiceLabel,
                        error: dispatchErr.message
                    });
                    summary.failedCount++;
                    summary.results.push({
                        customerId: customer.id,
                        customerName: customer.name || "Customer",
                        phone: cleanPhone,
                        totalDue,
                        status: "FAILED",
                        reason: dispatchErr.message
                    });
                }
            }
            return summary;
        });
    }
    /**
     * Sends payment reminder for a single specific order ID (replaces paymentController.sendPaymentReminderController).
     * Enforces authentication, universal 24-hour cooldown, and atomic duplicate prevention.
     */
    sendSingleOrderReminder(orderIdOrOptions, actorIdArg, locationIdArg) {
        return __awaiter(this, void 0, void 0, function* () {
            const orderId = typeof orderIdOrOptions === "string" ? orderIdOrOptions : orderIdOrOptions.orderId;
            const actorId = typeof orderIdOrOptions === "string" ? actorIdArg : (orderIdOrOptions.actorId || actorIdArg);
            const locationId = typeof orderIdOrOptions === "string" ? locationIdArg : (orderIdOrOptions.locationId || locationIdArg);
            const order = yield prisma_1.default.order.findUnique({
                where: { id: orderId },
                include: { user: true, payments: true }
            });
            if (!order) {
                return {
                    success: false,
                    status: "FAILED",
                    error: "Order not found"
                };
            }
            const dueResult = (0, dueCalculationService_1.calculateOrderDue)(order);
            if (!dueResult.isEligible || dueResult.dueAmount <= 0) {
                return {
                    success: false,
                    status: "FAILED",
                    error: `Order is not eligible for payment reminder (${dueResult.ineligibilityReason || "Already settled"})`
                };
            }
            const user = order.user;
            if (!user || !user.phone) {
                return {
                    success: false,
                    status: "FAILED",
                    error: "Customer contact number not found on order"
                };
            }
            // Delegate to sendDueReminders with customerIds: [user.id] to guarantee exact same cooldown & claim enforcement!
            const summary = yield this.sendDueReminders({
                customerIds: [user.id],
                locationId: locationId || order.locationId || undefined,
                actorId,
                triggerSource: "ADMIN_SINGLE_ORDER"
            });
            const targetResult = summary.results[0];
            if (!targetResult) {
                return {
                    success: false,
                    status: "FAILED",
                    error: "Customer has no eligible outstanding balance."
                };
            }
            if (targetResult.status === "SENT") {
                return {
                    success: true,
                    status: "ACCEPTED_BY_PROVIDER"
                };
            }
            if (targetResult.status === "SKIPPED_COOLDOWN") {
                return {
                    success: false,
                    skipped: true,
                    status: "SKIPPED_COOLDOWN",
                    error: targetResult.reason || "Reminder already sent to this customer within 24 hours."
                };
            }
            return {
                success: false,
                status: "FAILED",
                error: targetResult.reason || "Failed to dispatch reminder."
            };
        });
    }
}
exports.ReminderService = ReminderService;
