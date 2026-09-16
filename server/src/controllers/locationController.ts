import { Request, Response } from "express";
import prisma from "../config/prisma";
import bcrypt from "bcryptjs";

export const getLocationById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        if (!id || id === "null" || id === "undefined") {
            return res.json(null);
        }
        const location = await (prisma.location as any).findUnique({
            where: { id },
            select: {
                id: true,
                slug: true,
                name: true,
                address: true,
                contactNumber: true,
                gstNumber: true,
                receiptHeader: true,
                receiptFooter: true,
                latitude: true,
                longitude: true,
                deliveryRadius: true,
                isOpen: true,
                upiId: true
            }
        });
        if (!location) return res.status(404).json({ message: "Location not found" });
        res.json(location);
    } catch (error) {
        res.status(500).json({ message: "Error fetching location" });
    }
};

let locationSchemaEnsured = false;
const ensureLocationSchema = async () => {
    if (locationSchemaEnsured) return;
    try {
        await prisma.$executeRawUnsafe(`
            ALTER TABLE "Location" ADD COLUMN IF NOT EXISTS "purchaseManagerId" TEXT;
        `);
        locationSchemaEnsured = true;
    } catch (e) {
        console.error("[LOCATION SCHEMA WARNING]", e);
    }
};

export const getLocations = async (_req: Request, res: Response) => {
    try {
        await ensureLocationSchema();
        try {
            const locations = await prisma.location.findMany({
                orderBy: { name: "asc" },
                select: {
                    id: true,
                    slug: true,
                    name: true,
                    address: true,
                    contactNumber: true,
                    gstNumber: true,
                    receiptHeader: true,
                    receiptFooter: true,
                    latitude: true,
                    longitude: true,
                    deliveryRadius: true,
                    isOpen: true,
                    upiId: true,
                    purchaseManagerId: true,
                    purchaseManager: { select: { id: true, name: true, phone: true, email: true } }
                }
            });
            return res.status(200).json(locations);
        } catch (queryErr) {
            console.warn("[getLocations fallback]:", queryErr);
            const fallbackLocations = await prisma.location.findMany({
                orderBy: { name: "asc" },
                select: {
                    id: true,
                    slug: true,
                    name: true,
                    address: true,
                    contactNumber: true,
                    gstNumber: true,
                    receiptHeader: true,
                    receiptFooter: true,
                    latitude: true,
                    longitude: true,
                    deliveryRadius: true,
                    isOpen: true,
                    upiId: true
                }
            });
            return res.status(200).json(fallbackLocations);
        }
    } catch (error: any) {
        console.error("[getLocations Critical Error]:", error);
        res.status(500).json({ error: error.message });
    }
};
export const getLocationBySlug = async (req: Request, res: Response) => {
    try {
        const { slug } = req.params;
        const location = await (prisma.location as any).findFirst({
            where: { slug: slug as string },
            select: {
                id: true,
                slug: true,
                name: true,
                address: true,
                contactNumber: true,
                gstNumber: true,
                receiptHeader: true,
                receiptFooter: true,
                latitude: true,
                longitude: true,
                deliveryRadius: true
            }
        });
        if (!location) return res.status(404).json({ message: "Location not found" });
        res.json(location);
    } catch (error) {
        res.status(500).json({ message: "Error fetching location" });
    }
};

export const createLocation = async (req: Request, res: Response) => {
    try {
        const { name, password, ...rest } = req.body;
        if (!name) return res.status(400).json({ message: "Location name is required" });

        // Generate base slug
        let slug = name.toLowerCase().trim().replace(/[^\w ]+/g, "").replace(/ +/g, "-");

        // Check for collision
        const existing = await prisma.location.findFirst({ where: { slug } });
        if (existing) {
            slug = `${slug}-${Math.random().toString(36).substring(7)}`;
        }

        let hashedPassword = undefined;
        if (password) {
            hashedPassword = await bcrypt.hash(password, 10);
        }

        const locationId = req.params.id; // For update logic mostly, but let's focus on create first
        
        // Data Sanitation & Typal Alignment (Strings to Floats)
        const sanitizedData: any = {
            address: rest.address || null,
            contactNumber: rest.contactNumber || null,
            gstNumber: rest.gstNumber || null,
            receiptHeader: rest.receiptHeader || null,
            receiptFooter: rest.receiptFooter || null,
            latitude: (rest.latitude !== undefined && rest.latitude !== null && rest.latitude !== "") 
                ? parseFloat(rest.latitude) 
                : null,
            longitude: (rest.longitude !== undefined && rest.longitude !== null && rest.longitude !== "") 
                ? parseFloat(rest.longitude) 
                : null,
            deliveryRadius: (rest.deliveryRadius !== undefined && rest.deliveryRadius !== null && rest.deliveryRadius !== "") 
                ? parseFloat(rest.deliveryRadius) 
                : 15.0,
        };

        const location = await (prisma.location as any).create({
            data: { 
                ...sanitizedData, 
                name, 
                slug, 
                password: hashedPassword 
            }
        });

        // Sanitize output
        const { password: _, ...sanitized } = location;
        res.status(201).json(sanitized);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const updateLocation = async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;
        const { password, ...rest } = req.body;

        const sanitizedData: any = { ...rest };

        // Safeguard: Never wipe out latitude if it was omitted or empty in partial updates (e.g. POS isOpen toggle)
        if ("latitude" in rest) {
            if (rest.latitude === "" || rest.latitude === null || rest.latitude === undefined) {
                delete sanitizedData.latitude; // Preserve existing coordinate in DB
            } else {
                const parsedLat = parseFloat(rest.latitude);
                if (!isNaN(parsedLat)) {
                    sanitizedData.latitude = parsedLat;
                } else {
                    delete sanitizedData.latitude;
                }
            }
        }

        // Safeguard: Never wipe out longitude if it was omitted or empty in partial updates
        if ("longitude" in rest) {
            if (rest.longitude === "" || rest.longitude === null || rest.longitude === undefined) {
                delete sanitizedData.longitude; // Preserve existing coordinate in DB
            } else {
                const parsedLng = parseFloat(rest.longitude);
                if (!isNaN(parsedLng)) {
                    sanitizedData.longitude = parsedLng;
                } else {
                    delete sanitizedData.longitude;
                }
            }
        }

        if ("deliveryRadius" in rest) {
            if (rest.deliveryRadius !== "" && rest.deliveryRadius !== null && rest.deliveryRadius !== undefined) {
                const parsedRadius = parseFloat(rest.deliveryRadius);
                if (!isNaN(parsedRadius)) {
                    sanitizedData.deliveryRadius = parsedRadius;
                } else {
                    delete sanitizedData.deliveryRadius;
                }
            } else {
                delete sanitizedData.deliveryRadius;
            }
        }

        if (password) {
            sanitizedData.password = await bcrypt.hash(password, 10);
        }

        const location = await (prisma.location as any).update({
            where: { id },
            data: sanitizedData
        });

        const { password: _, ...sanitized } = location;
        res.status(200).json(sanitized);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const deleteLocation = async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;
        await prisma.location.delete({ where: { id } });
        res.status(204).send();
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const getSeoSitemapData = async (_req: Request, res: Response) => {
    try {
        const locations = await prisma.location.findMany({
            select: { id: true, slug: true, name: true, address: true }
        });

        const categories = await prisma.category.findMany({
            select: { id: true, slug: true, name: true }
        });

        const products = await prisma.product.findMany({
            select: { id: true, name: true, createdAt: true, updatedAt: true }
        });

        const popular = await prisma.searchHistory.groupBy({
            by: ["query"],
            _sum: { count: true },
            orderBy: { _sum: { count: "desc" } },
            take: 30,
        });
        let popularSearches = popular.map(p => p.query);
        if (popularSearches.length === 0) {
            popularSearches = ["Organic Potato", "Fresh Onion", "Alphonso Mango", "Mint Leaves", "Green Chili", "Desi Ghee"];
        }

        const addresses = await prisma.address.findMany({
            select: { city: true, pincode: true, fullAddress: true }
        });

        // Filter and get distinct pincodes and cities
        const uniqueCities = Array.from(new Set(addresses.map(a => a.city).filter(Boolean)));
        const uniquePincodes = Array.from(new Set(addresses.map(a => a.pincode).filter(Boolean)));

        res.status(200).json({
            locations,
            categories,
            products,
            popularSearches,
            uniqueCities,
            uniquePincodes
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};
