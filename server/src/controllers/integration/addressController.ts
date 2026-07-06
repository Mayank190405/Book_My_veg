import { Response } from "express";
import prisma from "../../config/prisma";
import { logAuthorizationFailure } from "../../middleware/integrationThreatDetector";

export const getUserAddresses = async (req: any, res: Response) => {
    const { userId } = req.params;
    const integration = req.integration;

    try {
        // Fetch target user location boundary
        const targetUser = await prisma.user.findUnique({
            where: { id: userId },
            select: { locationId: true }
        });

        if (!targetUser) {
            return res.status(404).json({ message: "User not found." });
        }

        // Store boundary enforcement
        if (integration.role === "STORE_ADMIN" && targetUser.locationId !== integration.locationId) {
            await logAuthorizationFailure(req);
            return res.status(403).json({ message: "Forbidden. User store alignment mismatch." });
        }

        const addresses = await prisma.address.findMany({
            where: { userId },
            orderBy: { isDefault: "desc" }
        });

        res.json(addresses);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const createUserAddress = async (req: any, res: Response) => {
    const { userId } = req.params;
    const { type, fullAddress, landmark, city, state, pincode, name, phone, latitude, longitude, isDefault } = req.body;
    const integration = req.integration;

    if (!fullAddress) {
        return res.status(400).json({ message: "fullAddress is required." });
    }

    try {
        const targetUser = await prisma.user.findUnique({
            where: { id: userId },
            select: { locationId: true }
        });

        if (!targetUser) {
            return res.status(404).json({ message: "User not found." });
        }

        // Store boundary enforcement
        if (integration.role === "STORE_ADMIN" && targetUser.locationId !== integration.locationId) {
            await logAuthorizationFailure(req);
            return res.status(403).json({ message: "Forbidden. User store alignment mismatch." });
        }

        // If setting as default, unset other default addresses for this user
        if (isDefault) {
            await prisma.address.updateMany({
                where: { userId, isDefault: true },
                data: { isDefault: false }
            });
        }

        const address = await prisma.address.create({
            data: {
                userId,
                type: type || "HOME",
                fullAddress,
                landmark,
                city,
                state,
                pincode,
                name,
                phone,
                latitude: latitude ? parseFloat(latitude) : null,
                longitude: longitude ? parseFloat(longitude) : null,
                isDefault: !!isDefault,
                tag: type === "OTHER" ? "Other" : type === "HOME" ? "Home" : "Office"
            }
        });

        res.status(201).json(address);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const updateUserAddress = async (req: any, res: Response) => {
    const { id } = req.params;
    const { type, fullAddress, landmark, city, state, pincode, name, phone, latitude, longitude, isDefault } = req.body;
    const integration = req.integration;

    try {
        const address = await prisma.address.findUnique({
            where: { id },
            include: { user: { select: { id: true, locationId: true } } }
        });

        if (!address) {
            return res.status(404).json({ message: "Address not found." });
        }

        // Store boundary enforcement
        if (integration.role === "STORE_ADMIN" && address.user.locationId !== integration.locationId) {
            await logAuthorizationFailure(req);
            return res.status(403).json({ message: "Forbidden. Address belongs to user in another store boundary." });
        }

        if (isDefault) {
            await prisma.address.updateMany({
                where: { userId: address.userId, isDefault: true },
                data: { isDefault: false }
            });
        }

        const updated = await prisma.address.update({
            where: { id },
            data: {
                type,
                fullAddress,
                landmark,
                city,
                state,
                pincode,
                name,
                phone,
                latitude: latitude !== undefined ? (latitude ? parseFloat(latitude) : null) : undefined,
                longitude: longitude !== undefined ? (longitude ? parseFloat(longitude) : null) : undefined,
                isDefault: isDefault !== undefined ? !!isDefault : undefined,
                tag: type === "OTHER" ? "Other" : type === "HOME" ? "Home" : "Office"
            }
        });

        res.json(updated);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};
