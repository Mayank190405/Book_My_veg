const { Pool } = require('pg');
require('dotenv').config();

// Allow self-signed certs for Supabase
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function migrate() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log("Connecting to database...");

        // Add new columns to Product table
        await pool.query(`
            ALTER TABLE "Product" 
            ADD COLUMN IF NOT EXISTS "countryOfOrigin" TEXT,
            ADD COLUMN IF NOT EXISTS "shelfLife" TEXT,
            ADD COLUMN IF NOT EXISTS "packagedDate" TIMESTAMP WITH TIME ZONE,
            ADD COLUMN IF NOT EXISTS "fssaiLicense" TEXT,
            ADD COLUMN IF NOT EXISTS "nutritionInfo" JSONB,
            ADD COLUMN IF NOT EXISTS "specifications" JSONB;
        `);

        console.log("Migration successful: Added product detail fields.");
    } catch (err) {
        console.error("Migration failed:", err);
    } finally {
        await pool.end();
    }
}

migrate();
