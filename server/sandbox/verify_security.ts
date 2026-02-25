import { requireStoreAccess } from "../src/middleware/isolation";
import { requirePermission } from "../src/middleware/permissions";

function runTests() {
    console.log("=== Phase 1 Validation: Multi-Tenant Isolation & RBAC ===");

    const mockRes = () => {
        const res: any = {};
        res.status = (code: number) => { res.statusCode = code; return res; };
        res.json = (data: any) => { res.body = data; return res; };
        return res;
    };

    console.log("\n-> 🛑 TEST 1: Cross-Tenant Attack (Store Admin A accessing Store B)");
    const req1: any = {
        user: { role: "STORE_ADMIN", locationId: "STORE_A_ID" },
        params: { locationId: "STORE_B_ID" }
    };
    const res1 = mockRes();
    requireStoreAccess()(req1, res1, () => { res1.statusCode = 200; res1.body = { message: "Success" }; });

    if (res1.statusCode === 403) {
        console.log("✅ SUCCESS: Cross-tenant access blocked.");
        console.log(`   Response: ${res1.statusCode} - ${res1.body.message}`);
    } else {
        console.log("❌ FAILED: Cross-tenant access was allowed!");
    }

    console.log("\n-> 🟢 TEST 2: SUPER_ADMIN Bypass (Global Admin accessing Store B)");
    const req2: any = {
        user: { role: "SUPER_ADMIN", locationId: "HQ_ID" },
        params: { locationId: "STORE_B_ID" }
    };
    const res2 = mockRes();
    requireStoreAccess()(req2, res2, () => { res2.statusCode = 200; res2.body = { message: "Success" }; });

    if (res2.statusCode === 200) {
        console.log("✅ SUCCESS: SUPER_ADMIN bypass allowed.");
    } else {
        console.log("❌ FAILED: SUPER_ADMIN was blocked!");
    }

    console.log("\n-> 🛑 TEST 3: RBAC Hardening (POS Operator attempting inventory:write)");
    const req3: any = {
        user: { role: "POS_OPERATOR", locationId: "STORE_A_ID" }
    };
    const res3 = mockRes();
    requirePermission("inventory:write")(req3, res3, () => { res3.statusCode = 200; res3.body = { message: "Success" }; });

    if (res3.statusCode === 403) {
        console.log("✅ SUCCESS: Unauthorized capability blocked.");
        console.log(`   Response: ${res3.statusCode} - ${res3.body.message}`);
    } else {
        console.log("❌ FAILED: POS Operator was allowed to mutate inventory!");
    }
}

runTests();
