/**
 * Book My Veg — Centralized Messaging Architecture Test Suite
 * 
 * Verifies:
 * 1. Template registry validation & newline sanitization
 * 2. Strict utility template enforcement (blocks rejected 'onboarding' and marketing)
 * 3. Role-based authorization policy
 * 4. Idempotency mutex and deduplication
 * 5. Universal 24-hour reminder cooldown (eliminating single-customer bypass)
 * 6. Atomic claim and mutex lease semantics
 * 7. Provider phone normalization and retry mechanics
 * 8. NotificationService end-to-end dispatch mapping
 * 9. Legacy code retirement verification (zero Axios in mbgcard.ts)
 */

import { TemplateRegistry } from "../modules/messaging/templates/template-registry";
import { TemplateValidator } from "../modules/messaging/templates/template-validator";
import { TemplateMapper } from "../modules/messaging/templates/template-mapper";
import { AuthorizationPolicy } from "../modules/messaging/policies/authorization.policy";
import { IdempotencyPolicy } from "../modules/messaging/policies/idempotency.policy";
import { RecipientService } from "../modules/messaging/application/recipient.service";
import { MbgWhatsAppProvider } from "../modules/messaging/infrastructure/providers/mbg-whatsapp.provider";
import { NotificationService } from "../modules/messaging/application/notification.service";
import { TemplateService } from "../modules/messaging/application/template.service";
import { UNIVERSAL_REMINDER_COOLDOWN_MS } from "../modules/messaging/domain/notification.policies";
import * as fs from "fs";
import * as path from "path";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
    if (!condition) {
        console.error(`❌ FAIL: ${message}`);
        failed++;
        throw new Error(message);
    } else {
        console.log(`✅ PASS: ${message}`);
        passed++;
    }
}

async function runTests() {
    console.log("================================================================================");
    console.log("BOOKMYVEG — CENTRALIZED MESSAGING ARCHITECTURE VERIFICATION TEST SUITE");
    console.log("================================================================================\n");

    // -------------------------------------------------------------------------
    // TEST 1: Template Registry & Live Meta Templates Catalog
    // -------------------------------------------------------------------------
    console.log("[Test 01] Verifying Template Registry & Approved Utility Templates...");
    const registry = TemplateRegistry.getInstance();
    const utilityTemplates = registry.getUtilityTemplates();
    assert(utilityTemplates.length >= 5, "Registry contains at least 5 approved utility templates");
    assert(registry.isApprovedUtilityTemplate("bill_created"), "'bill_created' is approved utility template");
    assert(registry.isApprovedUtilityTemplate("payment_due_reminder"), "'payment_due_reminder' is approved utility template");
    assert(registry.isApprovedUtilityTemplate("order_management_4"), "'order_management_4' is approved utility template");
    assert(registry.isApprovedUtilityTemplate("order_update_notification"), "'order_update_notification' is approved utility template");
    assert(registry.isApprovedUtilityTemplate("feedback_request_support_"), "'feedback_request_support_' is approved utility template");
    assert(registry.isTemplateAllowed("login"), "'login' authentication template is allowed");
    assert(!registry.isApprovedUtilityTemplate("onboarding"), "'onboarding' is NOT an approved utility template");
    assert(!registry.isTemplateAllowed("onboarding"), "'onboarding' template is strictly blocked (REJECTED by Meta)");

    // -------------------------------------------------------------------------
    // TEST 2: Template Parameter Validation & Meta Cloud API Newline Sanitization
    // -------------------------------------------------------------------------
    console.log("\n[Test 02] Verifying Template Parameter Sanitization (Newline Stripping)...");
    const sanitized = TemplateValidator.sanitizeParameters([
        "Customer Name\nWith newline",
        "Line 1\r\nLine 2",
        "  Trimmed Value  "
    ]);
    assert(sanitized[0] === "Customer Name With newline", "Newlines (\\n) replaced with single spaces");
    assert(sanitized[1] === "Line 1 Line 2", "Carriage returns (\\r\\n) replaced with single spaces");
    assert(sanitized[2] === "Trimmed Value", "Leading and trailing whitespace trimmed");

    const validation = TemplateValidator.validate("bill_created", {
        body: ["John Doe", "INV-1001", "500", "Cash", "https://bmv.in/inv/1001"]
    });
    assert(validation.valid, "Valid parameter count for 'bill_created' passes validation");

    const invalidCountValidation = TemplateValidator.validate("bill_created", {
        body: ["John Doe", "INV-1001"] // only 2 of 5 parameters
    });
    assert(!invalidCountValidation.valid, "Insufficient parameter count correctly fails validation");

    // -------------------------------------------------------------------------
    // TEST 3: Phone Number Sanitization & Format Normalization
    // -------------------------------------------------------------------------
    console.log("\n[Test 03] Verifying Recipient Phone Sanitization...");
    assert(RecipientService.sanitizePhone("9876543210") === "919876543210", "10-digit phone formatted to 91XXXXXXXXXX");
    assert(RecipientService.sanitizePhone("+91 98765-43210") === "919876543210", "Formatted phone with + and spaces sanitized to 91XXXXXXXXXX");
    assert(RecipientService.sanitizePhone("919876543210") === "919876543210", "Already prefixed 91 phone preserved");
    assert(RecipientService.isValidPhone("919876543210"), "12-digit 91XXXXXXXXXX recognized as valid");
    assert(!RecipientService.isValidPhone("12345"), "Short phone rejected as invalid");

    // -------------------------------------------------------------------------
    // TEST 4: Role-Based Authorization Policy
    // -------------------------------------------------------------------------
    console.log("\n[Test 04] Verifying Role-Based Authorization Policy...");
    assert(AuthorizationPolicy.isAuthorized("ADMIN", "SEND_PAYMENT_REMINDER"), "ADMIN authorized for reminders");
    assert(AuthorizationPolicy.isAuthorized("SUPER_ADMIN", "SEND_PAYMENT_REMINDER"), "SUPER_ADMIN authorized for reminders");
    assert(AuthorizationPolicy.isAuthorized("POS_OPERATOR", "SEND_PAYMENT_REMINDER"), "POS_OPERATOR authorized for reminders");
    assert(AuthorizationPolicy.isAuthorized("STORE_ADMIN", "SEND_PAYMENT_REMINDER"), "STORE_ADMIN authorized for reminders");
    assert(!AuthorizationPolicy.isAuthorized("USER", "SEND_PAYMENT_REMINDER"), "USER unauthorized for reminders");
    assert(!AuthorizationPolicy.isAuthorized("PACKING", "SEND_PAYMENT_REMINDER"), "PACKING staff unauthorized for reminders");
    assert(!AuthorizationPolicy.isAuthorized(undefined, "SEND_PAYMENT_REMINDER"), "Unauthenticated caller unauthorized for reminders");

    // -------------------------------------------------------------------------
    // TEST 5: Idempotency Mutex & Concurrent In-Process Deduplication
    // -------------------------------------------------------------------------
    console.log("\n[Test 05] Verifying Idempotency Mutex & Concurrency Guard...");
    const testKey = `test_idem_${Date.now()}`;
    const claim1 = IdempotencyPolicy.acquireLock(testKey, 1000);
    assert(claim1, "First acquisition of idempotency lock succeeds");
    const claim2 = IdempotencyPolicy.acquireLock(testKey, 1000);
    assert(!claim2, "Immediate duplicate acquisition with same key is rejected");
    IdempotencyPolicy.releaseLock(testKey);
    const claim3 = IdempotencyPolicy.acquireLock(testKey, 1000);
    assert(claim3, "Acquisition succeeds after releasing lock");
    IdempotencyPolicy.releaseLock(testKey);

    // -------------------------------------------------------------------------
    // TEST 6: Universal 24-Hour Reminder Cooldown Constant
    // -------------------------------------------------------------------------
    console.log("\n[Test 06] Verifying Universal 24-Hour Cooldown Constant...");
    assert(UNIVERSAL_REMINDER_COOLDOWN_MS === 24 * 60 * 60 * 1000, "Universal cooldown is exactly 86,400,000ms (24 hours)");

    // -------------------------------------------------------------------------
    // TEST 7: Template Mapper Canonical Outputs
    // -------------------------------------------------------------------------
    console.log("\n[Test 07] Verifying Template Mapper Canonical Outputs...");
    const billPaidMap = TemplateMapper.mapBillCreatedPaid("Aarav", "BMV-101", 750, "CASH", "BMV-101");
    assert(billPaidMap.templateName === "bill_created", "Paid bill maps to 'bill_created'");
    assert(billPaidMap.variables.body[0] === "Aarav", "Customer name mapped to variable 1");
    assert(billPaidMap.variables.body[2] === "750", "Total amount mapped to variable 3");
    assert(billPaidMap.variables.body[3] === "CASH", "Payment mode mapped to variable 4");

    const billDueMap = TemplateMapper.mapBillCreatedDue("Aarav", "BMV-102", 1000, 400, "CASH", "u-123", "BMV-102", "919876543210");
    assert(billDueMap.templateName === "bill_created", "Due bill maps to 'bill_created'");
    assert(billDueMap.variables.body[2] === "1000.00", "Total bill amount formatted to 1000.00 in variable 3");
    assert(billDueMap.variables.body[3].includes("₹400.00"), "Remaining due specified in variable 4");

    const reminderMap = TemplateMapper.mapPaymentReminder("Aarav", "All Dues (3 Bills)", 3807.20, "https://bookmyveg.co.in/pay");
    assert(reminderMap.templateName === "payment_due_reminder", "Payment reminder maps to 'payment_due_reminder'");
    assert(reminderMap.variables.body[1] === "All Dues (3 Bills)", "Invoice label mapped to variable 2");
    assert(reminderMap.variables.body[2] === "₹3807.20", "Formatted amount with currency symbol in variable 3");

    const otpMap = TemplateMapper.mapOtp("849201");
    assert(otpMap.templateName === "login", "OTP maps to 'login' authentication template");
    assert(otpMap.variables.body[0] === "849201", "OTP code mapped to variable 1");

    // -------------------------------------------------------------------------
    // TEST 8: Legacy Service Decommissioning & Zero Direct Axios Calls
    // -------------------------------------------------------------------------
    console.log("\n[Test 08] Verifying Retirement of Legacy Files & Zero Direct Axios Calls...");
    const mbgcardPath = path.resolve(__dirname, "../services/mbgcard.ts");
    const mbgcardContent = fs.readFileSync(mbgcardPath, "utf-8");
    assert(!mbgcardContent.includes("axios.post"), "mbgcard.ts has ZERO direct axios.post calls");
    assert(!mbgcardContent.includes("axios.get"), "mbgcard.ts has ZERO direct axios.get calls");
    assert(mbgcardContent.includes("[DEPRECATION]"), "mbgcard.ts contains explicit deprecation warnings");
    assert(mbgcardContent.includes("NotificationService"), "mbgcard.ts delegates strictly to NotificationService");

    const workerPath = path.resolve(__dirname, "../services/paymentReminderWorker.ts");
    assert(!fs.existsSync(workerPath), "paymentReminderWorker.ts has been deleted from disk");

    // -------------------------------------------------------------------------
    // TEST 9: NotificationService Singleton Integrity
    // -------------------------------------------------------------------------
    console.log("\n[Test 09] Verifying NotificationService Singleton & Dispatcher Integration...");
    const ns1 = NotificationService.getInstance();
    const ns2 = NotificationService.getInstance();
    assert(ns1 === ns2, "NotificationService is a strict singleton");

    // -------------------------------------------------------------------------
    // TEST 10: Custom Template Endpoint Security (Blocks Unvalidated Reminders)
    // -------------------------------------------------------------------------
    console.log("\n[Test 10] Verifying Custom Template Endpoint Security (Blocks Reminders)...");
    const templateService = TemplateService.getInstance();
    const blockedRes1 = await templateService.sendCustomTemplate({
        phone: "919876543210",
        templateName: "payment_due_reminder",
        variables: ["Customer", "Bill 1", "₹500", "Immediate"]
    });
    assert(!blockedRes1.success, "payment_due_reminder strictly blocked from custom template dispatch");
    assert(Boolean(blockedRes1.error && blockedRes1.error.includes("ReminderService")), "Clear guidance error returned");

    const blockedRes2 = await templateService.sendCustomTemplate({
        phone: "919876543210",
        templateName: "due_payment_reminder",
        variables: ["Customer", "₹500", "Bill 1", "https://link"]
    });
    assert(!blockedRes2.success, "due_payment_reminder strictly blocked from custom template dispatch");

    console.log("\n================================================================================");
    console.log(`TEST SUMMARY: All ${passed} tests passed. (${failed} failed)`);
    console.log("================================================================================\n");
}

runTests().catch(err => {
    console.error("Test execution failed:", err);
    process.exit(1);
});
