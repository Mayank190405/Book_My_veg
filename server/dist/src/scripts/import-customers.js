"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_1 = __importDefault(require("../config/prisma"));
const client_1 = require("@prisma/client");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
/**
 * CUSTOMER IMPORT SCRIPT (CSV Version)
 * Expected customers.csv columns:
 * Name, Number, Address, Email, Due
 */
function importCustomers() {
    return __awaiter(this, void 0, void 0, function* () {
        const csvPath = path_1.default.join(__dirname, 'customers.csv');
        if (!fs_1.default.existsSync(csvPath)) {
            console.error(`❌ Error: File not found at ${csvPath}`);
            console.log("Please create a 'customers.csv' file in the same folder with headers: Name, Number, Address, Email, Due");
            process.exit(1);
        }
        const fileContent = fs_1.default.readFileSync(csvPath, 'utf8');
        const lines = fileContent.split('\n').filter(line => line.trim() !== '');
        // Skip header line
        const rows = lines.slice(1);
        console.log(`🚀 Starting import of ${rows.length} customers from CSV...`);
        let created = 0;
        let updated = 0;
        let failed = 0;
        for (const row of rows) {
            try {
                const columns = row.split(',').map(c => c.trim());
                // Name, Number, Address, Email, Due
                const name = columns[0];
                const number = columns[1];
                const addressText = columns[2];
                const email = columns[3];
                const dueValue = columns[4];
                if (!name || !number) {
                    console.warn(`⚠️ Skipping row: Missing name or number -> "${row}"`);
                    failed++;
                    continue;
                }
                const customer = yield prisma_1.default.user.upsert({
                    where: { phone: number },
                    update: {
                        name,
                        email: email || null,
                        profileAddress: addressText || null,
                        totalDue: new client_1.Prisma.Decimal(dueValue || 0),
                        isActive: true,
                    },
                    create: {
                        phone: number,
                        name,
                        email: email || null,
                        profileAddress: addressText || null,
                        totalDue: new client_1.Prisma.Decimal(dueValue || 0),
                        role: client_1.Role.USER,
                        isActive: true,
                    }
                });
                if (customer.createdAt.getTime() === customer.updatedAt.getTime())
                    created++;
                else
                    updated++;
            }
            catch (error) {
                console.error(`❌ Failed to import customer in row: ${row}`, error.message);
                failed++;
            }
        }
        console.log('\n' + '═'.repeat(50));
        console.log(`✅ IMPORT COMPLETE`);
        console.log(`👤 Created: ${created}`);
        console.log(`🔄 Updated: ${updated}`);
        console.log(`❌ Failed:  ${failed}`);
        console.log('═'.repeat(50));
    });
}
importCustomers()
    .catch(console.error)
    .finally(() => prisma_1.default.$disconnect());
