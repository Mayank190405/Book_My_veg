const { Pool } = require('pg');
require('dotenv').config();

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function populate() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log("Populating detailed info for Potato...");

        // Find Potato ID
        const res = await pool.query("SELECT id FROM \"Product\" WHERE name LIKE '%Potato%' LIMIT 1");
        if (res.rows.length === 0) {
            console.log("Potato not found.");
            return;
        }
        const potatoId = res.rows[0].id;

        const nutrition = {
            "Energy": "77 kcal",
            "Carbohydrates": "17.5 g",
            "Fiber": "2.2 g",
            "Protein": "2 g",
            "Vitamin C": "33% DV"
        };

        const specs = {
            "Storage": "Store in a cool, dry and dark place. Do not refrigerate.",
            "Usage": "Perfect for boiling, mashing, roasting or frying."
        };

        await pool.query(`
            UPDATE "Product" 
            SET 
                "countryOfOrigin" = 'India',
                "shelfLife" = '15-20 Days',
                "packagedDate" = NOW(),
                "fssaiLicense" = '12345678901234',
                "nutritionInfo" = $1,
                "specifications" = $2
            WHERE id = $3
        `, [JSON.stringify(nutrition), JSON.stringify(specs), potatoId]);

        console.log("Population successful.");
    } catch (err) {
        console.error("Population failed:", err);
    } finally {
        await pool.end();
    }
}

populate();
