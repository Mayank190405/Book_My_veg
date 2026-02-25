import { Request, Response } from "express";
import prisma from "../config/prisma";
import { z } from "zod";

// Schema for creating coupons (Admin)
export const createCouponSchema = z.object({
    body: z.object({
        code: z.string().min(3).toUpperCase(),
        discountType: z.enum(["FLAT", "PERCENTAGE"]),
        discountValue: z.number().positive(),
        minOrderAmount: z.number().nonnegative().optional(),
        maxDiscount: z.number().positive().optional(),
        expiresAt: z.string().datetime().optional(), // ISO string
        usageLimit: z.number().int().positive().optional(),
    }),
});

export const createCoupon = async (req: Request, res: Response) => {
    try {
        const { code, discountType, discountValue, minOrderAmount, maxDiscount, expiresAt, usageLimit } = req.body;

        const existing = await prisma.coupon.findUnique({ where: { code } });
        if (existing) return res.status(409).json({ message: "Coupon code already exists" });

        const coupon = await prisma.coupon.create({
            data: {
                code,
                discountType,
                discountValue,
                minOrderAmount: minOrderAmount || 0,
                maxDiscount,
                expiresAt,
                usageLimit,
            },
        });

        res.status(201).json(coupon);
    } catch (error) {
        res.status(500).json({ message: "Error creating coupon" });
    }
};

export const listCoupons = async (req: Request, res: Response) => {
    try {
        const coupons = await prisma.coupon.findMany({
            orderBy: { createdAt: "desc" },
        });
        res.json(coupons);
    } catch (error) {
        res.status(500).json({ message: "Error fetching coupons" });
    }
};

export const validateCoupon = async (req: Request, res: Response) => {
    const { code, orderAmount } = req.body;

    if (!code) return res.status(400).json({ message: "Coupon code required" });

    try {
        const coupon = await prisma.coupon.findUnique({ where: { code } });

        if (!coupon) return res.status(404).json({ message: "Invalid coupon code" });
        if (!coupon.isActive) return res.status(400).json({ message: "Coupon is inactive" });
        if (coupon.expiresAt && new Date() > coupon.expiresAt) return res.status(400).json({ message: "Coupon expired" });
        if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) return res.status(400).json({ message: "Coupon usage limit reached" });

        const amount = Number(orderAmount || 0);
        if (amount < Number(coupon.minOrderAmount)) {
            return res.status(400).json({ message: `Minimum order amount is ₹${coupon.minOrderAmount}` });
        }

        // Calculate discount
        let discount = 0;
        if (coupon.discountType === "FLAT") {
            discount = Number(coupon.discountValue);
        } else {
            discount = (amount * Number(coupon.discountValue)) / 100;
            if (coupon.maxDiscount) {
                discount = Math.min(discount, Number(coupon.maxDiscount));
            }
        }

        res.json({
            isValid: true,
            code: coupon.code,
            discountAmount: discount,
            description: coupon.discountType === "FLAT" ? `₹${Number(coupon.discountValue)} OFF` : `${Number(coupon.discountValue)}% OFF`,
            couponId: coupon.id
        });
    } catch (error) {
        res.status(500).json({ message: "Error validating coupon" });
    }
};
