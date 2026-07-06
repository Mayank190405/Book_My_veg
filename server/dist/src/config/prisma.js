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
exports.prisma = exports.basePrisma = void 0;
exports.withRetry = withRetry;
const client_1 = require("@prisma/client");
const adapter_pg_1 = require("@prisma/adapter-pg");
const pg_1 = require("pg");
const context_1 = require("../utils/context");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
/**
 * Prisma v7 client singleton with @prisma/adapter-pg
 *
 * Features:
 * - Robust pooling with TCP keepalive
 * - SSL configured for Supabase (rejectUnauthorized: false)
 * - Data isolation (store-level filtering)
 * - Mandatory audit logging for critical entities
 */
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set");
}
const pool = new pg_1.Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
});
pool.on("error", (err) => {
    console.error("[Prisma Pool] Unexpected error:", err.message);
});
const adapter = new adapter_pg_1.PrismaPg(pool);
exports.basePrisma = new client_1.PrismaClient({ adapter });
exports.prisma = exports.basePrisma.$extends({
    query: {
        $allModels: {
            $allOperations(_a) {
                return __awaiter(this, arguments, void 0, function* ({ model, operation, args, query }) {
                    const ctx = (0, context_1.getContext)();
                    // 1. Data Isolation Logic
                    const isolationModels = ["Order", "Inventory", "CashierShift", "Attendance", "StoreExpense", "MortalityLog"];
                    if ((ctx === null || ctx === void 0 ? void 0 : ctx.locationId) && isolationModels.includes(model) && ctx.role !== 'SUPER_ADMIN') {
                        if (['findMany', 'findFirst', 'findUnique', 'count', 'aggregate'].includes(operation)) {
                            args.where = Object.assign(Object.assign({}, args.where), { locationId: ctx.locationId });
                        }
                    }
                    // 2. Audit Logging Logic
                    const auditModels = ["Product", "Pricing", "Inventory", "CustomerKhata", "User"];
                    const auditOps = ["create", "update", "delete"];
                    if (auditModels.includes(model) && auditOps.includes(operation) && model !== "AuditLog" && (ctx === null || ctx === void 0 ? void 0 : ctx.userId) !== 'SYSTEM') {
                        const beforeArgs = Object.assign({}, args);
                        const result = yield query(args);
                        // Resilient staff reference resolution for virtualized hub logins
                        const staffId = ((ctx === null || ctx === void 0 ? void 0 : ctx.userId) && !ctx.userId.startsWith("STORE_")) ? ctx.userId : null;
                        exports.basePrisma.auditLog.create({
                            data: {
                                entityType: model,
                                entityId: (result === null || result === void 0 ? void 0 : result.id) || "N/A",
                                action: operation.toUpperCase(),
                                oldValue: (operation === 'update' || operation === 'delete') ? beforeArgs.data : null,
                                newValue: (operation === 'create' || operation === 'update') ? args.data : null,
                                staffId,
                                locationId: (ctx === null || ctx === void 0 ? void 0 : ctx.locationId) || null
                            }
                        }).catch(err => console.error("[Audit] Failed to record log:", err));
                        return result;
                    }
                    return query(args);
                });
            }
        }
    }
});
/**
 * Retry helper for transient DB errors
 */
function withRetry(fn_1) {
    return __awaiter(this, arguments, void 0, function* (fn, retries = 2, delayMs = 300) {
        var _a, _b;
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                return yield fn();
            }
            catch (err) {
                const isConnectionError = ((_a = err === null || err === void 0 ? void 0 : err.message) === null || _a === void 0 ? void 0 : _a.includes("Connection terminated")) ||
                    ((_b = err === null || err === void 0 ? void 0 : err.message) === null || _b === void 0 ? void 0 : _b.includes("SocketTimeout")) ||
                    (err === null || err === void 0 ? void 0 : err.code) === "P1008" ||
                    (err === null || err === void 0 ? void 0 : err.code) === "P1001";
                if (isConnectionError && attempt < retries) {
                    console.warn(`[Prisma] DB error on attempt ${attempt}/${retries}. Retrying in ${delayMs}ms…`);
                    yield new Promise((r) => setTimeout(r, delayMs));
                    continue;
                }
                throw err;
            }
        }
        throw new Error("withRetry: exhausted all retries");
    });
}
exports.default = exports.prisma;
