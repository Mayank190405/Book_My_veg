import { Request, Response, NextFunction } from "express";
import prisma from "../config/prisma";
import { AuthRequest } from "../middleware/auth";

export const getVendors = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { locationId, query, category, isActive } = req.query;
    try {
        const whereClause: any = {};

        if (isActive !== undefined && isActive !== "ALL") {
            whereClause.isActive = isActive === "true";
        }

        if (category && category !== "ALL") {
            whereClause.category = String(category);
        }

        if (locationId && locationId !== "ALL") {
            whereClause.OR = [
                { locationId: String(locationId) },
                { locationId: null }
            ];
        }

        if (query) {
            const q = String(query).trim();
            whereClause.OR = [
                { name: { contains: q, mode: "insensitive" } },
                { companyName: { contains: q, mode: "insensitive" } },
                { phone: { contains: q } },
                { email: { contains: q, mode: "insensitive" } },
                { gstNumber: { contains: q, mode: "insensitive" } }
            ];
        }

        const vendors = await prisma.vendor.findMany({
            where: whereClause,
            include: {
                location: { select: { id: true, name: true, slug: true } },
                _count: { select: { purchaseOrders: true } }
            },
            orderBy: { createdAt: "desc" }
        });

        res.json({ vendors });
    } catch (error) {
        next(error);
    }
};

export const getVendorById = async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    try {
        const vendor = await prisma.vendor.findUnique({
            where: { id: String(id) },
            include: {
                location: { select: { id: true, name: true, slug: true } },
                purchaseOrders: {
                    orderBy: { createdAt: "desc" },
                    take: 10,
                    include: {
                        location: { select: { name: true } },
                        items: {
                            include: {
                                product: { select: { name: true } }
                            }
                        }
                    }
                }
            }
        });

        if (!vendor) {
            return res.status(404).json({ message: "Vendor not found" });
        }

        res.json({ vendor });
    } catch (error) {
        next(error);
    }
};

export const createVendor = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { name, companyName, phone, email, address, gstNumber, paymentTerms, category, locationId } = req.body;

    if (!name || !phone) {
        return res.status(400).json({ message: "Vendor name and phone number are required." });
    }

    try {
        const vendor = await prisma.vendor.create({
            data: {
                name: String(name).trim(),
                companyName: companyName ? String(companyName).trim() : null,
                phone: String(phone).trim(),
                email: email ? String(email).trim() : null,
                address: address ? String(address).trim() : null,
                gstNumber: gstNumber ? String(gstNumber).trim() : null,
                paymentTerms: paymentTerms || "NET_30",
                category: category || "VEGETABLES",
                locationId: locationId && locationId !== "GLOBAL" ? String(locationId) : null,
                isActive: true
            },
            include: {
                location: { select: { id: true, name: true } }
            }
        });

        res.status(201).json({ message: "Vendor registered successfully.", vendor });
    } catch (error) {
        next(error);
    }
};

export const updateVendor = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { name, companyName, phone, email, address, gstNumber, paymentTerms, category, locationId, isActive } = req.body;

    try {
        const vendor = await prisma.vendor.update({
            where: { id: String(id) },
            data: {
                ...(name && { name: String(name).trim() }),
                ...(companyName !== undefined && { companyName: companyName ? String(companyName).trim() : null }),
                ...(phone && { phone: String(phone).trim() }),
                ...(email !== undefined && { email: email ? String(email).trim() : null }),
                ...(address !== undefined && { address: address ? String(address).trim() : null }),
                ...(gstNumber !== undefined && { gstNumber: gstNumber ? String(gstNumber).trim() : null }),
                ...(paymentTerms !== undefined && { paymentTerms }),
                ...(category !== undefined && { category }),
                ...(locationId !== undefined && { locationId: locationId && locationId !== "GLOBAL" ? String(locationId) : null }),
                ...(isActive !== undefined && { isActive: Boolean(isActive) })
            },
            include: {
                location: { select: { id: true, name: true } }
            }
        });

        res.json({ message: "Vendor updated successfully.", vendor });
    } catch (error) {
        next(error);
    }
};

export const deleteVendor = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { id } = req.params;
    try {
        await prisma.vendor.delete({ where: { id: String(id) } });
        res.json({ message: "Vendor deleted successfully." });
    } catch (error) {
        next(error);
    }
};
