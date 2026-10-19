"use strict";
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
exports.allocateBulkPaymentAcrossBills = exports.calculateChronologicalLedger = exports.isAllDuesDisplayLabel = exports.processCustomersWithDuesInBatches = exports.getEligibleOrdersWhereClause = exports.calculateCustomerDues = exports.calculateOrderDue = exports.formatCurrencyAmount = exports.calculateOrderPaidAmountDecimal = exports.isValidPaymentRecord = exports.INELIGIBLE_ORDER_STATUSES = exports.FULLY_SETTLED_ORDER_PAYMENT_STATUSES = exports.INVALID_PAYMENT_STATUSES = exports.VALID_PAYMENT_STATUSES = void 0;
const decimal_js_1 = __importDefault(require("decimal.js"));
const prisma_1 = __importDefault(require("../config/prisma"));
/**
 * Supported payment statuses that represent successfully settled money.
 * Case-insensitive comparison.
 */
exports.VALID_PAYMENT_STATUSES = new Set(["SUCCESS", "COMPLETED", "PAID"]);
/**
 * Payment statuses that explicitly represent incomplete or non-money states.
 */
exports.INVALID_PAYMENT_STATUSES = new Set(["PENDING", "FAILED", "REFUNDED", "USER_DROPPED", "CANCELLED"]);
/**
 * Order-level payment statuses that represent a fully settled bill.
 */
exports.FULLY_SETTLED_ORDER_PAYMENT_STATUSES = new Set(["COMPLETED", "PAID", "SETTLED"]);
/**
 * Order-level statuses that negate any outstanding balance collection.
 */
exports.INELIGIBLE_ORDER_STATUSES = new Set(["CANCELLED", "FAILED"]);
/**
 * Determines whether an individual payment record represents collected funds.
 * Rules:
 * 1. Amount must be positive (> 0).
 * 2. Method must not be CREDIT (credit ledger note is not cash/money collected).
 * 3. Status must be SUCCESS, COMPLETED, PAID, or null/undefined (legacy records).
 *    Status must NOT be PENDING, FAILED, REFUNDED, etc.
 */
const isValidPaymentRecord = (payment) => {
    if (!payment)
        return false;
    // Check amount
    const amtVal = payment.amount !== undefined && payment.amount !== null && typeof payment.amount === "object" && "toString" in payment.amount
        ? payment.amount.toString()
        : (payment.amount || 0);
    const amt = new decimal_js_1.default(amtVal);
    if (amt.lessThanOrEqualTo(0))
        return false;
    // Credit method is an issuance of credit, not money received
    if (payment.method && String(payment.method).trim().toUpperCase() === "CREDIT") {
        return false;
    }
    // Check status
    if (!payment.status || String(payment.status).trim() === "") {
        // Legacy payment records with null or empty status are counted as successful
        return true;
    }
    const normStatus = String(payment.status).trim().toUpperCase();
    if (exports.INVALID_PAYMENT_STATUSES.has(normStatus)) {
        return false;
    }
    return exports.VALID_PAYMENT_STATUSES.has(normStatus);
};
exports.isValidPaymentRecord = isValidPaymentRecord;
/**
 * Sums all valid payment records for an order using high-precision Decimal arithmetic.
 */
const calculateOrderPaidAmountDecimal = (payments) => {
    if (!Array.isArray(payments) || payments.length === 0) {
        return new decimal_js_1.default(0);
    }
    return payments.reduce((sum, p) => {
        if ((0, exports.isValidPaymentRecord)(p)) {
            return sum.plus(new decimal_js_1.default(p.amount ? p.amount.toString() : 0));
        }
        return sum;
    }, new decimal_js_1.default(0));
};
exports.calculateOrderPaidAmountDecimal = calculateOrderPaidAmountDecimal;
/**
 * Formats a monetary number to exactly two decimal places.
 */
const formatCurrencyAmount = (amount) => {
    const val = amount !== undefined && amount !== null && typeof amount === "object" && "toString" in amount
        ? amount.toString()
        : (amount || 0);
    const d = new decimal_js_1.default(val);
    return d.toFixed(2);
};
exports.formatCurrencyAmount = formatCurrencyAmount;
const calculateOrderDue = (order) => {
    const totalVal = order.totalAmount !== undefined && order.totalAmount !== null && typeof order.totalAmount === "object" && "toString" in order.totalAmount
        ? order.totalAmount.toString()
        : (order.totalAmount || 0);
    const orderTotalDec = new decimal_js_1.default(totalVal);
    const orderTotal = Number(orderTotalDec.toFixed(2));
    // 1. Check order status (Cancelled/Failed orders have 0 due)
    const normStatus = String(order.status || "").trim().toUpperCase();
    if (exports.INELIGIBLE_ORDER_STATUSES.has(normStatus)) {
        return {
            orderId: order.id,
            isEligible: false,
            totalAmount: orderTotal,
            paidAmount: 0,
            dueAmount: 0,
            ineligibilityReason: `Order status is ${normStatus}`
        };
    }
    // 2. Check if explicitly marked isPaid: true
    if (order.isPaid === true) {
        return {
            orderId: order.id,
            isEligible: false,
            totalAmount: orderTotal,
            paidAmount: orderTotal,
            dueAmount: 0,
            ineligibilityReason: "Order marked isPaid: true"
        };
    }
    // 3. Check if paymentStatus indicates fully settled
    const normPaymentStatus = String(order.paymentStatus || "").trim().toUpperCase();
    if (exports.FULLY_SETTLED_ORDER_PAYMENT_STATUSES.has(normPaymentStatus)) {
        return {
            orderId: order.id,
            isEligible: false,
            totalAmount: orderTotal,
            paidAmount: orderTotal,
            dueAmount: 0,
            ineligibilityReason: `Order paymentStatus is ${normPaymentStatus}`
        };
    }
    // 4. Calculate actual valid paid amount
    const paidDec = (0, exports.calculateOrderPaidAmountDecimal)(order.payments);
    const paidAmount = Number(paidDec.toFixed(2));
    // 5. Calculate remaining balance: Math.max(0, total - paid)
    const remainingDec = decimal_js_1.default.max(0, orderTotalDec.minus(paidDec));
    const dueAmount = Number(remainingDec.toFixed(2));
    // 6. If due is zero or negative (paid in full despite isPaid flag not updated)
    if (remainingDec.lessThanOrEqualTo(new decimal_js_1.default(0.005))) {
        return {
            orderId: order.id,
            isEligible: false,
            totalAmount: orderTotal,
            paidAmount,
            dueAmount: 0,
            ineligibilityReason: "Fully paid via transactions"
        };
    }
    return {
        orderId: order.id,
        isEligible: true,
        totalAmount: orderTotal,
        paidAmount,
        dueAmount
    };
};
exports.calculateOrderDue = calculateOrderDue;
/**
 * Authoritative aggregator for customer dues across a set of orders.
 * Accurately tracks total outstanding due, bill count, total spend, and total payments.
 */
const calculateCustomerDues = (orders) => {
    let totalSpendDec = new decimal_js_1.default(0);
    let totalPaidDec = new decimal_js_1.default(0);
    let totalDueDec = new decimal_js_1.default(0);
    const eligibleOrders = [];
    for (const order of orders) {
        const normStatus = String(order.status || "").trim().toUpperCase();
        if (exports.INELIGIBLE_ORDER_STATUSES.has(normStatus)) {
            continue;
        }
        const dueResult = (0, exports.calculateOrderDue)(order);
        totalSpendDec = totalSpendDec.plus(new decimal_js_1.default(dueResult.totalAmount));
        totalPaidDec = totalPaidDec.plus(new decimal_js_1.default(dueResult.paidAmount));
        if (dueResult.isEligible && dueResult.dueAmount > 0) {
            totalDueDec = totalDueDec.plus(new decimal_js_1.default(dueResult.dueAmount));
            eligibleOrders.push(Object.assign(Object.assign({}, order), { dueAmount: dueResult.dueAmount, paidAmount: dueResult.paidAmount }));
        }
    }
    const roundedTotalDue = Number(totalDueDec.toFixed(2));
    return {
        totalDue: roundedTotalDue,
        totalDueFormatted: totalDueDec.toFixed(2),
        eligibleOrdersCount: eligibleOrders.length,
        eligibleOrders,
        totalPaid: Number(totalPaidDec.toFixed(2)),
        totalSpend: Number(totalSpendDec.toFixed(2))
    };
};
exports.calculateCustomerDues = calculateCustomerDues;
/**
 * Centralized Prisma 'where' clause generator for eligible unpaid orders.
 * Ensures identical filtering criteria across worker, POS, and sync handlers.
 */
const getEligibleOrdersWhereClause = (options) => {
    return Object.assign(Object.assign(Object.assign({ status: { notIn: ["CANCELLED", "FAILED"] }, isPaid: false, paymentStatus: { notIn: ["COMPLETED", "PAID", "SETTLED"] } }, ((options === null || options === void 0 ? void 0 : options.customerId) ? { userId: options.customerId } : {})), ((options === null || options === void 0 ? void 0 : options.customerIds) && options.customerIds.length > 0 ? { userId: { in: options.customerIds } } : {})), ((options === null || options === void 0 ? void 0 : options.locationId) ? { locationId: options.locationId } : {}));
};
exports.getEligibleOrdersWhereClause = getEligibleOrdersWhereClause;
/**
 * Scalable cursor-based batch processor for customers with dues.
 * Eliminates silent truncation from arbitrary limits like `take: 200`.
 */
const processCustomersWithDuesInBatches = (options) => __awaiter(void 0, void 0, void 0, function* () {
    const batchSize = options.batchSize || 100;
    let cursor = undefined;
    let totalProcessed = 0;
    let totalWithDues = 0;
    const baseWhere = {
        isActive: true,
        phone: { not: "" },
        orders: {
            some: (0, exports.getEligibleOrdersWhereClause)({ locationId: options.locationId })
        }
    };
    while (true) {
        const customers = yield prisma_1.default.user.findMany({
            where: baseWhere,
            select: {
                id: true,
                name: true,
                phone: true,
                orders: {
                    where: (0, exports.getEligibleOrdersWhereClause)({ locationId: options.locationId }),
                    include: { payments: true },
                    orderBy: { createdAt: "desc" }
                }
            },
            take: batchSize,
            skip: cursor ? 1 : 0,
            cursor: cursor ? { id: cursor } : undefined,
            orderBy: { id: "asc" }
        });
        if (customers.length === 0)
            break;
        for (const customer of customers) {
            totalProcessed++;
            const summary = (0, exports.calculateCustomerDues)(customer.orders);
            if (summary.eligibleOrdersCount > 0 && summary.totalDue > 0) {
                totalWithDues++;
                yield options.handler({
                    customer: {
                        id: customer.id,
                        name: customer.name,
                        phone: customer.phone
                    },
                    summary
                });
            }
        }
        cursor = customers[customers.length - 1].id;
        if (customers.length < batchSize)
            break;
    }
    return { totalProcessed, totalWithDues };
});
exports.processCustomersWithDuesInBatches = processCustomersWithDuesInBatches;
/**
 * Checks whether an incoming bill ID / order ID string is actually a display label
 * such as "All Dues (16 Bills)" rather than a true database ID.
 */
const isAllDuesDisplayLabel = (str) => {
    if (!str)
        return false;
    const trimmed = String(str).trim();
    return /^all\s*dues/i.test(trimmed);
};
exports.isAllDuesDisplayLabel = isAllDuesDisplayLabel;
/**
 * Reconciles chronological ledger events with high-precision Decimal arithmetic
 * and deterministic tie-breaking (timestamps, CHARGE before PAYMENT, then ID).
 */
const calculateChronologicalLedger = (events) => {
    // 1. Deterministic sort: chronological ascending
    const sorted = [...events].sort((a, b) => {
        const timeA = a.date instanceof Date ? a.date.getTime() : new Date(a.date).getTime();
        const timeB = b.date instanceof Date ? b.date.getTime() : new Date(b.date).getTime();
        const timeDiff = timeA - timeB;
        if (timeDiff !== 0)
            return timeDiff;
        // Charges processed before Payments for the same timestamp so balance doesn't falsely dip negative
        if (a.type === "CHARGE" && b.type === "PAYMENT")
            return -1;
        if (a.type === "PAYMENT" && b.type === "CHARGE")
            return 1;
        return a.id.localeCompare(b.id);
    });
    let runningBalanceDec = new decimal_js_1.default(0);
    let totalSpendDec = new decimal_js_1.default(0);
    let totalPaidDec = new decimal_js_1.default(0);
    const ledger = sorted.map((event) => {
        const amountDec = new decimal_js_1.default(event.amount || 0);
        if (event.type === "CHARGE") {
            totalSpendDec = totalSpendDec.plus(amountDec);
            runningBalanceDec = runningBalanceDec.plus(amountDec);
        }
        else {
            totalPaidDec = totalPaidDec.plus(amountDec);
            runningBalanceDec = runningBalanceDec.minus(amountDec);
        }
        return Object.assign(Object.assign({}, event), { amount: Number(amountDec.toFixed(2)), runningBalance: Number(runningBalanceDec.toFixed(2)) });
    });
    const totalSpend = Number(totalSpendDec.toFixed(2));
    const totalPaid = Number(totalPaidDec.toFixed(2));
    const outstandingDue = Number(decimal_js_1.default.max(0, runningBalanceDec).toFixed(2));
    return {
        ledger,
        totalSpend,
        totalPaid,
        outstandingDue
    };
};
exports.calculateChronologicalLedger = calculateChronologicalLedger;
/**
 * Pure function to simulate or compute multi-bill payment allocation.
 * Guarantees zero floating-point drift and enforces exact bill limits.
 */
const allocateBulkPaymentAcrossBills = (bills, availableAmount) => {
    let remaining = new decimal_js_1.default(availableAmount !== undefined && availableAmount !== null ? availableAmount.toString() : 0);
    let totalAllocatedDec = new decimal_js_1.default(0);
    const allocations = [];
    for (const bill of bills) {
        if (remaining.lessThanOrEqualTo(0)) {
            const billDue = (0, exports.calculateOrderDue)(bill);
            allocations.push({
                orderId: bill.id,
                allocatedAmount: 0,
                previousPaid: billDue.paidAmount,
                remainingDue: billDue.dueAmount,
                isFullyPaid: billDue.dueAmount <= 0
            });
            continue;
        }
        const billTotalDec = new decimal_js_1.default(bill.totalAmount ? bill.totalAmount.toString() : 0);
        const paidDec = (0, exports.calculateOrderPaidAmountDecimal)(bill.payments);
        const dueDec = decimal_js_1.default.max(0, billTotalDec.minus(paidDec));
        if (dueDec.lessThanOrEqualTo(0.005)) {
            allocations.push({
                orderId: bill.id,
                allocatedAmount: 0,
                previousPaid: Number(paidDec.toFixed(2)),
                remainingDue: 0,
                isFullyPaid: true
            });
            continue;
        }
        const toApplyDec = decimal_js_1.default.min(remaining, dueDec);
        const toApply = Number(toApplyDec.toFixed(2));
        remaining = remaining.minus(toApplyDec);
        totalAllocatedDec = totalAllocatedDec.plus(toApplyDec);
        const newPaidDec = paidDec.plus(toApplyDec);
        const newRemainingDec = decimal_js_1.default.max(0, billTotalDec.minus(newPaidDec));
        const isFull = newRemainingDec.lessThanOrEqualTo(0.005);
        allocations.push({
            orderId: bill.id,
            allocatedAmount: toApply,
            previousPaid: Number(paidDec.toFixed(2)),
            remainingDue: Number(newRemainingDec.toFixed(2)),
            isFullyPaid: isFull
        });
    }
    return {
        allocations,
        totalAllocated: Number(totalAllocatedDec.toFixed(2)),
        excessAmount: Number(remaining.toFixed(2))
    };
};
exports.allocateBulkPaymentAcrossBills = allocateBulkPaymentAcrossBills;
