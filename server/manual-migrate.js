const { Pool } = require('pg');
require('dotenv').config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function runSells() {
    const client = await pool.connect();
    try {
        console.log("🚀 Starting manual migration...");

        // 1. Create ProductVariant
        await client.query(`
            CREATE TABLE IF NOT EXISTS "ProductVariant" (
                "id" TEXT NOT NULL,
                "productId" TEXT NOT NULL,
                "name" TEXT NOT NULL,
                "price" DECIMAL(10,2) NOT NULL,
                "weight" DECIMAL(10,2),
                "weightUnit" "WeightUnit" NOT NULL DEFAULT 'GM',
                "isActive" BOOLEAN NOT NULL DEFAULT true,
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
            )
        `);
        console.log("✅ Table ProductVariant created or exists");

        // 2. Add columns to related tables (ignore if already exist)
        const tables = ["Inventory", "Pricing", "CartItem", "OrderItem"];
        for (const table of tables) {
            try {
                await client.query(`ALTER TABLE "${table}" ADD COLUMN "variantId" TEXT`);
                console.log(`✅ Added variantId to ${table}`);
            } catch (e) {
                console.log(`ℹ️ variantId already exists in ${table} or error: ${e.message}`);
            }
        }

        // 3. Add foreign keys
        try {
            await client.query(`ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE`);
            console.log("✅ Added product relation to ProductVariant");
        } catch (e) { console.log("ℹ️ ProductVariant FK already exists"); }

        for (const table of tables) {
            try {
                await client.query(`ALTER TABLE "${table}" ADD CONSTRAINT "${table}_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE`);
                console.log(`✅ Added variant relation to ${table}`);
            } catch (e) { console.log(`ℹ️ ${table} variantId FK already exists`); }
        }

        // 4. Update Unique Constraints
        // Note: We might need to handle existing names. For Inventory it was Inventory_productId_locationId_key
        try {
            await client.query(`ALTER TABLE "Inventory" DROP CONSTRAINT "Inventory_productId_locationId_key"`);
            await client.query(`ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_productId_locationId_variantId_key" UNIQUE ("productId", "locationId", "variantId")`);
            console.log("✅ Updated Inventory unique constraint");
        } catch (e) { console.log("ℹ️ Inventory constraint update skipped:", e.message); }

        try {
            await client.query(`ALTER TABLE "CartItem" DROP CONSTRAINT "CartItem_cartId_productId_key"`);
            await client.query(`ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_cartId_productId_variantId_key" UNIQUE ("cartId", "productId", "variantId")`);
            console.log("✅ Updated CartItem unique constraint");
        } catch (e) { console.log("ℹ️ CartItem constraint update skipped:", e.message); }

        console.log("✨ Manual migration completed successfully!");
    } catch (err) {
        console.error("❌ Migration failed:", err.message);
    } finally {
        client.release();
        await pool.end();
    }
}

runSells();
