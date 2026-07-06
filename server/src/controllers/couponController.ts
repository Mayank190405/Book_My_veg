import { Request, Response } from "express";
import prisma from "../config/prisma";
import { z } from "zod";
import { AuthRequest } from "../middleware/auth";
import { couponService, CartItemInput } from "../services/couponService";

// Schema for creating coupons (Admin)
export const createCouponSchema = z.object({
    body: z.object({
        code: z.string().min(1).toUpperCase(),
        // Case-insensitive enum mapping (maps "PERCENT" -> "PERCENTAGE" for frontend parity)
        discountType: z.preprocess((val: any) => {
            const s = String(val || "FLAT").toUpperCase();
            return s === "PERCENT" ? "PERCENTAGE" : s;
        }, z.enum(["FLAT", "PERCENTAGE"])),
        discountValue: z.coerce.number().nonnegative().optional().nullable(),
        minOrderAmount: z.preprocess((val) => (val === "" ? undefined : val), z.coerce.number().nonnegative().optional()),
        maxDiscount: z.preprocess((val) => (!val || val === "" || val === 0 || val === "0" ? undefined : val), z.coerce.number().positive().optional()),
        expiresAt: z.preprocess((val) => (val === "" ? undefined : val), z.string().optional().nullable()), 
        usageLimit: z.preprocess((val) => (!val || val === "" || val === 0 || val === "0" ? undefined : val), z.coerce.number().int().positive().optional().nullable()),
        type: z.enum(["DISCOUNT", "ITEM_DISCOUNT", "SPECIAL_PRICE_ITEM", "FREE_GIFT", "CASHBACK"]).optional(),
        description: z.string().optional(),
        rewardProductId: z.string().optional().nullable(),
        rewardVariantId: z.string().optional().nullable(),
        specialPrice: z.coerce.number().optional().nullable(),
        userUsageLimit: z.coerce.number().int().optional(),
        cartRulesJson: z.any().optional().nullable(),
        scheduleRulesJson: z.any().optional().nullable(),
        allowedLocations: z.array(z.string()).optional(),
        allowedPincodes: z.array(z.string()).optional(),
        allowedPayment: z.array(z.string()).optional(),
        userSegments: z.array(z.string()).optional(),
    }),
});

export const createCoupon = async (req: Request, res: Response) => {
    try {
        console.log("DEBUG: Processing Coupon with data:", JSON.stringify(req.body, null, 2));
        const { 
            code, 
            discountType, 
            discountValue, 
            minOrderAmount, 
            maxDiscount, 
            expiresAt, 
            usageLimit,
            type,
            description,
            rewardProductId,
            rewardVariantId,
            specialPrice,
            userUsageLimit,
            cartRulesJson,
            scheduleRulesJson,
            allowedLocations,
            allowedPincodes,
            allowedPayment,
            userSegments
        } = req.body;

        const existing = await prisma.coupon.findUnique({ where: { code } });
        if (existing) return res.status(409).json({ message: "Coupon code already exists" });

        const expiresDate = expiresAt ? new Date(expiresAt) : null;
        const validExpiresAt = (expiresDate instanceof Date && !isNaN(expiresDate.getTime())) ? expiresDate : null;

        const coupon = await prisma.coupon.create({
            data: {
                code,
                discountType: discountType || "FLAT",
                discountValue: discountValue !== undefined && discountValue !== null ? parseFloat(discountValue) : 0,
                minOrderAmount: minOrderAmount ? parseFloat(minOrderAmount) : 0,
                maxDiscount: maxDiscount ? parseFloat(maxDiscount) : null,
                expiresAt: validExpiresAt,
                usageLimit: usageLimit ? parseInt(usageLimit) : null,
                type: type || "DISCOUNT",
                description: description || "",
                rewardProductId: rewardProductId || null,
                rewardVariantId: rewardVariantId || null,
                specialPrice: specialPrice !== undefined && specialPrice !== null ? parseFloat(specialPrice) : null,
                userUsageLimit: userUsageLimit !== undefined ? parseInt(userUsageLimit) : 1,
                cartRulesJson: cartRulesJson || null,
                scheduleRulesJson: scheduleRulesJson || null,
                allowedLocations: allowedLocations || [],
                allowedPincodes: allowedPincodes || [],
                allowedPayment: allowedPayment || [],
                userSegments: userSegments || ["ALL"]
            },
        });

        res.status(201).json(coupon);
    } catch (error) {
        console.error("Critical Coupon Creation Failure:", error);
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
        console.error("DEBUG: Error fetching coupons:", error);
        res.status(500).json({ message: "Error fetching coupons" });
    }
};

export const validateCoupon = async (req: Request, res: Response) => {
    const { code, orderAmount, paymentMethod, pincode } = req.body;
    const authReq = req as AuthRequest;
    const userId = authReq.user?.userId;

    if (!code) return res.status(400).json({ message: "Coupon code required" });

    try {
        const amount = Number(orderAmount || 0);

        // Fetch cart items from DB or body
        let cartItems: CartItemInput[] = [];
        if (req.body.cartItems && Array.isArray(req.body.cartItems)) {
            cartItems = req.body.cartItems;
        } else if (userId) {
            const userCart = await prisma.cart.findUnique({
                where: { userId },
                include: {
                    items: {
                        include: {
                            product: true,
                            variant: true
                        }
                    }
                }
            });

            if (userCart && userCart.items) {
                cartItems = userCart.items.map((item) => {
                    const price = item.variant 
                        ? Number(item.variant.price) 
                        : Number(item.product.basePrice || 0);
                    return {
                        productId: item.productId,
                        variantId: item.variantId || undefined,
                        quantity: Number(item.quantity),
                        price,
                        categoryId: item.product.categoryId,
                        name: item.product.name
                    };
                });
            }
        }

        // Run validation through the consolidated rules engine
        const result = await couponService.validateCoupon(
            prisma,
            code,
            amount,
            userId,
            cartItems,
            paymentMethod,
            pincode
        );

        res.json({
            isValid: true,
            code: result.code,
            discountAmount: result.discountAmount,
            description: result.description,
            couponId: result.id,
            type: result.type,
            rewardProductId: result.rewardProductId,
            specialPrice: result.specialPrice
        });
    } catch (error: any) {
        console.error("DEBUG: Coupon validation error:", error.message);
        res.status(error.statusCode || 400).json({ message: error.message || "Error validating coupon" });
    }
};

export const updateCoupon = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        const { 
            code, 
            discountType, 
            discountValue, 
            minOrderAmount, 
            maxDiscount, 
            expiresAt, 
            usageLimit, 
            isActive,
            type,
            description,
            rewardProductId,
            rewardVariantId,
            specialPrice,
            userUsageLimit,
            cartRulesJson,
            scheduleRulesJson,
            allowedLocations,
            allowedPincodes,
            allowedPayment,
            userSegments
        } = req.body;

        const expiresDate = expiresAt ? new Date(expiresAt) : null;
        const validExpiresAt = (expiresDate instanceof Date && !isNaN(expiresDate.getTime())) ? expiresDate : null;

        const coupon = await prisma.coupon.update({
            where: { id: id as string },
            data: {
                code: code?.toUpperCase(),
                discountType,
                discountValue: discountValue !== undefined && discountValue !== null ? parseFloat(discountValue) : undefined,
                minOrderAmount: minOrderAmount !== undefined ? parseFloat(minOrderAmount) : undefined,
                maxDiscount: maxDiscount !== undefined ? (maxDiscount === "" || maxDiscount === 0 ? null : parseFloat(maxDiscount)) : undefined,
                expiresAt: validExpiresAt,
                usageLimit: usageLimit !== undefined ? (usageLimit === "" || usageLimit === 0 ? null : parseInt(usageLimit)) : undefined,
                isActive,
                type,
                description,
                rewardProductId: rewardProductId !== undefined ? rewardProductId : undefined,
                rewardVariantId: rewardVariantId !== undefined ? rewardVariantId : undefined,
                specialPrice: specialPrice !== undefined ? (specialPrice === "" || specialPrice === 0 ? null : parseFloat(specialPrice)) : undefined,
                userUsageLimit: userUsageLimit !== undefined ? parseInt(userUsageLimit) : undefined,
                cartRulesJson: cartRulesJson !== undefined ? cartRulesJson : undefined,
                scheduleRulesJson: scheduleRulesJson !== undefined ? scheduleRulesJson : undefined,
                allowedLocations: allowedLocations !== undefined ? allowedLocations : undefined,
                allowedPincodes: allowedPincodes !== undefined ? allowedPincodes : undefined,
                allowedPayment: allowedPayment !== undefined ? allowedPayment : undefined,
                userSegments: userSegments !== undefined ? userSegments : undefined
            },
        });

        res.json(coupon);
    } catch (error) {
        console.error("Critical Coupon Update Failure:", error);
        res.status(500).json({ message: "Error updating coupon" });
    }
};

export const deleteCoupon = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        await prisma.coupon.delete({ where: { id: id as string } });
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ message: "Error deleting coupon" });
    }
};
