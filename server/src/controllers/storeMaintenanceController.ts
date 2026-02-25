import { Request, Response, NextFunction } from "express";
import prisma from "../config/prisma";
import { BulkImportService } from "../services/bulkImportService";

export const getStoreCosts = async (req: Request, res: Response, next: NextFunction) => {
    // ... (rest of the file moves down)
    try {
        const locationId = req.params.locationId as string;
        const costs = await prisma.storeExpense.findMany({
            where: { locationId },
            orderBy: { date: "desc" }
        });
        res.json(costs);
    } catch (error) {
        next(error);
    }
};

export const recordStoreCost = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { locationId, category, amount, description, date } = req.body;
        const cost = await prisma.storeExpense.create({
            data: {
                locationId,
                category,
                amount: Number(amount),
                description,
                date: new Date(date)
            }
        });
        res.status(201).json(cost);
    } catch (error) {
        next(error);
    }
};

export const bulkDeleteProducts = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { productIds } = req.body;
        await prisma.product.deleteMany({
            where: { id: { in: productIds } }
        });
        res.json({ message: `${productIds.length} products deleted` });
    } catch (error) {
        next(error);
    }
};

export const exportProducts = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const products = await prisma.product.findMany({
            include: { variants: true }
        });
        // Simplification: In a real app, use an excel library
        res.json(products);
    } catch (error) {
        next(error);
    }
};

export const bulkImportProducts = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { locationId, staffId } = req.body;
        if (!req.file) return res.status(400).json({ message: "No file uploaded" });

        const results = await BulkImportService.importFromExcel(
            req.file.buffer,
            locationId,
            staffId || "SYSTEM"
        );
        res.json(results);
    } catch (error) {
        next(error);
    }
};

export const toggleWebsitePublishing = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { productId, isPublished } = req.body;
        const product = await prisma.product.update({
            where: { id: productId },
            data: { isActive: isPublished }
        });
        res.json(product);
    } catch (error) {
        next(error);
    }
};
