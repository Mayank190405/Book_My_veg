
import prisma from "../config/prisma";
import { Prisma } from "@prisma/client";
import logger from "../utils/logger";
import { SecurityService } from "./securityService";

export interface ReconciliationResult {
    domain: "INVENTORY" | "KHATA" | "CASH";
    entityId: string;
    isClean: boolean;
    snapshotValue: number;
    ledgerValue: number;
    drift: number;
}

export class ReconciliationService {
    static async reconcileInventory(locationId: string): Promise<ReconciliationResult[]> {
        const inventories = await prisma.inventory.findMany({ where: { locationId } });
        const results: ReconciliationResult[] = [];

        for (const inv of inventories) {
            const logs = await prisma.inventoryLog.aggregate({
                where: { productId: inv.productId, variantId: inv.variantId || null, locationId },
                _sum: { delta: true }
            });

            const ledgerStock = Number(logs._sum.delta || 0);
            const snapshotStock = inv.currentStock;
            const drift = snapshotStock - ledgerStock;

            if (drift !== 0) {
                await SecurityService.logAudit({
                    tableName: "Inventory",
                    operation: "RECONCILE_DRIFT",
                    staffId: "SYSTEM",
                    severity: "CRITICAL",
                    details: `SKU: ${inv.productId}, Drift: ${drift}`
                });
            }

            results.push({ domain: "INVENTORY", entityId: inv.productId, isClean: drift === 0, snapshotValue: snapshotStock, ledgerValue: ledgerStock, drift });
        }
        return results;
    }

    static async reconcileKhata(): Promise<ReconciliationResult[]> {
        const khatas = await prisma.customerKhata.findMany();
        const results: ReconciliationResult[] = [];
        for (const khata of khatas) {
            const txs = await prisma.khataTransaction.aggregate({ where: { khataId: khata.id }, _sum: { amount: true } });
            const ledgerBalance = Number(txs._sum.amount || 0);
            const snapshotBalance = Number(khata.outstanding);
            const drift = snapshotBalance - ledgerBalance;
            results.push({ domain: "KHATA", entityId: khata.userId, isClean: drift === 0, snapshotValue: snapshotBalance, ledgerValue: ledgerBalance, drift });
        }
        return results;
    }

    static async reconcileCashierShift(shiftId: string): Promise<ReconciliationResult> {
        const shift = await prisma.cashierShift.findUnique({
            where: { id: shiftId },
            include: { orders: { include: { payments: true } } }
        });
        if (!shift) throw new Error("Shift not found");

        let totalCashCollected = new Prisma.Decimal(0);
        for (const order of shift.orders) {
            for (const payment of order.payments) {
                if (payment.method === "CASH" && payment.status === "COMPLETED") {
                    totalCashCollected = totalCashCollected.plus(payment.amount);
                }
            }
        }

        const s = shift as any;
        const ledgerValue = Number(totalCashCollected.plus(s.openingBalance));
        const snapshotValue = Number(s.expectedCash);
        const drift = snapshotValue - ledgerValue;

        return { domain: "CASH", entityId: shiftId, isClean: Math.abs(drift) < 0.01, snapshotValue, ledgerValue, drift };
    }

    static async runFullReconciliation(locationId: string) {
        const inventory = await this.reconcileInventory(locationId);
        const khata = await this.reconcileKhata();
        const issues = [...inventory, ...khata].filter(r => !r.isClean);

        if (issues.length > 0) {
            for (const issue of issues) {
                await SecurityService.logAudit({ tableName: issue.domain, operation: "STOP_THE_LINE", staffId: "SYSTEM", severity: "CRITICAL", details: `Drift: ${issue.drift}` });
            }
            return { success: false, issues };
        }
        return { success: true, issues: [] };
    }
}
