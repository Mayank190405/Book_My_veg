import { Response } from "express";
import prisma from "../../config/prisma";
import bcrypt from "bcryptjs";
import { logAuthorizationFailure, logDataHarvest } from "../../middleware/integrationThreatDetector";

export const getUsers = async (req: any, res: Response) => {
    const integration = req.integration;
    const { limit = 20, cursor } = req.query;

    const parsedLimit = Math.min(Number(limit) || 20, 100);
    const where: any = {};

    // Store-level API Key isolation check
    if (integration.role === "STORE_ADMIN") {
        if (integration.locationId) {
            where.locationId = integration.locationId;
        } else {
            return res.json({ data: [], nextCursor: null });
        }
    }

    try {
        const users = await prisma.user.findMany({
            where,
            take: parsedLimit + 1,
            cursor: cursor ? { id: cursor as string } : undefined,
            skip: cursor ? 1 : 0,
            select: {
                id: true,
                phone: true,
                email: true,
                name: true,
                role: true,
                isActive: true,
                locationId: true,
                createdAt: true,
                updatedAt: true
            },
            orderBy: { createdAt: "desc" }
        });

        const hasMore = users.length > parsedLimit;
        const data = hasMore ? users.slice(0, parsedLimit) : users;
        const nextCursor = hasMore ? data[data.length - 1].id : null;

        // Log record consumption volume
        await logDataHarvest(req, data.length);

        res.json({ data, nextCursor });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const getUserDetail = async (req: any, res: Response) => {
    const { id } = req.params;
    const integration = req.integration;

    try {
        const user = await prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                phone: true,
                email: true,
                name: true,
                role: true,
                isActive: true,
                locationId: true,
                createdAt: true,
                updatedAt: true,
                addresses: true
            }
        });

        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        // Store boundary enforcement
        if (integration.role === "STORE_ADMIN" && user.locationId !== integration.locationId) {
            await logAuthorizationFailure(req);
            return res.status(403).json({ message: "Forbidden. Store access mismatch." });
        }

        res.json(user);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const createUser = async (req: any, res: Response) => {
    const { phone, name, email, role, locationId, password } = req.body;
    const integration = req.integration;

    if (!phone) {
        return res.status(400).json({ message: "Phone is required." });
    }

    // Align location for store-level API keys
    let targetLocationId = locationId;
    if (integration.role === "STORE_ADMIN") {
        if (locationId && locationId !== integration.locationId) {
            await logAuthorizationFailure(req);
            return res.status(403).json({ message: "Forbidden. Store admins can only onboard local store staff." });
        }
        targetLocationId = integration.locationId;
    }

    try {
        const hashedPassword = password ? await bcrypt.hash(password, 10) : await bcrypt.hash("user123", 10);

        const user = await prisma.user.create({
            data: {
                phone: phone.toString(),
                name,
                email,
                role: role || "USER",
                locationId: targetLocationId,
                password: hashedPassword,
                isActive: true
            },
            select: {
                id: true,
                phone: true,
                email: true,
                name: true,
                role: true,
                isActive: true,
                locationId: true,
                createdAt: true
            }
        });

        res.status(201).json(user);
    } catch (error: any) {
        if (error.code === 'P2002') {
            return res.status(409).json({ message: "Phone number or email is already registered." });
        }
        res.status(500).json({ error: error.message });
    }
};

export const updateUser = async (req: any, res: Response) => {
    const { id } = req.params;
    const { name, email, role, locationId, isActive, password } = req.body;
    const integration = req.integration;

    try {
        const targetUser = await prisma.user.findUnique({ where: { id } });
        if (!targetUser) {
            return res.status(404).json({ message: "User not found." });
        }

        // Store boundary enforcement
        if (integration.role === "STORE_ADMIN" && targetUser.locationId !== integration.locationId) {
            await logAuthorizationFailure(req);
            return res.status(403).json({ message: "Forbidden. Store access mismatch." });
        }

        // Prevent location modification for store admins
        if (integration.role === "STORE_ADMIN" && locationId && locationId !== integration.locationId) {
            return res.status(403).json({ message: "Forbidden. Cannot move user to another store location." });
        }

        const hashedPassword = password ? await bcrypt.hash(password, 10) : undefined;

        const updatedUser = await prisma.user.update({
            where: { id },
            data: {
                name,
                email,
                role,
                locationId: integration.role === "STORE_ADMIN" ? targetUser.locationId : locationId,
                isActive,
                ...(hashedPassword && { password: hashedPassword })
            },
            select: {
                id: true,
                phone: true,
                email: true,
                name: true,
                role: true,
                isActive: true,
                locationId: true,
                updatedAt: true
            }
        });

        res.json(updatedUser);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};
