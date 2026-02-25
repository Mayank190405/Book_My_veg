import { z } from "zod";

export const createReviewSchema = z.object({
    body: z.object({
        productId: z.string().uuid(),
        rating: z.number().int().min(1).max(5),
        comment: z.string().min(3).max(500).optional(),
    }),
});
