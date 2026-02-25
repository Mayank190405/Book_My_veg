
import prisma from "../config/prisma";
import { Prisma } from "@prisma/client";

export interface QRLineItem {
    productCode: string;
    quantity: number;
    unit: string;
    product?: any;
    price?: number;
    subtotal?: number;
}

export class QRParserService {
    /**
     * Parses a QR string like "102-1kg,105-0.5kg,107-2pcs" into bill lines.
     * Fetches live DB pricing for each item.
     */
    static async parseQRBill(qrString: string, channel: "WEB" | "POS" | "WHATSAPP" = "POS"): Promise<{
        lines: QRLineItem[];
        totalWeight: number;
        totalAmount: number;
        mergedLines?: QRLineItem[];
    }> {
        const tokens = qrString.split(",").map(t => t.trim()).filter(Boolean);
        const rawLines: QRLineItem[] = [];

        for (const token of tokens) {
            const [code, rawQty] = token.split("-");
            if (!code || !rawQty) continue;

            const quantity = parseFloat(rawQty);
            const unit = rawQty.replace(/[0-9.]/g, "") || "pcs";

            rawLines.push({ productCode: code.trim(), quantity: isNaN(quantity) ? 1 : quantity, unit });
        }

        // Batch-fetch products by their code (trying id first, then slug fallback)
        const codes = rawLines.map(l => l.productCode);
        const products = await prisma.product.findMany({
            where: { id: { in: codes } },
            include: {
                pricing: {
                    where: { channel: channel as any, isActive: true },
                    orderBy: { startDate: "desc" },
                    take: 1
                }
            }
        });

        // Also try slug lookup for codes that didn't match IDs
        const foundIds = new Set(products.map(p => p.id));
        const missingCodes = codes.filter(c => !foundIds.has(c));
        if (missingCodes.length > 0) {
            const bySlug = await prisma.product.findMany({
                where: { slug: { in: missingCodes } },
                include: {
                    pricing: {
                        where: { channel: channel as any, isActive: true },
                        orderBy: { startDate: "desc" },
                        take: 1
                    }
                }
            });
            products.push(...bySlug);
        }

        // Build map: code → product (both by id and slug)
        const productMap = new Map<string, any>();
        for (const p of products) {
            productMap.set(p.id, p);
            productMap.set(p.slug, p);
        }

        let totalWeight = 0;
        let totalAmount = 0;
        const lines: QRLineItem[] = [];

        for (const line of rawLines) {
            const product = productMap.get(line.productCode);
            const price = product?.pricing?.[0]?.price ?? product?.basePrice ?? 0;
            const numPrice = Number(price);
            const subtotal = numPrice * line.quantity;

            if (["kg", "g", "gm"].includes(line.unit.toLowerCase())) {
                totalWeight += line.unit === "kg" ? line.quantity : line.quantity / 1000;
            }
            totalAmount += subtotal;

            lines.push({
                ...line,
                product: product ? { id: product.id, name: product.name, images: product.images } : undefined,
                price: numPrice,
                subtotal
            });
        }

        return { lines, totalWeight: parseFloat(totalWeight.toFixed(3)), totalAmount: parseFloat(totalAmount.toFixed(2)) };
    }

    /**
     * B2B Merge Mode — collapses duplicate product codes into single lines.
     */
    static mergeLines(lines: QRLineItem[]): QRLineItem[] {
        const merged = new Map<string, QRLineItem>();
        for (const line of lines) {
            const existing = merged.get(line.productCode);
            if (existing) {
                existing.quantity += line.quantity;
                existing.subtotal = (existing.subtotal || 0) + (line.subtotal || 0);
            } else {
                merged.set(line.productCode, { ...line });
            }
        }
        return Array.from(merged.values());
    }
}

export class WeightCheckService {
    private static readonly TOLERANCE_PERCENT = 0.02; // 2% tolerance

    static async verifyWeight(params: {
        sessionRef: string;
        expectedWeight: number;
        actualWeight: number;
        staffId?: string;
    }) {
        const variance = params.actualWeight - params.expectedWeight;
        const toleranceAbs = params.expectedWeight * this.TOLERANCE_PERCENT;
        const isPassed = Math.abs(variance) <= toleranceAbs;

        await prisma.weightVerificationLog.create({
            data: {
                sessionRef: params.sessionRef,
                expectedWeight: new Prisma.Decimal(params.expectedWeight),
                actualWeight: new Prisma.Decimal(params.actualWeight),
                variance: new Prisma.Decimal(variance),
                isPassed,
                staffId: params.staffId
            }
        });

        return {
            isPassed,
            variance: parseFloat(variance.toFixed(3)),
            toleranceAbs: parseFloat(toleranceAbs.toFixed(3)),
            message: isPassed
                ? "✅ Weight verified — within tolerance."
                : `⚠️ Weight mismatch! Variance: ${variance > 0 ? "+" : ""}${variance.toFixed(3)} kg. Check bag contents.`
        };
    }
}

export class KhataService {
    static async getKhata(userId: string) {
        const khata = await prisma.customerKhata.findUnique({
            where: { userId },
            include: {
                transactions: {
                    orderBy: { createdAt: "desc" },
                    take: 20,
                    select: { id: true, type: true, amount: true, orderId: true, notes: true, createdAt: true }
                }
            }
        });
        return khata;
    }

    static async getOrCreate(userId: string) {
        return prisma.customerKhata.upsert({
            where: { userId },
            update: {},
            create: { userId, creditLimit: 0, outstanding: 0 }
        });
    }

    /**
     * Checks if a credit purchase is allowed.
     */
    static async canMakePurchase(userId: string, amount: number): Promise<{
        allowed: boolean;
        reason?: string;
        outstanding: number;
        creditLimit: number;
    }> {
        const khata = await this.getOrCreate(userId);
        const outstanding = Number(khata.outstanding);
        const creditLimit = Number(khata.creditLimit);
        const newOutstanding = outstanding + amount;

        if (creditLimit === 0) {
            return { allowed: false, reason: "No credit limit set for this customer.", outstanding, creditLimit };
        }
        if (newOutstanding > creditLimit) {
            return {
                allowed: false,
                reason: `Credit limit exceeded. Outstanding: ₹${outstanding}, Limit: ₹${creditLimit}, Required: ₹${amount}`,
                outstanding,
                creditLimit
            };
        }
        return { allowed: true, outstanding, creditLimit };
    }

    /**
     * Records a purchase on credit (khata).
     */
    static async addPurchase(userId: string, amount: number, orderId?: string, staffId?: string) {
        const khata = await this.getOrCreate(userId);

        await prisma.customerKhata.update({
            where: { userId },
            data: { outstanding: { increment: amount } }
        });

        return prisma.khataTransaction.create({
            data: {
                khataId: khata.id,
                type: "PURCHASE",
                amount: new Prisma.Decimal(amount),
                orderId,
                staffId,
                notes: `Order purchase ${orderId || "—"}`
            }
        });
    }

    /**
     * Records a payment (customer settles some/all outstanding).
     */
    static async recordPayment(userId: string, amount: number, staffId?: string, notes?: string) {
        const khata = await this.getOrCreate(userId);

        await prisma.customerKhata.update({
            where: { userId },
            data: { outstanding: { decrement: amount } }
        });

        return prisma.khataTransaction.create({
            data: {
                khataId: khata.id,
                type: "PAYMENT",
                amount: new Prisma.Decimal(amount),
                staffId,
                notes: notes || "Payment received"
            }
        });
    }

    /**
     * Updates credit limit.
     */
    static async updateCreditLimit(userId: string, creditLimit: number, staffId?: string) {
        const khata = await this.getOrCreate(userId);
        return prisma.customerKhata.update({
            where: { userId },
            data: { creditLimit: new Prisma.Decimal(creditLimit) }
        });
    }
}
