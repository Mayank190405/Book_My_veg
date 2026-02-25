import { Request, Response } from "express";
import prisma from "../config/prisma";
import { withRetry } from "../config/prisma";
import { InventoryService } from "../services/inventoryService";

export const logMortality = async (req: Request, res: Response) => {
    try {
        const { productId, variantId, locationId, quantity, reason, notes, staffId } = req.body;

        if (!productId || !locationId || !quantity || !reason) {
            return res.status(400).json({ error: "Missing required fields: productId, locationId, quantity, reason" });
        }

        const result = await prisma.$transaction(async (tx) => {
            // 1. Record the mortality log
            const log = await tx.mortalityLog.create({
                data: {
                    productId,
                    variantId,
                    locationId,
                    quantity: Number(quantity),
                    reason,
                    notes,
                    staffId
                }
            });

            // 2. Adjust central inventory via robust locked wrapper
            await InventoryService.adjustGlobalInventory(tx, {
                productId,
                variantId: variantId || undefined,
                locationId,
                qtyDelta: -Number(quantity),
                referenceType: 'MORTALITY',
                referenceId: log.id,
                staffId
            });

            // 3. (Optional) Create a ledger entry for financial tracking
            // This would normally go to COA_NATURAL_LOSS

            return log;
        });

        res.status(201).json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const getMortalityLogs = async (req: Request, res: Response) => {
    try {
        const { locationId, productId } = req.query;
        const logs = await prisma.mortalityLog.findMany({
            where: {
                ...(locationId && { locationId: String(locationId) }),
                ...(productId && { productId: String(productId) })
            },
            include: {
                product: { select: { name: true } },
                location: { select: { name: true } }
            },
            orderBy: { createdAt: "desc" }
        });
        res.json(logs);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};
