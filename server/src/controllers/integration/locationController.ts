import { Response } from "express";
import prisma from "../../config/prisma";
import { logAuthorizationFailure } from "../../middleware/integrationThreatDetector";

export const getLocations = async (req: any, res: Response) => {
    const integration = req.integration;
    const where: any = { isOpen: true };

    // Scope store list for store-level API keys
    if (integration.role === "STORE_ADMIN") {
        if (integration.locationId) {
            where.id = integration.locationId;
        } else {
            return res.json([]);
        }
    }

    try {
        const locations = await prisma.location.findMany({
            where,
            select: {
                id: true,
                slug: true,
                name: true,
                address: true,
                contactNumber: true,
                gstNumber: true,
                latitude: true,
                longitude: true,
                deliveryRadius: true,
                isOpen: true
            }
        });
        res.json(locations);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const getLocationDetail = async (req: any, res: Response) => {
    const { id } = req.params;
    const integration = req.integration;

    // Store boundary check
    if (integration.role === "STORE_ADMIN" && integration.locationId !== id) {
        await logAuthorizationFailure(req);
        return res.status(403).json({ message: "Forbidden. Store access mismatch." });
    }

    try {
        const location = await prisma.location.findUnique({
            where: { id },
            select: {
                id: true,
                slug: true,
                name: true,
                address: true,
                contactNumber: true,
                gstNumber: true,
                latitude: true,
                longitude: true,
                deliveryRadius: true,
                isOpen: true
            }
        });

        if (!location) {
            return res.status(404).json({ message: "Location not found." });
        }

        res.json(location);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};
