import { Response } from "express";
import prisma from "../config/prisma";
import { AuthRequest } from "../middleware/auth";

export const addStoreExpense = async (req: AuthRequest, res: Response) => {
    console.log(">>>>>>>>>> ADD EXPENSE REACHED <<<<<<<<<<");
    console.log("REQUEST BODY:", JSON.stringify(req.body));
    console.log("AUTH USER:", JSON.stringify(req.user));

    const { amount, category, description, receiptUrl, locationId: bodyLocationId, staffId: bodyStaffId, denominations } = req.body;
    
    // Resolve Identity: Use provided ID or fall back to authenticated user session
    const staffId = bodyStaffId || req.user?.userId;
    const locationId = bodyLocationId || req.user?.locationId;

    console.log(`[Expense] Adding expense: Amount=${amount}, Location=${locationId}, Staff=${staffId}`);

    if (!amount || isNaN(parseFloat(amount))) {
        return res.status(400).json({ error: "Valid amount is required" });
    }

    if (!staffId) {
        return res.status(400).json({ error: "Staff identity required" });
    }

    if (!locationId || locationId === "ALL") {
        return res.status(400).json({ error: "A valid specific location ID is required to record expenses" });
    }

    try {
        // Verify staff exists if provided
        let verifiedStaffId: string | null = null;
        if (staffId) {
            const user = await prisma.user.findUnique({ where: { id: String(staffId) }, select: { id: true } });
            if (user) verifiedStaffId = user.id;
        }

        console.log(`[Expense Debug] Attempting Prisma Create with:`, {
            locationId: String(locationId),
            staffId: verifiedStaffId,
            amount: parseFloat(amount),
            category: category || "MISC",
            description,
            receiptUrl,
            denominations
        });

        const expense = await prisma.$transaction(async (tx) => {
            const exp = await tx.storeExpense.create({
                data: {
                    locationId: String(locationId),
                    staffId: verifiedStaffId,
                    amount: parseFloat(amount),
                    category: category || "MISC",
                    description,
                    receiptUrl,
                    denominations: denominations || null
                }
            });

            if (denominations) {
                const activeShift = await tx.cashierShift.findFirst({
                    where: { locationId: String(locationId), status: "OPEN" }
                });
                if (activeShift) {
                    const shiftDenominations = activeShift.currentDenominations 
                        ? (typeof activeShift.currentDenominations === "string" 
                            ? JSON.parse(activeShift.currentDenominations) 
                            : activeShift.currentDenominations as Record<string, number>)
                        : {} as Record<string, number>;
                    
                    const denominationsKeys = ["500", "200", "100", "50", "20", "10", "5", "2", "1"];
                    const updatedDenominations: Record<string, number> = {};
                    for (const key of denominationsKeys) {
                        const currentCount = Number(shiftDenominations[key] || 0);
                        const expenseCount = Number(denominations[key] || 0);
                        updatedDenominations[key] = Math.max(0, currentCount - expenseCount);
                    }
                    
                    await tx.cashierShift.update({
                        where: { id: activeShift.id },
                        data: {
                            currentDenominations: updatedDenominations
                        }
                    });
                }
            }
            return exp;
        });

        res.json(expense);
    } catch (error: any) {
        console.error("[Expense Critical Error]", {
            message: error.message,
            stack: error.stack,
            meta: error.meta,
            code: error.code,
            full: JSON.stringify(error, null, 2)
        });
        res.status(500).json({ 
            error: "Prisma Operation Failed", 
            details: error.message,
            code: error.code 
        });
    }
};

export const getStoreExpenses = async (req: AuthRequest, res: Response) => {
    const locationId = req.params.locationId || req.user?.locationId;
    
    if (!locationId) {
        return res.status(400).json({ error: "Location ID required" });
    }

    try {
        const expenses = await prisma.storeExpense.findMany({
            where: { locationId: locationId as string },
            include: {
                staff: { select: { name: true } }
            },
            orderBy: { createdAt: "desc" }
        });
        res.json(expenses);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};
