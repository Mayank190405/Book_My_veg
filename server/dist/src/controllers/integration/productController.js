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
exports.updatePricing = exports.updateInventory = exports.updateProduct = exports.createProduct = exports.getProducts = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
const integrationThreatDetector_1 = require("../../middleware/integrationThreatDetector");
const getProducts = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const integration = req.integration;
    const { limit = 20, cursor, search } = req.query;
    const parsedLimit = Math.min(Number(limit) || 20, 100);
    const where = { isActive: true };
    if (search) {
        where.OR = [
            { name: { contains: search, mode: "insensitive" } },
            { sku: { contains: search, mode: "insensitive" } },
            { barcode: { contains: search, mode: "insensitive" } }
        ];
    }
    try {
        const products = yield prisma_1.default.product.findMany({
            where,
            take: parsedLimit + 1,
            cursor: cursor ? { id: cursor } : undefined,
            skip: cursor ? 1 : 0,
            include: {
                variants: {
                    where: { isActive: true },
                    include: {
                        inventory: integration.role === "STORE_ADMIN"
                            ? { where: { locationId: integration.locationId } }
                            : true,
                        pricing: { where: { isActive: true } }
                    }
                },
                inventory: integration.role === "STORE_ADMIN"
                    ? { where: { locationId: integration.locationId } }
                    : true,
                pricing: { where: { isActive: true } },
                category: { select: { id: true, name: true, slug: true } }
            },
            orderBy: { createdAt: "desc" }
        });
        const hasMore = products.length > parsedLimit;
        const data = hasMore ? products.slice(0, parsedLimit) : products;
        const nextCursor = hasMore ? data[data.length - 1].id : null;
        // Log record consumption volume
        yield (0, integrationThreatDetector_1.logDataHarvest)(req, data.length);
        res.json({ data, nextCursor });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.getProducts = getProducts;
const createProduct = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const integration = req.integration;
    // Enforce Admin Key Only for catalog modifications
    if (integration.role !== "ADMIN") {
        return res.status(403).json({ message: "Forbidden. Admin API Key required to create products." });
    }
    const { name, slug, description, categoryId, basePrice, sku, barcode, taxSlab, gstRate, hsnCode } = req.body;
    if (!name || !slug || !categoryId) {
        return res.status(400).json({ message: "Name, slug, and categoryId are required." });
    }
    try {
        const product = yield prisma_1.default.product.create({
            data: {
                name,
                slug,
                description,
                categoryId,
                basePrice: basePrice ? parseFloat(basePrice) : null,
                sku,
                barcode,
                taxSlab: taxSlab ? parseFloat(taxSlab) : 0,
                gstRate: gstRate ? parseFloat(gstRate) : 0,
                hsnCode,
                isActive: true
            }
        });
        res.status(201).json(product);
    }
    catch (error) {
        if (error.code === 'P2002') {
            return res.status(409).json({ message: "Slug, SKU, or Barcode already exists." });
        }
        res.status(500).json({ error: error.message });
    }
});
exports.createProduct = createProduct;
const updateProduct = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const integration = req.integration;
    // Enforce Admin Key Only for catalog modifications
    if (integration.role !== "ADMIN") {
        return res.status(403).json({ message: "Forbidden. Admin API Key required to update products." });
    }
    const { id } = req.params;
    const { name, description, categoryId, basePrice, sku, barcode, taxSlab, gstRate, hsnCode, isActive } = req.body;
    try {
        const product = yield prisma_1.default.product.update({
            where: { id },
            data: {
                name,
                description,
                categoryId,
                basePrice: basePrice !== undefined ? (basePrice ? parseFloat(basePrice) : null) : undefined,
                sku,
                barcode,
                taxSlab: taxSlab !== undefined ? parseFloat(taxSlab) : undefined,
                gstRate: gstRate !== undefined ? parseFloat(gstRate) : undefined,
                hsnCode,
                isActive
            }
        });
        res.json(product);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.updateProduct = updateProduct;
const updateInventory = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const integration = req.integration;
    const { productId, variantId, locationId, currentStock, thresholdStock } = req.body;
    if (!productId || currentStock === undefined) {
        return res.status(400).json({ message: "productId and currentStock are required." });
    }
    // Align location for store-level API keys
    let targetLocationId = locationId;
    if (integration.role === "STORE_ADMIN") {
        if (locationId && locationId !== integration.locationId) {
            yield (0, integrationThreatDetector_1.logAuthorizationFailure)(req);
            return res.status(403).json({ message: "Forbidden. Store admins can only manage local store inventory." });
        }
        targetLocationId = integration.locationId;
    }
    if (!targetLocationId) {
        return res.status(400).json({ message: "LocationId is required." });
    }
    try {
        // Atomic inventory adjustment via upsert
        const stock = parseFloat(currentStock);
        const threshold = thresholdStock !== undefined ? parseFloat(thresholdStock) : 5;
        const inventory = yield prisma_1.default.inventory.upsert({
            where: {
                productId_locationId_variantId: {
                    productId,
                    locationId: targetLocationId,
                    variantId: variantId || null
                }
            },
            update: {
                currentStock: stock,
                thresholdStock: threshold,
                lastRestocked: new Date(),
                isLowStock: stock <= threshold
            },
            create: {
                productId,
                locationId: targetLocationId,
                variantId: variantId || null,
                currentStock: stock,
                thresholdStock: threshold,
                lastRestocked: new Date(),
                isLowStock: stock <= threshold
            }
        });
        // Create log record
        yield prisma_1.default.inventoryLog.create({
            data: {
                productId,
                variantId: variantId || null,
                locationId: targetLocationId,
                type: "ADJUSTMENT",
                beforeQty: 0, // Placeholder
                afterQty: stock,
                delta: stock,
                staffId: `API_KEY_${integration.id}`
            }
        });
        res.json(inventory);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.updateInventory = updateInventory;
const updatePricing = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const integration = req.integration;
    // Enforce Admin Key Only for pricing modifications
    if (integration.role !== "ADMIN") {
        return res.status(403).json({ message: "Forbidden. Admin API Key required to update pricing." });
    }
    const { productId, variantId, channel, price, discountType, discountValue, startDate, endDate } = req.body;
    if (!productId || price === undefined) {
        return res.status(400).json({ message: "productId and price are required." });
    }
    try {
        // Create or update pricing record
        const pricing = yield prisma_1.default.pricing.create({
            data: {
                productId,
                variantId: variantId || null,
                channel: channel || "WEB",
                price: parseFloat(price),
                discountType,
                discountValue: discountValue ? parseFloat(discountValue) : null,
                startDate: startDate ? new Date(startDate) : null,
                endDate: endDate ? new Date(endDate) : null,
                isActive: true
            }
        });
        res.status(201).json(pricing);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.updatePricing = updatePricing;
