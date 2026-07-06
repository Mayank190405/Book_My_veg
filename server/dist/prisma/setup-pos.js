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
require("dotenv/config");
const client_1 = require("@prisma/client");
const adapter_pg_1 = require("@prisma/adapter-pg");
const pg_1 = require("pg");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const pool = new pg_1.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new adapter_pg_1.PrismaPg(pool);
const prisma = new client_1.PrismaClient({ adapter });
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("🏪 Setting up POS with store-wise inventory...\n");
        const hashedPassword = yield bcryptjs_1.default.hash("12345678", 10);
        // ── 1. Ensure Location exists ────────────────────────────────────────
        let location = yield prisma.location.findFirst();
        if (!location) {
            location = yield prisma.location.create({
                data: {
                    name: "Book My Veg — Govind Nagar",
                    slug: "govind-nagar",
                    address: "Shop 12, Govind Nagar Market, Pune",
                    contactNumber: "9876543210",
                    gstNumber: "27AABCU9603R1ZM",
                    receiptHeader: "BOOK MY VEG",
                    receiptFooter: "Thank you for shopping with us!",
                    latitude: 18.5204,
                    longitude: 73.8567
                }
            });
            console.log("✅ Store location created:", location.name);
        }
        else {
            // Update existing location with receipt config if missing
            if (!location.gstNumber || !location.receiptHeader) {
                location = yield prisma.location.update({
                    where: { id: location.id },
                    data: {
                        gstNumber: location.gstNumber || "27AABCU9603R1ZM",
                        receiptHeader: location.receiptHeader || "BOOK MY VEG",
                        receiptFooter: location.receiptFooter || "Thank you for shopping with us!",
                        contactNumber: location.contactNumber || "9876543210"
                    }
                });
            }
            console.log("✅ Using existing location:", location.name, `(${location.id})`);
        }
        // ── 2. Create POS Operator ───────────────────────────────────────────
        const posPhone = "7777777777";
        let posUser = yield prisma.user.findUnique({ where: { phone: posPhone } });
        if (!posUser) {
            posUser = yield prisma.user.create({
                data: {
                    phone: posPhone,
                    name: "POS Operator",
                    role: client_1.Role.POS_OPERATOR,
                    password: hashedPassword,
                    locationId: location.id,
                    isActive: true,
                }
            });
            console.log("✅ POS Operator created — Phone:", posPhone, "| Password: 12345678");
        }
        else {
            // Ensure location is linked
            if (!posUser.locationId) {
                yield prisma.user.update({ where: { id: posUser.id }, data: { locationId: location.id } });
            }
            console.log("✅ POS Operator exists — Phone:", posPhone);
        }
        // Also ensure ADMIN has location
        const admins = yield prisma.user.findMany({ where: { role: client_1.Role.ADMIN } });
        for (const admin of admins) {
            if (!admin.locationId) {
                yield prisma.user.update({ where: { id: admin.id }, data: { locationId: location.id } });
                console.log(`   ↳ Linked admin ${admin.name} to store`);
            }
        }
        // ── 3. Ensure all products have inventory at this location ────────────
        const products = yield prisma.product.findMany({ where: { isActive: true } });
        console.log(`\n📦 Found ${products.length} active products. Checking store inventory...`);
        let created = 0, skipped = 0;
        for (const product of products) {
            // Check if inventory exists at this location
            const existing = yield prisma.inventory.findFirst({
                where: { productId: product.id, locationId: location.id }
            });
            if (!existing) {
                const initialQty = 100;
                // Create batch for FIFO
                yield prisma.batch.create({
                    data: {
                        productId: product.id,
                        locationId: location.id,
                        batchNumber: `POS-SEED-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                        costPrice: new client_1.Prisma.Decimal(Number(product.basePrice || 0) * 0.7),
                        initialQty: new client_1.Prisma.Decimal(initialQty),
                        remainingQty: new client_1.Prisma.Decimal(initialQty),
                        receivedDate: new Date()
                    }
                });
                // Create inventory record
                yield prisma.inventory.create({
                    data: {
                        productId: product.id,
                        locationId: location.id,
                        currentStock: initialQty,
                        thresholdStock: 10,
                        isLowStock: false
                    }
                });
                // Create POS pricing if not exists
                const posPricing = yield prisma.pricing.findFirst({
                    where: { productId: product.id, channel: client_1.Channel.POS, isActive: true }
                });
                if (!posPricing) {
                    yield prisma.pricing.create({
                        data: {
                            productId: product.id,
                            channel: client_1.Channel.POS,
                            price: product.basePrice || new client_1.Prisma.Decimal(0),
                            startDate: new Date(),
                            isActive: true
                        }
                    });
                }
                console.log(`   ✅ ${product.name} — Stock: ${initialQty}, Price: ₹${product.basePrice}`);
                created++;
            }
            else {
                // Ensure POS pricing exists
                const posPricing = yield prisma.pricing.findFirst({
                    where: { productId: product.id, channel: client_1.Channel.POS, isActive: true }
                });
                if (!posPricing) {
                    yield prisma.pricing.create({
                        data: {
                            productId: product.id,
                            channel: client_1.Channel.POS,
                            price: product.basePrice || new client_1.Prisma.Decimal(0),
                            startDate: new Date(),
                            isActive: true
                        }
                    });
                    console.log(`   ✅ ${product.name} — POS pricing added: ₹${product.basePrice}`);
                }
                skipped++;
            }
        }
        console.log(`\n📊 Inventory Summary: ${created} created, ${skipped} already existed`);
        // ── 4. Create a sample customer for POS testing ──────────────────────
        const testPhone = "9999888877";
        let testCustomer = yield prisma.user.findUnique({ where: { phone: testPhone } });
        if (!testCustomer) {
            testCustomer = yield prisma.user.create({
                data: {
                    phone: testPhone,
                    name: "Gaurav Sharma",
                    role: client_1.Role.USER,
                    password: hashedPassword,
                    isActive: true
                }
            });
            console.log(`\n👤 Test customer created: ${testCustomer.name} (${testPhone})`);
        }
        console.log("\n" + "═".repeat(50));
        console.log("🚀 POS SETUP COMPLETE!");
        console.log("═".repeat(50));
        console.log(`\n🏪 Store: ${location.name}`);
        console.log(`📍 Location ID: ${location.id}`);
        console.log(`\n👤 POS Login Credentials:`);
        console.log(`   Phone: ${posPhone}`);
        console.log(`   Password: 12345678`);
        console.log(`\n👤 Admin Login:`);
        console.log(`   Phone: 9191919191`);
        console.log(`   Password: 12345678`);
        console.log(`\n👤 Test Customer (for tagging in POS):`);
        console.log(`   Name: Gaurav Sharma`);
        console.log(`   Phone: ${testPhone}`);
        console.log("");
    });
}
main()
    .catch((e) => { console.error("❌ Error:", e); process.exit(1); })
    .finally(() => __awaiter(void 0, void 0, void 0, function* () { yield prisma.$disconnect(); yield pool.end(); }));
