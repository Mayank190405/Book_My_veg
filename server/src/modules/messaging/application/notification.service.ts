/**
 * Book My Veg — Primary Notification Service
 * Unified entry point for all business events and communication triggers.
 */

import { NotificationDispatcherService } from "./notification-dispatcher.service";
import { TemplateMapper } from "../templates/template-mapper";
import { RecipientService } from "./recipient.service";
import { ProviderSendResult } from "../domain/notification.types";
import {
    BillCancelledEvent,
    BillCreatedEvent,
    OrderConfirmedEvent,
    OrderStatusUpdatedEvent,
    PaymentReceivedEvent,
    PurchaseOrderEvent
} from "../domain/notification.events";
import logger from "../../../utils/logger";

export class NotificationService {
    private static instance: NotificationService;
    private dispatcher: NotificationDispatcherService;

    private constructor() {
        this.dispatcher = NotificationDispatcherService.getInstance();
    }

    public static getInstance(): NotificationService {
        if (!NotificationService.instance) {
            NotificationService.instance = new NotificationService();
        }
        return NotificationService.instance;
    }

    /**
     * Dispatches OTP via WhatsApp authentication template 'login'.
     */
    public async sendOtp(phone: string, otp: string, purpose: "AUTH" | "DELIVERY" | "CASH_COLLECTION" = "AUTH", referenceId?: string): Promise<ProviderSendResult> {
        const cleanPhone = RecipientService.sanitizePhone(phone);
        const mapped = TemplateMapper.mapOtp(otp);

        const typeMap = {
            AUTH: "AUTH_OTP",
            DELIVERY: "DELIVERY_OTP",
            CASH_COLLECTION: "CASH_COLLECTION_OTP"
        } as const;

        return await this.dispatcher.dispatch({
            idempotencyKey: `otp:${cleanPhone}:${purpose}:${referenceId || Date.now()}`,
            notificationType: typeMap[purpose] || "AUTH_OTP",
            channel: "WHATSAPP",
            recipientPhone: cleanPhone,
            referenceId,
            templateName: mapped.templateName,
            variables: mapped.variables,
            triggerSource: `OTP_${purpose}`
        });
    }

    /**
     * Dispatches order confirmation notification.
     */
    public async notifyOrderConfirmed(event: OrderConfirmedEvent): Promise<ProviderSendResult> {
        const cleanPhone = RecipientService.sanitizePhone(event.customerPhone);
        const mapped = TemplateMapper.mapOrderConfirmed(event.customerName, event.orderId);

        return await this.dispatcher.dispatch({
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
    }

    /**
     * Dispatches order status update notification.
     */
    public async notifyOrderStatusUpdated(event: OrderStatusUpdatedEvent): Promise<ProviderSendResult> {
        const cleanPhone = RecipientService.sanitizePhone(event.customerPhone);
        const mapped = TemplateMapper.mapOrderStatus(event.customerName, event.orderId, event.status);

        const normStatus = (event.status || "").toUpperCase();
        const notificationType = (normStatus === "OUT_FOR_DELIVERY" || normStatus === "SHIPPED")
            ? "ORDER_OUT_FOR_DELIVERY"
            : "ORDER_STATUS_UPDATE";

        return await this.dispatcher.dispatch({
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
    }

    /**
     * Dispatches bill creation notification (Paid vs. Due).
     */
    public async notifyBillCreated(event: BillCreatedEvent): Promise<ProviderSendResult> {
        const cleanPhone = RecipientService.sanitizePhone(event.customerPhone);

        const mapped = event.isPaid
            ? TemplateMapper.mapBillCreatedPaid(
                event.customerName,
                event.orderId,
                event.totalAmount,
                event.paymentMode,
                event.orderId
            )
            : TemplateMapper.mapBillCreatedDue(
                event.customerName,
                event.orderId,
                event.totalAmount,
                event.dueAmount,
                event.paymentMode,
                event.userId || "",
                event.orderId,
                cleanPhone
            );

        return await this.dispatcher.dispatch({
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
    }

    /**
     * Dispatches bill / order cancellation notification.
     */
    public async notifyBillCancelled(event: BillCancelledEvent): Promise<ProviderSendResult> {
        const cleanPhone = RecipientService.sanitizePhone(event.customerPhone);
        const mapped = TemplateMapper.mapBillCancelled(event.customerName, event.orderId, event.reason);

        return await this.dispatcher.dispatch({
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
    }

    /**
     * Dispatches payment received confirmation.
     */
    public async notifyPaymentReceived(event: PaymentReceivedEvent): Promise<ProviderSendResult> {
        const cleanPhone = RecipientService.sanitizePhone(event.customerPhone);
        const paidAmount = event.paidAmount ?? event.amount ?? 0;
        const paymentMode = event.paymentMode ?? event.paymentMethod ?? "ONLINE";
        const mapped = TemplateMapper.mapPaymentReceived(
            event.customerName,
            event.orderId,
            paidAmount,
            paymentMode,
            event.orderId
        );

        return await this.dispatcher.dispatch({
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
    }

    /**
     * Dispatches purchase order to vendor WhatsApp (uses approved utility template).
     */
    public async notifyPurchaseOrder(event: PurchaseOrderEvent): Promise<ProviderSendResult> {
        const cleanPhone = RecipientService.sanitizePhone(event.vendorPhone);

        // Map PO details into approved utility template 'bill_created' to ensure compliance with strict utility policy
        const variables = [
            event.vendorName || "Vendor",
            event.poNumber,
            String(event.totalAmount),
            `PO Issued (${event.itemCount} items) - Deliver to ${event.storeName}`,
            event.poLink
        ];

        return await this.dispatcher.dispatch({
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
    }

    /**
     * Dispatches feedback request notification for completed orders.
     */
    public async notifyFeedbackRequest(phone: string, customerName: string, orderId: string): Promise<ProviderSendResult> {
        const cleanPhone = RecipientService.sanitizePhone(phone);
        const mapped = TemplateMapper.mapFeedbackRequest(customerName, orderId);

        return await this.dispatcher.dispatch({
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
    }

    /**
     * Triggers an interactive chatbot flow via ChatHub provider with full audit log.
     */
    public async sendChatHubFlow(
        phone: string,
        flowId: string,
        name?: string,
        customFields?: Record<string, string>,
        actorId?: string
    ): Promise<ProviderSendResult> {
        const cleanPhone = RecipientService.sanitizePhone(phone);
        const provider = this.dispatcher.getProvider();

        if (!provider.sendFlow) {
            return {
                success: false,
                status: "FAILED",
                error: "Flow sending is not supported by current provider."
            };
        }

        try {
            return await provider.sendFlow(cleanPhone, flowId, name, customFields);
        } catch (err: any) {
            logger.error(`[NotificationService] Error executing ChatHub flow for ${cleanPhone}:`, err);
            return {
                success: false,
                status: "FAILED",
                error: err.message
            };
        }
    }
}

