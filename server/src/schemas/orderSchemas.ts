import { z } from "zod";

const itemSchema = z.object({
    productId: z.string().uuid(),
    quantity: z.number().int().positive(),
    price: z.number().positive(),
});

export const createOrderSchema = z.object({
    body: z.object({
        items: z.array(itemSchema).min(1, "Order must have at least one item"),
        totalAmount: z.number().positive(),
        paymentMethod: z.enum(["COD", "UPI", "CARD"]),
        address: z.object({
            fullAddress: z.string(),
            city: z.string().optional(), // Optional for now as legacy addresses might not have it
            state: z.string().optional(),
            pincode: z.string().regex(/^\d{6}$/, "Invalid pincode"),
            name: z.string().optional(),
            phone: z.string().optional(),
        }),
        deliverySlot: z.string().regex(/^\d{2}:\d{2}-\d{2}:\d{2}$/, "Invalid slot format (e.g. 09:00-11:00)").optional(),
        deliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)").optional(),
        couponCode: z.string().optional(),
    }),
});
