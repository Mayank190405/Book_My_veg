import { Request, Response, NextFunction } from "express";
import prisma from "../config/prisma";

export const getBanners = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const banners = await prisma.banner.findMany({
            orderBy: { sortOrder: "asc" }
        });
        res.json(banners);
    } catch (error) {
        next(error);
    }
};

export const createBanner = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { title, subtitle, imageUrl, link, isActive, sortOrder, redirectType, redirectId, buttonText, priority, position } = req.body;

        if (isActive) {
            const activeCount = await prisma.banner.count({ where: { isActive: true } });
            if (activeCount >= 3) {
                return res.status(400).json({ message: "Maximum of 3 active banners allowed" });
            }
        }

        const banner = await prisma.banner.create({
            data: {
                title,
                subtitle,
                imageUrl,
                link,
                isActive: isActive ?? true,
                sortOrder: sortOrder || 0,
                redirectType: redirectType || "external",
                redirectId,
                buttonText,
                priority: priority || 0,
                position: position || "HOME_TOP"
            }
        });

        res.status(201).json(banner);
    } catch (error) {
        next(error);
    }
};

export const updateBanner = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = req.params.id as string;
        const { title, subtitle, imageUrl, link, isActive, sortOrder, redirectType, redirectId, buttonText, priority, position } = req.body;

        if (isActive) {
            const activeCount = await prisma.banner.count({
                where: {
                    isActive: true,
                    id: { not: id }
                }
            });
            if (activeCount >= 3) {
                return res.status(400).json({ message: "Maximum of 3 active banners allowed" });
            }
        }

        const banner = await prisma.banner.update({
            where: { id },
            data: {
                title,
                subtitle,
                imageUrl,
                link,
                isActive,
                sortOrder,
                redirectType,
                redirectId,
                buttonText,
                priority,
                position
            }
        });
        res.json(banner);
    } catch (error) {
        next(error);
    }
};

export const deleteBanner = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = req.params.id as string;
        await prisma.banner.delete({ where: { id } });
        res.json({ message: "Banner deleted" });
    } catch (error) {
        next(error);
    }
};

export const toggleBanner = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = req.params.id as string;
        const existing = await prisma.banner.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ message: "Banner not found" });

        const newState = !existing.isActive;

        if (newState) {
            const activeCount = await prisma.banner.count({ where: { isActive: true } });
            if (activeCount >= 3) {
                return res.status(400).json({ message: "Maximum of 3 active banners allowed" });
            }
        }

        const banner = await prisma.banner.update({
            where: { id },
            data: { isActive: newState }
        });
        res.json(banner);
    } catch (error) {
        next(error);
    }
};
