import { z } from "zod";

const itemSchema = z.object({
    productId: z.string().min(1, "productId is required"),
    quantity: z.number().positive("quantity must be greater than 0"),
    price: z.number().nonnegative().optional().nullable(),
    variantId: z.string().optional().nullable(),
});

export const createOrderSchema = z.object({
    body: z.object({
        items: z.array(itemSchema).min(1, "Order must have at least one item"),
        totalAmount: z.number().nonnegative("totalAmount must be non-negative"),
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
            locationId: z.string().optional().nullable(),
        }).optional().nullable(),
        deliverySlot: z.string().optional().nullable(),
        deliveryDate: z.string().optional().nullable(),
        couponCode: z.string().optional().nullable(),
        deliveryCharge: z.number().nonnegative().optional().nullable(),
        locationId: z.string().optional().nullable(),
        notes: z.string().optional().nullable(),
    }),
});
