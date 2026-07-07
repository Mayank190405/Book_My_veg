"use strict";
// server/src/scripts/createAdmin.ts
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
        const phone = process.argv[2] || "9999999999";
        const password = process.argv[3] || "adminPassword123";
        const hashedPassword = yield bcryptjs_1.default.hash(password, 10);
        const user = yield prisma_1.default.user.upsert({
            where: { phone },
            update: {
                role: "ADMIN",
                password: hashedPassword,
                isActive: true
            },
            create: {
                phone,
                role: "ADMIN",
                password: hashedPassword,
                isActive: true,
                name: "Local Admin"
            }
        });
        console.log(`✅ Admin user ${user.phone} created/updated.`);
        console.log(`🔑 Login locally at http://localhost:3000/login`);
        console.log(`📱 Phone: ${phone}`);
        console.log(`🔒 Password: ${password}`);
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
