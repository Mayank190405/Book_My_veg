
import { ReconciliationService } from "../src/services/reconciliationService";
import logger from "../src/utils/logger";

async function main() {
    console.log("===============================================================");
    console.log("NIGHTLY RECONCILIATION TEST");
    console.log("===============================================================");

    // Use a known location from seed or existing data
    const locationId = "6093554e-4860-4966-bd98-75c6ebbbd049";

    try {
        const result = await ReconciliationService.runFullReconciliation(locationId);

        if (result.success) {
            console.log("✅ SUCCESS: All ledgers match snapshots.");
        } else {
            console.log("❌ FAILURE: Drift detected in following entities:");
            result.issues.forEach(i => {
                console.log(` - [${i.domain}] ${i.entityId}: Drift ${i.drift}`);
            });
        }
    } catch (error) {
        console.error("Reconciliation execution failed", error);
    }
}

main();
