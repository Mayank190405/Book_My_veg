import { Request, Response } from "express";
import crypto from "crypto";
import prisma from "../config/prisma";

interface AuthenticatedRequest extends Request {
    user?: {
        userId: string;
        role: string;
        locationId?: string;
    };
}

export const createApiKey = async (req: AuthenticatedRequest, res: Response) => {
    const { name, role, locationId } = req.body;

    if (!name || !role) {
        return res.status(400).json({ message: "Name and role are required." });
    }

    if (role === "STORE_ADMIN" && !locationId) {
        return res.status(400).json({ message: "LocationId is required for store-level keys." });
    }

    try {
        // Enforce store alignment if creator is a store admin
        let targetLocationId = locationId;
        if (req.user?.role === "STORE_ADMIN") {
            const adminLocId = req.user.userId.startsWith("STORE_")
                ? req.user.userId.replace("STORE_", "")
                : (await prisma.user.findUnique({ where: { id: req.user.userId as string }, select: { locationId: true } }))?.locationId;

            if (!adminLocId || adminLocId !== locationId) {
                return res.status(403).json({ message: "Store admins can only create keys for their own store location." });
            }
            targetLocationId = adminLocId;
        }

        // Generate high-entropy API key
        const rawKey = "bmv_live_" + crypto.randomBytes(24).toString("hex");

        const apiKey = await prisma.apiKey.create({
            data: {
                name,
                key: rawKey,
                role,
                locationId: role === "STORE_ADMIN" ? targetLocationId : null
            },
            include: {
                location: { select: { name: true } }
            }
        });

        // Return the full unmasked key only ONCE upon creation
        res.status(201).json({
            message: "API Key created successfully. Please save this secret key now, as it will not be shown again.",
            id: apiKey.id,
            name: apiKey.name,
            key: apiKey.key, // Raw unmasked key
            role: apiKey.role,
            locationId: apiKey.locationId,
            locationName: apiKey.location?.name || "Global / General Admin",
            isActive: apiKey.isActive,
            createdAt: apiKey.createdAt
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const listApiKeys = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const caller = req.user;
        const where: any = {};

        // Scope keys listed for Store Admins to their store only
        if (caller?.role === "STORE_ADMIN") {
            const adminLocId = req.user?.userId.startsWith("STORE_")
                ? req.user.userId.replace("STORE_", "")
                : (await prisma.user.findUnique({ where: { id: req.user?.userId as string }, select: { locationId: true } }))?.locationId;

            if (adminLocId) {
                where.locationId = adminLocId;
            } else {
                return res.json([]);
            }
        }

        const keys = await prisma.apiKey.findMany({
            where,
            include: {
                location: { select: { name: true } }
            },
            orderBy: { createdAt: "desc" }
        });

        // Mask secrets to prevent unauthorized leakage in list views
        const maskedKeys = keys.map(key => ({
            id: key.id,
            name: key.name,
            key: `bmv_live_****************${key.key.substring(key.key.length - 4)}`, // masked
            role: key.role,
            locationId: key.locationId,
            locationName: key.location?.name || "Global / General Admin",
            isActive: key.isActive,
            isSuspended: key.isSuspended,
            suspendReason: key.suspendReason,
            createdAt: key.createdAt,
            updatedAt: key.updatedAt
        }));

        res.json(maskedKeys);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const toggleApiKey = async (req: AuthenticatedRequest, res: Response) => {
    const id = req.params.id as string;
    const { isActive } = req.body;

    if (isActive === undefined) {
        return res.status(400).json({ message: "isActive status is required." });
    }

    try {
        const key = await prisma.apiKey.findUnique({ where: { id } });
        if (!key) {
            return res.status(404).json({ message: "API key not found." });
        }

        // Store Admins sovereignty check
        if (req.user?.role === "STORE_ADMIN") {
            const adminLocId = req.user.userId.startsWith("STORE_")
                ? req.user.userId.replace("STORE_", "")
                : (await prisma.user.findUnique({ where: { id: req.user.userId as string }, select: { locationId: true } }))?.locationId;

            if (!adminLocId || adminLocId !== key.locationId) {
                return res.status(403).json({ message: "Store admins are restricted to managing local store API keys only." });
            }
        }

        // Update active status, and if activating, clear suspension status to allow recovery!
        const updated = await prisma.apiKey.update({
            where: { id },
            data: {
                isActive,
                ...(isActive && { isSuspended: false, suspendReason: null })
            }
        });

        res.json({
            message: `API key ${isActive ? "activated" : "deactivated"} successfully.`,
            id: updated.id,
            isActive: updated.isActive,
            isSuspended: updated.isSuspended
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const deleteApiKey = async (req: AuthenticatedRequest, res: Response) => {
    const id = req.params.id as string;

    try {
        const key = await prisma.apiKey.findUnique({ where: { id } });
        if (!key) {
            return res.status(404).json({ message: "API key not found." });
        }

        // Store Admins sovereignty check
        if (req.user?.role === "STORE_ADMIN") {
            const adminLocId = req.user.userId.startsWith("STORE_")
                ? req.user.userId.replace("STORE_", "")
                : (await prisma.user.findUnique({ where: { id: req.user.userId as string }, select: { locationId: true } }))?.locationId;

            if (!adminLocId || adminLocId !== key.locationId) {
                return res.status(403).json({ message: "Store admins are restricted to managing local store API keys only." });
            }
        }

        await prisma.apiKey.delete({ where: { id } });
        res.json({ message: "API key deleted successfully." });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};
