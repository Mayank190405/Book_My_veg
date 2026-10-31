/**
 * Book My Veg — Canonical Payment Reminder Service
 * Enforces universal 24-hour reminder cooldown, atomic mutex claims, and durable audit logs.
 */

import prisma from "../../../config/prisma";
import { calculateCustomerDues, calculateOrderDue, formatCurrencyAmount, getEligibleOrdersWhereClause } from "../../../services/dueCalculationService";
import { NotificationRepository } from "../infrastructure/repositories/notification.repository";
import { NotificationDispatcherService } from "./notification-dispatcher.service";
import { TemplateMapper } from "../templates/template-mapper";
import { RecipientService } from "./recipient.service";
import { ProviderSendResult } from "../domain/notification.types";
import logger from "../../../utils/logger";

export interface SendDuesRemindersOptions {
    customerIds?: string[];
    locationId?: string;
    actorId?: string;
    triggerSource?: "POS_MANUAL" | "ADMIN_SINGLE_ORDER" | "ADMIN_MANUAL";
}

export interface ReminderExecutionSummary {
    totalAttempted: number;
    sentCount: number;
    skippedCount: number;
    failedCount: number;
    results: Array<{
        customerId: string;
        customerName: string;
        phone: string;
        totalDue: number;
        status: "SENT" | "SKIPPED_COOLDOWN" | "CLAIM_CONFLICT" | "FAILED";
        reason?: string;
    }>;
}

export class ReminderService {
    private static instance: ReminderService;
    private repository: NotificationRepository;
    private dispatcher: NotificationDispatcherService;

    private constructor() {
        this.repository = NotificationRepository.getInstance();
        this.dispatcher = NotificationDispatcherService.getInstance();
    }

    public static getInstance(): ReminderService {
        if (!ReminderService.instance) {
            ReminderService.instance = new ReminderService();
        }
        return ReminderService.instance;
    }

    /**
     * Sends payment-due reminders with strict universal 24-hour cooldown and atomic claims.
     * Works identically whether customerIds has 1 customer or 100 customers.
     */
    public async sendDueReminders(options: SendDuesRemindersOptions): Promise<ReminderExecutionSummary> {
        const { customerIds, locationId, actorId, triggerSource = "POS_MANUAL" } = options;
        const origin = process.env.CLIENT_URL || "https://bookmyveg.co.in";

        const orders = await prisma.order.findMany({
            where: getEligibleOrdersWhereClause({ customerIds, locationId }),
            include: { user: true, payments: true },
            orderBy: { createdAt: "desc" }
        });

        const customerOrdersMap: Record<string, { user: any; orders: any[] }> = {};
        for (const order of orders) {
            if (!order.user || !order.user.phone) continue;
            const uId = order.user.id;
            if (!customerOrdersMap[uId]) {
                customerOrdersMap[uId] = { user: order.user, orders: [] };
            }
            customerOrdersMap[uId].orders.push(order);
        }

        const summary: ReminderExecutionSummary = {
            totalAttempted: Object.keys(customerOrdersMap).length,
            sentCount: 0,
            skippedCount: 0,
            failedCount: 0,
            results: []
        };

        for (const entry of Object.values(customerOrdersMap)) {
            const dues = calculateCustomerDues(entry.orders);
            if (dues.eligibleOrdersCount <= 0 || dues.totalDue <= 0) {
                continue;
            }

            const customer = entry.user;
            const cleanPhone = RecipientService.sanitizePhone(customer.phone);
            const totalDue = dues.totalDue;
            const orderCount = dues.eligibleOrdersCount;
            const latestOrderId = dues.eligibleOrders[0].id;
            const includedOrderIds = dues.eligibleOrders.map((o: any) => o.id);

            const invoiceLabel = orderCount > 1
                ? `All Dues (${orderCount} Bills)`
                : latestOrderId;

            // 1. UNIVERSAL COOLDOWN & ATOMIC MUTEX CLAIM (Applied to EVERY send, single or bulk)
            const claimResult = await this.repository.claimCustomerReminder(customer.id, {
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

                logger.info(`[ReminderService] Skipped customer ${cleanPhone} (${customer.name}): ${reasonText}`);
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

            const claimId = claimResult.claimId!;

            // 2. Prepare Meta-approved template variables
            let payLink = `${origin}/pay?number=${cleanPhone.replace(/\D/g, "")}`;
            if (customer.id) payLink += `&userid=${customer.id}`;

            const templateData = TemplateMapper.mapPaymentReminder(
                customer.name || "Customer",
                invoiceLabel,
                totalDue,
                payLink
            );

            // 3. Dispatch through notification dispatcher
            try {
                const sendResult = await this.dispatcher.dispatch({
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
                await this.repository.finalizeCustomerReminderClaim(customer.id, claimId, {
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
                } else {
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
            } catch (dispatchErr: any) {
                logger.error(`[ReminderService] Error sending reminder to ${cleanPhone}:`, dispatchErr);
                await this.repository.finalizeCustomerReminderClaim(customer.id, claimId, {
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
    }

    /**
     * Sends payment reminder for a single specific order ID (replaces paymentController.sendPaymentReminderController).
     * Enforces authentication, universal 24-hour cooldown, and atomic duplicate prevention.
     */
    public async sendSingleOrderReminder(
        orderIdOrOptions: string | { orderId: string; actorId?: string; locationId?: string },
        actorIdArg?: string,
        locationIdArg?: string
    ): Promise<ProviderSendResult> {
        const orderId = typeof orderIdOrOptions === "string" ? orderIdOrOptions : orderIdOrOptions.orderId;
        const actorId = typeof orderIdOrOptions === "string" ? actorIdArg : (orderIdOrOptions.actorId || actorIdArg);
        const locationId = typeof orderIdOrOptions === "string" ? locationIdArg : (orderIdOrOptions.locationId || locationIdArg);
        const order = await prisma.order.findUnique({
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

        const dueResult = calculateOrderDue(order);
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
        const summary = await this.sendDueReminders({
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
    }
}

