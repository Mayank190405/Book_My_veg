/**
 * Book My Veg — Standard Notification Events
 */

export interface OrderConfirmedEvent {
    orderId: string;
    userId?: string;
    customerName: string;
    customerPhone: string;
    totalAmount: number;
    itemsSummary?: string;
}

export interface OrderStatusUpdatedEvent {
    orderId: string;
    userId?: string;
    customerName: string;
    customerPhone: string;
    status: string;
    remark?: string;
    deliveryEta?: string;
    actorId?: string;
    triggeredBy?: string;
}

export interface BillCreatedEvent {
    orderId: string;
    userId?: string;
    customerName: string;
    customerPhone: string;
    totalAmount: number;
    paidAmount: number;
    dueAmount: number;
    paymentMode: string;
    isPaid?: boolean;
    locationId?: string;
    actorId?: string;
}

export interface BillCancelledEvent {
    orderId: string;
    userId?: string;
    customerName: string;
    customerPhone: string;
    reason?: string;
    cancellationReason?: string;
    actorId?: string;
    triggeredBy?: string;
}

export interface PaymentReceivedEvent {
    orderId: string;
    userId?: string;
    customerName: string;
    customerPhone: string;
    paidAmount?: number;
    amount?: number;
    paymentMode?: string;
    paymentMethod?: string;
    transactionId?: string;
    paymentId?: string;
    remainingBalance?: number;
    triggeredBy?: string;
}

export interface PaymentReminderEvent {
    customerId: string;
    customerName: string;
    customerPhone: string;
    totalDue: number;
    orderCount: number;
    includedOrderIds: string[];
    actorId?: string;
    locationId?: string;
    triggerSource: "POS_MANUAL" | "ADMIN_SINGLE_ORDER" | "ADMIN_MANUAL";
}

export interface OtpRequestedEvent {
    phone: string;
    otp: string;
    purpose: "AUTH" | "DELIVERY" | "CASH_COLLECTION";
    referenceId?: string;
}

export interface PurchaseOrderEvent {
    poId: string;
    poNumber: string;
    vendorName: string;
    vendorPhone: string;
    itemCount: number;
    totalAmount: number;
    storeName: string;
    storeAddress: string;
    poLink: string;
    actorId?: string;
}
