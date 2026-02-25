import { Request, Response } from "express";
import prisma from "../config/prisma";

interface AuthenticatedRequest extends Request {
    user?: {
        userId: string;
        role: string;
    };
}

export const getAddresses = async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    try {
        const addresses = await prisma.address.findMany({
            where: { userId },
            orderBy: { isDefault: 'desc' } // Default address first
        });
        res.json(addresses);
    } catch (error) {
        res.status(500).json({ message: "Error fetching addresses" });
    }
};

export const createAddress = async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    // Expanded fields based on new schema
    const {
        type,
        fullAddress,
        landmark,
        city,
        state,
        pincode,
        name,
        phone,
        latitude,
        longitude,
        isDefault
    } = req.body;

    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    try {
        // If setting as default, unset other default addresses
        if (isDefault) {
            await prisma.address.updateMany({
                where: { userId, isDefault: true },
                data: { isDefault: false }
            });
        }

        const address = await prisma.address.create({
            data: {
                userId,
                type,
                fullAddress,
                landmark,
                city,
                state,
                pincode,
                name,
                phone,
                latitude,
                longitude,
                isDefault,
                tag: type === "OTHER" ? "Other" : type === "HOME" ? "Home" : "Office"
            }
        });

        res.status(201).json(address);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error creating address" });
    }
};

export const updateAddress = async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    const { id } = req.params;
    const {
        type,
        fullAddress,
        landmark,
        city,
        state,
        pincode,
        name,
        phone,
        latitude,
        longitude,
        isDefault
    } = req.body;

    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    try {
        if (isDefault) {
            await prisma.address.updateMany({
                where: { userId, isDefault: true },
                data: { isDefault: false }
            });
        }

        const address = await prisma.address.update({
            where: { id: id as string, userId },
            data: {
                type,
                fullAddress,
                landmark,
                city,
                state,
                pincode,
                name,
                phone,
                latitude,
                longitude,
                isDefault,
                tag: type === "OTHER" ? "Other" : type === "HOME" ? "Home" : "Office"
            }
        });

        res.json(address);
    } catch (error) {
        res.status(500).json({ message: "Error updating address" });
    }
};

export const deleteAddress = async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    const { id } = req.params;

    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    try {
        await prisma.address.delete({
            where: { id: id as string, userId }
        });
        res.json({ message: "Address deleted" });
    } catch (error) {
        res.status(500).json({ message: "Error deleting address" });
    }
};
