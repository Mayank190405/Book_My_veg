import { z } from "zod";

export const getProductsSchema = z.object({
    query: z.object({
        categoryId: z.preprocess((val) => (val === "" ? undefined : val), z.string().uuid("Invalid category identifier").optional()),
        search: z.string().optional(),
        cursor: z.preprocess((val) => (val === "" ? undefined : val), z.string().uuid("Invalid cursor position").optional()),
        limit: z.string().regex(/^\d+$/, "Limit must be a numeric value").optional(),
    }),
});

export const pincodeParamsSchema = z.object({
    params: z.object({
        pincode: z.string().regex(/^\d{6}$/, "Pincode must be exactly 6 digits"),
    }),
});

export const uuidParamsSchema = z.object({
    params: z.object({
        id: z.string().uuid("Invalid resource identifier"),
    }),
});
