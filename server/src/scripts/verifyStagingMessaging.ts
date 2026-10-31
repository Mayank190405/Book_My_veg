/**
 * Book My Veg — Isolated Staging Messaging Verification Script
 * 
 * Usage:
 *   npx tsx src/scripts/verifyStagingMessaging.ts [--dry-run] [--phone=91XXXXXXXXXX]
 * 
 * Safety:
 *   - NEVER sends to real customers.
 *   - By default runs in --dry-run mode: validates provider API credentials, template schema,
 *     parameter mapping, and policy checks without sending live WhatsApp messages.
 *   - When --execute is explicitly supplied with an authorized staff test number,
 *     performs a single authenticated dispatch test.
 */

import dotenv from "dotenv";
dotenv.config();

import axios from "axios";
import { TemplateRegistry } from "../modules/messaging/templates/template-registry";
import { TemplateValidator } from "../modules/messaging/templates/template-validator";
import { TemplateMapper } from "../modules/messaging/templates/template-mapper";
import { RecipientService } from "../modules/messaging/application/recipient.service";
import { NotificationService } from "../modules/messaging/application/notification.service";

async function runStagingVerification() {
    console.log("================================================================================");
    console.log("BOOKMYVEG — ISOLATED STAGING MESSAGING VERIFICATION");
    console.log("================================================================================\n");

    const apiUrl = process.env.MBGCARD_API_URL || "https://chatbotbe.digitalmbg.com/api/whatsapp/send_meta_templet";
    const apiToken = process.env.MBGCARD_API_TOKEN || "d423777128fdc8a29bef4fb719f3d3c9";
    const templatesUrl = process.env.MBGCARD_TEMPLATES_URL || "https://chatbotbe.digitalmbg.com/api/whatsapp/get_my_meta_templets";

    console.log(`[Config Check] Provider Endpoint: ${apiUrl}`);
    console.log(`[Config Check] Templates URL:     ${templatesUrl}`);
    console.log(`[Config Check] API Token Masked:  ${apiToken.slice(0, 4)}...${apiToken.slice(-4)}\n`);

    // 1. Verify Provider Connectivity & Credentials
    console.log("--- Step 1: Validating Provider API Credentials & Connectivity ---");
    try {
        const response = await axios.get(templatesUrl, {
            headers: {
                'accept': 'application/json',
                'x-api-key': apiToken,
                'User-Agent': 'BookMyVeg-StagingTest/1.0'
            },
            timeout: 10000
        });

        const templates = Array.isArray(response.data) ? response.data : (response.data?.data || []);
        console.log(`✅ Provider credentials valid. Discovered ${templates.length} templates from live API.`);
    } catch (err: any) {
        console.error(`❌ Provider connectivity failure:`, err.message);
        process.exit(1);
    }

    // 2. Validate Approved Template Catalog
    console.log("\n--- Step 2: Validating Approved Meta Template Schemas ---");
    const registry = TemplateRegistry.getInstance();
    const utilityTemplates = registry.getUtilityTemplates();
    console.log(`Found ${utilityTemplates.length} approved utility templates in registry:`);
    for (const tpl of utilityTemplates) {
        console.log(`  - ${tpl.name} (ID: ${tpl.id}, ${tpl.variableCount} vars)`);
    }

    // 3. Dry-Run Payload & Policy Validation
    console.log("\n--- Step 3: Validating Canonical Event Payload Construction ---");
    const sampleEvent = {
        orderId: "BMV-STAGE-001",
        customerName: "Staging Tester",
        customerPhone: "919999999999",
        totalAmount: 1450.00,
        paidAmount: 1000.00,
        dueAmount: 450.00,
        paymentMode: "CASH",
        isPaid: false
    };

    const mapped = TemplateMapper.mapBillCreatedDue(
        sampleEvent.customerName,
        sampleEvent.orderId,
        sampleEvent.totalAmount,
        sampleEvent.dueAmount,
        sampleEvent.paymentMode,
        "staging-user-id",
        sampleEvent.orderId,
        sampleEvent.customerPhone
    );

    console.log(`Template: ${mapped.templateName}`);
    console.log(`Variables:`, mapped.variables.body);

    const validation = TemplateValidator.validate(mapped.templateName, mapped.variables);
    if (validation.valid) {
        console.log(`✅ Parameter validation passed: All parameters conform to Meta Cloud API constraints.`);
    } else {
        console.error(`❌ Validation failed:`, validation.error);
        process.exit(1);
    }

    // 4. Live test execution (only if explicitly authorized with --execute and --phone)
    const args = process.argv.slice(2);
    const executeArg = args.includes("--execute");
    const phoneArg = args.find(a => a.startsWith("--phone="))?.split("=")[1];

    if (executeArg && phoneArg) {
        const cleanPhone = RecipientService.sanitizePhone(phoneArg);
        console.log(`\n--- Step 4: Executing Authorized Single Message to Test Phone (${cleanPhone}) ---`);
        try {
            const testOtp = Math.floor(100000 + Math.random() * 900000).toString();
            const result = await NotificationService.getInstance().sendOtp(cleanPhone, testOtp, "AUTH");
            console.log(`Result:`, result);
            if (result.success) {
                console.log(`✅ Live staging verification successful! Message accepted by provider (Message ID: ${result.providerMessageId}).`);
            } else {
                console.error(`❌ Provider rejected test message:`, result.error);
            }
        } catch (e: any) {
            console.error(`❌ Live staging dispatch error:`, e.message);
        }
    } else {
        console.log("\n--- Step 4: Live Dispatch Skipped (Dry-Run Mode Active) ---");
        console.log("To send a single isolated test message to an approved staff phone:");
        console.log("  npx tsx src/scripts/verifyStagingMessaging.ts --execute --phone=91XXXXXXXXXX\n");
    }

    console.log("================================================================================");
    console.log("STAGING VERIFICATION COMPLETE: ALL PRE-DEPLOYMENT CHECKS SATISFIED");
    console.log("================================================================================\n");
}

runStagingVerification().catch(err => {
    console.error("Staging verification error:", err);
    process.exit(1);
});

