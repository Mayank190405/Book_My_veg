const { Pool } = require('pg');
require('dotenv').config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function addVariants() {
    const client = await pool.connect();
    try {
        console.log("🚀 Adding weight variants to existing products (Raw SQL)...");

        const { rows: products } = await client.query(`
            SELECT id, name, "basePrice" FROM "Product"
            WHERE name ILIKE '%Potato%' OR name ILIKE '%Onion%' OR name ILIKE '%Mango%' OR name ILIKE '%Orange%'
        `);

        console.log(`Found ${products.length} products to update.`);

        for (const p of products) {
            const { rows: existing } = await client.query('SELECT id FROM "ProductVariant" WHERE "productId" = $1 LIMIT 1', [p.id]);

            if (existing.length > 0) {
                console.log(`ℹ️ Product ${p.name} already has variants. Skipping.`);
                continue;
            }

            const variants = [
                { name: "500g", priceMultiplier: 0.55, weight: 500, unit: 'GM' },
                { name: "1kg", priceMultiplier: 1.0, weight: 1, unit: 'KG' },
                { name: "2kg", priceMultiplier: 1.9, weight: 2, unit: 'KG' },
            ];

            for (const v of variants) {
                const varPrice = Number(p.basePrice) * v.priceMultiplier;
                const id = require('crypto').randomUUID();
                await client.query(`
                    INSERT INTO "ProductVariant" (id, "productId", name, price, weight, "weightUnit", "isActive", "updatedAt")
                    VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
                `, [id, p.id, v.name, varPrice, v.weight, v.unit, true]);
            }
            console.log(`✅ Added variants for ${p.name}`);
        }

        console.log("✨ Variant population completed!");
    } catch (err) {
        console.error("❌ Population failed:", err.message);
    } finally {
        client.release();
        await pool.end();
    }
}

addVariants();
