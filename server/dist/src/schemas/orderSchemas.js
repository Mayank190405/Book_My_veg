"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createOrderSchema = void 0;
const zod_1 = require("zod");
const itemSchema = zod_1.z.object({
    productId: zod_1.z.string().uuid(),
    quantity: zod_1.z.number().int().positive(),
    price: zod_1.z.number().positive(),
    variantId: zod_1.z.string().uuid().optional().nullable(),
});
exports.createOrderSchema = zod_1.z.object({
    body: zod_1.z.object({
        items: zod_1.z.array(itemSchema).min(1, "Order must have at least one item"),
        totalAmount: zod_1.z.number().positive(),
        paymentMethod: zod_1.z.string().optional().nullable(),
        address: zod_1.z.object({
            fullAddress: zod_1.z.string().optional().nullable(),
            landmark: zod_1.z.string().optional().nullable(),
            type: zod_1.z.string().optional().nullable(),
            city: zod_1.z.string().optional().nullable(),
            state: zod_1.z.string().optional().nullable(),
            pincode: zod_1.z.string().optional().nullable(),
            name: zod_1.z.string().optional().nullable(),
            phone: zod_1.z.string().optional().nullable(),
            locationId: zod_1.z.string().uuid().optional().nullable(),
        }).optional(),
        deliverySlot: zod_1.z.string().optional().nullable(),
        deliveryDate: zod_1.z.string().optional().nullable(),
        couponCode: zod_1.z.string().optional().nullable(),
        deliveryCharge: zod_1.z.number().nonnegative().optional().nullable(),
        locationId: zod_1.z.string().uuid().optional().nullable(),
        notes: zod_1.z.string().optional().nullable(),
    }),
});
