import { Request, Response } from "express";
import prisma from "../config/prisma";

export const getLocations = async (_req: Request, res: Response) => {
    try {
        const locations = await prisma.location.findMany({
            orderBy: { name: "asc" }
        });
        res.status(200).json(locations);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};
export const getLocationBySlug = async (req: Request, res: Response) => {
    try {
        const { slug } = req.params;
        const location = await (prisma.location as any).findFirst({
            where: { slug: slug as string }
        });
        if (!location) return res.status(404).json({ message: "Location not found" });
        res.json(location);
    } catch (error) {
        res.status(500).json({ message: "Error fetching location" });
    }
};

export const createLocation = async (req: Request, res: Response) => {
    try {
        const { name, ...rest } = req.body;
        if (!name) return res.status(400).json({ message: "Location name is required" });

        // Generate base slug
        let slug = name.toLowerCase().trim().replace(/[^\w ]+/g, "").replace(/ +/g, "-");

        // Check for collision
        const existing = await prisma.location.findFirst({ where: { slug } });
        if (existing) {
            slug = `${slug}-${Math.random().toString(36).substring(7)}`;
        }

        const location = await prisma.location.create({
            data: { ...rest, name, slug }
        });
        res.status(201).json(location);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const updateLocation = async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;
        const location = await prisma.location.update({
            where: { id },
            data: req.body
        });
        res.status(200).json(location);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};
