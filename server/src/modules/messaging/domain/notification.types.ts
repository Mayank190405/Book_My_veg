/**
 * Book My Veg — Unified Messaging Domain Types
 */

export type NotificationChannel = "WHATSAPP" | "IN_APP" | "SOCKET";

export type NotificationType =
    | "AUTH_OTP"
    | "DELIVERY_OTP"
    | "CASH_COLLECTION_OTP"
    | "ORDER_CONFIRMATION"
    | "ORDER_STATUS_UPDATE"
    | "ORDER_OUT_FOR_DELIVERY"
    | "BILL_CREATED_PAID"
    | "BILL_CREATED_DUE"
    | "BILL_CANCELLED"
    | "PAYMENT_RECEIVED"
    | "PAYMENT_REMINDER"
    | "PURCHASE_ORDER"
    | "WALLET_DEPOSIT"
    | "FEEDBACK_REQUEST"
    | "CUSTOMER_INACTIVE"
    | "CUSTOM_TEMPLATE"
    | "CHATHUB_FLOW";

export type NotificationStatus =
    | "QUEUED"
    | "SUBMITTED"
    | "ACCEPTED_BY_PROVIDER"
    | "DELIVERED"
    | "FAILED"
    | "BLOCKED_BY_POLICY"
    | "SKIPPED_COOLDOWN";

export type TemplateCategory = "AUTHENTICATION" | "UTILITY" | "MARKETING";

export type TemplateStatus = "APPROVED" | "PENDING" | "REJECTED";

export interface TemplateComponent {
    type: "HEADER" | "BODY" | "FOOTER" | "BUTTONS";
    format?: "TEXT" | "IMAGE" | "DOCUMENT" | "VIDEO";
    text?: string;
    example?: {
        body_text?: string[][];
        header_text?: string[];
        header_handle?: string[];
    };
    buttons?: Array<{
        type: "QUICK_REPLY" | "URL" | "PHONE_NUMBER";
        text: string;
        url?: string;
        phone_number?: string;
        example?: string[];
    }>;
}

export interface TemplateDefinition {
    id: string;
    name: string;
    status: TemplateStatus;
    category: TemplateCategory;
    language: string;
    variableCount: number;
    bodyText: string;
    headerText?: string | null;
    buttons?: any[];
    raw?: any;
}

export interface OutboundMessageRequest {
    idempotencyKey?: string;
    correlationId?: string;
    notificationType: NotificationType;
    channel: NotificationChannel;
    recipientPhone: string;
    recipientName?: string;
    recipientId?: string;
    referenceId?: string;
    templateName: string;
    templateLanguage?: string;
    variables?: {
        header?: string[];
        body?: string[];
    };
    dynamicMedia?: string;
    triggerSource: string;
    actorId?: string;
    locationId?: string;
    metadata?: Record<string, any>;
}

export interface ProviderSendResult {
    success: boolean;
    providerMessageId?: string | null;
    status: NotificationStatus;
    blocked?: boolean;
    skipped?: boolean;
    cooldownRemainingMs?: number;
    error?: string;
    rawResponse?: any;
}

export interface PaymentReminderSnapshot {
    customerId: string;
    customerName: string;
    customerPhone: string;
    totalDue: number;
    orderCount: number;
    includedOrderIds: string[];
    outstandingPerOrder: Array<{ orderId: string; dueAmount: number; totalAmount: number }>;
    invoiceLabel: string;
    payLink: string;
    timestamp: Date;
}

export interface ReminderClaimResult {
    claimed: boolean;
    claimId?: string;
    reason?: "COOLDOWN_ACTIVE" | "ACTIVE_CLAIM_IN_PROGRESS" | "DB_ERROR";
    cooldownRemainingMs?: number;
}

