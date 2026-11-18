"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getProducts } from "@/services/productService";
import { getCategories } from "@/services/categoryService";
import ProductCard from "@/components/ui/ProductCard";
import FilterDrawer, {
    ActiveFilters,
    DEFAULT_FILTERS,
    getActiveFilterCount,
} from "@/components/ui/FilterDrawer";
import { SlidersHorizontal, Search, X, Package, Sparkles, Check, ArrowUpDown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 24;

interface CategoryItem {
    id: string;
    name: string;
    slug?: string;
}

function getActivePrice(product: any): { finalPrice: number; originalPrice: number; discountPct: number } {
    const basePrice = Number(product.basePrice || 0);
    const active = product.pricing?.find((p: any) => p.isActive && p.discountValue > 0);
    if (!active) return { finalPrice: basePrice, originalPrice: basePrice, discountPct: 0 };

    if (active.discountType === "PERCENTAGE") {
        const finalPrice = basePrice - (basePrice * active.discountValue) / 100;
        return { finalPrice, originalPrice: basePrice, discountPct: Math.round(active.discountValue) };
    }
    if (active.discountType === "FLAT") {
        const finalPrice = basePrice - active.discountValue;
        return { finalPrice, originalPrice: basePrice, discountPct: Math.round((active.discountValue / basePrice) * 100) };
    }
    return { finalPrice: basePrice, originalPrice: basePrice, discountPct: 0 };
}

function applyFilters(
    products: any[],
    search: string,
    filters: ActiveFilters,
    selectedCategoryId: string
): any[] {
    if (!Array.isArray(products)) return [];
    let result = [...products];

    // Category filter
    if (selectedCategoryId !== "all") {
        result = result.filter((p) => {
            const catId = p.categoryId || p.category?.id;
            const catName = p.category?.name || "";
            const catSlug = p.category?.slug || "";
            if (catId === selectedCategoryId) return true;

            // Name/slug pattern matching for robust category mapping
            if (selectedCategoryId === "veg") return /veg/i.test(catName) && !/leaf/i.test(catName);
            if (selectedCategoryId === "fruits") return /fruit/i.test(catName);
            if (selectedCategoryId === "dairy") return /dairy|milk|egg/i.test(catName);
            if (selectedCategoryId === "exotic") return /exotic/i.test(catName);
            if (selectedCategoryId === "leafy") return /leaf/i.test(catName);
            if (selectedCategoryId === "grains") return /grain|pulse|flour/i.test(catName);
            if (selectedCategoryId === "oil") return /oil|ghee/i.test(catName);

            return false;
        });
    }

    // Search query
    if (search.trim()) {
        const q = search.toLowerCase().trim();
        result = result.filter((p) =>
            p.name.toLowerCase().includes(q) ||
            (p.category?.name && p.category.name.toLowerCase().includes(q))
        );
    }

    // In-stock only
    if (filters.inStockOnly) {
        result = result.filter((p) => {
            const allInv = [...(p.inventory ?? []), ...(p.variants?.flatMap((v: any) => v.inventory ?? []) ?? [])];
            const stock = allInv.reduce((acc, inv) => acc + Number(inv.currentStock || 0), 0);
            return stock > 0;
        });
    }

    // Price range filters
    if (filters.minPrice !== null) {
        result = result.filter((p) => getActivePrice(p).finalPrice >= filters.minPrice!);
    }
    if (filters.maxPrice !== null) {
        result = result.filter((p) => getActivePrice(p).finalPrice <= filters.maxPrice!);
    }

    // Minimum discount filter
    if (filters.minDiscount !== null) {
        result = result.filter((p) => getActivePrice(p).discountPct >= filters.minDiscount!);
    }

    // Sorting
    result.sort((a, b) => {
        const priceA = getActivePrice(a).finalPrice;
        const priceB = getActivePrice(b).finalPrice;

        switch (filters.sort) {
            case "price_asc":
                return priceA - priceB;
            case "price_desc":
                return priceB - priceA;
            case "newest":
                return new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();
            case "discount":
                return getActivePrice(b).discountPct - getActivePrice(a).discountPct;
            default:
                return 0;
        }
    });

    return result;
}

export default function ProductsPage() {
    const [search, setSearch] = useState("");
    const [selectedCategoryId, setSelectedCategoryId] = useState<string>("all");
    const [filters, setFilters] = useState<ActiveFilters>(DEFAULT_FILTERS);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [page, setPage] = useState(1);
    const loadMoreRef = useRef<HTMLDivElement>(null);

    // Fetch all products
    const { data: productsData, isLoading: isProductsLoading } = useQuery({
        queryKey: ["all-products"],
        queryFn: () => getProducts(undefined, 300),
        staleTime: 3 * 60 * 1000,
    });

    // Fetch categories for filter pills
    const { data: categoriesData } = useQuery({
        queryKey: ["categories"],
        queryFn: getCategories,
        staleTime: 5 * 60 * 1000,
    });

    const products = productsData?.data || [];
    const categories: CategoryItem[] = Array.isArray(categoriesData)
        ? categoriesData
        : (categoriesData?.data || []);

    // Reset pagination when search, category, or filters change
    useEffect(() => {
        setPage(1);
    }, [search, selectedCategoryId, filters]);

    const filtered = useMemo(
        () => applyFilters(products, search, filters, selectedCategoryId),
        [products, search, filters, selectedCategoryId]
    );

    const displayed = useMemo(() => filtered.slice(0, page * PAGE_SIZE), [filtered, page]);
    const hasMore = displayed.length < filtered.length;
    const filterCount = getActiveFilterCount(filters);

    // Infinite scroll observer
    useEffect(() => {
        if (!loadMoreRef.current || !hasMore) return;
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    setPage((p) => p + 1);
                }
            },
            { threshold: 0.1 }
        );
        observer.observe(loadMoreRef.current);
        return () => observer.disconnect();
    }, [hasMore, displayed.length]);

    const SORT_OPTIONS = [
        { label: "All Items", sort: "popular" },
        { label: "Price: Low to High", sort: "price_asc" },
        { label: "Price: High to Low", sort: "price_desc" },
        { label: "Offers & Discounts", sort: "discount" },
        { label: "Newly Added", sort: "newest" },
    ] as const;

    return (
        <div className="min-h-screen bg-[#F8FAF9] pb-32">
            {/* Sticky Header & Search Strip */}
            <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-2xs">
                <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 space-y-2.5">
                    {/* Search Input + Filter Trigger */}
                    <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search all fresh products..."
                                className="w-full h-10 pl-9 pr-8 bg-slate-100/80 rounded-xl text-xs sm:text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#017649] focus:bg-white transition-all border border-transparent focus:border-[#017649]"
                            />
                            {search && (
                                <button
                                    onClick={() => setSearch("")}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                                >
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            )}
                        </div>

                        {/* Filter Button */}
                        <button
                            type="button"
                            onClick={() => setDrawerOpen(true)}
                            className={cn(
                                "flex items-center gap-1.5 h-10 px-3 sm:px-4 rounded-xl border text-xs font-bold transition-all shrink-0 active:scale-95",
                                filterCount > 0
                                    ? "bg-[#017649] text-white border-[#017649] shadow-xs"
                                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                            )}
                        >
                            <SlidersHorizontal className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Filters</span>
                            {filterCount > 0 && (
                                <span className="w-4 h-4 rounded-full bg-white text-[#017649] text-[10px] font-black flex items-center justify-center">
                                    {filterCount}
                                </span>
                            )}
                        </button>
                    </div>

                    {/* Category Horizontal Filter Pills */}
                    <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide pb-0.5">
                        <button
                            type="button"
                            onClick={() => setSelectedCategoryId("all")}
                            className={cn(
                                "px-3 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 whitespace-nowrap active:scale-95",
                                selectedCategoryId === "all"
                                    ? "bg-[#017649] text-white shadow-2xs"
                                    : "bg-slate-100 text-slate-700 hover:bg-slate-200/80"
                            )}
                        >
                            All Categories
                        </button>

                        {categories.map((cat) => {
                            const isSelected = selectedCategoryId === cat.id;
                            return (
                                <button
                                    key={cat.id}
                                    type="button"
                                    onClick={() => setSelectedCategoryId(cat.id)}
                                    className={cn(
                                        "px-3 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 whitespace-nowrap active:scale-95",
                                        isSelected
                                            ? "bg-[#017649] text-white shadow-2xs"
                                            : "bg-slate-100 text-slate-700 hover:bg-slate-200/80"
                                    )}
                                >
                                    {cat.name}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Sub-strip: Sort chips & active count */}
                <div className="bg-slate-50/70 border-t border-slate-100 px-3 sm:px-6 py-1.5">
                    <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
                        {/* Sort chips */}
                        <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide text-[11px] font-bold">
                            {SORT_OPTIONS.map((opt) => (
                                <button
                                    key={opt.sort}
                                    type="button"
                                    onClick={() => setFilters((f) => ({ ...f, sort: opt.sort as any }))}
                                    className={cn(
                                        "px-2.5 py-1 rounded-lg shrink-0 whitespace-nowrap transition-colors",
                                        filters.sort === opt.sort
                                            ? "bg-[#e8f7ef] text-[#017649] font-black border border-[#a3e4c4]"
                                            : "text-slate-500 hover:text-slate-800"
                                    )}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>

                        {/* Product count */}
                        <span className="text-[11px] font-semibold text-slate-400 shrink-0">
                            {isProductsLoading ? "Loading..." : `${filtered.length} products`}
                        </span>
                    </div>
                </div>
            </div>

            {/* Products Main Container */}
            <main className="max-w-7xl mx-auto px-2.5 sm:px-6 pt-3.5 sm:pt-5 select-none">
                {isProductsLoading ? (
                    /* 3x3 Skeletons */
                    <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3.5">
                        {[...Array(18)].map((_, i) => (
                            <div
                                key={i}
                                className="rounded-2xl border border-slate-200/80 bg-white p-2 sm:p-2.5 flex flex-col justify-between animate-pulse"
                            >
                                <Skeleton className="w-full aspect-square rounded-xl bg-slate-100" />
                                <div className="space-y-1.5 mt-2">
                                    <Skeleton className="w-full h-3 bg-slate-200 rounded" />
                                    <Skeleton className="w-2/3 h-2.5 bg-slate-200 rounded" />
                                </div>
                                <div className="flex items-center justify-between mt-3 pt-1">
                                    <Skeleton className="w-10 h-4 bg-slate-200 rounded" />
                                    <Skeleton className="w-12 h-6 bg-slate-200 rounded-lg" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : displayed.length === 0 ? (
                    /* Empty State */
                    <div className="rounded-3xl border border-slate-200/80 bg-white p-12 text-center max-w-md mx-auto my-12 shadow-2xs space-y-3">
                        <div className="w-16 h-16 bg-[#e8f7ef] rounded-2xl flex items-center justify-center text-[#017649] mx-auto shadow-2xs">
                            <Package className="h-8 w-8" />
                        </div>
                        <h3 className="text-base font-bold text-slate-900">No products found</h3>
                        <p className="text-xs text-slate-500 font-medium leading-relaxed">
                            We couldn't find any items matching your selected category or filters.
                        </p>
                        <button
                            type="button"
                            onClick={() => {
                                setSearch("");
                                setSelectedCategoryId("all");
                                setFilters(DEFAULT_FILTERS);
                            }}
                            className="bg-[#017649] hover:bg-[#015f3b] text-white text-xs font-bold px-5 py-2.5 rounded-xl transition-all active:scale-95 shadow-2xs mt-2"
                        >
                            Reset All Filters
                        </button>
                    </div>
                ) : (
                    /* 3-Column Product Grid (3 cols mobile, up to 6 on wide desktop) */
                    <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3.5">
                        {displayed.map((product: any, idx: number) => (
                            <div
                                key={product.id}
                                className="w-full animate-fade-in"
                                style={{ animationDelay: `${(idx % 12) * 20}ms` }}
                            >
                                <ProductCard
                                    id={product.id}
                                    name={product.name}
                                    images={product.images || []}
                                    basePrice={Number(product.basePrice || 0)}
                                    weight={product.weight}
                                    weightUnit={product.weightUnit}
                                    inventory={product.inventory || []}
                                    pricing={product.pricing || []}
                                    variants={product.variants || []}
                                    compact
                                />
                            </div>
                        ))}
                    </div>
                )}

                {/* Infinite Scroll Indicator */}
                {hasMore && (
                    <div ref={loadMoreRef} className="flex justify-center items-center py-8">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400">
                            <div className="w-1.5 h-1.5 rounded-full bg-[#017649] animate-bounce" style={{ animationDelay: "0ms" }} />
                            <div className="w-1.5 h-1.5 rounded-full bg-[#017649] animate-bounce" style={{ animationDelay: "150ms" }} />
                            <div className="w-1.5 h-1.5 rounded-full bg-[#017649] animate-bounce" style={{ animationDelay: "300ms" }} />
                        </div>
                    </div>
                )}
            </main>

            {/* Filter Drawer */}
            <FilterDrawer
                open={drawerOpen}
                onClose={() => setDrawerOpen(false)}
                filters={filters}
                onApply={(newFilters) => setFilters(newFilters)}
            />
        </div>
    );
}
