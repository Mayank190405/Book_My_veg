"use strict";
/**
 * Book My Veg — Primary Notification Service
 * Unified entry point for all business events and communication triggers.
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
exports.NotificationService = void 0;
const notification_dispatcher_service_1 = require("./notification-dispatcher.service");
const template_mapper_1 = require("../templates/template-mapper");
const recipient_service_1 = require("./recipient.service");
const logger_1 = __importDefault(require("../../../utils/logger"));
class NotificationService {
    constructor() {
        this.dispatcher = notification_dispatcher_service_1.NotificationDispatcherService.getInstance();
    }
    static getInstance() {
        if (!NotificationService.instance) {
            NotificationService.instance = new NotificationService();
        }
        return NotificationService.instance;
    }
    /**
     * Dispatches OTP via WhatsApp authentication template 'login'.
     */
    sendOtp(phone_1, otp_1) {
        return __awaiter(this, arguments, void 0, function* (phone, otp, purpose = "AUTH", referenceId) {
            const cleanPhone = recipient_service_1.RecipientService.sanitizePhone(phone);
            const mapped = template_mapper_1.TemplateMapper.mapOtp(otp);
            const typeMap = {
                AUTH: "AUTH_OTP",
                DELIVERY: "DELIVERY_OTP",
                CASH_COLLECTION: "CASH_COLLECTION_OTP"
            };
            return yield this.dispatcher.dispatch({
                idempotencyKey: `otp:${cleanPhone}:${purpose}:${referenceId || Date.now()}`,
                notificationType: typeMap[purpose] || "AUTH_OTP",
                channel: "WHATSAPP",
                recipientPhone: cleanPhone,
                referenceId,
                templateName: mapped.templateName,
                variables: mapped.variables,
                triggerSource: `OTP_${purpose}`
            });
        });
    }
    /**
     * Dispatches order confirmation notification.
     */
    notifyOrderConfirmed(event) {
        return __awaiter(this, void 0, void 0, function* () {
            const cleanPhone = recipient_service_1.RecipientService.sanitizePhone(event.customerPhone);
            const mapped = template_mapper_1.TemplateMapper.mapOrderConfirmed(event.customerName, event.orderId);
            return yield this.dispatcher.dispatch({
                idempotencyKey: `ord_conf:${event.orderId}`,
                notificationType: "ORDER_CONFIRMATION",
                channel: "WHATSAPP",
                recipientPhone: cleanPhone,
                recipientName: event.customerName,
                recipientId: event.userId,
                referenceId: event.orderId,
                templateName: mapped.templateName,
                variables: mapped.variables,
                triggerSource: "ORDER_PLACEMENT"
            });
        });
    }
    /**
     * Dispatches order status update notification.
     */
    notifyOrderStatusUpdated(event) {
        return __awaiter(this, void 0, void 0, function* () {
            const cleanPhone = recipient_service_1.RecipientService.sanitizePhone(event.customerPhone);
            const mapped = template_mapper_1.TemplateMapper.mapOrderStatus(event.customerName, event.orderId, event.status);
            const normStatus = (event.status || "").toUpperCase();
            const notificationType = (normStatus === "OUT_FOR_DELIVERY" || normStatus === "SHIPPED")
                ? "ORDER_OUT_FOR_DELIVERY"
                : "ORDER_STATUS_UPDATE";
            return yield this.dispatcher.dispatch({
                idempotencyKey: `ord_status:${event.orderId}:${event.status}`,
                notificationType,
                channel: "WHATSAPP",
                recipientPhone: cleanPhone,
                recipientName: event.customerName,
                recipientId: event.userId,
                referenceId: event.orderId,
                templateName: mapped.templateName,
                variables: mapped.variables,
                triggerSource: "STATUS_UPDATE",
                actorId: event.actorId
            });
        });
    }
    /**
     * Dispatches bill creation notification (Paid vs. Due).
     */
    notifyBillCreated(event) {
        return __awaiter(this, void 0, void 0, function* () {
            const cleanPhone = recipient_service_1.RecipientService.sanitizePhone(event.customerPhone);
            const mapped = event.isPaid
                ? template_mapper_1.TemplateMapper.mapBillCreatedPaid(event.customerName, event.orderId, event.totalAmount, event.paymentMode, event.orderId)
                : template_mapper_1.TemplateMapper.mapBillCreatedDue(event.customerName, event.orderId, event.totalAmount, event.dueAmount, event.paymentMode, event.userId || "", event.orderId, cleanPhone);
            return yield this.dispatcher.dispatch({
                idempotencyKey: `bill_create:${event.orderId}:${event.isPaid ? "PAID" : "DUE"}`,
                notificationType: event.isPaid ? "BILL_CREATED_PAID" : "BILL_CREATED_DUE",
                channel: "WHATSAPP",
                recipientPhone: cleanPhone,
                recipientName: event.customerName,
                recipientId: event.userId,
                referenceId: event.orderId,
                templateName: mapped.templateName,
                variables: mapped.variables,
                triggerSource: "BILL_CREATION",
                actorId: event.actorId,
                locationId: event.locationId
            });
        });
    }
    /**
     * Dispatches bill / order cancellation notification.
     */
    notifyBillCancelled(event) {
        return __awaiter(this, void 0, void 0, function* () {
            const cleanPhone = recipient_service_1.RecipientService.sanitizePhone(event.customerPhone);
            const mapped = template_mapper_1.TemplateMapper.mapBillCancelled(event.customerName, event.orderId, event.reason);
            return yield this.dispatcher.dispatch({
                idempotencyKey: `bill_cancel:${event.orderId}`,
                notificationType: "BILL_CANCELLED",
                channel: "WHATSAPP",
                recipientPhone: cleanPhone,
                recipientName: event.customerName,
                recipientId: event.userId,
                referenceId: event.orderId,
                templateName: mapped.templateName,
                variables: mapped.variables,
                triggerSource: "BILL_CANCELLATION",
                actorId: event.actorId
            });
        });
    }
    /**
     * Dispatches payment received confirmation.
     */
    notifyPaymentReceived(event) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d;
            const cleanPhone = recipient_service_1.RecipientService.sanitizePhone(event.customerPhone);
            const paidAmount = (_b = (_a = event.paidAmount) !== null && _a !== void 0 ? _a : event.amount) !== null && _b !== void 0 ? _b : 0;
            const paymentMode = (_d = (_c = event.paymentMode) !== null && _c !== void 0 ? _c : event.paymentMethod) !== null && _d !== void 0 ? _d : "ONLINE";
            const mapped = template_mapper_1.TemplateMapper.mapPaymentReceived(event.customerName, event.orderId, paidAmount, paymentMode, event.orderId);
            return yield this.dispatcher.dispatch({
                idempotencyKey: `pay_rcv:${event.orderId}:${event.transactionId || event.paidAmount}`,
                notificationType: "PAYMENT_RECEIVED",
                channel: "WHATSAPP",
                recipientPhone: cleanPhone,
                recipientName: event.customerName,
                recipientId: event.userId,
                referenceId: event.orderId,
                templateName: mapped.templateName,
                variables: mapped.variables,
                triggerSource: "PAYMENT_SETTLEMENT"
            });
        });
    }
    /**
     * Dispatches purchase order to vendor WhatsApp (uses approved utility template).
     */
    notifyPurchaseOrder(event) {
        return __awaiter(this, void 0, void 0, function* () {
            const cleanPhone = recipient_service_1.RecipientService.sanitizePhone(event.vendorPhone);
            // Map PO details into approved utility template 'bill_created' to ensure compliance with strict utility policy
            const variables = [
                event.vendorName || "Vendor",
                event.poNumber,
                String(event.totalAmount),
                `PO Issued (${event.itemCount} items) - Deliver to ${event.storeName}`,
                event.poLink
            ];
            return yield this.dispatcher.dispatch({
                idempotencyKey: `po_dispatch:${event.poId}`,
                notificationType: "PURCHASE_ORDER",
                channel: "WHATSAPP",
                recipientPhone: cleanPhone,
                recipientName: event.vendorName,
                referenceId: event.poId,
                templateName: "bill_created",
                variables: { body: variables },
                triggerSource: "PO_DISPATCH",
                actorId: event.actorId
            });
        });
    }
    /**
     * Dispatches feedback request notification for completed orders.
     */
    notifyFeedbackRequest(phone, customerName, orderId) {
        return __awaiter(this, void 0, void 0, function* () {
            const cleanPhone = recipient_service_1.RecipientService.sanitizePhone(phone);
            const mapped = template_mapper_1.TemplateMapper.mapFeedbackRequest(customerName, orderId);
            return yield this.dispatcher.dispatch({
                idempotencyKey: `feedback:${orderId}`,
                notificationType: "FEEDBACK_REQUEST",
                channel: "WHATSAPP",
                recipientPhone: cleanPhone,
                recipientName: customerName,
                referenceId: orderId,
                templateName: mapped.templateName,
                variables: mapped.variables,
                triggerSource: "FEEDBACK_DISPATCH"
            });
        });
    }
    /**
     * Triggers an interactive chatbot flow via ChatHub provider with full audit log.
     */
    sendChatHubFlow(phone, flowId, name, customFields, actorId) {
        return __awaiter(this, void 0, void 0, function* () {
            const cleanPhone = recipient_service_1.RecipientService.sanitizePhone(phone);
            const provider = this.dispatcher.getProvider();
            if (!provider.sendFlow) {
                return {
                    success: false,
                    status: "FAILED",
                    error: "Flow sending is not supported by current provider."
                };
            }
            try {
                return yield provider.sendFlow(cleanPhone, flowId, name, customFields);
            }
            catch (err) {
                logger_1.default.error(`[NotificationService] Error executing ChatHub flow for ${cleanPhone}:`, err);
                return {
                    success: false,
                    status: "FAILED",
                    error: err.message
                };
            }
        });
    }
}
exports.NotificationService = NotificationService;
