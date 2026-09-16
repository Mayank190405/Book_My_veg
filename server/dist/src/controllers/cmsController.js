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
exports.deleteSection = exports.toggleSectionStatus = exports.duplicateSection = exports.reorderSections = exports.updateSection = exports.createSection = exports.getSectionById = exports.getAllSections = exports.getHomeFeed = void 0;
const prisma_1 = __importDefault(require("../config/prisma"));
const logger_1 = __importDefault(require("../utils/logger"));
/**
 * Filter sections by scheduling rules
 */
function isSectionCurrentlyActive(section) {
    if (!section.isActive)
        return false;
    if (section.status && section.status !== "PUBLISHED")
        return false;
    const scheduling = section.scheduling;
    if (!scheduling)
        return true;
    const now = new Date();
    if (scheduling.startDate && new Date(scheduling.startDate) > now) {
        return false;
    }
    if (scheduling.endDate && new Date(scheduling.endDate) < now) {
        return false;
    }
    if (scheduling.activeDaysOfWeek && Array.isArray(scheduling.activeDaysOfWeek) && scheduling.activeDaysOfWeek.length > 0) {
        const currentDay = now.getDay();
        if (!scheduling.activeDaysOfWeek.includes(currentDay)) {
            return false;
        }
    }
    return true;
}
/**
 * Seed high quality starter sections if CmsSection table is empty
 */
function seedDefaultSectionsIfEmpty() {
    return __awaiter(this, void 0, void 0, function* () {
        const count = yield prisma_1.default.cmsSection.count();
        if (count > 0)
            return;
        // Fetch up to 6 products for live hydration
        const sampleProducts = yield prisma_1.default.product.findMany({
            where: { isActive: true },
            take: 6,
            select: { id: true, name: true }
        });
        const pIds = sampleProducts.map(p => p.id);
        // Fetch up to 6 categories
        const sampleCategories = yield prisma_1.default.category.findMany({
            where: { isActive: true },
            take: 6,
            select: { id: true }
        });
        const cIds = sampleCategories.map(c => c.id);
        const defaultSections = [
            {
                page: "home",
                type: "hero_banner",
                template: "SPLIT_BANNER",
                title: "Farm Fresh Super Sale",
                subtitle: "Directly harvested from certified organic farms near Nashik",
                size: "large",
                sortOrder: 0,
                isActive: true,
                status: "PUBLISHED",
                theme: {
                    background: "#15803D",
                    secondaryBackground: "#166534",
                    gradient: "linear-gradient(135deg, #15803D 0%, #166534 100%)",
                    headingColor: "#FFFFFF",
                    textColor: "#DCFCE7",
                    accentColor: "#FACC15",
                    ctaBackground: "#FACC15",
                    ctaText: "#14532D",
                    badgeBackground: "#DC2626",
                    badgeText: "#FFFFFF",
                    borderColor: "#22C55E"
                },
                layout: {
                    desktop: { columns: 2, minHeight: "420px" },
                    mobile: { columns: 1, minHeight: "360px" },
                    borderRadius: "1.5rem"
                },
                content: {
                    headline: "Fresh From Farm To Your Kitchen",
                    subtitle: "Crisp vegetables, seasonal fruits & farm essentials delivered in 30 minutes.",
                    badgeText: "FLAT 30% OFF TODAY",
                    ctaText: "Explore Super Deals",
                    ctaLink: "/categories",
                    secondaryCtaText: "View Flash Deals",
                    secondaryCtaLink: "/deals",
                    image: "https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=1200&q=80"
                },
                productIds: pIds.slice(0, 3)
            },
            {
                page: "home",
                type: "category_grid",
                template: "CATEGORY_BANNER",
                title: "Explore Categories",
                subtitle: "Handpicked categories for your everyday health",
                size: "medium",
                sortOrder: 1,
                isActive: true,
                status: "PUBLISHED",
                theme: {
                    background: "#F8FAFC",
                    headingColor: "#0F172A",
                    textColor: "#475569",
                    accentColor: "#16A34A"
                },
                layout: {
                    desktop: { columns: 6 },
                    tablet: { columns: 4 },
                    mobile: { columns: 3 }
                },
                categoryIds: cIds
            },
            {
                page: "home",
                type: "promo_banner",
                template: "PRODUCT_SHOWCASE",
                title: "Weekly Organic Spotlight",
                subtitle: "Curated directly from our premier growers",
                size: "large",
                sortOrder: 2,
                isActive: true,
                status: "PUBLISHED",
                theme: {
                    background: "#FEFCE8",
                    secondaryBackground: "#FEF08A",
                    gradient: "linear-gradient(135deg, #CA8A04 0%, #A16207 100%)",
                    headingColor: "#713F12",
                    textColor: "#854D0E",
                    accentColor: "#EAB308",
                    ctaBackground: "#CA8A04",
                    ctaText: "#FFFFFF",
                    badgeBackground: "#EA580C",
                    badgeText: "#FFFFFF",
                    borderColor: "#FDE047"
                },
                layout: {
                    borderRadius: "1.25rem"
                },
                content: {
                    headline: "Farm Fresh Tomato & Green Veggies",
                    subtitle: "Rich in antioxidants, harvested early this morning.",
                    badgeText: "HARVEST OF THE DAY",
                    ctaText: "Shop Deal Now",
                    ctaLink: "/products",
                    discountText: "25% OFF"
                },
                productIds: pIds.slice(0, 1)
            },
            {
                page: "home",
                type: "promo_banner",
                template: "THREE_PRODUCT_BANNER",
                title: "Trio Essentials Combo",
                subtitle: "Buy the daily staple trio and get free delivery",
                size: "large",
                sortOrder: 3,
                isActive: true,
                status: "PUBLISHED",
                theme: {
                    background: "#FFF7ED",
                    secondaryBackground: "#FFEDD5",
                    gradient: "linear-gradient(135deg, #EA580C 0%, #C2410C 100%)",
                    headingColor: "#7C2D12",
                    textColor: "#9A3412",
                    accentColor: "#F97316",
                    ctaBackground: "#EA580C",
                    ctaText: "#FFFFFF",
                    badgeBackground: "#DC2626",
                    badgeText: "#FFFFFF",
                    borderColor: "#FDBA74"
                },
                content: {
                    headline: "Daily Staples Bundle",
                    subtitle: "Onions, Potatoes & Tomatoes paired at unmatched wholesale rates.",
                    badgeText: "SAVE ₹65",
                    ctaText: "Add Bundle To Cart",
                    ctaLink: "/cart",
                    discountText: "COMBO DISCOUNT"
                },
                productIds: pIds.slice(0, 3)
            },
            {
                page: "home",
                type: "promo_banner",
                template: "COUNTDOWN_BANNER",
                title: "Flash Rush Sale",
                subtitle: "Limited quantity lightning offers ending soon",
                size: "medium",
                sortOrder: 4,
                isActive: true,
                status: "PUBLISHED",
                theme: {
                    background: "#0F172A",
                    secondaryBackground: "#1E293B",
                    gradient: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)",
                    headingColor: "#F8FAFC",
                    textColor: "#94A3B8",
                    accentColor: "#10B981",
                    ctaBackground: "#10B981",
                    ctaText: "#0F172A",
                    badgeBackground: "#EF4444",
                    badgeText: "#FFFFFF",
                    borderColor: "#334155"
                },
                content: {
                    headline: "Midnight Harvest Rush Hours",
                    subtitle: "Fresh batch stock clearing before dawn deliveries.",
                    badgeText: "ENDS IN 04:32:10",
                    ctaText: "Grab Before Sold Out",
                    ctaLink: "/deals",
                    countdownTarget: new Date(Date.now() + 86400000).toISOString()
                },
                productIds: pIds.slice(1, 4)
            },
            {
                page: "home",
                type: "promo_banner",
                template: "OFFER_BANNER",
                title: "Special Coupon Offer",
                subtitle: "Exclusive code for first 500 orders",
                size: "small",
                sortOrder: 5,
                isActive: true,
                status: "PUBLISHED",
                theme: {
                    background: "#FAF5FF",
                    secondaryBackground: "#F3E8FF",
                    headingColor: "#581C87",
                    textColor: "#6B21A8",
                    accentColor: "#A855F7",
                    ctaBackground: "#7E22CE",
                    ctaText: "#FFFFFF",
                    badgeBackground: "#EC4899",
                    badgeText: "#FFFFFF",
                    borderColor: "#E9D5FF"
                },
                content: {
                    headline: "Use Code FRESH50 & Get ₹50 Instant Cashback",
                    subtitle: "Valid on all orders above ₹299. Applied at checkout.",
                    offerCode: "FRESH50",
                    badgeText: "COUPON SPECIAL",
                    ctaText: "Apply Code",
                    ctaLink: "/cart"
                }
            },
            {
                page: "home",
                type: "product_carousel",
                template: "PRODUCT_GRID_BANNER",
                title: "Fresh Vegetables From Farm",
                subtitle: "Direct morning arrivals ready for cooking",
                size: "large",
                sortOrder: 6,
                isActive: true,
                status: "PUBLISHED",
                theme: {
                    background: "#FFFFFF",
                    headingColor: "#15803D",
                    textColor: "#374151"
                },
                layout: {
                    desktop: { columns: 4 },
                    tablet: { columns: 3 },
                    mobile: { columns: 2 }
                },
                productIds: pIds
            }
        ];
        for (const sec of defaultSections) {
            yield prisma_1.default.cmsSection.create({
                data: sec
            });
        }
    });
}
/**
 * Hydrate live products and categories for sections
 */
function hydrateSections(sections) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f;
        // 1. Gather all productIds
        const allProductIds = new Set();
        const allCategoryIds = new Set();
        for (const sec of sections) {
            if (sec.productIds && Array.isArray(sec.productIds)) {
                sec.productIds.forEach((pid) => {
                    if (typeof pid === "string")
                        allProductIds.add(pid);
                    else if (pid && pid.productId)
                        allProductIds.add(pid.productId);
                });
            }
            if (sec.categoryIds && Array.isArray(sec.categoryIds)) {
                sec.categoryIds.forEach((cid) => {
                    if (typeof cid === "string")
                        allCategoryIds.add(cid);
                });
            }
        }
        // 2. Fetch live products from DB with inventory & pricing
        const productsMap = new Map();
        if (allProductIds.size > 0) {
            const dbProducts = yield prisma_1.default.product.findMany({
                where: {
                    id: { in: Array.from(allProductIds) }
                },
                include: {
                    category: { select: { id: true, name: true, slug: true } },
                    inventory: true,
                    pricing: true,
                    variants: {
                        include: {
                            pricing: true,
                            inventory: true
                        }
                    }
                }
            });
            for (const p of dbProducts) {
                // Check inventory safety
                const totalStock = (_b = (_a = p.inventory) === null || _a === void 0 ? void 0 : _a.reduce((acc, inv) => acc + (inv.currentStock || 0), 0)) !== null && _b !== void 0 ? _b : 100;
                const isAvailable = p.isActive && totalStock > 0;
                productsMap.set(p.id, {
                    id: p.id,
                    name: p.name,
                    slug: p.slug,
                    description: p.description,
                    images: p.images,
                    basePrice: Number(p.basePrice) || 0,
                    weightUnit: p.weightUnit,
                    inventory: p.inventory,
                    pricing: (_c = p.pricing) === null || _c === void 0 ? void 0 : _c.map((pr) => (Object.assign(Object.assign({}, pr), { price: Number(pr.price), discountValue: Number(pr.discountValue) }))),
                    variants: (_d = p.variants) === null || _d === void 0 ? void 0 : _d.map((v) => {
                        var _a;
                        return (Object.assign(Object.assign({}, v), { price: Number(v.price), pricing: (_a = v.pricing) === null || _a === void 0 ? void 0 : _a.map((vp) => (Object.assign(Object.assign({}, vp), { price: Number(vp.price), discountValue: Number(vp.discountValue) }))) }));
                    }),
                    isAvailable
                });
            }
        }
        // 3. Fetch live categories from DB
        const categoriesMap = new Map();
        if (allCategoryIds.size > 0) {
            const dbCategories = yield prisma_1.default.category.findMany({
                where: {
                    id: { in: Array.from(allCategoryIds) }
                },
                select: {
                    id: true,
                    name: true,
                    slug: true,
                    imageUrl: true,
                    icon: true,
                    _count: {
                        select: { products: true }
                    }
                }
            });
            for (const c of dbCategories) {
                categoriesMap.set(c.id, {
                    id: c.id,
                    name: c.name,
                    slug: c.slug,
                    imageUrl: c.imageUrl,
                    icon: c.icon,
                    productCount: (_f = (_e = c._count) === null || _e === void 0 ? void 0 : _e.products) !== null && _f !== void 0 ? _f : 0
                });
            }
        }
        // 4. Attach hydrated products and categories to each section
        return sections.map((sec) => {
            var _a, _b;
            const hydratedSection = Object.assign({}, sec);
            if (sec.productIds && Array.isArray(sec.productIds)) {
                const productList = [];
                for (const item of sec.productIds) {
                    const pid = typeof item === "string" ? item : item === null || item === void 0 ? void 0 : item.productId;
                    const found = productsMap.get(pid);
                    if (found) {
                        productList.push(Object.assign(Object.assign({}, found), { position: (item === null || item === void 0 ? void 0 : item.position) || "right", displayPrice: (_a = item === null || item === void 0 ? void 0 : item.displayPrice) !== null && _a !== void 0 ? _a : true, displayDiscount: (_b = item === null || item === void 0 ? void 0 : item.displayDiscount) !== null && _b !== void 0 ? _b : true }));
                    }
                }
                hydratedSection.products = productList;
            }
            if (sec.categoryIds && Array.isArray(sec.categoryIds)) {
                const categoryList = [];
                for (const cid of sec.categoryIds) {
                    const found = categoriesMap.get(cid);
                    if (found)
                        categoryList.push(found);
                }
                hydratedSection.categories = categoryList;
            }
            return hydratedSection;
        });
    });
}
/**
 * GET /api/v1/cms/home/feed
 * Public SDUI endpoint that returns fully hydrated, active homepage sections
 */
const getHomeFeed = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield seedDefaultSectionsIfEmpty();
        const { page = "home", preview } = req.query;
        const whereClause = { page: String(page) };
        if (preview !== "true") {
            whereClause.isActive = true;
            whereClause.status = "PUBLISHED";
        }
        const rawSections = yield prisma_1.default.cmsSection.findMany({
            where: whereClause,
            orderBy: { sortOrder: "asc" }
        });
        // Filter by scheduling if not in preview mode
        const activeSections = preview === "true"
            ? rawSections
            : rawSections.filter(isSectionCurrentlyActive);
        // Hydrate live products and categories
        const hydratedSections = yield hydrateSections(activeSections);
        res.json({
            page: String(page),
            version: 1,
            serverTimestamp: new Date().toISOString(),
            sections: hydratedSections
        });
    }
    catch (error) {
        logger_1.default.error("Error in getHomeFeed:", error);
        next(error);
    }
});
exports.getHomeFeed = getHomeFeed;
/**
 * GET /api/v1/cms/sections
 * Admin endpoint to list all CMS sections with filters
 */
const getAllSections = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield seedDefaultSectionsIfEmpty();
        const { page = "home" } = req.query;
        const sections = yield prisma_1.default.cmsSection.findMany({
            where: { page: String(page) },
            orderBy: { sortOrder: "asc" }
        });
        const hydrated = yield hydrateSections(sections);
        res.json(hydrated);
    }
    catch (error) {
        logger_1.default.error("Error in getAllSections:", error);
        next(error);
    }
});
exports.getAllSections = getAllSections;
/**
 * GET /api/v1/cms/sections/:id
 */
const getSectionById = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const id = req.params.id;
        const section = yield prisma_1.default.cmsSection.findUnique({
            where: { id }
        });
        if (!section) {
            return res.status(404).json({ message: "Section not found" });
        }
        const [hydrated] = yield hydrateSections([section]);
        res.json(hydrated);
    }
    catch (error) {
        next(error);
    }
});
exports.getSectionById = getSectionById;
/**
 * POST /api/v1/cms/sections
 * Admin create new section
 */
const createSection = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { page = "home", type, template, title, subtitle, size = "large", sortOrder, isActive = true, status = "PUBLISHED", theme, layout, content, productIds, categoryIds, conditions, scheduling, abTest, metadata } = req.body;
        if (!type) {
            return res.status(400).json({ message: "Section type is required" });
        }
        // Determine sortOrder if not provided
        let targetOrder = sortOrder;
        if (targetOrder === undefined) {
            const last = yield prisma_1.default.cmsSection.findFirst({
                where: { page },
                orderBy: { sortOrder: "desc" },
                select: { sortOrder: true }
            });
            targetOrder = ((_a = last === null || last === void 0 ? void 0 : last.sortOrder) !== null && _a !== void 0 ? _a : -1) + 1;
        }
        const section = yield prisma_1.default.cmsSection.create({
            data: {
                page,
                type,
                template,
                title,
                subtitle,
                size,
                sortOrder: targetOrder,
                isActive,
                status,
                theme: theme || {},
                layout: layout || {},
                content: content || {},
                productIds: productIds || [],
                categoryIds: categoryIds || [],
                conditions: conditions || {},
                scheduling: scheduling || {},
                abTest: abTest || {},
                metadata: metadata || {}
            }
        });
        const [hydrated] = yield hydrateSections([section]);
        res.status(201).json(hydrated);
    }
    catch (error) {
        logger_1.default.error("Error creating CMS section:", error);
        next(error);
    }
});
exports.createSection = createSection;
/**
 * PUT /api/v1/cms/sections/:id
 * Admin update section
 */
const updateSection = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const id = req.params.id;
        const { type, template, title, subtitle, size, sortOrder, isActive, status, theme, layout, content, productIds, categoryIds, conditions, scheduling, abTest, metadata } = req.body;
        const existing = yield prisma_1.default.cmsSection.findUnique({ where: { id } });
        if (!existing) {
            return res.status(404).json({ message: "Section not found" });
        }
        const updated = yield prisma_1.default.cmsSection.update({
            where: { id },
            data: Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({}, (type !== undefined && { type })), (template !== undefined && { template })), (title !== undefined && { title })), (subtitle !== undefined && { subtitle })), (size !== undefined && { size })), (sortOrder !== undefined && { sortOrder })), (isActive !== undefined && { isActive })), (status !== undefined && { status })), (theme !== undefined && { theme })), (layout !== undefined && { layout })), (content !== undefined && { content })), (productIds !== undefined && { productIds })), (categoryIds !== undefined && { categoryIds })), (conditions !== undefined && { conditions })), (scheduling !== undefined && { scheduling })), (abTest !== undefined && { abTest })), (metadata !== undefined && { metadata }))
        });
        const [hydrated] = yield hydrateSections([updated]);
        res.json(hydrated);
    }
    catch (error) {
        logger_1.default.error("Error updating CMS section:", error);
        next(error);
    }
});
exports.updateSection = updateSection;
/**
 * POST /api/v1/cms/sections/reorder
 * Admin bulk update sort orders
 */
const reorderSections = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { items } = req.body; // Array of { id: string, sortOrder: number }
        if (!Array.isArray(items)) {
            return res.status(400).json({ message: "items must be an array of { id, sortOrder }" });
        }
        yield prisma_1.default.$transaction(items.map((item) => prisma_1.default.cmsSection.update({
            where: { id: item.id },
            data: { sortOrder: item.sortOrder }
        })));
        res.json({ success: true, message: "Sections reordered successfully" });
    }
    catch (error) {
        logger_1.default.error("Error reordering sections:", error);
        next(error);
    }
});
exports.reorderSections = reorderSections;
/**
 * POST /api/v1/cms/sections/:id/duplicate
 * Admin duplicate an existing section
 */
const duplicateSection = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const id = req.params.id;
        const original = yield prisma_1.default.cmsSection.findUnique({ where: { id } });
        if (!original) {
            return res.status(404).json({ message: "Original section not found" });
        }
        const duplicated = yield prisma_1.default.cmsSection.create({
            data: {
                page: original.page,
                type: original.type,
                template: original.template,
                title: original.title ? `${original.title} (Copy)` : "New Section (Copy)",
                subtitle: original.subtitle,
                size: original.size,
                sortOrder: original.sortOrder + 1,
                isActive: false, // Start as inactive draft for safety
                status: "DRAFT",
                theme: original.theme || {},
                layout: original.layout || {},
                content: original.content || {},
                productIds: original.productIds || [],
                categoryIds: original.categoryIds || [],
                conditions: original.conditions || {},
                scheduling: original.scheduling || {},
                abTest: original.abTest || {},
                metadata: original.metadata || {}
            }
        });
        const [hydrated] = yield hydrateSections([duplicated]);
        res.status(201).json(hydrated);
    }
    catch (error) {
        logger_1.default.error("Error duplicating CMS section:", error);
        next(error);
    }
});
exports.duplicateSection = duplicateSection;
/**
 * PATCH /api/v1/cms/sections/:id/toggle
 * Admin toggle active status
 */
const toggleSectionStatus = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const id = req.params.id;
        const existing = yield prisma_1.default.cmsSection.findUnique({ where: { id } });
        if (!existing) {
            return res.status(404).json({ message: "Section not found" });
        }
        const updated = yield prisma_1.default.cmsSection.update({
            where: { id },
            data: {
                isActive: !existing.isActive,
                status: !existing.isActive ? "PUBLISHED" : "PAUSED"
            }
        });
        res.json({
            id: updated.id,
            isActive: updated.isActive,
            status: updated.status
        });
    }
    catch (error) {
        next(error);
    }
});
exports.toggleSectionStatus = toggleSectionStatus;
/**
 * DELETE /api/v1/cms/sections/:id
 */
const deleteSection = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const id = req.params.id;
        yield prisma_1.default.cmsSection.delete({ where: { id } });
        res.json({ success: true, message: "Section deleted successfully" });
    }
    catch (error) {
        next(error);
    }
});
exports.deleteSection = deleteSection;
