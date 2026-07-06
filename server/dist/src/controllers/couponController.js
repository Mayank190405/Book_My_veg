"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteCoupon = exports.updateCoupon = exports.validateCoupon = exports.listCoupons = exports.createCoupon = exports.createCouponSchema = void 0;
const prisma_1 = __importDefault(require("../config/prisma"));
const zod_1 = require("zod");
const couponService_1 = require("../services/couponService");
// Schema for creating coupons (Admin)
exports.createCouponSchema = zod_1.z.object({
    body: zod_1.z.object({
        code: zod_1.z.string().min(1).toUpperCase(),
        // Case-insensitive enum mapping (maps "PERCENT" -> "PERCENTAGE" for frontend parity)
        discountType: zod_1.z.preprocess((val) => {
            const s = String(val || "FLAT").toUpperCase();
            return s === "PERCENT" ? "PERCENTAGE" : s;
        }, zod_1.z.enum(["FLAT", "PERCENTAGE"])),
        discountValue: zod_1.z.coerce.number().nonnegative().optional().nullable(),
        minOrderAmount: zod_1.z.preprocess((val) => (val === "" ? undefined : val), zod_1.z.coerce.number().nonnegative().optional()),
        maxDiscount: zod_1.z.preprocess((val) => (!val || val === "" || val === 0 || val === "0" ? undefined : val), zod_1.z.coerce.number().positive().optional()),
        expiresAt: zod_1.z.preprocess((val) => (val === "" ? undefined : val), zod_1.z.string().optional().nullable()),
        usageLimit: zod_1.z.preprocess((val) => (!val || val === "" || val === 0 || val === "0" ? undefined : val), zod_1.z.coerce.number().int().positive().optional().nullable()),
        type: zod_1.z.enum(["DISCOUNT", "ITEM_DISCOUNT", "SPECIAL_PRICE_ITEM", "FREE_GIFT", "CASHBACK"]).optional(),
        description: zod_1.z.string().optional(),
        rewardProductId: zod_1.z.string().optional().nullable(),
        rewardVariantId: zod_1.z.string().optional().nullable(),
        specialPrice: zod_1.z.coerce.number().optional().nullable(),
        userUsageLimit: zod_1.z.coerce.number().int().optional(),
        cartRulesJson: zod_1.z.any().optional().nullable(),
        scheduleRulesJson: zod_1.z.any().optional().nullable(),
        allowedLocations: zod_1.z.array(zod_1.z.string()).optional(),
        allowedPincodes: zod_1.z.array(zod_1.z.string()).optional(),
        allowedPayment: zod_1.z.array(zod_1.z.string()).optional(),
        userSegments: zod_1.z.array(zod_1.z.string()).optional(),
    }),
});
const createCoupon = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        console.log("DEBUG: Processing Coupon with data:", JSON.stringify(req.body, null, 2));
        const { code, discountType, discountValue, minOrderAmount, maxDiscount, expiresAt, usageLimit, type, description, rewardProductId, rewardVariantId, specialPrice, userUsageLimit, cartRulesJson, scheduleRulesJson, allowedLocations, allowedPincodes, allowedPayment, userSegments } = req.body;
        const existing = yield prisma_1.default.coupon.findUnique({ where: { code } });
        if (existing)
            return res.status(409).json({ message: "Coupon code already exists" });
        const expiresDate = expiresAt ? new Date(expiresAt) : null;
        const validExpiresAt = (expiresDate instanceof Date && !isNaN(expiresDate.getTime())) ? expiresDate : null;
        const coupon = yield prisma_1.default.coupon.create({
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
    }
    catch (error) {
        console.error("Critical Coupon Creation Failure:", error);
        res.status(500).json({ message: "Error creating coupon" });
    }
});
exports.createCoupon = createCoupon;
const listCoupons = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const coupons = yield prisma_1.default.coupon.findMany({
            orderBy: { createdAt: "desc" },
        });
        res.json(coupons);
    }
    catch (error) {
        console.error("DEBUG: Error fetching coupons:", error);
        res.status(500).json({ message: "Error fetching coupons" });
    }
});
exports.listCoupons = listCoupons;
const validateCoupon = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { code, orderAmount, paymentMethod, pincode } = req.body;
    const authReq = req;
    const userId = (_a = authReq.user) === null || _a === void 0 ? void 0 : _a.userId;
    if (!code)
        return res.status(400).json({ message: "Coupon code required" });
    try {
        const amount = Number(orderAmount || 0);
        // Fetch cart items from DB or body
        let cartItems = [];
        if (req.body.cartItems && Array.isArray(req.body.cartItems)) {
            cartItems = req.body.cartItems;
        }
        else if (userId) {
            const userCart = yield prisma_1.default.cart.findUnique({
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
        const result = yield couponService_1.couponService.validateCoupon(prisma_1.default, code, amount, userId, cartItems, paymentMethod, pincode);
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
    }
    catch (error) {
        console.error("DEBUG: Coupon validation error:", error.message);
        res.status(error.statusCode || 400).json({ message: error.message || "Error validating coupon" });
    }
});
exports.validateCoupon = validateCoupon;
const updateCoupon = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    try {
        const { code, discountType, discountValue, minOrderAmount, maxDiscount, expiresAt, usageLimit, isActive, type, description, rewardProductId, rewardVariantId, specialPrice, userUsageLimit, cartRulesJson, scheduleRulesJson, allowedLocations, allowedPincodes, allowedPayment, userSegments } = req.body;
        const expiresDate = expiresAt ? new Date(expiresAt) : null;
        const validExpiresAt = (expiresDate instanceof Date && !isNaN(expiresDate.getTime())) ? expiresDate : null;
        const coupon = yield prisma_1.default.coupon.update({
            where: { id: id },
            data: {
                code: code === null || code === void 0 ? void 0 : code.toUpperCase(),
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
    }
    catch (error) {
        console.error("Critical Coupon Update Failure:", error);
        res.status(500).json({ message: "Error updating coupon" });
    }
});
exports.updateCoupon = updateCoupon;
const deleteCoupon = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    try {
        yield prisma_1.default.coupon.delete({ where: { id: id } });
        res.status(204).send();
    }
    catch (error) {
        res.status(500).json({ message: "Error deleting coupon" });
    }
});
exports.deleteCoupon = deleteCoupon;
