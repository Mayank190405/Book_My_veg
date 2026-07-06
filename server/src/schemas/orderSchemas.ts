import { z } from "zod";

const itemSchema = z.object({
    productId: z.string().uuid(),
    quantity: z.number().int().positive(),
    price: z.number().positive(),
    variantId: z.string().uuid().optional().nullable(),
});

export const createOrderSchema = z.object({
    body: z.object({
        items: z.array(itemSchema).min(1, "Order must have at least one item"),
        totalAmount: z.number().positive(),
        paymentMethod: z.string().optional().nullable(),
        address: z.object({
            fullAddress: z.string().optional().nullable(),
            landmark: z.string().optional().nullable(),
            type: z.string().optional().nullable(),
            city: z.string().optional().nullable(),
            state: z.string().optional().nullable(),
            pincode: z.string().optional().nullable(),
            name: z.string().optional().nullable(),
            phone: z.string().optional().nullable(),
            locationId: z.string().uuid().optional().nullable(),
        }).optional(),
        deliverySlot: z.string().optional().nullable(),
        deliveryDate: z.string().optional().nullable(),
        couponCode: z.string().optional().nullable(),
        deliveryCharge: z.number().nonnegative().optional().nullable(),
        locationId: z.string().uuid().optional().nullable(),
        notes: z.string().optional().nullable(),
    }),
});
