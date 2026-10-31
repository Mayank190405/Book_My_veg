"use strict";
/**
 * DEPRECATED — Legacy messaging adapter.
 * All messaging operations have been replaced by the centralized messaging module in:
 * server/src/modules/messaging/
 *
 * Direct HTTP calls to external provider APIs have been removed from this file.
 * All calls are redirected through the validated, audited, and deduplicated pipeline.
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
exports.getMyMetaTemplates = exports.getConversation = exports.sendFeedbackRequestViaWhatsapp = exports.sendPaymentReminderViaWhatsapp = exports.sendBillCancelledViaWhatsapp = exports.sendPaymentReceivedViaWhatsapp = exports.sendInvoiceDueViaWhatsapp = exports.sendInvoicePaidViaWhatsapp = exports.sendOrderStatusUpdateViaWhatsapp = exports.sendOrderConfirmationViaWhatsapp = exports.sendTemplateViaChatHub = exports.sendFlowViaChatHub = exports.sendOtpViaWhatsapp = exports.APPROVED_UTILITY_TEMPLATES = void 0;
const messaging_1 = require("../modules/messaging");
Object.defineProperty(exports, "APPROVED_UTILITY_TEMPLATES", { enumerable: true, get: function () { return messaging_1.APPROVED_UTILITY_TEMPLATES; } });
const logger_1 = __importDefault(require("../utils/logger"));
const sendOtpViaWhatsapp = (phone, otp) => __awaiter(void 0, void 0, void 0, function* () {
    logger_1.default.warn("[DEPRECATION] sendOtpViaWhatsapp called via legacy mbgcard service. Use NotificationService instead.");
    return messaging_1.NotificationService.getInstance().sendOtp(phone, otp, "AUTH");
});
exports.sendOtpViaWhatsapp = sendOtpViaWhatsapp;
const sendFlowViaChatHub = (phone, flowId, name, customFields) => __awaiter(void 0, void 0, void 0, function* () {
    logger_1.default.warn("[DEPRECATION] sendFlowViaChatHub called via legacy mbgcard service. Use NotificationService instead.");
    return messaging_1.NotificationService.getInstance().sendChatHubFlow(phone, flowId, name, customFields);
});
exports.sendFlowViaChatHub = sendFlowViaChatHub;
const sendTemplateViaChatHub = (phone, templateName, variables, dynamicMedia) => __awaiter(void 0, void 0, void 0, function* () {
    logger_1.default.warn("[DEPRECATION] sendTemplateViaChatHub called via legacy mbgcard service. Use TemplateService instead.");
    return messaging_1.TemplateService.getInstance().sendCustomTemplate({
        phone,
        templateName,
        variables,
        dynamicMedia,
        triggerSource: "LEGACY_MBGCARD_WRAPPER"
    });
});
exports.sendTemplateViaChatHub = sendTemplateViaChatHub;
const sendOrderConfirmationViaWhatsapp = (phone, customerName, orderId, amount) => __awaiter(void 0, void 0, void 0, function* () {
    logger_1.default.warn("[DEPRECATION] sendOrderConfirmationViaWhatsapp called via legacy mbgcard service. Use NotificationService instead.");
    return messaging_1.NotificationService.getInstance().notifyOrderConfirmed({
        orderId,
        customerPhone: phone,
        customerName,
        totalAmount: amount || 0,
        itemsSummary: "BookMyVeg Order"
    });
});
exports.sendOrderConfirmationViaWhatsapp = sendOrderConfirmationViaWhatsapp;
const sendOrderStatusUpdateViaWhatsapp = (phone, customerName, orderId, status, deliveryEta) => __awaiter(void 0, void 0, void 0, function* () {
    logger_1.default.warn("[DEPRECATION] sendOrderStatusUpdateViaWhatsapp called via legacy mbgcard service. Use NotificationService instead.");
    return messaging_1.NotificationService.getInstance().notifyOrderStatusUpdated({
        orderId,
        customerPhone: phone,
        customerName,
        status,
        deliveryEta
    });
});
exports.sendOrderStatusUpdateViaWhatsapp = sendOrderStatusUpdateViaWhatsapp;
const sendInvoicePaidViaWhatsapp = (phone, customerName, orderId, totalAmount, paymentMethod, _invoiceNumber) => __awaiter(void 0, void 0, void 0, function* () {
    logger_1.default.warn("[DEPRECATION] sendInvoicePaidViaWhatsapp called via legacy mbgcard service. Use NotificationService instead.");
    return messaging_1.NotificationService.getInstance().notifyBillCreated({
        orderId,
        customerPhone: phone,
        customerName,
        totalAmount,
        paidAmount: totalAmount,
        dueAmount: 0,
        paymentMode: paymentMethod
    });
});
exports.sendInvoicePaidViaWhatsapp = sendInvoicePaidViaWhatsapp;
const sendInvoiceDueViaWhatsapp = (phone, customerName, orderId, totalAmount, paymentMethod, remainingDue, _customerId, _invoiceNumber) => __awaiter(void 0, void 0, void 0, function* () {
    logger_1.default.warn("[DEPRECATION] sendInvoiceDueViaWhatsapp called via legacy mbgcard service. Use NotificationService instead.");
    return messaging_1.NotificationService.getInstance().notifyBillCreated({
        orderId,
        customerPhone: phone,
        customerName,
        totalAmount,
        paidAmount: Math.max(0, totalAmount - remainingDue),
        dueAmount: remainingDue,
        paymentMode: paymentMethod
    });
});
exports.sendInvoiceDueViaWhatsapp = sendInvoiceDueViaWhatsapp;
const sendPaymentReceivedViaWhatsapp = (phone, customerName, orderId, amount, paymentMethod, remainingBalance) => __awaiter(void 0, void 0, void 0, function* () {
    logger_1.default.warn("[DEPRECATION] sendPaymentReceivedViaWhatsapp called via legacy mbgcard service. Use NotificationService instead.");
    return messaging_1.NotificationService.getInstance().notifyPaymentReceived({
        paymentId: `PAY-${orderId}-${Date.now().toString().slice(-4)}`,
        orderId,
        customerPhone: phone,
        customerName,
        amount,
        paymentMethod,
        remainingBalance: remainingBalance || 0
    });
});
exports.sendPaymentReceivedViaWhatsapp = sendPaymentReceivedViaWhatsapp;
const sendBillCancelledViaWhatsapp = (phone, customerName, orderId, cancellationReason) => __awaiter(void 0, void 0, void 0, function* () {
    logger_1.default.warn("[DEPRECATION] sendBillCancelledViaWhatsapp called via legacy mbgcard service. Use NotificationService instead.");
    return messaging_1.NotificationService.getInstance().notifyBillCancelled({
        orderId,
        customerPhone: phone,
        customerName,
        cancellationReason
    });
});
exports.sendBillCancelledViaWhatsapp = sendBillCancelledViaWhatsapp;
const sendPaymentReminderViaWhatsapp = (phone, _customerName, _totalDue, _invoiceLabel, _customerId, latestOrderId) => __awaiter(void 0, void 0, void 0, function* () {
    logger_1.default.warn("[DEPRECATION] sendPaymentReminderViaWhatsapp called via legacy mbgcard service. Use ReminderService instead.");
    if (latestOrderId) {
        return messaging_1.ReminderService.getInstance().sendSingleOrderReminder({
            orderId: latestOrderId
        });
    }
    return { success: false, error: "Legacy reminder call missing order ID" };
});
exports.sendPaymentReminderViaWhatsapp = sendPaymentReminderViaWhatsapp;
const sendFeedbackRequestViaWhatsapp = (phone, customerName, orderId) => __awaiter(void 0, void 0, void 0, function* () {
    logger_1.default.warn("[DEPRECATION] sendFeedbackRequestViaWhatsapp called via legacy mbgcard service. Use NotificationService instead.");
    return messaging_1.NotificationService.getInstance().notifyFeedbackRequest(phone, customerName, orderId);
});
exports.sendFeedbackRequestViaWhatsapp = sendFeedbackRequestViaWhatsapp;
exports.getConversation = messaging_1.getConversation;
const getMyMetaTemplates = () => __awaiter(void 0, void 0, void 0, function* () {
    logger_1.default.warn("[DEPRECATION] getMyMetaTemplates called via legacy mbgcard service. Use TemplateService instead.");
    const templates = yield messaging_1.TemplateService.getInstance().syncAndGetTemplates();
    return { success: true, data: templates };
});
exports.getMyMetaTemplates = getMyMetaTemplates;
