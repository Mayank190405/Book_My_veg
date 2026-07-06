
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { getContext } from "../utils/context";
import dotenv from "dotenv";
dotenv.config();


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

const pool = new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
});



pool.on("error", (err) => {
    console.error("[Prisma Pool] Unexpected error:", err.message);
});

const adapter = new PrismaPg(pool);
export const basePrisma = new PrismaClient({ adapter });

export const prisma = basePrisma.$extends({
    query: {
        $allModels: {
            async $allOperations({ model, operation, args, query }) {
                const ctx = getContext();

                // 1. Data Isolation Logic
                const isolationModels = ["Order", "Inventory", "CashierShift", "Attendance", "StoreExpense", "MortalityLog"];
                if (ctx?.locationId && isolationModels.includes(model) && ctx.role !== 'SUPER_ADMIN') {
                    if (['findMany', 'findFirst', 'findUnique', 'count', 'aggregate'].includes(operation)) {
                        (args as any).where = {
                            ...(args as any).where,
                            locationId: ctx.locationId
                        };
                    }
                }

                // 2. Audit Logging Logic
                const auditModels = ["Product", "Pricing", "Inventory", "CustomerKhata", "User"];
                const auditOps = ["create", "update", "delete"];

                if (auditModels.includes(model) && auditOps.includes(operation) && model !== "AuditLog" && ctx?.userId !== 'SYSTEM') {
                    const beforeArgs = { ...args };
                    const result = await query(args);

                    // Resilient staff reference resolution for virtualized hub logins
                    const staffId = (ctx?.userId && !ctx.userId.startsWith("STORE_")) ? ctx.userId : null;

                    basePrisma.auditLog.create({
                        data: {
                            entityType: model,
                            entityId: (result as any)?.id || "N/A",
                            action: operation.toUpperCase(),
                            oldValue: (operation === 'update' || operation === 'delete') ? (beforeArgs as any).data : null,
                            newValue: (operation === 'create' || operation === 'update') ? (args as any).data : null,
                            staffId,
                            locationId: ctx?.locationId || null
                        }
                    }).catch(err => console.error("[Audit] Failed to record log:", err));

                    return result;
                }

                return query(args);
            }
        }
    }
});

/**
 * Retry helper for transient DB errors
 */
export async function withRetry<T>(
    fn: () => Promise<T>,
    retries = 2,
    delayMs = 300
): Promise<T> {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            return await fn();
        } catch (err: any) {
            const isConnectionError =
                err?.message?.includes("Connection terminated") ||
                err?.message?.includes("SocketTimeout") ||
                err?.code === "P1008" ||
                err?.code === "P1001";

            if (isConnectionError && attempt < retries) {
                console.warn(`[Prisma] DB error on attempt ${attempt}/${retries}. Retrying in ${delayMs}ms…`);
                await new Promise((r) => setTimeout(r, delayMs));
                continue;
            }
            throw err;
        }
    }
    throw new Error("withRetry: exhausted all retries");
}

export default prisma;
