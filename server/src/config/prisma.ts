/**
 * Prisma v7 client singleton
 *
 * Uses @prisma/adapter-pg with a robust pg.Pool that:
 *  - enables TCP keepalive so the OS detects dead connections quickly
 *  - trims idle connections before Supabase/Neon silently drop them
 *  - surfaces pool errors without crashing the process
 *
 * SSL and connection string details are handled via DATABASE_URL params.
 */

import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

dotenv.config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set");
}

const pool = new Pool({
    connectionString,
    max: 5,
    // Close idle connections after 20 s — before Supabase kills them (~60 s)
    idleTimeoutMillis: 20_000,
    // Fail fast if no connection available within 10 s
    connectionTimeoutMillis: 10_000,
    // TCP keepalive: keeps the connection alive through NAT/firewalls
    keepAlive: true,
    // Required for Supabase pooler — accepts self-signed/intermediate certs
    ssl: { rejectUnauthorized: false },
});

// Surface unexpected idle-client errors without crashing the process
pool.on("error", (err: Error) => {
    console.error("[Prisma Pool] Unexpected idle-client error:", err.message);
});

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter } as any);

export default prisma;

// ---------------------------------------------------------------------------
// Retry helper – transparently reconnects on dropped-connection errors
// ---------------------------------------------------------------------------
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
                console.warn(
                    `[Prisma] DB error on attempt ${attempt}/${retries}. Retrying in ${delayMs}ms…`
                );
                await new Promise((r) => setTimeout(r, delayMs));
                continue;
            }
            throw err;
        }
    }
    throw new Error("withRetry: exhausted all retries");
}
