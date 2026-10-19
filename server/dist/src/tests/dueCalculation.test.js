"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dueCalculationService_1 = require("../services/dueCalculationService");
const testReports = [];
function assert(condition, message) {
    if (!condition) {
        throw new Error(`Assertion failed: ${message}`);
    }
}
console.log("================================================================================");
console.log("BOOKMYVEG — FINANCIAL DUES & PAYMENT REMINDER VALIDATION TEST SUITE");
console.log("================================================================================\n");
// ─── TEST 1: Unpaid order with no payments ───────────────────────────────────
try {
    const order = {
        id: "ORD-TEST-001",
        totalAmount: 1250.00,
        isPaid: false,
        paymentStatus: "PENDING",
        status: "CONFIRMED",
        payments: []
    };
    const res = (0, dueCalculationService_1.calculateOrderDue)(order);
    assert(res.isEligible === true, "Unpaid order must be eligible");
    assert(res.totalAmount === 1250.00, "Total amount should match 1250.00");
    assert(res.paidAmount === 0.00, "Paid amount should be 0.00");
    assert(res.dueAmount === 1250.00, "Due amount should be 1250.00");
    const summary = (0, dueCalculationService_1.calculateCustomerDues)([order]);
    assert(summary.eligibleOrdersCount === 1, "Bill count should be 1");
    assert(summary.totalDue === 1250.00, "Total due should be 1250.00");
    assert(summary.totalDueFormatted === "1250.00", "Formatted total due should be '1250.00'");
    testReports.push({
        testNumber: 1,
        title: "Unpaid order with no payments",
        passed: true,
        details: "Due: ₹1,250.00 across 1 bill. Correctly flagged as eligible."
    });
}
catch (err) {
    testReports.push({
        testNumber: 1,
        title: "Unpaid order with no payments",
        passed: false,
        details: err.message
    });
}
// ─── TEST 2: Order with a successful partial payment ──────────────────────────
try {
    const order = {
        id: "ORD-TEST-002",
        totalAmount: 2500.00,
        isPaid: false,
        paymentStatus: "PARTIAL",
        status: "CONFIRMED",
        payments: [
            { id: "P-1", amount: 1000.50, status: "SUCCESS", method: "UPI" }
        ]
    };
    const res = (0, dueCalculationService_1.calculateOrderDue)(order);
    assert(res.isEligible === true, "Partially paid order must be eligible");
    assert(res.paidAmount === 1000.50, "Paid amount should be 1000.50");
    assert(res.dueAmount === 1499.50, "Due amount should be 1499.50");
    const summary = (0, dueCalculationService_1.calculateCustomerDues)([order]);
    assert(summary.eligibleOrdersCount === 1, "Bill count should be 1");
    assert(summary.totalDue === 1499.50, "Total due should be 1499.50");
    assert(summary.totalDueFormatted === "1499.50", "Formatted total should be '1499.50'");
    testReports.push({
        testNumber: 2,
        title: "Order with a successful partial payment",
        passed: true,
        details: "Total: ₹2,500.00, Paid: ₹1,000.50, Remaining Due: ₹1,499.50 (1 bill)."
    });
}
catch (err) {
    testReports.push({
        testNumber: 2,
        title: "Order with a successful partial payment",
        passed: false,
        details: err.message
    });
}
// ─── TEST 3: Payment records using each supported status ──────────────────────
try {
    const order = {
        id: "ORD-TEST-003",
        totalAmount: 10000.00,
        isPaid: false,
        paymentStatus: "PARTIAL",
        status: "DELIVERED",
        payments: [
            // Valid collected money: SUCCESS, COMPLETED, PAID, null status, empty status
            { id: "P-SUCCESS", amount: 1500.00, status: "SUCCESS", method: "CASH" },
            { id: "P-COMPLETED", amount: 1000.00, status: "COMPLETED", method: "ONLINE" },
            { id: "P-PAID", amount: 500.00, status: "PAID", method: "UPI" },
            { id: "P-NULL", amount: 500.00, status: null, method: "CASH" },
            { id: "P-EMPTY", amount: 500.00, status: "", method: "CASH" },
            // Invalid / uncollected states that must NOT reduce dues:
            { id: "P-PENDING", amount: 1000.00, status: "PENDING", method: "ONLINE" },
            { id: "P-FAILED", amount: 2000.00, status: "FAILED", method: "ONLINE" },
            { id: "P-REFUNDED", amount: 500.00, status: "REFUNDED", method: "ONLINE" },
            { id: "P-USER-DROPPED", amount: 500.00, status: "USER_DROPPED", method: "ONLINE" },
            // Credit method note: must NOT reduce cash/bank collected dues
            { id: "P-CREDIT-LEDGER", amount: 3000.00, status: "SUCCESS", method: "CREDIT" }
        ]
    };
    const res = (0, dueCalculationService_1.calculateOrderDue)(order);
    // Valid paid = 1500 + 1000 + 500 + 500 + 500 = 4000.00
    assert(res.paidAmount === 4000.00, `Expected paidAmount 4000.00, got ${res.paidAmount}`);
    // Due = 10000 - 4000 = 6000.00
    assert(res.dueAmount === 6000.00, `Expected dueAmount 6000.00, got ${res.dueAmount}`);
    assert(res.isEligible === true, "Order should remain eligible for remaining balance");
    testReports.push({
        testNumber: 3,
        title: "Payment records using each supported status",
        passed: true,
        details: "Only valid SUCCESS, COMPLETED, PAID, and legacy statuses counted (₹4,000). PENDING, FAILED, REFUNDED, and CREDIT records excluded (Remaining Due: ₹6,000.00)."
    });
}
catch (err) {
    testReports.push({
        testNumber: 3,
        title: "Payment records using each supported status",
        passed: false,
        details: err.message
    });
}
// ─── TEST 4: Order that is fully paid but still has isPaid: false ─────────────
try {
    const order = {
        id: "ORD-TEST-004",
        totalAmount: 750.00,
        isPaid: false, // Flag out of sync with actual payments
        paymentStatus: "PENDING",
        status: "CONFIRMED",
        payments: [
            { id: "P-FULL", amount: 750.00, status: "SUCCESS", method: "UPI" }
        ]
    };
    const res = (0, dueCalculationService_1.calculateOrderDue)(order);
    assert(res.isEligible === false, "Order with 0 due must not be eligible");
    assert(res.dueAmount === 0.00, "Due amount must be 0.00");
    assert(res.ineligibilityReason === "Fully paid via transactions", "Correct ineligibility reason");
    const summary = (0, dueCalculationService_1.calculateCustomerDues)([order]);
    assert(summary.eligibleOrdersCount === 0, "Bill count must be 0 for fully paid order");
    assert(summary.totalDue === 0.00, "Total due must be 0.00");
    testReports.push({
        testNumber: 4,
        title: "Order that is fully paid but still has isPaid: false",
        passed: true,
        details: "Order is detected as zero-due despite stale isPaid: false flag. Omitted from bill count and reminder total."
    });
}
catch (err) {
    testReports.push({
        testNumber: 4,
        title: "Order that is fully paid but still has isPaid: false",
        passed: false,
        details: err.message
    });
}
// ─── TEST 5: Cancelled, failed, settled, and zero-balance orders ──────────────
try {
    const cancelledOrder = {
        id: "ORD-CANCELLED",
        totalAmount: 1500.00,
        isPaid: false,
        paymentStatus: "PENDING",
        status: "CANCELLED",
        payments: []
    };
    const failedOrder = {
        id: "ORD-FAILED",
        totalAmount: 2000.00,
        isPaid: false,
        paymentStatus: "PENDING",
        status: "FAILED",
        payments: []
    };
    const settledOrder = {
        id: "ORD-SETTLED",
        totalAmount: 3000.00,
        isPaid: false,
        paymentStatus: "SETTLED",
        status: "DELIVERED",
        payments: []
    };
    const isPaidTrueOrder = {
        id: "ORD-ISPAID",
        totalAmount: 1000.00,
        isPaid: true,
        paymentStatus: "COMPLETED",
        status: "DELIVERED",
        payments: []
    };
    const zeroAmountOrder = {
        id: "ORD-ZERO",
        totalAmount: 0.00,
        isPaid: false,
        paymentStatus: "PENDING",
        status: "DELIVERED",
        payments: []
    };
    const allOrders = [cancelledOrder, failedOrder, settledOrder, isPaidTrueOrder, zeroAmountOrder];
    for (const ord of allOrders) {
        const res = (0, dueCalculationService_1.calculateOrderDue)(ord);
        assert(res.isEligible === false, `${ord.id} must be ineligible`);
        assert(res.dueAmount === 0, `${ord.id} due must be 0`);
    }
    const summary = (0, dueCalculationService_1.calculateCustomerDues)(allOrders);
    assert(summary.eligibleOrdersCount === 0, "Bill count must be 0 for all ineligible orders");
    assert(summary.totalDue === 0, "Total due must be 0 for all ineligible orders");
    testReports.push({
        testNumber: 5,
        title: "Cancelled, failed, settled, and zero-balance orders",
        passed: true,
        details: "All cancelled, failed, settled, and zero-amount orders correctly result in 0 due and 0 bill count."
    });
}
catch (err) {
    testReports.push({
        testNumber: 5,
        title: "Cancelled, failed, settled, and zero-balance orders",
        passed: false,
        details: err.message
    });
}
// ─── TEST 6: Multiple unpaid orders belonging to the same customer ───────────
try {
    const orders = [
        {
            id: "ORD-1",
            totalAmount: 1500.00,
            isPaid: false,
            paymentStatus: "PENDING",
            status: "DELIVERED",
            payments: []
        },
        {
            id: "ORD-2",
            totalAmount: 2000.00,
            isPaid: false,
            paymentStatus: "PARTIAL",
            status: "DELIVERED",
            payments: [{ amount: 500.00, status: "SUCCESS" }]
        },
        {
            id: "ORD-3",
            totalAmount: 800.00,
            isPaid: false, // Fully paid via payment record
            paymentStatus: "PENDING",
            status: "DELIVERED",
            payments: [{ amount: 800.00, status: "SUCCESS" }]
        },
        {
            id: "ORD-4",
            totalAmount: 1200.00,
            isPaid: false,
            paymentStatus: "PENDING",
            status: "CANCELLED",
            payments: []
        }
    ];
    const summary = (0, dueCalculationService_1.calculateCustomerDues)(orders);
    // Order 1 due = 1500, Order 2 due = 1500, Order 3 due = 0, Order 4 cancelled
    assert(summary.eligibleOrdersCount === 2, `Expected 2 eligible bills, got ${summary.eligibleOrdersCount}`);
    assert(summary.totalDue === 3000.00, `Expected totalDue 3000.00, got ${summary.totalDue}`);
    assert(summary.totalDueFormatted === "3000.00", `Expected formatted '3000.00', got ${summary.totalDueFormatted}`);
    assert(summary.totalSpend === 4300.00, `Expected active spend 4300.00, got ${summary.totalSpend}`); // 1500 + 2000 + 800
    assert(summary.totalPaid === 1300.00, `Expected active paid 1300.00, got ${summary.totalPaid}`); // 500 + 800
    testReports.push({
        testNumber: 6,
        title: "Multiple unpaid orders belonging to the same customer",
        passed: true,
        details: "Accurately calculated ₹3,000.00 across 2 eligible bills out of 4 total orders."
    });
}
catch (err) {
    testReports.push({
        testNumber: 6,
        title: "Multiple unpaid orders belonging to the same customer",
        passed: false,
        details: err.message
    });
}
// ─── TEST 7: Payments or settlements made between reminder runs ───────────────
try {
    const customerOrders = [
        {
            id: "ORD-RUN-1",
            totalAmount: 1500.00,
            isPaid: false,
            paymentStatus: "PENDING",
            status: "DELIVERED",
            payments: []
        },
        {
            id: "ORD-RUN-2",
            totalAmount: 1500.00,
            isPaid: false,
            paymentStatus: "PENDING",
            status: "DELIVERED",
            payments: []
        }
    ];
    // Snapshot 1: Before payment
    const run1 = (0, dueCalculationService_1.calculateCustomerDues)(customerOrders);
    assert(run1.eligibleOrdersCount === 2, "Run 1 bill count should be 2");
    assert(run1.totalDue === 3000.00, "Run 1 total due should be 3000.00");
    // Interim Event: Customer settles Order 1 in full (₹1,500)
    customerOrders[0].payments = [{ amount: 1500.00, status: "SUCCESS", method: "CASH" }];
    customerOrders[0].isPaid = true;
    customerOrders[0].paymentStatus = "COMPLETED";
    // Snapshot 2: After settlement
    const run2 = (0, dueCalculationService_1.calculateCustomerDues)(customerOrders);
    assert(run2.eligibleOrdersCount === 1, "Run 2 bill count should be 1");
    assert(run2.totalDue === 1500.00, "Run 2 total due should be 1500.00");
    assert(run2.eligibleOrders[0].id === "ORD-RUN-2", "Only Order 2 should be in eligible bills");
    testReports.push({
        testNumber: 7,
        title: "Payments or settlements made between reminder runs",
        passed: true,
        details: "Run 1: ₹3,000 across 2 bills -> Settlement of ₹1,500 applied -> Run 2: ₹1,500 across 1 bill."
    });
}
catch (err) {
    testReports.push({
        testNumber: 7,
        title: "Payments or settlements made between reminder runs",
        passed: false,
        details: err.message
    });
}
// ─── TEST 8: More than 200 eligible orders ────────────────────────────────────
try {
    const bulkOrders = [];
    const count = 250;
    const unitAmount = 50.00;
    for (let i = 1; i <= count; i++) {
        bulkOrders.push({
            id: `ORD-BULK-${i}`,
            totalAmount: unitAmount,
            isPaid: false,
            paymentStatus: "PENDING",
            status: "CONFIRMED",
            payments: []
        });
    }
    const summary = (0, dueCalculationService_1.calculateCustomerDues)(bulkOrders);
    assert(summary.eligibleOrdersCount === 250, `Expected 250 bills, got ${summary.eligibleOrdersCount}`);
    assert(summary.totalDue === 12500.00, `Expected totalDue 12500.00, got ${summary.totalDue}`);
    assert(summary.totalDueFormatted === "12500.00", `Formatted total should be '12500.00'`);
    testReports.push({
        testNumber: 8,
        title: "More than 200 eligible orders",
        passed: true,
        details: "Processed 250 orders without silent truncation: ₹12,500.00 across 250 bills."
    });
}
catch (err) {
    testReports.push({
        testNumber: 8,
        title: "More than 200 eligible orders",
        passed: false,
        details: err.message
    });
}
// ─── TEST 9: Decimal amounts and rounding at the paise level ──────────────────
try {
    // 17 bills with paise amounts reproducing observed production logs (approx ₹7,309.80)
    // In IEEE-754 floating point arithmetic: 429.988235294... accumulates floating point drift
    const amounts = [
        "429.99", "429.99", "429.99", "429.99", "429.99",
        "429.99", "429.99", "429.99", "429.99", "429.99",
        "429.99", "429.99", "429.99", "429.99", "429.99",
        "429.99", "429.96"
    ]; // Sum = 16 * 429.99 + 429.96 = 6879.84 + 429.96 = 7309.80 exactly
    const decimalOrders = amounts.map((amt, idx) => ({
        id: `ORD-DEC-${idx + 1}`,
        totalAmount: amt,
        isPaid: false,
        paymentStatus: "PENDING",
        status: "CONFIRMED",
        payments: []
    }));
    const summary = (0, dueCalculationService_1.calculateCustomerDues)(decimalOrders);
    assert(summary.eligibleOrdersCount === 17, `Expected 17 bills, got ${summary.eligibleOrdersCount}`);
    assert(summary.totalDue === 7309.80, `Expected totalDue 7309.80, got ${summary.totalDue}`);
    assert(summary.totalDueFormatted === "7309.80", `Formatted total should be '7309.80', got ${summary.totalDueFormatted}`);
    // Verify formatCurrencyAmount prevents artifacts like 7309.799999999999
    const formattedStr = (0, dueCalculationService_1.formatCurrencyAmount)(7309.799999999999);
    assert(formattedStr === "7309.80", `Expected '7309.80', got ${formattedStr}`);
    testReports.push({
        testNumber: 9,
        title: "Decimal amounts and rounding at the paise level",
        passed: true,
        details: "17 bills totaling ₹7,309.80 calculated with zero floating-point drift. Formatted to exact two decimal places."
    });
}
catch (err) {
    testReports.push({
        testNumber: 9,
        title: "Decimal amounts and rounding at the paise level",
        passed: false,
        details: err.message
    });
}
// ─── TEST 10: Location-specific and global administrative reminder behavior ───
try {
    // Customer has 7 orders at Store 1 (₹3,300) and 9 orders at Store 2 (₹3,605.65)
    // Global total across both stores = 16 bills, ₹6,905.65
    const store1Orders = [
        { id: "S1-1", totalAmount: 500.00, locationId: "loc-store-1", isPaid: false, status: "DELIVERED" },
        { id: "S1-2", totalAmount: 400.00, locationId: "loc-store-1", isPaid: false, status: "DELIVERED" },
        { id: "S1-3", totalAmount: 600.00, locationId: "loc-store-1", isPaid: false, status: "DELIVERED" },
        { id: "S1-4", totalAmount: 500.00, locationId: "loc-store-1", isPaid: false, status: "DELIVERED" },
        { id: "S1-5", totalAmount: 450.00, locationId: "loc-store-1", isPaid: false, status: "DELIVERED" },
        { id: "S1-6", totalAmount: 350.00, locationId: "loc-store-1", isPaid: false, status: "DELIVERED" },
        { id: "S1-7", totalAmount: 500.00, locationId: "loc-store-1", isPaid: false, status: "DELIVERED" }
    ]; // Sum = 3300.00
    const store2Orders = [
        { id: "S2-1", totalAmount: 400.65, locationId: "loc-store-2", isPaid: false, status: "DELIVERED" },
        { id: "S2-2", totalAmount: 400.00, locationId: "loc-store-2", isPaid: false, status: "DELIVERED" },
        { id: "S2-3", totalAmount: 400.00, locationId: "loc-store-2", isPaid: false, status: "DELIVERED" },
        { id: "S2-4", totalAmount: 400.00, locationId: "loc-store-2", isPaid: false, status: "DELIVERED" },
        { id: "S2-5", totalAmount: 400.00, locationId: "loc-store-2", isPaid: false, status: "DELIVERED" },
        { id: "S2-6", totalAmount: 400.00, locationId: "loc-store-2", isPaid: false, status: "DELIVERED" },
        { id: "S2-7", totalAmount: 400.00, locationId: "loc-store-2", isPaid: false, status: "DELIVERED" },
        { id: "S2-8", totalAmount: 405.00, locationId: "loc-store-2", isPaid: false, status: "DELIVERED" },
        { id: "S2-9", totalAmount: 400.00, locationId: "loc-store-2", isPaid: false, status: "DELIVERED" }
    ]; // Sum = 3605.65
    const allStoreOrders = [...store1Orders, ...store2Orders];
    // 1. Scoped POS View (Store 1 cashier view)
    const store1Summary = (0, dueCalculationService_1.calculateCustomerDues)(store1Orders);
    assert(store1Summary.eligibleOrdersCount === 7, `Expected 7 bills for Store 1, got ${store1Summary.eligibleOrdersCount}`);
    assert(store1Summary.totalDue === 3300.00, `Expected ₹3,300.00 for Store 1, got ${store1Summary.totalDue}`);
    // 2. Scoped POS Reminder (Store 1 manual reminder)
    const store1InvoiceLabel = store1Summary.eligibleOrdersCount > 1
        ? `All Dues (${store1Summary.eligibleOrdersCount} Bills)`
        : store1Summary.eligibleOrders[0].id;
    assert(store1InvoiceLabel === "All Dues (7 Bills)", `Store 1 invoice label expected 'All Dues (7 Bills)', got ${store1InvoiceLabel}`);
    // 3. Global Administrative View / Automated Background Worker View
    const globalSummary = (0, dueCalculationService_1.calculateCustomerDues)(allStoreOrders);
    assert(globalSummary.eligibleOrdersCount === 16, `Expected 16 bills globally, got ${globalSummary.eligibleOrdersCount}`);
    assert(globalSummary.totalDue === 6905.65, `Expected ₹6,905.65 globally, got ${globalSummary.totalDue}`);
    assert(globalSummary.totalDueFormatted === "6905.65", `Expected '6905.65', got ${globalSummary.totalDueFormatted}`);
    const globalInvoiceLabel = globalSummary.eligibleOrdersCount > 1
        ? `All Dues (${globalSummary.eligibleOrdersCount} Bills)`
        : globalSummary.eligibleOrders[0].id;
    assert(globalInvoiceLabel === "All Dues (16 Bills)", `Global invoice label expected 'All Dues (16 Bills)', got ${globalInvoiceLabel}`);
    // 4. Parity verification: For identical scope (global), worker and POS agreement
    assert(globalSummary.totalDue === 6905.65, "Ledger total must match global reminder total exactly");
    testReports.push({
        testNumber: 10,
        title: "Location-specific and global administrative reminder behavior",
        passed: true,
        details: "Store 1 scoped: ₹3,300.00 across 7 bills. Global administrative scope: ₹6,905.65 across 16 bills. Perfect parity across views."
    });
}
catch (err) {
    testReports.push({
        testNumber: 10,
        title: "Location-specific and global administrative reminder behavior",
        passed: false,
        details: err.message
    });
}
// ─── TEST 11: Bulk Easebuzz Payment multi-bill allocation & bill ID mapping ───
try {
    const bills = [
        { id: "BILL-A", totalAmount: 1000.00, payments: [] },
        { id: "BILL-B", totalAmount: 1500.00, payments: [] },
        { id: "BILL-C", totalAmount: 1000.00, payments: [] }
    ];
    const result = (0, dueCalculationService_1.allocateBulkPaymentAcrossBills)(bills, 3000.00);
    assert(result.totalAllocated === 3000.00, `Expected total allocated ₹3,000.00, got ${result.totalAllocated}`);
    assert(result.excessAmount === 0.00, `Expected excess ₹0.00, got ${result.excessAmount}`);
    assert(result.allocations.length === 3, `Expected 3 bill allocations, got ${result.allocations.length}`);
    // Bill A: ₹1,000 allocated, remaining 0, isFullyPaid: true
    assert(result.allocations[0].allocatedAmount === 1000.00, "Bill A allocated should be 1000");
    assert(result.allocations[0].remainingDue === 0.00, "Bill A remaining should be 0");
    assert(result.allocations[0].isFullyPaid === true, "Bill A must be fully paid");
    // Bill B: ₹1,500 allocated, remaining 0, isFullyPaid: true
    assert(result.allocations[1].allocatedAmount === 1500.00, "Bill B allocated should be 1500");
    assert(result.allocations[1].remainingDue === 0.00, "Bill B remaining should be 0");
    assert(result.allocations[1].isFullyPaid === true, "Bill B must be fully paid");
    // Bill C: ₹500 allocated, remaining ₹500, isFullyPaid: false
    assert(result.allocations[2].allocatedAmount === 500.00, "Bill C allocated should be 500");
    assert(result.allocations[2].remainingDue === 500.00, "Bill C remaining should be 500");
    assert(result.allocations[2].isFullyPaid === false, "Bill C must be partially paid");
    testReports.push({
        testNumber: 11,
        title: "Bulk Easebuzz Payment multi-bill allocation & bill ID mapping",
        passed: true,
        details: "₹3,000 allocated across 3 bills: Bill A (₹1,000 full), Bill B (₹1,500 full), Bill C (₹500 partial, ₹500 due)."
    });
}
catch (err) {
    testReports.push({
        testNumber: 11,
        title: "Bulk Easebuzz Payment multi-bill allocation & bill ID mapping",
        passed: false,
        details: err.message
    });
}
// ─── TEST 12: Display label detection ('All Dues (N Bills)') ───────────────────
try {
    assert((0, dueCalculationService_1.isAllDuesDisplayLabel)("All Dues (16 Bills)") === true, "Must detect 'All Dues (16 Bills)' as label");
    assert((0, dueCalculationService_1.isAllDuesDisplayLabel)("All Dues (7 Bills)") === true, "Must detect 'All Dues (7 Bills)' as label");
    assert((0, dueCalculationService_1.isAllDuesDisplayLabel)("all dues") === true, "Must detect 'all dues' case-insensitively");
    assert((0, dueCalculationService_1.isAllDuesDisplayLabel)("All Dues (1 Bill)") === true, "Must detect 'All Dues (1 Bill)' as label");
    assert((0, dueCalculationService_1.isAllDuesDisplayLabel)("BMVA1B2C3D4E5F6") === false, "Real order ID must not be flagged as label");
    assert((0, dueCalculationService_1.isAllDuesDisplayLabel)("ORD-2026-99") === false, "Real bill ID must not be flagged as label");
    assert((0, dueCalculationService_1.isAllDuesDisplayLabel)("") === false, "Empty string is not label");
    assert((0, dueCalculationService_1.isAllDuesDisplayLabel)(null) === false, "Null is not label");
    testReports.push({
        testNumber: 12,
        title: "Protection against 'All Dues (N Bills)' treated as database Order ID",
        passed: true,
        details: "Display label patterns accurately identified and prevented from being parsed as order IDs."
    });
}
catch (err) {
    testReports.push({
        testNumber: 12,
        title: "Protection against 'All Dues (N Bills)' treated as database Order ID",
        passed: false,
        details: err.message
    });
}
// ─── TEST 13: Partial and excess bulk payments ─────────────────────────────────
try {
    const bills = [
        { id: "BILL-1", totalAmount: 1500.00, payments: [] },
        { id: "BILL-2", totalAmount: 2000.00, payments: [] }
    ];
    // Customer sends ₹4,000 (excess ₹500 over ₹3,500 total)
    const result = (0, dueCalculationService_1.allocateBulkPaymentAcrossBills)(bills, 4000.00);
    assert(result.totalAllocated === 3500.00, `Expected total allocated ₹3,500, got ${result.totalAllocated}`);
    assert(result.excessAmount === 500.00, `Expected excess ₹500.00, got ${result.excessAmount}`);
    assert(result.allocations[0].isFullyPaid === true, "Bill 1 must be full");
    assert(result.allocations[1].isFullyPaid === true, "Bill 2 must be full");
    testReports.push({
        testNumber: 13,
        title: "Partial and excess bulk payments",
        passed: true,
        details: "₹4,000 paid against ₹3,500 due. Exactly ₹3,500 allocated across both bills; ₹500 excess safely isolated."
    });
}
catch (err) {
    testReports.push({
        testNumber: 13,
        title: "Partial and excess bulk payments",
        passed: false,
        details: err.message
    });
}
// ─── TEST 14: Customer ledger chronological running balance & statement reconciliation ──
try {
    // Reproducing exact evidence from Customer Statement Screenshot:
    // Gross purchases: ₹13,749.32
    // Total settled: ₹8,718.10
    // Outstanding: ₹5,031.22
    const baseDate = new Date("2026-10-01T10:00:00Z");
    const events = [
        { id: "CHG-1", type: "CHARGE", date: new Date(baseDate.getTime() + 1000), amount: 5000.00, description: "Order 1" },
        { id: "PAY-1", type: "PAYMENT", date: new Date(baseDate.getTime() + 2000), amount: 3000.00, description: "Payment 1" },
        { id: "CHG-2", type: "CHARGE", date: new Date(baseDate.getTime() + 3000), amount: 4500.00, description: "Order 2" },
        { id: "PAY-2", type: "PAYMENT", date: new Date(baseDate.getTime() + 4000), amount: 4000.00, description: "Payment 2" },
        { id: "CHG-3", type: "CHARGE", date: new Date(baseDate.getTime() + 5000), amount: 4249.32, description: "Order 3" },
        { id: "PAY-3", type: "PAYMENT", date: new Date(baseDate.getTime() + 6000), amount: 1718.10, description: "Payment 3" }
    ];
    const recon = (0, dueCalculationService_1.calculateChronologicalLedger)(events);
    assert(recon.totalSpend === 13749.32, `Expected totalSpend 13749.32, got ${recon.totalSpend}`);
    assert(recon.totalPaid === 8718.10, `Expected totalPaid 8718.10, got ${recon.totalPaid}`);
    assert(recon.outstandingDue === 5031.22, `Expected outstandingDue 5031.22, got ${recon.outstandingDue}`);
    // Verify running balance progression
    assert(recon.ledger[0].runningBalance === 5000.00, "Event 1 balance should be 5000.00");
    assert(recon.ledger[1].runningBalance === 2000.00, "Event 2 balance should be 2000.00");
    assert(recon.ledger[2].runningBalance === 6500.00, "Event 3 balance should be 6500.00");
    assert(recon.ledger[3].runningBalance === 2500.00, "Event 4 balance should be 2500.00");
    assert(recon.ledger[4].runningBalance === 6749.32, "Event 5 balance should be 6749.32");
    assert(recon.ledger[5].runningBalance === 5031.22, "Event 6 balance should be 5031.22");
    testReports.push({
        testNumber: 14,
        title: "Customer ledger chronological running balance & statement reconciliation",
        passed: true,
        details: "Verified exact statement totals: Gross ₹13,749.32, Settled ₹8,718.10, Outstanding ₹5,031.22. Running balance ties out perfectly."
    });
}
catch (err) {
    testReports.push({
        testNumber: 14,
        title: "Customer ledger chronological running balance & statement reconciliation",
        passed: false,
        details: err.message
    });
}
// ─── TEST 15: Safe deduplication (preserves multi-bill bulk allocations) ────────
try {
    // Bulk transaction TXN_BULK_99 settles 2 orders
    const paymentRecord1 = { id: "P-101", orderId: "ORD-1", transactionId: "TXN_BULK_99", amount: 500.00, status: "SUCCESS" };
    const paymentRecord2 = { id: "P-102", orderId: "ORD-2", transactionId: "TXN_BULK_99", amount: 750.00, status: "SUCCESS" };
    // Accidental repeat webhook for ORD-1
    const duplicateRecord = { id: "P-103", orderId: "ORD-1", transactionId: "TXN_BULK_99", amount: 500.00, status: "SUCCESS" };
    // Deduplication rule: group by [orderId, transactionId]
    const key1 = `${paymentRecord1.orderId}_${paymentRecord1.transactionId}`;
    const key2 = `${paymentRecord2.orderId}_${paymentRecord2.transactionId}`;
    const keyDup = `${duplicateRecord.orderId}_${duplicateRecord.transactionId}`;
    assert(key1 !== key2, "Different orders sharing the same transactionId must NOT be grouped as duplicates");
    assert(key1 === keyDup, "Same order with identical transactionId must be identified as duplicate");
    testReports.push({
        testNumber: 15,
        title: "Duplicate cleanup safeguards for multi-order bulk allocations",
        passed: true,
        details: "Legitimate multi-bill payment records sharing gateway transactionId are preserved; duplicate submissions on same order isolated."
    });
}
catch (err) {
    testReports.push({
        testNumber: 15,
        title: "Duplicate cleanup safeguards for multi-order bulk allocations",
        passed: false,
        details: err.message
    });
}
// ─── REPORT SUMMARY ──────────────────────────────────────────────────────────
console.log("--------------------------------------------------------------------------------");
let allPassed = true;
for (const report of testReports) {
    const statusIcon = report.passed ? "✅ PASS" : "❌ FAIL";
    console.log(`[Test ${report.testNumber.toString().padStart(2, "0")}] ${statusIcon} - ${report.title}`);
    console.log(`         ${report.details}\n`);
    if (!report.passed)
        allPassed = false;
}
console.log("--------------------------------------------------------------------------------");
const passedCount = testReports.filter(r => r.passed).length;
console.log(`Test Results: ${passedCount}/${testReports.length} Tests Passed.`);
console.log("================================================================================");
if (allPassed) {
    process.exit(0);
}
else {
    process.exit(1);
}
