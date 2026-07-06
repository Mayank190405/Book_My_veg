"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uuidParamsSchema = exports.pincodeParamsSchema = exports.getProductsSchema = void 0;
const zod_1 = require("zod");
exports.getProductsSchema = zod_1.z.object({
    query: zod_1.z.object({
        categoryId: zod_1.z.preprocess((val) => (val === "" ? undefined : val), zod_1.z.string().uuid("Invalid category identifier").optional()),
        search: zod_1.z.string().optional(),
        cursor: zod_1.z.preprocess((val) => (val === "" ? undefined : val), zod_1.z.string().uuid("Invalid cursor position").optional()),
        limit: zod_1.z.string().regex(/^\d+$/, "Limit must be a numeric value").optional(),
    }),
});
exports.pincodeParamsSchema = zod_1.z.object({
    params: zod_1.z.object({
        pincode: zod_1.z.string().regex(/^\d{6}$/, "Pincode must be exactly 6 digits"),
    }),
});
exports.uuidParamsSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: zod_1.z.string().uuid("Invalid resource identifier"),
    }),
});
