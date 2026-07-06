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
const bcryptjs_1 = __importDefault(require("bcryptjs"));
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('Seeding initial staff users...');
        // Create a default location if one doesn't exist
        let location = yield prisma_1.default.location.findFirst({ where: { slug: 'main-store' } });
        if (!location) {
            location = yield prisma_1.default.location.create({
                data: {
                    name: 'Main Store',
                    slug: 'main-store',
                    address: 'Central Market',
                    contactNumber: '1234567890'
                }
            });
            console.log('Created Main Store location.');
        }
        // Passwords (hash them if bcryptjs is available, otherwise plain text. Let's try hash first, usually auth expects it.)
        let hashedPassword = yield bcryptjs_1.default.hash('password123', 10).catch(() => 'password123');
        // 1. ADMIN
        const admin = yield prisma_1.default.user.upsert({
            where: { phone: '9999999991' },
            update: { password: hashedPassword, role: 'ADMIN' },
            create: {
                phone: '9999999991',
                name: 'System Admin',
                role: 'ADMIN',
                password: hashedPassword,
                locationId: location.id,
            },
        });
        // 2. STORE MANAGER
        const manager = yield prisma_1.default.user.upsert({
            where: { phone: '9999999992' },
            update: { password: hashedPassword, role: 'MANAGER' },
            create: {
                phone: '9999999992',
                name: 'Store Manager',
                role: 'MANAGER',
                password: hashedPassword,
                locationId: location.id,
            },
        });
        // 3. POS OPERATOR
        const posOperator = yield prisma_1.default.user.upsert({
            where: { phone: '9999999993' },
            update: { password: hashedPassword, role: 'POS_OPERATOR' },
            create: {
                phone: '9999999993',
                name: 'POS Operator 1',
                role: 'POS_OPERATOR',
                password: hashedPassword,
                locationId: location.id,
            },
        });
        console.log('--- User Credentials (password: password123) ---');
        console.log(`Admin Phone: ${admin.phone}`);
        console.log(`Manager Phone: ${manager.phone}`);
        console.log(`POS Operator Phone: ${posOperator.phone}`);
        console.log('------------------------------------------------');
    });
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(() => __awaiter(void 0, void 0, void 0, function* () {
    yield prisma_1.default.$disconnect();
}));
