import { Request, Response } from "express";
import prisma from "../config/prisma";

export const suspendOrder = async (req: Request, res: Response) => {
    try {
        const { items, customerMobile, customerName, notes, totalAmount, staffId } = req.body;

        if (!items || items.length === 0) {
            return res.status(400).json({ message: "No items to suspend" });
        }

        const suspendedOrder = await (prisma as any).suspendedOrder.create({
            data: {
                staffId,
                customerMobile,
                customerName,
                totalAmount,
                notes,
                items: {
                    create: items.map((item: any) => ({
                        productId: item.productId,
                        variantId: item.variantId,
                        quantity: item.quantity,
                        price: item.price,
                        unit: item.unit || "pcs"
                    }))
                }
            },
            include: { items: true }
        });

        res.status(201).json(suspendedOrder);
    } catch (error) {
        console.error("Error suspending order:", error);
        res.status(500).json({ message: "Error suspending order" });
    }
};

export const getSuspendedOrders = async (req: Request, res: Response) => {
    try {
        const orders = await (prisma as any).suspendedOrder.findMany({
            include: {
                items: {
                    include: {
                        product: true,
                        variant: true
                    }
                }
            },
            orderBy: { createdAt: "desc" }
        });
        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: "Error fetching suspended orders" });
    }
};

export const deleteSuspendedOrder = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        await (prisma as any).suspendedOrder.delete({ where: { id: id as string } });
        res.json({ message: "Suspended order removed" });
    } catch (error) {
        res.status(500).json({ message: "Error deleting suspended order" });
    }
};
