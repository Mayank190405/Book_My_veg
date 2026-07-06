"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createReviewSchema = void 0;
const zod_1 = require("zod");
exports.createReviewSchema = zod_1.z.object({
    body: zod_1.z.object({
        productId: zod_1.z.string().uuid(),
        rating: zod_1.z.number().int().min(1).max(5),
        comment: zod_1.z.string().min(3).max(500).optional(),
    }),
});
