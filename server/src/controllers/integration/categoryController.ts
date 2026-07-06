import { Response } from "express";
import prisma from "../../config/prisma";

export const getCategories = async (req: any, res: Response) => {
    try {
        const categories = await prisma.category.findMany({
            where: { isActive: true, parentId: null },
            include: { children: true },
            orderBy: { sortOrder: "asc" }
        });
        res.json(categories);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};
