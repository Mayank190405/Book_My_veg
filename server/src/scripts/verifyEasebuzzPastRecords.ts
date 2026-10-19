import dotenv from "dotenv";
dotenv.config();

import { syncEasebuzzTransactions } from "../services/easebuzzSyncService";
import logger from "../utils/logger";

const run = async () => {
    const args = process.argv.slice(2);
    const isCommit = args.includes("--commit");
    const dryRun = !isCommit;

    // Parse custom date ranges if passed, e.g. --start=01-01-2024 --end=19-10-2026
    const startArg = args.find(a => a.startsWith("--start="));
    const endArg = args.find(a => a.startsWith("--end="));
    const customStartDate = startArg ? startArg.split("=")[1] : undefined;
    const customEndDate = endArg ? endArg.split("=")[1] : undefined;

    console.log("================================================================================");
    console.log("BOOKMYVEG — EASEBUZZ HISTORICAL PAYMENT VERIFICATION & SYNC");
    console.log("================================================================================");
    console.log(`Execution Mode     : ${dryRun ? "🔍 READ-ONLY DRY-RUN (Safe, no database changes)" : "⚡ LIVE COMMIT (Applying verified settlements)"}`);
    console.log(`Date Range Filter  : ${customStartDate || "Full History (from earliest order)"} -> ${customEndDate || "Today"}`);
    console.log(`Gateway Key        : ${process.env.EASEBUZZ_KEY || process.env.EASEBUZZ_MERCHANT_KEY ? "CONFIGURED (***)" : "MISSING ⚠️"}`);
    console.log(`Gateway Salt       : ${process.env.EASEBUZZ_SALT ? "CONFIGURED (***)" : "MISSING ⚠️"}`);
    console.log(`Environment        : ${process.env.EASEBUZZ_ENV || process.env.ENV || "test"}`);
    console.log("================================================================================\n");

    try {
        console.log("Connecting to Easebuzz Gateway and querying transaction records...\n");

        const result: any = await syncEasebuzzTransactions({
            customStartDate,
            customEndDate,
            forceFullHistory: !customStartDate,
            dryRun
        });

        if (!result || !result.success) {
            console.error("\n❌ Easebuzz Verification Failed:", result?.message || result?.error || "Unknown error");
            process.exit(1);
        }

        console.log("\n--------------------------------------------------------------------------------");
        console.log("RECONCILIATION SUMMARY");
        console.log("--------------------------------------------------------------------------------");
        console.log(`Historical Range Examined : ${result.startDate} to ${result.endDate}`);
        console.log(`Unpaid Orders Examined    : ${result.totalUnpaidVerified}`);
        console.log(`Bulk Gateway Txns Fetched : ${result.totalFetched}`);
        console.log(`Verified Settlements      : ${result.totalSettled}`);
        console.log(`Failed Gateway Txns       : ${result.totalFailed}`);
        console.log(`Kept Pending              : ${result.totalKeptPending}`);
        console.log("--------------------------------------------------------------------------------\n");

        if (Array.isArray(result.proposedSettlements) && result.proposedSettlements.length > 0) {
            console.log(`Proposed Settlements (${result.proposedSettlements.length}):`);
            result.proposedSettlements.slice(0, 25).forEach((s: any, idx: number) => {
                console.log(`  [${idx + 1}] Order ID: ${s.orderId || s.resolvedOrderId} | Txn: ${s.txnid} | Amount: ₹${s.amount} | Action: ${s.proposedAction || "SETTLE"}`);
            });
            if (result.proposedSettlements.length > 25) {
                console.log(`  ... and ${result.proposedSettlements.length - 25} more settlements.`);
            }
            console.log();
        }

        if (Array.isArray(result.proposedFailures) && result.proposedFailures.length > 0) {
            console.log(`Proposed Failed Transactions (${result.proposedFailures.length}):`);
            result.proposedFailures.slice(0, 10).forEach((f: any, idx: number) => {
                console.log(`  [${idx + 1}] Order ID: ${f.orderId || f.resolvedOrderId} | Txn: ${f.txnid} | Action: MARK_FAILED`);
            });
            console.log();
        }

        if (Array.isArray(result.unmatchedTransactions) && result.unmatchedTransactions.length > 0) {
            console.log(`⚠️ Unmatched Gateway Transactions (${result.unmatchedTransactions.length}):`);
            result.unmatchedTransactions.forEach((u: any, idx: number) => {
                console.log(`  [${idx + 1}] Txn: ${u.txnid} | Amount: ₹${u.amount} | Phone: ${u.phone || "N/A"} (Requires manual review)`);
            });
            console.log();
        }

        console.log("================================================================================");
        if (dryRun) {
            console.log("✅ DRY-RUN COMPLETE: No financial records were changed.");
            console.log("👉 To apply the above settlements to the production database, run:");
            console.log("   npm run verify:easebuzz -- --commit");
        } else {
            console.log("✅ LIVE COMMIT COMPLETE: Verified payments and balances updated successfully.");
        }
        console.log("================================================================================\n");

        process.exit(0);
    } catch (err: any) {
        console.error("\n❌ Fatal Exception during verification:", err.message);
        process.exit(1);
    }
};

run();
