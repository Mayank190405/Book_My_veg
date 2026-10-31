"use strict";
/**
 * Book My Veg — Template Mapper
 * Canonical mapping from domain events to Meta-approved template variables.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TemplateMapper = void 0;
const dueCalculationService_1 = require("../../../services/dueCalculationService");
class TemplateMapper {
    static getOrigin() {
        return process.env.CLIENT_URL || "https://bookmyveg.co.in";
    }
    static mapOrderConfirmed(customerName, orderId) {
        return {
            templateName: "order_management_4",
            variables: {
                body: [customerName || "Customer", orderId]
            }
        };
    }
    static mapOrderStatus(customerName, orderId, status) {
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
    static mapBillCreatedPaid(customerName, invoiceNo, totalAmount, paymentMode, orderId) {
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
    static mapBillCreatedDue(customerName, invoiceNo, totalAmount, dueAmount, paymentMode, userId, orderId, phone) {
        const origin = this.getOrigin();
        const cleanPhone = phone ? phone.replace(/\D/g, "") : "";
        let payLink = `${origin}/pay?number=${cleanPhone}`;
        if (userId)
            payLink += `&userid=${userId}`;
        const invoiceAndPayLink = `${origin}/invoice/${orderId} | Pay Online: ${payLink}`;
        const formattedTotal = (0, dueCalculationService_1.formatCurrencyAmount)(totalAmount);
        const formattedDue = (0, dueCalculationService_1.formatCurrencyAmount)(dueAmount);
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
    static mapPaymentReceived(customerName, invoiceNo, paidAmount, paymentMode, orderId) {
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
    static mapBillCancelled(customerName, orderId, reason) {
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
    static mapPaymentReminder(customerName, invoiceLabel, totalDue, payLink) {
        const dueTiming = `Immediate. Pay online: ${payLink}`;
        const formattedDue = (0, dueCalculationService_1.formatCurrencyAmount)(totalDue);
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
    static mapOtp(otp) {
        return {
            templateName: "login",
            variables: {
                body: [otp]
            }
        };
    }
    static mapFeedbackRequest(customerName, _orderId) {
        return {
            templateName: "feedback_request_support_",
            variables: {
                body: [customerName || "Customer"]
            }
        };
    }
}
exports.TemplateMapper = TemplateMapper;
