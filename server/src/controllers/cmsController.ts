import { Request, Response, NextFunction } from "express";
import prisma from "../config/prisma";
import logger from "../utils/logger";

interface AuthRequest extends Request {
    user?: {
        userId: string;
        role: string;
    };
}

/**
 * Filter sections by scheduling rules
 */
function isSectionCurrentlyActive(section: any): boolean {
    if (!section.isActive) return false;
    if (section.status && section.status !== "PUBLISHED") return false;

    const scheduling = section.scheduling as any;
    if (!scheduling) return true;

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
async function seedDefaultSectionsIfEmpty() {
    const count = await prisma.cmsSection.count();
    if (count > 0) return;

    // Fetch up to 6 products for live hydration
    const sampleProducts = await prisma.product.findMany({
        where: { isActive: true },
        take: 6,
        select: { id: true, name: true }
    });
    const pIds = sampleProducts.map(p => p.id);

    // Fetch up to 6 categories
    const sampleCategories = await prisma.category.findMany({
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
        await prisma.cmsSection.create({
            data: sec as any
        });
    }
}

/**
 * Hydrate live products and categories for sections
 */
async function hydrateSections(sections: any[]) {
    // 1. Gather all productIds
    const allProductIds = new Set<string>();
    const allCategoryIds = new Set<string>();

    for (const sec of sections) {
        if (sec.productIds && Array.isArray(sec.productIds)) {
            sec.productIds.forEach((pid: any) => {
                if (typeof pid === "string") allProductIds.add(pid);
                else if (pid && pid.productId) allProductIds.add(pid.productId);
            });
        }
        if (sec.categoryIds && Array.isArray(sec.categoryIds)) {
            sec.categoryIds.forEach((cid: any) => {
                if (typeof cid === "string") allCategoryIds.add(cid);
            });
        }
    }

    // 2. Fetch live products from DB with inventory & pricing
    const productsMap = new Map<string, any>();
    if (allProductIds.size > 0) {
        const dbProducts = await prisma.product.findMany({
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
            const totalStock = p.inventory?.reduce((acc: number, inv: any) => acc + (inv.currentStock || 0), 0) ?? 100;
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
                pricing: p.pricing?.map((pr: any) => ({
                    ...pr,
                    price: Number(pr.price),
                    discountValue: Number(pr.discountValue)
                })),
                variants: p.variants?.map((v: any) => ({
                    ...v,
                    price: Number(v.price),
                    pricing: v.pricing?.map((vp: any) => ({
                        ...vp,
                        price: Number(vp.price),
                        discountValue: Number(vp.discountValue)
                    }))
                })),
                isAvailable
            });
        }
    }

    // 3. Fetch live categories from DB
    const categoriesMap = new Map<string, any>();
    if (allCategoryIds.size > 0) {
        const dbCategories = await prisma.category.findMany({
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
                productCount: c._count?.products ?? 0
            });
        }
    }

    // 4. Attach hydrated products and categories to each section
    return sections.map((sec) => {
        const hydratedSection = { ...sec };

        if (sec.productIds && Array.isArray(sec.productIds)) {
            const productList: any[] = [];
            for (const item of sec.productIds) {
                const pid = typeof item === "string" ? item : item?.productId;
                const found = productsMap.get(pid);
                if (found) {
                    productList.push({
                        ...found,
                        position: item?.position || "right",
                        displayPrice: item?.displayPrice ?? true,
                        displayDiscount: item?.displayDiscount ?? true
                    });
                }
            }
            hydratedSection.products = productList;
        }

        if (sec.categoryIds && Array.isArray(sec.categoryIds)) {
            const categoryList: any[] = [];
            for (const cid of sec.categoryIds) {
                const found = categoriesMap.get(cid);
                if (found) categoryList.push(found);
            }
            hydratedSection.categories = categoryList;
        }

        return hydratedSection;
    });
}

/**
 * GET /api/v1/cms/home/feed
 * Public SDUI endpoint that returns fully hydrated, active homepage sections
 */
export const getHomeFeed = async (req: Request, res: Response, next: NextFunction) => {
    try {
        await seedDefaultSectionsIfEmpty();

        const { page = "home", preview } = req.query;

        const whereClause: any = { page: String(page) };
        if (preview !== "true") {
            whereClause.isActive = true;
            whereClause.status = "PUBLISHED";
        }

        const rawSections = await prisma.cmsSection.findMany({
            where: whereClause,
            orderBy: { sortOrder: "asc" }
        });

        // Filter by scheduling if not in preview mode
        const activeSections = preview === "true" 
            ? rawSections 
            : rawSections.filter(isSectionCurrentlyActive);

        // Hydrate live products and categories
        const hydratedSections = await hydrateSections(activeSections);

        res.json({
            page: String(page),
            version: 1,
            serverTimestamp: new Date().toISOString(),
            sections: hydratedSections
        });
    } catch (error) {
        logger.error("Error in getHomeFeed:", error);
        next(error);
    }
};

/**
 * GET /api/v1/cms/sections
 * Admin endpoint to list all CMS sections with filters
 */
export const getAllSections = async (req: Request, res: Response, next: NextFunction) => {
    try {
        await seedDefaultSectionsIfEmpty();

        const { page = "home" } = req.query;
        const sections = await prisma.cmsSection.findMany({
            where: { page: String(page) },
            orderBy: { sortOrder: "asc" }
        });

        const hydrated = await hydrateSections(sections);
        res.json(hydrated);
    } catch (error) {
        logger.error("Error in getAllSections:", error);
        next(error);
    }
};

/**
 * GET /api/v1/cms/sections/:id
 */
export const getSectionById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = req.params.id as string;
        const section = await prisma.cmsSection.findUnique({
            where: { id }
        });

        if (!section) {
            return res.status(404).json({ message: "Section not found" });
        }

        const [hydrated] = await hydrateSections([section]);
        res.json(hydrated);
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/v1/cms/sections
 * Admin create new section
 */
export const createSection = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const {
            page = "home",
            type,
            template,
            title,
            subtitle,
            size = "large",
            sortOrder,
            isActive = true,
            status = "PUBLISHED",
            theme,
            layout,
            content,
            productIds,
            categoryIds,
            conditions,
            scheduling,
            abTest,
            metadata
        } = req.body;

        if (!type) {
            return res.status(400).json({ message: "Section type is required" });
        }

        // Determine sortOrder if not provided
        let targetOrder = sortOrder;
        if (targetOrder === undefined) {
            const last = await prisma.cmsSection.findFirst({
                where: { page },
                orderBy: { sortOrder: "desc" },
                select: { sortOrder: true }
            });
            targetOrder = (last?.sortOrder ?? -1) + 1;
        }

        const section = await prisma.cmsSection.create({
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

        const [hydrated] = await hydrateSections([section]);
        res.status(201).json(hydrated);
    } catch (error) {
        logger.error("Error creating CMS section:", error);
        next(error);
    }
};

/**
 * PUT /api/v1/cms/sections/:id
 * Admin update section
 */
export const updateSection = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = req.params.id as string;
        const {
            type,
            template,
            title,
            subtitle,
            size,
            sortOrder,
            isActive,
            status,
            theme,
            layout,
            content,
            productIds,
            categoryIds,
            conditions,
            scheduling,
            abTest,
            metadata
        } = req.body;

        const existing = await prisma.cmsSection.findUnique({ where: { id } });
        if (!existing) {
            return res.status(404).json({ message: "Section not found" });
        }

        const updated = await prisma.cmsSection.update({
            where: { id },
            data: {
                ...(type !== undefined && { type }),
                ...(template !== undefined && { template }),
                ...(title !== undefined && { title }),
                ...(subtitle !== undefined && { subtitle }),
                ...(size !== undefined && { size }),
                ...(sortOrder !== undefined && { sortOrder }),
                ...(isActive !== undefined && { isActive }),
                ...(status !== undefined && { status }),
                ...(theme !== undefined && { theme }),
                ...(layout !== undefined && { layout }),
                ...(content !== undefined && { content }),
                ...(productIds !== undefined && { productIds }),
                ...(categoryIds !== undefined && { categoryIds }),
                ...(conditions !== undefined && { conditions }),
                ...(scheduling !== undefined && { scheduling }),
                ...(abTest !== undefined && { abTest }),
                ...(metadata !== undefined && { metadata })
            }
        });

        const [hydrated] = await hydrateSections([updated]);
        res.json(hydrated);
    } catch (error) {
        logger.error("Error updating CMS section:", error);
        next(error);
    }
};

/**
 * POST /api/v1/cms/sections/reorder
 * Admin bulk update sort orders
 */
export const reorderSections = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { items } = req.body; // Array of { id: string, sortOrder: number }

        if (!Array.isArray(items)) {
            return res.status(400).json({ message: "items must be an array of { id, sortOrder }" });
        }

        await prisma.$transaction(
            items.map((item) =>
                prisma.cmsSection.update({
                    where: { id: item.id },
                    data: { sortOrder: item.sortOrder }
                })
            )
        );

        res.json({ success: true, message: "Sections reordered successfully" });
    } catch (error) {
        logger.error("Error reordering sections:", error);
        next(error);
    }
};

/**
 * POST /api/v1/cms/sections/:id/duplicate
 * Admin duplicate an existing section
 */
export const duplicateSection = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = req.params.id as string;
        const original = await prisma.cmsSection.findUnique({ where: { id } });

        if (!original) {
            return res.status(404).json({ message: "Original section not found" });
        }

        const duplicated = await prisma.cmsSection.create({
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
                theme: (original.theme as any) || {},
                layout: (original.layout as any) || {},
                content: (original.content as any) || {},
                productIds: (original.productIds as any) || [],
                categoryIds: (original.categoryIds as any) || [],
                conditions: (original.conditions as any) || {},
                scheduling: (original.scheduling as any) || {},
                abTest: (original.abTest as any) || {},
                metadata: (original.metadata as any) || {}
            }
        });

        const [hydrated] = await hydrateSections([duplicated]);
        res.status(201).json(hydrated);
    } catch (error) {
        logger.error("Error duplicating CMS section:", error);
        next(error);
    }
};

/**
 * PATCH /api/v1/cms/sections/:id/toggle
 * Admin toggle active status
 */
export const toggleSectionStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = req.params.id as string;
        const existing = await prisma.cmsSection.findUnique({ where: { id } });

        if (!existing) {
            return res.status(404).json({ message: "Section not found" });
        }

        const updated = await prisma.cmsSection.update({
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
    } catch (error) {
        next(error);
    }
};

/**
 * DELETE /api/v1/cms/sections/:id
 */
export const deleteSection = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = req.params.id as string;
        await prisma.cmsSection.delete({ where: { id } });
        res.json({ success: true, message: "Section deleted successfully" });
    } catch (error) {
        next(error);
    }
};
