/**
 * DEPRECATED — Legacy messaging adapter.
 * All messaging operations have been replaced by the centralized messaging module in:
 * server/src/modules/messaging/
 * 
 * Direct HTTP calls to external provider APIs have been removed from this file.
 * All calls are redirected through the validated, audited, and deduplicated pipeline.
 */

import {
    NotificationService,
    TemplateService,
    ReminderService,
    APPROVED_UTILITY_TEMPLATES,
    getConversation as moduleGetConversation
} from "../modules/messaging";
import logger from "../utils/logger";

export { APPROVED_UTILITY_TEMPLATES };

export const sendOtpViaWhatsapp = async (phone: string, otp: string) => {
    logger.warn("[DEPRECATION] sendOtpViaWhatsapp called via legacy mbgcard service. Use NotificationService instead.");
    return NotificationService.getInstance().sendOtp(phone, otp, "AUTH");
};

export const sendFlowViaChatHub = async (
    phone: string,
    flowId: string,
    name?: string,
    customFields?: Record<string, string>
) => {
    logger.warn("[DEPRECATION] sendFlowViaChatHub called via legacy mbgcard service. Use NotificationService instead.");
    return NotificationService.getInstance().sendChatHubFlow(phone, flowId, name, customFields);
};

export const sendTemplateViaChatHub = async (
    phone: string,
    templateName: string,
    variables?: any,
    dynamicMedia?: string
) => {
    logger.warn("[DEPRECATION] sendTemplateViaChatHub called via legacy mbgcard service. Use TemplateService instead.");
    return TemplateService.getInstance().sendCustomTemplate({
        phone,
        templateName,
        variables,
        dynamicMedia,
        triggerSource: "LEGACY_MBGCARD_WRAPPER"
    });
};

export const sendOrderConfirmationViaWhatsapp = async (
    phone: string,
    customerName: string,
    orderId: string,
    amount?: number
) => {
    logger.warn("[DEPRECATION] sendOrderConfirmationViaWhatsapp called via legacy mbgcard service. Use NotificationService instead.");
    return NotificationService.getInstance().notifyOrderConfirmed({
        orderId,
        customerPhone: phone,
        customerName,
        totalAmount: amount || 0,
        itemsSummary: "BookMyVeg Order"
    });
};

export const sendOrderStatusUpdateViaWhatsapp = async (
    phone: string,
    customerName: string,
    orderId: string,
    status: string,
    deliveryEta?: string
) => {
    logger.warn("[DEPRECATION] sendOrderStatusUpdateViaWhatsapp called via legacy mbgcard service. Use NotificationService instead.");
    return NotificationService.getInstance().notifyOrderStatusUpdated({
        orderId,
        customerPhone: phone,
        customerName,
        status,
        deliveryEta
    });
};

export const sendInvoicePaidViaWhatsapp = async (
    phone: string,
    customerName: string,
    orderId: string,
    totalAmount: number,
    paymentMethod: string,
    _invoiceNumber?: string
) => {
    logger.warn("[DEPRECATION] sendInvoicePaidViaWhatsapp called via legacy mbgcard service. Use NotificationService instead.");
    return NotificationService.getInstance().notifyBillCreated({
        orderId,
        customerPhone: phone,
        customerName,
        totalAmount,
        paidAmount: totalAmount,
        dueAmount: 0,
        paymentMode: paymentMethod
    });
};

export const sendInvoiceDueViaWhatsapp = async (
    phone: string,
    customerName: string,
    orderId: string,
    totalAmount: number,
    paymentMethod: string,
    remainingDue: number,
    _customerId?: string,
    _invoiceNumber?: string
) => {
    logger.warn("[DEPRECATION] sendInvoiceDueViaWhatsapp called via legacy mbgcard service. Use NotificationService instead.");
    return NotificationService.getInstance().notifyBillCreated({
        orderId,
        customerPhone: phone,
        customerName,
        totalAmount,
        paidAmount: Math.max(0, totalAmount - remainingDue),
        dueAmount: remainingDue,
        paymentMode: paymentMethod
    });
};

export const sendPaymentReceivedViaWhatsapp = async (
    phone: string,
    customerName: string,
    orderId: string,
    amount: number,
    paymentMethod: string,
    remainingBalance?: number
) => {
    logger.warn("[DEPRECATION] sendPaymentReceivedViaWhatsapp called via legacy mbgcard service. Use NotificationService instead.");
    return NotificationService.getInstance().notifyPaymentReceived({
        paymentId: `PAY-${orderId}-${Date.now().toString().slice(-4)}`,
        orderId,
        customerPhone: phone,
        customerName,
        amount,
        paymentMethod,
        remainingBalance: remainingBalance || 0
    });
};

export const sendBillCancelledViaWhatsapp = async (
    phone: string,
    customerName: string,
    orderId: string,
    cancellationReason: string
) => {
    logger.warn("[DEPRECATION] sendBillCancelledViaWhatsapp called via legacy mbgcard service. Use NotificationService instead.");
    return NotificationService.getInstance().notifyBillCancelled({
        orderId,
        customerPhone: phone,
        customerName,
        cancellationReason
    });
};

export const sendPaymentReminderViaWhatsapp = async (
    phone: string,
    _customerName: string,
    _totalDue: number,
    _invoiceLabel: string,
    _customerId?: string,
    latestOrderId?: string
) => {
    logger.warn("[DEPRECATION] sendPaymentReminderViaWhatsapp called via legacy mbgcard service. Use ReminderService instead.");
    if (latestOrderId) {
        return ReminderService.getInstance().sendSingleOrderReminder({
            orderId: latestOrderId
        });
    }
    return { success: false, error: "Legacy reminder call missing order ID" };
};

export const sendFeedbackRequestViaWhatsapp = async (
    phone: string,
    customerName: string,
    orderId: string
) => {
    logger.warn("[DEPRECATION] sendFeedbackRequestViaWhatsapp called via legacy mbgcard service. Use NotificationService instead.");
    return NotificationService.getInstance().notifyFeedbackRequest(phone, customerName, orderId);
};

export const getConversation = moduleGetConversation;

export const getMyMetaTemplates = async () => {
    logger.warn("[DEPRECATION] getMyMetaTemplates called via legacy mbgcard service. Use TemplateService instead.");
    const templates = await TemplateService.getInstance().syncAndGetTemplates();
    return { success: true, data: templates };
};
