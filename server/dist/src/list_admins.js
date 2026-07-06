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
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("FETCHING ADMINISTRATIVE REGISTRY...");
        const admins = yield prisma.user.findMany({
            where: {
                role: {
                    in: ["ADMIN", "STORE_ADMIN"]
                }
            },
            select: {
                id: true,
                name: true,
                phone: true,
                role: true,
                isActive: true,
                location: {
                    select: { name: true }
                }
            }
        });
        if (admins.length === 0) {
            console.log("CRITICAL: NO ADMINISTRATIVE NODES DETECTED.");
            console.log("PLEASE REGISTER AN ADMIN VIA OTP FIRST, THEN ELEVATE ROLE.");
        }
        else {
            console.table(admins.map((a) => {
                var _a;
                return ({
                    "Protocol Name": a.name || "UNNAMED_ASSET",
                    "Node ID (Phone)": a.phone,
                    "Privilege Class": a.role,
                    "Node Status": a.isActive ? "ACTIVE" : "SUSPENDED",
                    "Assigned Hub": ((_a = a.location) === null || _a === void 0 ? void 0 : _a.name) || "GLOBAL_HQ"
                });
            }));
        }
    });
}
main().finally(() => __awaiter(void 0, void 0, void 0, function* () {
    yield prisma.$disconnect();
}));
