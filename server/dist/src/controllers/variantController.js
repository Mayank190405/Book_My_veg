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
exports.deleteVariant = exports.toggleVariantStatus = exports.updateVariant = exports.createVariant = exports.getVariantById = exports.getVariants = void 0;
const prisma_1 = __importDefault(require("../config/prisma"));
const logger_1 = __importDefault(require("../utils/logger"));
const client_1 = require("@prisma/client");
// ─── GET /api/v1/variants ───────────────────────────────────────────────────
const getVariants = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { search, productId, isActive } = req.query;
        const whereClause = {};
        if (productId) {
            whereClause.productId = String(productId);
        }
        if (isActive !== undefined && isActive !== "") {
            whereClause.isActive = isActive === "true";
        }
        if (search) {
            const query = String(search).trim();
            whereClause.OR = [
                { name: { contains: query, mode: "insensitive" } },
                { product: { name: { contains: query, mode: "insensitive" } } },
            ];
        }
        const variants = yield prisma_1.default.productVariant.findMany({
            where: whereClause,
            include: {
                product: {
                    select: {
                        id: true,
                        name: true,
                        images: true,
                        sku: true,
                        basePrice: true,
                        category: {
                            select: { id: true, name: true }
                        }
                    }
                },
                inventory: {
                    select: {
                        locationId: true,
                        currentStock: true,
                        location: { select: { id: true, name: true } }
                    }
                },
                pricing: {
                    select: {
                        id: true,
                        channel: true,
                        price: true
                    }
                }
            },
            orderBy: { createdAt: "desc" }
        });
        // Compute total stock count for each variant across locations
        const formattedVariants = variants.map((variant) => {
            const totalStock = (variant.inventory || []).reduce((sum, inv) => sum + Number(inv.currentStock || 0), 0);
            return Object.assign(Object.assign({}, variant), { price: Number(variant.price), weight: variant.weight ? Number(variant.weight) : null, totalStock });
        });
        return res.json({
            success: true,
            count: formattedVariants.length,
            data: formattedVariants
        });
    }
    catch (error) {
        logger_1.default.error(`[VariantController] getVariants error: ${error.message}`);
        return res.status(500).json({ message: "Failed to fetch product variants" });
    }
});
exports.getVariants = getVariants;
// ─── GET /api/v1/variants/:id ───────────────────────────────────────────────
const getVariantById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const id = String(req.params.id);
        const variant = yield prisma_1.default.productVariant.findUnique({
            where: { id },
            include: {
                product: {
                    select: {
                        id: true,
                        name: true,
                        images: true,
                        sku: true,
                        basePrice: true,
                        category: { select: { id: true, name: true } }
                    }
                },
                inventory: {
                    include: { location: { select: { id: true, name: true } } }
                },
                pricing: true
            }
        });
        if (!variant) {
            return res.status(404).json({ message: "Product variant not found" });
        }
        return res.json({
            success: true,
            data: Object.assign(Object.assign({}, variant), { price: Number(variant.price), weight: variant.weight ? Number(variant.weight) : null })
        });
    }
    catch (error) {
        logger_1.default.error(`[VariantController] getVariantById error: ${error.message}`);
        return res.status(500).json({ message: "Failed to fetch variant details" });
    }
});
exports.getVariantById = getVariantById;
// ─── POST /api/v1/variants ──────────────────────────────────────────────────
const createVariant = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { productId, name, price, weight, weightUnit, isActive } = req.body;
        if (!productId || !name || price === undefined) {
            return res.status(400).json({ message: "productId, name, and price are required" });
        }
        const numericPrice = Number(price);
        if (isNaN(numericPrice) || numericPrice < 0) {
            return res.status(400).json({ message: "Invalid price value" });
        }
        // Verify product exists
        const productExists = yield prisma_1.default.product.findUnique({
            where: { id: productId },
            select: { id: true, name: true }
        });
        if (!productExists) {
            return res.status(404).json({ message: "Target product not found" });
        }
        const validWeightUnit = Object.values(client_1.WeightUnit).includes(weightUnit) ? weightUnit : client_1.WeightUnit.GM;
        const newVariant = yield prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            const variant = yield tx.productVariant.create({
                data: {
                    productId,
                    name: String(name).trim(),
                    price: numericPrice,
                    weight: weight !== undefined && weight !== null && weight !== "" ? Number(weight) : null,
                    weightUnit: validWeightUnit,
                    isActive: isActive !== undefined ? Boolean(isActive) : true,
                },
                include: {
                    product: {
                        select: { id: true, name: true, images: true, category: { select: { name: true } } }
                    }
                }
            });
            // Seed POS pricing record for this variant
            yield tx.pricing.create({
                data: {
                    productId,
                    variantId: variant.id,
                    channel: "POS",
                    price: numericPrice
                }
            });
            return variant;
        }));
        logger_1.default.info(`[VariantController] Variant created: ${newVariant.id} (${newVariant.name}) for product ${productId}`);
        return res.status(201).json({
            success: true,
            message: "Variant created successfully",
            data: Object.assign(Object.assign({}, newVariant), { price: Number(newVariant.price), weight: newVariant.weight ? Number(newVariant.weight) : null })
        });
    }
    catch (error) {
        logger_1.default.error(`[VariantController] createVariant error: ${error.message}`);
        return res.status(500).json({ message: error.message || "Failed to create variant" });
    }
});
exports.createVariant = createVariant;
// ─── PUT /api/v1/variants/:id ───────────────────────────────────────────────
const updateVariant = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const id = String(req.params.id);
        const { name, price, weight, weightUnit, isActive, productId } = req.body;
        const existing = yield prisma_1.default.productVariant.findUnique({
            where: { id }
        });
        if (!existing) {
            return res.status(404).json({ message: "Product variant not found" });
        }
        const updateData = {};
        if (name !== undefined)
            updateData.name = String(name).trim();
        if (price !== undefined) {
            const numPrice = Number(price);
            if (isNaN(numPrice) || numPrice < 0) {
                return res.status(400).json({ message: "Invalid price value" });
            }
            updateData.price = numPrice;
        }
        if (weight !== undefined) {
            updateData.weight = weight !== null && weight !== "" ? Number(weight) : null;
        }
        if (weightUnit !== undefined && Object.values(client_1.WeightUnit).includes(weightUnit)) {
            updateData.weightUnit = weightUnit;
        }
        if (isActive !== undefined) {
            updateData.isActive = Boolean(isActive);
        }
        if (productId !== undefined && productId !== existing.productId) {
            updateData.productId = productId;
        }
        const updatedVariant = yield prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            const variant = yield tx.productVariant.update({
                where: { id },
                data: updateData,
                include: {
                    product: {
                        select: { id: true, name: true, images: true, category: { select: { name: true } } }
                    }
                }
            });
            // Update POS pricing record if price was updated
            if (updateData.price !== undefined) {
                yield tx.pricing.upsert({
                    where: {
                        productId_variantId_channel: {
                            productId: variant.productId,
                            variantId: variant.id,
                            channel: "POS"
                        }
                    },
                    update: { price: updateData.price },
                    create: {
                        productId: variant.productId,
                        variantId: variant.id,
                        channel: "POS",
                        price: updateData.price
                    }
                });
            }
            return variant;
        }));
        logger_1.default.info(`[VariantController] Variant updated: ${updatedVariant.id}`);
        return res.json({
            success: true,
            message: "Variant updated successfully",
            data: Object.assign(Object.assign({}, updatedVariant), { price: Number(updatedVariant.price), weight: updatedVariant.weight ? Number(updatedVariant.weight) : null })
        });
    }
    catch (error) {
        logger_1.default.error(`[VariantController] updateVariant error: ${error.message}`);
        return res.status(500).json({ message: error.message || "Failed to update variant" });
    }
});
exports.updateVariant = updateVariant;
// ─── PATCH /api/v1/variants/:id/toggle ─────────────────────────────────────
const toggleVariantStatus = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const id = String(req.params.id);
        const existing = yield prisma_1.default.productVariant.findUnique({
            where: { id },
            select: { id: true, isActive: true, name: true }
        });
        if (!existing) {
            return res.status(404).json({ message: "Product variant not found" });
        }
        const updated = yield prisma_1.default.productVariant.update({
            where: { id },
            data: { isActive: !existing.isActive }
        });
        return res.json({
            success: true,
            message: `Variant ${updated.name} ${updated.isActive ? "activated" : "deactivated"}`,
            data: updated
        });
    }
    catch (error) {
        logger_1.default.error(`[VariantController] toggleVariantStatus error: ${error.message}`);
        return res.status(500).json({ message: "Failed to toggle variant status" });
    }
});
exports.toggleVariantStatus = toggleVariantStatus;
// ─── DELETE /api/v1/variants/:id ───────────────────────────────────────────
const deleteVariant = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const id = String(req.params.id);
        const existing = yield prisma_1.default.productVariant.findUnique({
            where: { id },
            include: {
                _count: {
                    select: { orderItems: true, cartItems: true }
                }
            }
        });
        if (!existing) {
            return res.status(404).json({ message: "Product variant not found" });
        }
        // Clean up related inventory, pricing, batches before deleting variant
        yield prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            yield tx.inventory.deleteMany({ where: { variantId: id } });
            yield tx.inventoryLog.deleteMany({ where: { variantId: id } });
            yield tx.pricing.deleteMany({ where: { variantId: id } });
            yield tx.batch.deleteMany({ where: { variantId: id } });
            yield tx.cartItem.deleteMany({ where: { variantId: id } });
            yield tx.productVariant.delete({ where: { id } });
        }));
        logger_1.default.info(`[VariantController] Variant deleted: ${id}`);
        return res.json({
            success: true,
            message: "Product variant deleted successfully"
        });
    }
    catch (error) {
        logger_1.default.error(`[VariantController] deleteVariant error: ${error.message}`);
        return res.status(500).json({ message: "Failed to delete product variant" });
    }
});
exports.deleteVariant = deleteVariant;
