/**
 * Book My Veg — Template Mapper
 * Canonical mapping from domain events to Meta-approved template variables.
 */

import { formatCurrencyAmount } from "../../../services/dueCalculationService";

export class TemplateMapper {
    private static getOrigin(): string {
        return process.env.CLIENT_URL || "https://bookmyveg.co.in";
    }

    public static mapOrderConfirmed(customerName: string, orderId: string): { templateName: string; variables: { body: string[] } } {
        return {
            templateName: "order_management_4",
            variables: {
                body: [customerName || "Customer", orderId]
            }
        };
    }

    public static mapOrderStatus(
        customerName: string,
        orderId: string,
        status: string
    ): { templateName: string; variables: { body: string[] } } {
        const normStatus = (status || "").toUpperCase();
        if (normStatus === "OUT_FOR_DELIVERY" || normStatus === "SHIPPED") {
            return {
                templateName: "order_update_notification",
                variables: {
                    body: [customerName || "Customer"]
                }
            };
        }
        return {
            templateName: "order_management_4",
            variables: {
                body: [customerName || "Customer", orderId]
            }
        };
    }

    public static mapBillCreatedPaid(
        customerName: string,
        invoiceNo: string,
        totalAmount: number,
        paymentMode: string,
        orderId: string
    ): { templateName: string; variables: { body: string[] } } {
        const origin = this.getOrigin();
        const invoicePdfLink = `${origin}/invoice/${orderId}`;
        return {
            templateName: "bill_created",
            variables: {
                body: [
                    customerName || "Customer",
                    invoiceNo,
                    String(totalAmount),
                    paymentMode || "CASH",
                    invoicePdfLink
                ]
            }
        };
    }

    public static mapBillCreatedDue(
        customerName: string,
        invoiceNo: string,
        totalAmount: number,
        dueAmount: number,
        paymentMode: string,
        userId: string,
        orderId: string,
        phone: string
    ): { templateName: string; variables: { body: string[] } } {
        const origin = this.getOrigin();
        const cleanPhone = phone ? phone.replace(/\D/g, "") : "";
        let payLink = `${origin}/pay?number=${cleanPhone}`;
        if (userId) payLink += `&userid=${userId}`;

        const invoiceAndPayLink = `${origin}/invoice/${orderId} | Pay Online: ${payLink}`;
        const formattedTotal = formatCurrencyAmount(totalAmount);
        const formattedDue = formatCurrencyAmount(dueAmount);

        return {
            templateName: "bill_created",
            variables: {
                body: [
                    customerName || "Customer",
                    invoiceNo,
                    formattedTotal,
                    `DUE: ₹${formattedDue} (${paymentMode || "DUE ON ACCOUNT"})`,
                    invoiceAndPayLink
                ]
            }
        };
    }

    public static mapPaymentReceived(
        customerName: string,
        invoiceNo: string,
        paidAmount: number,
        paymentMode: string,
        orderId?: string
    ): { templateName: string; variables: { body: string[] } } {
        const origin = this.getOrigin();
        const invoicePdfLink = `${origin}/invoice/${orderId || invoiceNo}`;
        return {
            templateName: "bill_created",
            variables: {
                body: [
                    customerName || "Customer",
                    invoiceNo,
                    String(paidAmount),
                    `${paymentMode || "ONLINE"} (Paid)`,
                    invoicePdfLink
                ]
            }
        };
    }

    public static mapBillCancelled(
        customerName: string,
        orderId: string,
        reason?: string
    ): { templateName: string; variables: { body: string[] } } {
        const origin = this.getOrigin();
        const invoicePdfLink = `${origin}/invoice/${orderId}`;
        const cancelDesc = reason ? `CANCELLED (${reason})` : "CANCELLED";
        return {
            templateName: "bill_created",
            variables: {
                body: [
                    customerName || "Customer",
                    orderId,
                    "0",
                    cancelDesc,
                    invoicePdfLink
                ]
            }
        };
    }

    public static mapPaymentReminder(
        customerName: string,
        invoiceLabel: string,
        totalDue: number,
        payLink: string
    ): { templateName: string; variables: { body: string[] } } {
        const dueTiming = `Immediate. Pay online: ${payLink}`;
        const formattedDue = formatCurrencyAmount(totalDue);
        return {
            templateName: "payment_due_reminder",
            variables: {
                body: [
                    customerName || "Customer",
                    invoiceLabel,
                    `₹${formattedDue}`,
                    dueTiming
                ]
            }
        };
    }

    public static mapOtp(otp: string): { templateName: string; variables: { body: string[] } } {
        return {
            templateName: "login",
            variables: {
                body: [otp]
            }
        };
    }

    public static mapFeedbackRequest(customerName: string, _orderId?: string): { templateName: string; variables: { body: string[] } } {
        return {
            templateName: "feedback_request_support_",
            variables: {
                body: [customerName || "Customer"]
            }
        };
    }
}

