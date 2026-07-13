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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadProductImage = exports.bulkImportProducts = exports.getProductsAdmin = exports.trackTrendingOnOrder = exports.toggleProductStatus = exports.getBuyAgain = exports.checkServiceability = exports.getSimilarProducts = exports.getFlashDeals = exports.getTrendingProducts = exports.deleteProduct = exports.updateProduct = exports.createProduct = exports.getProductById = exports.getProducts = void 0;
const prisma_1 = __importDefault(require("../config/prisma"));
const client_1 = require("@prisma/client");
const redis_1 = __importDefault(require("../config/redis"));
const cacheUtils_1 = require("../utils/cacheUtils");
const searchService_1 = require("../services/searchService");
const csv_parser_1 = __importDefault(require("csv-parser"));
const fs_1 = __importDefault(require("fs"));
const CACHE_TTL = 300; // 5 minutes
const TRENDING_TTL = 7200; // 2 hours
// ─── helpers ────────────────────────────────────────────────────────────────
function normalizeWeightUnit(unit) {
    if (!unit)
        return "GM";
    const u = unit.trim().toUpperCase();
    const result = u === "G" || u === "GM" || u === "GRAM" || u === "GRAMS" ? "GM" :
        u === "KG" || u === "KILOGRAM" || u === "KILOGRAMS" ? "KG" :
            u === "ML" || u === "MILLILITER" ? "ML" :
                u === "LTR" || u === "LITER" || u === "LITRE" ? "LTR" :
                    u === "PKT" || u === "PACKET" || u === "PACKETS" || u === "PKTS" ? "PACKET" :
                        u === "PIECE" || u === "PCS" || u === "PC" || u === "PIECES" ? "PIECE" : "GM";
    if (unit && result === "GM" && u !== "GM" && u !== "GRAM") {
        console.log(`[Normalization] Unit "${unit}" fell back to GM`);
    }
    return result;
}
// ─── Product Controller Logic ───────────────────────────────────────────────
const getProducts = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { categoryId, search, cursor, limit = "20", locationId } = req.query;
        const pageLimit = parseInt(limit);
        const locId = locationId;
        const cacheKey = `products:${locId || 'global'}:${categoryId || 'all'}:${search || 'none'}:${cursor || 'start'}:${limit}`;
        const cachedData = yield redis_1.default.get(cacheKey);
        if (cachedData)
            return res.json(JSON.parse(cachedData));
        // Scope inventory to a specific store when locationId provided
        const inventoryFilter = locId ? { where: { locationId: locId } } : true;
        const where = { isActive: true };
        if (categoryId)
            where.categoryId = categoryId;
        let products = [];
        let nextCursor = null;
        if (search) {
            const searchResults = yield searchService_1.SearchService.getInstance().search(search, {
                limit: pageLimit,
                isActive: true
            });
            const productIds = searchResults.hits.map((h) => h.id);
            // Re-fetch full details from Prisma for the search results
            products = yield prisma_1.default.product.findMany({
                where: { id: { in: productIds } },
                include: {
                    category: { select: { name: true, slug: true } },
                    variants: {
                        include: {
                            pricing: { where: { isActive: true } },
                            inventory: inventoryFilter
                        }
                    },
                    pricing: { where: { isActive: true } },
                    inventory: inventoryFilter
                }
            });
            // Maintain search relevance order
            products.sort((a, b) => productIds.indexOf(a.id) - productIds.indexOf(b.id));
        }
        else {
            products = yield prisma_1.default.product.findMany({
                where,
                take: pageLimit + 1,
                cursor: cursor ? { id: cursor } : undefined,
                orderBy: { createdAt: 'desc' },
                include: {
                    category: { select: { name: true, slug: true } },
                    variants: {
                        include: {
                            pricing: { where: { isActive: true } },
                            inventory: inventoryFilter
                        }
                    },
                    pricing: { where: { isActive: true } },
                    inventory: inventoryFilter
                }
            });
            if (products.length > pageLimit) {
                const nextItem = products.pop();
                nextCursor = nextItem.id;
            }
        }
        const response = { data: products, nextCursor };
        yield redis_1.default.setEx(cacheKey, CACHE_TTL, JSON.stringify(response));
        res.json(response);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error fetching products" });
    }
});
exports.getProducts = getProducts;
const getProductById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    try {
        const product = yield prisma_1.default.product.findUnique({
            where: { id: id },
            include: {
                category: true,
                variants: {
                    include: {
                        pricing: { where: { isActive: true } },
                        inventory: true
                    }
                },
                pricing: { where: { isActive: true } },
                inventory: true
            }
        });
        if (!product)
            return res.status(404).json({ message: "Product not found" });
        res.json(product);
    }
    catch (error) {
        res.status(500).json({ message: "Error fetching product" });
    }
});
exports.getProductById = getProductById;
const createProduct = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const _a = req.body, { variants, categoryId, basePrice } = _a, productInfo = __rest(_a, ["variants", "categoryId", "basePrice"]);
        const primaryLocation = yield prisma_1.default.location.findFirst();
        const productData = Object.assign({}, productInfo);
        if (productData.weightUnit) {
            productData.weightUnit = normalizeWeightUnit(productData.weightUnit);
        }
        // Resilient Category Resolution: Ensure a valid categoryId exists
        let finalCategoryId = categoryId;
        if (!finalCategoryId) {
            const uncategorized = yield prisma_1.default.category.upsert({
                where: { slug: "uncategorized" },
                update: {},
                create: {
                    name: "Uncategorized",
                    slug: "uncategorized",
                    isActive: true
                }
            });
            finalCategoryId = uncategorized.id;
        }
        const product = yield prisma_1.default.product.create({
            data: Object.assign(Object.assign({}, productData), { basePrice: basePrice !== undefined && basePrice !== null
                    ? new client_1.Prisma.Decimal(basePrice)
                    : undefined, category: { connect: { id: finalCategoryId } }, variants: variants ? {
                    create: variants.map((v) => ({
                        name: v.name,
                        price: parseFloat(v.price),
                        weight: parseFloat(v.weight),
                        weightUnit: normalizeWeightUnit(v.weightUnit),
                        isActive: true
                    }))
                } : undefined }),
            include: { variants: true, category: { select: { name: true } } }
        });
        // Background Indexing
        searchService_1.SearchService.getInstance().indexProduct(product).catch(e => console.error('ES Sync Error:', e));
        // Atomic inventory and pricing seeding for variants if requested
        if (variants && variants.length > 0) {
            const variantPromises = product.variants.map((v, idx) => __awaiter(void 0, void 0, void 0, function* () {
                var _a;
                const originalVariant = variants[idx];
                const qty = parseInt(originalVariant.quantity) || 0;
                // 1. Create default POS pricing for this variant
                yield prisma_1.default.pricing.create({
                    data: {
                        productId: product.id,
                        variantId: v.id,
                        channel: 'POS',
                        price: new client_1.Prisma.Decimal((_a = originalVariant === null || originalVariant === void 0 ? void 0 : originalVariant.price) !== null && _a !== void 0 ? _a : 0),
                        isActive: true
                    }
                });
                // 2. Handle inventory if primaryLocation is set
                if (primaryLocation && qty > 0) {
                    yield prisma_1.default.inventory.create({
                        data: {
                            product: { connect: { id: product.id } },
                            variant: { connect: { id: v.id } },
                            location: { connect: { id: primaryLocation.id } },
                            currentStock: qty,
                            thresholdStock: parseInt(originalVariant.threshold) || 5
                        }
                    });
                    yield prisma_1.default.batch.create({
                        data: {
                            batchNumber: `INIT-${Date.now()}-${idx}`,
                            product: { connect: { id: product.id } },
                            variant: { connect: { id: v.id } },
                            location: { connect: { id: primaryLocation.id } },
                            initialQty: qty,
                            remainingQty: qty,
                            costPrice: new client_1.Prisma.Decimal(originalVariant.price || 0).mul(0.7),
                            receivedDate: new Date()
                        }
                    });
                }
            }));
            yield Promise.all(variantPromises);
        }
        if ((!variants || variants.length === 0) && primaryLocation && req.body.quantity) {
            const qty = parseInt(req.body.quantity) || 0;
            if (qty > 0) {
                yield prisma_1.default.inventory.create({
                    data: {
                        product: { connect: { id: product.id } },
                        location: { connect: { id: primaryLocation.id } },
                        currentStock: qty,
                        thresholdStock: parseInt(req.body.threshold) || 5
                    }
                });
                yield prisma_1.default.batch.create({
                    data: {
                        batchNumber: `INIT-${Date.now()}`,
                        product: { connect: { id: product.id } },
                        location: { connect: { id: primaryLocation.id } },
                        initialQty: qty,
                        remainingQty: qty,
                        costPrice: new client_1.Prisma.Decimal(basePrice || 0).mul(0.7),
                        receivedDate: new Date()
                    }
                });
                // Create Base Pricing for Channel.POS if no variants
                yield prisma_1.default.pricing.create({
                    data: {
                        productId: product.id,
                        channel: 'POS',
                        price: new client_1.Prisma.Decimal(basePrice || 0),
                        isActive: true
                    }
                });
            }
        }
        yield (0, cacheUtils_1.invalidateProductCache)();
        res.status(201).json(product);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error creating product" });
    }
});
exports.createProduct = createProduct;
const updateProduct = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    try {
        const _a = req.body, { variants, id: _id, createdAt, updatedAt, category, inventory, pricing } = _a, productInfo = __rest(_a, ["variants", "id", "createdAt", "updatedAt", "category", "inventory", "pricing"]);
        if (productInfo.weightUnit) {
            productInfo.weightUnit = normalizeWeightUnit(productInfo.weightUnit);
        }
        const product = yield prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            const p = yield tx.product.update({
                where: { id: id },
                data: Object.assign(Object.assign({}, productInfo), { variants: variants ? {
                        deleteMany: {},
                        create: variants.map((v) => ({
                            name: v.name,
                            price: parseFloat(v.price),
                            weight: parseFloat(v.weight),
                            weightUnit: normalizeWeightUnit(v.weightUnit),
                            isActive: true
                        }))
                    } : undefined }),
                include: { variants: true }
            });
            // Sync POS Pricing for all variants
            if (p.variants && p.variants.length > 0) {
                for (const [idx, v] of p.variants.entries()) {
                    const originalVariant = variants ? variants[idx] : null;
                    const priceVal = originalVariant ? originalVariant.price : v.price;
                    const existingPricing = yield tx.pricing.findFirst({
                        where: { variantId: v.id, channel: 'POS' }
                    });
                    if (existingPricing) {
                        yield tx.pricing.update({
                            where: { id: existingPricing.id },
                            data: { price: new client_1.Prisma.Decimal(priceVal || 0) }
                        });
                    }
                    else {
                        yield tx.pricing.create({
                            data: {
                                productId: p.id,
                                variantId: v.id,
                                channel: 'POS',
                                price: new client_1.Prisma.Decimal(priceVal || 0),
                                isActive: true
                            }
                        });
                    }
                }
            }
            else {
                // Base product pricing sync if no variants
                const existingPricing = yield tx.pricing.findFirst({
                    where: { productId: p.id, variantId: null, channel: 'POS' }
                });
                const priceVal = productInfo.basePrice || p.basePrice;
                if (existingPricing) {
                    yield tx.pricing.update({
                        where: { id: existingPricing.id },
                        data: { price: new client_1.Prisma.Decimal(priceVal || 0) }
                    });
                }
                else {
                    yield tx.pricing.create({
                        data: {
                            productId: p.id,
                            channel: 'POS',
                            price: new client_1.Prisma.Decimal(priceVal || 0),
                            isActive: true
                        }
                    });
                }
            }
            return p;
        }));
        const fullProduct = yield prisma_1.default.product.findUnique({
            where: { id: id },
            include: { category: { select: { name: true } }, inventory: { select: { locationId: true } } }
        });
        searchService_1.SearchService.getInstance().indexProduct(fullProduct).catch(e => console.error('ES Sync Error:', e));
        yield (0, cacheUtils_1.invalidateProductCache)(id);
        res.json(product);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error updating product" });
    }
});
exports.updateProduct = updateProduct;
const deleteProduct = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    try {
        yield prisma_1.default.$transaction([
            prisma_1.default.orderItem.deleteMany({ where: { productId: id } }),
            prisma_1.default.inventoryLog.deleteMany({ where: { productId: id } }),
            prisma_1.default.batch.deleteMany({ where: { productId: id } }),
            prisma_1.default.inventory.deleteMany({ where: { productId: id } }),
            prisma_1.default.pricing.deleteMany({ where: { productId: id } }),
            prisma_1.default.cartItem.deleteMany({ where: { productId: id } }),
            prisma_1.default.productVariant.deleteMany({ where: { productId: id } }),
            prisma_1.default.product.delete({ where: { id: id } }),
        ]);
        searchService_1.SearchService.getInstance().deleteProduct(id).catch(e => console.error('ES Sync Error:', e));
        yield (0, cacheUtils_1.invalidateProductCache)();
        res.json({ message: "Product and dependencies purged successfully" });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error deleting product" });
    }
});
exports.deleteProduct = deleteProduct;
function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}
const getTrendingProducts = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { lat, lng, pincode, page = "1", limit = "10" } = req.query;
        const pageNum = parseInt(page) || 1;
        const limitNum = parseInt(limit) || 10;
        const skip = (pageNum - 1) * limitNum;
        const userLat = lat ? parseFloat(lat) : null;
        const userLng = lng ? parseFloat(lng) : null;
        // If coordinates are provided, perform proximity sorting
        if (userLat !== null && !isNaN(userLat) && userLng !== null && !isNaN(userLng)) {
            // 1. Fetch active locations
            const locations = yield prisma_1.default.location.findMany();
            // Calculate distance to each location
            const locationsWithDistance = locations.map(loc => {
                const locLat = loc.latitude !== null ? Number(loc.latitude) : null;
                const locLng = loc.longitude !== null ? Number(loc.longitude) : null;
                let distance = Infinity;
                if (locLat !== null && locLng !== null) {
                    distance = getDistance(userLat, userLng, locLat, locLng);
                }
                return Object.assign(Object.assign({}, loc), { distance });
            });
            // Sort locations by distance
            locationsWithDistance.sort((a, b) => a.distance - b.distance);
            // Create a map of locationId -> distance
            const distanceMap = new Map();
            locationsWithDistance.forEach(loc => {
                distanceMap.set(loc.id, loc.distance);
            });
            // 2. Fetch active products with inventory and pricing details
            const products = yield prisma_1.default.product.findMany({
                where: { isActive: true },
                include: {
                    category: { select: { name: true } },
                    variants: {
                        include: {
                            pricing: { where: { isActive: true } },
                            inventory: true
                        }
                    },
                    pricing: { where: { isActive: true } },
                    inventory: true
                }
            });
            // 3. For each product, find the minimum distance to a location where it is in stock.
            const productsWithDistance = products.map(product => {
                let minDistance = Infinity;
                // Check base product inventory
                if (product.inventory && product.inventory.length > 0) {
                    product.inventory.forEach(inv => {
                        if (Number(inv.currentStock) > 0) {
                            const dist = distanceMap.get(inv.locationId);
                            if (dist !== undefined && dist < minDistance) {
                                minDistance = dist;
                            }
                        }
                    });
                }
                // Check variant inventories
                if (product.variants && product.variants.length > 0) {
                    product.variants.forEach(variant => {
                        if (variant.inventory && variant.inventory.length > 0) {
                            variant.inventory.forEach(inv => {
                                if (Number(inv.currentStock) > 0) {
                                    const dist = distanceMap.get(inv.locationId);
                                    if (dist !== undefined && dist < minDistance) {
                                        minDistance = dist;
                                    }
                                }
                            });
                        }
                    });
                }
                return Object.assign(Object.assign({}, product), { minDistance });
            });
            // 4. Sort products:
            // - In stock at closer locations first.
            // - Products with minDistance = Infinity (out of stock everywhere) go to the end.
            // - Secondary sorting by createdAt desc.
            productsWithDistance.sort((a, b) => {
                if (a.minDistance !== b.minDistance) {
                    return a.minDistance - b.minDistance;
                }
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            });
            // 5. Apply pagination
            const paginated = productsWithDistance.slice(skip, skip + limitNum);
            // Remove the minDistance temporary field before responding
            const cleaned = paginated.map((_a) => {
                var { minDistance } = _a, rest = __rest(_a, ["minDistance"]);
                return rest;
            });
            return res.json(cleaned);
        }
        // Default logic: Fetch with standard caching
        const cacheKey = `products:trending:${pageNum}:${limitNum}`;
        const cachedData = yield redis_1.default.get(cacheKey);
        if (cachedData)
            return res.json(JSON.parse(cachedData));
        const products = yield prisma_1.default.product.findMany({
            where: { isActive: true },
            skip,
            take: limitNum,
            orderBy: { createdAt: 'desc' },
            include: {
                category: { select: { name: true } },
                variants: {
                    include: {
                        pricing: { where: { isActive: true } },
                        inventory: true
                    }
                },
                pricing: { where: { isActive: true } },
                inventory: true
            }
        });
        yield redis_1.default.setEx(cacheKey, TRENDING_TTL, JSON.stringify(products));
        res.json(products);
    }
    catch (error) {
        console.error("Error fetching trending products:", error);
        res.status(500).json({ message: "Error fetching trending merchandise" });
    }
});
exports.getTrendingProducts = getTrendingProducts;
// ─── Restored Missing Functions ───────────────────────────────────────────
const getFlashDeals = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const products = yield prisma_1.default.product.findMany({
            where: { isActive: true },
            take: 10,
            include: {
                variants: {
                    include: {
                        pricing: { where: { isActive: true } },
                        inventory: true
                    }
                },
                pricing: { where: { isActive: true } },
                inventory: true
            }
        });
        res.json(products);
    }
    catch (error) {
        res.status(500).json({ message: "Error fetching flash deals" });
    }
});
exports.getFlashDeals = getFlashDeals;
const getSimilarProducts = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    try {
        const product = yield prisma_1.default.product.findUnique({ where: { id: id } });
        if (!product)
            return res.status(404).json({ message: "Product not found" });
        const products = yield prisma_1.default.product.findMany({
            where: { categoryId: product.categoryId, id: { not: product.id }, isActive: true },
            take: 6,
            include: {
                variants: {
                    include: {
                        pricing: { where: { isActive: true } },
                        inventory: true
                    }
                },
                pricing: { where: { isActive: true } },
                inventory: true
            }
        });
        res.json(products);
    }
    catch (error) {
        res.status(500).json({ message: "Error fetching similar products" });
    }
});
exports.getSimilarProducts = getSimilarProducts;
const checkServiceability = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { pincode } = req.params;
    res.json({ serviceable: true, message: "Serviceable at " + pincode });
});
exports.checkServiceability = checkServiceability;
const getBuyAgain = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
    try {
        const orders = yield prisma_1.default.order.findMany({
            where: { userId },
            take: 5,
            orderBy: { createdAt: 'desc' },
            include: { items: { include: { product: { include: { variants: true, pricing: true } } } } }
        });
        const products = Array.from(new Set(orders.flatMap(o => o.items.map(i => i.product))));
        res.json(products);
    }
    catch (error) {
        res.status(500).json({ message: "Error fetching buy again products" });
    }
});
exports.getBuyAgain = getBuyAgain;
const toggleProductStatus = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    try {
        const product = yield prisma_1.default.product.findUnique({ where: { id: id } });
        if (!product)
            return res.status(404).json({ message: "Product not found" });
        const updated = yield prisma_1.default.product.update({
            where: { id: id },
            data: { isActive: !product.isActive },
            include: { category: { select: { name: true } }, inventory: { select: { locationId: true } } }
        });
        searchService_1.SearchService.getInstance().indexProduct(updated).catch(e => console.error('ES Sync Error:', e));
        yield (0, cacheUtils_1.invalidateProductCache)();
        res.json(updated);
    }
    catch (error) {
        res.status(500).json({ message: "Error toggling product status" });
    }
});
exports.toggleProductStatus = toggleProductStatus;
const trackTrendingOnOrder = (items, locationId) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        for (const item of items) {
            const key = `trending:${locationId}:${item.productId}`;
            yield redis_1.default.incrBy(key, Number(item.quantity) || 1);
            yield redis_1.default.expire(key, TRENDING_TTL);
        }
    }
    catch (error) {
        console.error("Trending Error:", error);
    }
});
exports.trackTrendingOnOrder = trackTrendingOnOrder;
const getProductsAdmin = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { categoryId, search } = req.query;
        const where = {};
        if (categoryId)
            where.categoryId = categoryId;
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { sku: { contains: search, mode: 'insensitive' } },
                { barcode: { contains: search, mode: 'insensitive' } }
            ];
        }
        // Admin view returns ALL products (active/inactive) without aggressive pagination caps
        // to facilitate comprehensive catalog management.
        const products = yield prisma_1.default.product.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: {
                category: { select: { name: true, slug: true } },
                variants: {
                    include: {
                        pricing: true,
                        inventory: true
                    }
                },
                pricing: true,
                inventory: true
            }
        });
        res.json(products);
    }
    catch (error) {
        console.error("Admin catalog fetch failure:", error);
        res.status(500).json({ error: error.message });
    }
});
exports.getProductsAdmin = getProductsAdmin;
const bulkImportProducts = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, e_1, _b, _c;
    if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
    }
    const filePath = req.file.path;
    const categoryCache = new Map();
    let successCount = 0;
    let failureCount = 0;
    let batchProducts = new Map();
    const BATCH_SIZE = 50;
    const sanitizeString = (val) => {
        if (val === undefined || val === null)
            return "";
        const clean = String(val).trim();
        // Prevent CSV Formula Injection
        if (clean.startsWith("=") || clean.startsWith("+") || clean.startsWith("-") || clean.startsWith("@")) {
            return `'${clean}`;
        }
        return clean;
    };
    const processBatch = () => __awaiter(void 0, void 0, void 0, function* () {
        if (batchProducts.size === 0)
            return;
        const productNames = Array.from(batchProducts.keys());
        // Preload existing products
        const existingProducts = yield prisma_1.default.product.findMany({
            where: {
                name: { in: productNames, mode: 'insensitive' }
            },
            include: {
                variants: true
            }
        });
        const existingProductMap = new Map();
        existingProducts.forEach(p => existingProductMap.set(p.name.toLowerCase(), p));
        yield prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            for (const [productName, productData] of batchProducts) {
                try {
                    // Resolve Category
                    const categoryName = productData.categoryName;
                    let categoryId = categoryCache.get(categoryName.toLowerCase());
                    if (!categoryId) {
                        let cat = yield tx.category.findFirst({
                            where: { name: { equals: categoryName, mode: 'insensitive' } }
                        });
                        if (!cat) {
                            cat = yield tx.category.create({
                                data: {
                                    name: categoryName,
                                    slug: categoryName.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + Math.random().toString(36).slice(-4),
                                    isActive: true
                                }
                            });
                        }
                        categoryId = cat.id;
                        categoryCache.set(categoryName.toLowerCase(), categoryId);
                    }
                    const existing = existingProductMap.get(productName.toLowerCase());
                    const primaryLocation = yield tx.location.findFirst();
                    if (existing) {
                        // Update product
                        const updatedProduct = yield tx.product.update({
                            where: { id: existing.id },
                            data: {
                                sku: productData.sku,
                                description: productData.description,
                                categoryId: categoryId,
                                images: productData.images,
                                variants: {
                                    deleteMany: {},
                                    create: productData.variants.map((v) => ({
                                        name: v.name,
                                        price: new client_1.Prisma.Decimal(v.price),
                                        weight: v.weight !== null ? new client_1.Prisma.Decimal(v.weight) : null,
                                        weightUnit: normalizeWeightUnit(v.weightUnit),
                                        isActive: true
                                    }))
                                }
                            },
                            include: { variants: true }
                        });
                        // Sync POS Pricing for all variants
                        if (updatedProduct.variants && updatedProduct.variants.length > 0) {
                            for (const [idx, v] of updatedProduct.variants.entries()) {
                                const originalVariant = productData.variants[idx];
                                const priceVal = originalVariant ? originalVariant.price : v.price;
                                const existingPricing = yield tx.pricing.findFirst({
                                    where: { variantId: v.id, channel: 'POS' }
                                });
                                if (existingPricing) {
                                    yield tx.pricing.update({
                                        where: { id: existingPricing.id },
                                        data: { price: new client_1.Prisma.Decimal(priceVal) }
                                    });
                                }
                                else {
                                    yield tx.pricing.create({
                                        data: {
                                            productId: updatedProduct.id,
                                            variantId: v.id,
                                            channel: 'POS',
                                            price: new client_1.Prisma.Decimal(priceVal),
                                            isActive: true
                                        }
                                    });
                                }
                            }
                        }
                        searchService_1.SearchService.getInstance().indexProduct(updatedProduct).catch(e => console.error('ES Sync Error:', e));
                    }
                    else {
                        // Create product
                        const newProduct = yield tx.product.create({
                            data: {
                                name: productData.name,
                                slug: productName.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + Math.random().toString(36).slice(-4),
                                sku: productData.sku,
                                description: productData.description,
                                categoryId: categoryId,
                                images: productData.images,
                                variants: {
                                    create: productData.variants.map((v) => ({
                                        name: v.name,
                                        price: new client_1.Prisma.Decimal(v.price),
                                        weight: v.weight !== null ? new client_1.Prisma.Decimal(v.weight) : null,
                                        weightUnit: normalizeWeightUnit(v.weightUnit),
                                        isActive: true
                                    }))
                                }
                            },
                            include: { variants: true }
                        });
                        // Handle Pricing and Inventory for new variants
                        if (newProduct.variants && newProduct.variants.length > 0) {
                            for (const [idx, v] of newProduct.variants.entries()) {
                                const originalVariant = productData.variants[idx];
                                const qty = originalVariant.quantity || 0;
                                yield tx.pricing.create({
                                    data: {
                                        productId: newProduct.id,
                                        variantId: v.id,
                                        channel: 'POS',
                                        price: new client_1.Prisma.Decimal(originalVariant.price),
                                        isActive: true
                                    }
                                });
                                if (primaryLocation && qty > 0) {
                                    yield tx.inventory.create({
                                        data: {
                                            productId: newProduct.id,
                                            variantId: v.id,
                                            locationId: primaryLocation.id,
                                            currentStock: qty,
                                            thresholdStock: originalVariant.threshold || 5
                                        }
                                    });
                                    yield tx.batch.create({
                                        data: {
                                            batchNumber: `INIT-${Date.now()}-${idx}`,
                                            productId: newProduct.id,
                                            variantId: v.id,
                                            locationId: primaryLocation.id,
                                            initialQty: qty,
                                            remainingQty: qty,
                                            costPrice: new client_1.Prisma.Decimal(originalVariant.price).mul(0.7),
                                            receivedDate: new Date()
                                        }
                                    });
                                }
                            }
                        }
                        searchService_1.SearchService.getInstance().indexProduct(newProduct).catch(e => console.error('ES Sync Error:', e));
                    }
                    successCount++;
                }
                catch (error) {
                    console.error(`Failed to process product [${productName}] during bulk import:`, error);
                    failureCount++;
                }
            }
        }));
        batchProducts.clear();
    });
    try {
        const parser = fs_1.default.createReadStream(filePath).pipe((0, csv_parser_1.default)());
        try {
            for (var _d = true, parser_1 = __asyncValues(parser), parser_1_1; parser_1_1 = yield parser_1.next(), _a = parser_1_1.done, !_a; _d = true) {
                _c = parser_1_1.value;
                _d = false;
                const row = _c;
                // Trim all headers
                const cleanedRow = {};
                for (const key of Object.keys(row)) {
                    cleanedRow[key.trim()] = row[key];
                }
                const rawName = cleanedRow["Product Name"] || cleanedRow["Product Na"] || cleanedRow["product name"] || cleanedRow["ProductName"] || cleanedRow["name"];
                const productName = sanitizeString(rawName);
                if (!productName)
                    continue;
                const categoryName = sanitizeString(cleanedRow["Category"] || cleanedRow["category"] || cleanedRow["CATEGORY"] || cleanedRow["Category Name"] || cleanedRow["category name"] || cleanedRow["CATEGORY NAME"]) || "Uncategorized";
                const sku = sanitizeString(cleanedRow["SKU"] || cleanedRow["sku"]) || null;
                const description = sanitizeString(cleanedRow["Description"] || cleanedRow["description"]) || "";
                const imageUrl = sanitizeString(cleanedRow["Image URL"] || cleanedRow["image url"] || cleanedRow["imageUrl"] || cleanedRow["ImageURL"]) || null;
                const images = imageUrl ? [imageUrl] : [];
                // Variant info
                const variantName = sanitizeString(cleanedRow["Variant Name"] || cleanedRow["Variant Na"] || cleanedRow["variant name"]) || "Standard";
                const rawWeight = cleanedRow["Weight"] || cleanedRow["weight"];
                const weight = !isNaN(parseFloat(rawWeight)) ? parseFloat(rawWeight) : null;
                const weightUnit = sanitizeString(cleanedRow["Unit"] || cleanedRow["unit"] || cleanedRow["UNIT"] || cleanedRow["Weight Unit"] || cleanedRow["weight unit"] || cleanedRow["WEIGHT UNIT"]) || "KG";
                const rawRate = cleanedRow["Rate"] || cleanedRow["rate"] || cleanedRow["Price"] || cleanedRow["price"];
                const price = !isNaN(parseFloat(rawRate)) ? parseFloat(rawRate) : 0;
                const rawQty = cleanedRow["Initial Qty"] || cleanedRow["initial qty"] || cleanedRow["Qty"] || cleanedRow["qty"];
                const quantity = !isNaN(parseInt(rawQty)) ? parseInt(rawQty) : 0;
                const rawThreshold = cleanedRow["Low Stock Alert"] || cleanedRow["low stock alert"] || cleanedRow["Threshold"] || cleanedRow["threshold"];
                const threshold = !isNaN(parseInt(rawThreshold)) ? parseInt(rawThreshold) : 5;
                const variantData = {
                    name: variantName,
                    weight,
                    weightUnit,
                    price,
                    quantity,
                    threshold
                };
                const key = productName.toLowerCase();
                if (batchProducts.has(key)) {
                    const prod = batchProducts.get(key);
                    prod.variants.push(variantData);
                }
                else {
                    batchProducts.set(key, {
                        name: productName,
                        categoryName,
                        sku,
                        description,
                        images,
                        variants: [variantData]
                    });
                }
                if (batchProducts.size >= BATCH_SIZE) {
                    yield processBatch();
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (!_d && !_a && (_b = parser_1.return)) yield _b.call(parser_1);
            }
            finally { if (e_1) throw e_1.error; }
        }
        // Process any remaining items
        yield processBatch();
        // Clean up uploaded file
        fs_1.default.unlink(filePath, (err) => {
            if (err)
                console.error("Failed to delete temp import file:", err);
        });
        // Invalidate Product Cache
        yield (0, cacheUtils_1.invalidateProductCache)();
        res.status(200).json({
            message: `Merchandise Ingestion Complete: ${successCount} successful product syncs, ${failureCount} failures.`,
            successCount,
            failureCount
        });
    }
    catch (error) {
        console.error("Bulk Import Process Failed:", error);
        // Clean up file on error
        fs_1.default.unlink(filePath, (err) => {
            if (err)
                console.error("Failed to delete temp import file:", err);
        });
        res.status(500).json({ message: `Bulk import failed: ${error.message}` });
    }
});
exports.bulkImportProducts = bulkImportProducts;
const uploadProductImage = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const file = req.file;
        if (!file) {
            return res.status(400).json({ message: "No file provided" });
        }
        const path = require("path");
        const crypto = require("crypto");
        const ext = path.extname(file.originalname).toLowerCase();
        // Generate random secure filename to prevent path traversal / collisions
        const randomName = `${crypto.randomUUID()}${ext}`;
        const productsUploadDir = path.join(process.cwd(), "public/uploads/products");
        if (!fs_1.default.existsSync(productsUploadDir)) {
            fs_1.default.mkdirSync(productsUploadDir, { recursive: true });
        }
        const targetPath = path.join(productsUploadDir, randomName);
        // Save file buffer
        yield fs_1.default.promises.writeFile(targetPath, file.buffer);
        // Return public relative path
        const publicUrl = `/uploads/products/${randomName}`;
        res.status(200).json({ url: publicUrl, filename: randomName });
    }
    catch (error) {
        console.error("Error saving uploaded image:", error);
        res.status(500).json({ message: "Error saving uploaded image to file storage" });
    }
});
exports.uploadProductImage = uploadProductImage;
