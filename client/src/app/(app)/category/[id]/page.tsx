"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getCategoryById, getCategories } from "@/services/categoryService";
import ProductCard from "@/components/ui/ProductCard";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/ui/EmptyState";
import FilterDrawer, {
    ActiveFilters,
    DEFAULT_FILTERS,
    getActiveFilterCount,
} from "@/components/ui/FilterDrawer";
import { ArrowLeft, SlidersHorizontal, LayoutGrid, List, ChevronRight } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;

function applyFilters(products: any[], filters: ActiveFilters): any[] {
    let result = [...products];

    // In-stock only
    if (filters.inStockOnly) {
        result = result.filter((p) => {
            const stock = p.inventory?.[0]?.currentStock ?? 0;
            return stock > 0;
        });
    }

    // Price range
    if (filters.minPrice !== null) {
        result = result.filter((p) => Number(p.basePrice) >= filters.minPrice!);
    }
    if (filters.maxPrice !== null) {
        result = result.filter((p) => Number(p.basePrice) <= filters.maxPrice!);
    }

    // Min discount
    if (filters.minDiscount !== null) {
        result = result.filter((p) => {
            const pricing = p.pricing?.find((pr: any) => pr.isActive);
            if (!pricing) return false;
            const disc =
                pricing.discountType === "PERCENTAGE"
                    ? pricing.discountValue
                    : (pricing.discountValue / Number(p.basePrice)) * 100;
            return disc >= filters.minDiscount!;
        });
    }

    // Sort
    result.sort((a, b) => {
        switch (filters.sort) {
            case "price_asc": return Number(a.basePrice) - Number(b.basePrice);
            case "price_desc": return Number(b.basePrice) - Number(a.basePrice);
            case "newest":
                return new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();
            case "discount": {
                const getDisc = (p: any) => {
                    const pr = p.pricing?.find((x: any) => x.isActive);
                    if (!pr) return 0;
                    return pr.discountType === "PERCENTAGE"
                        ? pr.discountValue
                        : (pr.discountValue / Number(p.basePrice)) * 100;
                };
                return getDisc(b) - getDisc(a);
            }
            default: return 0; // popularity — server order
        }
    });

    return result;
}

// Sidebar categories list
function CategorySidebar({ categories, activeId }: { categories: any[]; activeId: string }) {
    return (
        <aside className="w-20 sm:w-24 shrink-0 bg-white/20 backdrop-blur-md border-r border-black/5 overflow-y-auto scrollbar-hide flex flex-col pt-2 z-10 sticky top-0 self-start h-full">
            {categories.map((cat, idx) => {
                const isActive = cat.id === activeId;
                return (
                    <Link
                        key={cat.id}
                        href={`/category/${cat.id}`}
                        className={cn(
                            "flex flex-col items-center gap-1.5 py-4 px-1 transition-all text-center relative animate-slide-up",
                            isActive
                                ? "bg-emerald-500/10"
                                : "hover:bg-white/10"
                        )}
                        style={{ animationDelay: `${idx * 30}ms` }}
                    >
                        {/* Active Indicator */}
                        {isActive && (
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-10 bg-emerald-600 rounded-r-full shadow-[0_0_10px_rgba(5,150,105,0.2)]" />
                        )}

                        {/* Icon Container */}
                        <div className={cn(
                            "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border transition-all duration-300",
                            isActive
                                ? "bg-white border-emerald-200 shadow-md scale-110"
                                : "bg-white/40 border-transparent shadow-sm"
                        )}>
                            {/* In a real app we'd use icons, for now sticking to the logic but with emojis if available */}
                            {cat.icon ? (
                                <img
                                    src={cat.icon}
                                    alt={cat.name}
                                    className={cn("w-8 h-8 object-contain transition-transform", isActive && "rotate-3")}
                                />
                            ) : (
                                <span className="text-xl">🛍️</span>
                            )}
                        </div>
                        <span className={cn(
                            "text-[10px] font-black leading-tight px-1 transition-colors uppercase tracking-tight",
                            isActive ? "text-emerald-900" : "text-emerald-900/40"
                        )}>
                            {cat.name.split(" ")[0]}
                        </span>
                    </Link>
                );
            })}
        </aside>
    );
}

export default function CategoryDetailPage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();

    const [filters, setFilters] = useState<ActiveFilters>(DEFAULT_FILTERS);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [view, setView] = useState<"grid" | "list">("grid");
    const [page, setPage] = useState(1);
    const loadMoreRef = useRef<HTMLDivElement>(null);

    // Reset page when filters change
    useEffect(() => setPage(1), [filters]);

    const { data: category, isLoading } = useQuery({
        queryKey: ["category", id],
        queryFn: () => getCategoryById(id),
        enabled: !!id,
    });

    // All top-level categories for sidebar
    const { data: allCategories = [] } = useQuery({
        queryKey: ["categories"],
        queryFn: getCategories,
    });

    const filtered = useMemo(() => applyFilters(category?.products ?? [], filters), [category, filters]);
    const displayed = useMemo(() => filtered.slice(0, page * PAGE_SIZE), [filtered, page]);
    const hasMore = displayed.length < filtered.length;

    // IntersectionObserver for infinite scroll
    useEffect(() => {
        if (!loadMoreRef.current || !hasMore) return;
        const observer = new IntersectionObserver(
            (entries) => { if (entries[0].isIntersecting) setPage((p) => p + 1); },
            { threshold: 0.1 }
        );
        observer.observe(loadMoreRef.current);
        return () => observer.disconnect();
    }, [hasMore, displayed.length]);

    const filterCount = getActiveFilterCount(filters);

    return (
        <div className="flex flex-col h-dvh pt-16">
            {/* ── Sticky top bar ─────────────────────── */}
            <div className="z-20 bg-white/60 backdrop-blur-xl border-b border-black/5 shadow-sm">
                {/* Title row */}
                <div className="flex items-center gap-3 px-4 py-3">
                    <Link
                        href="/"
                        className="p-2 rounded-xl bg-white border border-black/5 shadow-sm hover:bg-gray-50 transition-colors"
                    >
                        <ArrowLeft className="h-5 w-5 text-emerald-900" />
                    </Link>
                    {isLoading
                        ? <Skeleton className="w-36 h-6" />
                        : <h1 className="text-lg font-black text-emerald-950 uppercase tracking-tight">{category?.name}</h1>
                    }
                    <span className="ml-auto text-[10px] font-black uppercase tracking-widest text-emerald-950/40">{filtered.length} items</span>
                </div>


                {/* Sub-category chips */}
                {!isLoading && category?.children?.length > 0 && (
                    <div className="flex overflow-x-auto gap-2 px-4 pb-3 scrollbar-hide">
                        {category.children.map((sub: any) => (
                            <Link
                                key={sub.id}
                                href={`/category/${sub.id}`}
                                className="flex-none flex items-center gap-1 bg-gray-100 hover:bg-green-50 hover:text-green-700 text-gray-600 text-xs font-medium px-3 py-1.5 rounded-full transition-colors whitespace-nowrap"
                            >
                                {sub.name}
                                <ChevronRight className="h-3 w-3" />
                            </Link>
                        ))}
                    </div>
                )}

                {/* Filter / Sort bar */}
                <div className="flex items-center gap-2 px-4 pb-3">
                    {/* Filter button */}
                    <button
                        onClick={() => setDrawerOpen(true)}
                        className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all",
                            filterCount > 0
                                ? "bg-green-500 text-white border-green-500"
                                : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                        )}
                    >
                        <SlidersHorizontal className="h-3.5 w-3.5" />
                        Filter{filterCount > 0 ? ` (${filterCount})` : ""}
                    </button>

                    {/* Sort chips — desktop */}
                    <div className="hidden sm:flex gap-1.5 flex-1 overflow-x-auto scrollbar-hide">
                        {[
                            { value: "popular", label: "Popular" },
                            { value: "price_asc", label: "Price ↑" },
                            { value: "price_desc", label: "Price ↓" },
                            { value: "newest", label: "New" },
                            { value: "discount", label: "Discount" },
                        ].map((opt) => (
                            <button
                                key={opt.value}
                                onClick={() => setFilters((f) => ({ ...f, sort: opt.value as any }))}
                                className={cn(
                                    "flex-none px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all",
                                    filters.sort === opt.value
                                        ? "bg-green-500 text-white border-green-500"
                                        : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                                )}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>

                    {/* Grid / List toggle */}
                    <div className="ml-auto flex items-center bg-gray-100 rounded-xl p-1 gap-0.5">
                        <button
                            onClick={() => setView("grid")}
                            className={cn("p-1.5 rounded-lg transition-all", view === "grid" ? "bg-white shadow-sm" : "text-gray-400")}
                        >
                            <LayoutGrid className="h-4 w-4" />
                        </button>
                        <button
                            onClick={() => setView("list")}
                            className={cn("p-1.5 rounded-lg transition-all", view === "list" ? "bg-white shadow-sm" : "text-gray-400")}
                        >
                            <List className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Main content: sidebar + product area ─── */}
            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar (always visible) */}
                {!isLoading && allCategories.length > 0 && (
                    <CategorySidebar categories={allCategories} activeId={id} />
                )}

                {/* Products area */}
                <div className="flex-1 overflow-y-auto h-full">
                    <div className="p-3 pb-28">
                        {isLoading ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {[...Array(8)].map((_, i) => (
                                    <Skeleton key={i} className="h-64 rounded-2xl" />
                                ))}
                            </div>
                        ) : displayed.length === 0 ? (
                            <EmptyState
                                title="No products found"
                                description="Try adjusting your filters."
                                actionLabel="Clear Filters"
                                onAction={() => setFilters(DEFAULT_FILTERS)}
                            />
                        ) : view === "grid" ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {displayed.map((product: any) => (
                                    <ProductCard
                                        key={product.id}
                                        id={product.id}
                                        name={product.name}
                                        images={product.images}
                                        basePrice={Number(product.basePrice)}
                                        weightUnit={product.weightUnit}
                                        inventory={product.inventory}
                                        pricing={product.pricing}
                                        variants={product.variants}
                                    />
                                ))}
                            </div>
                        ) : (
                            /* List view */
                            <div className="space-y-2">
                                {displayed.map((product: any) => (
                                    <Link
                                        key={product.id}
                                        href={`/products/${product.id}`}
                                        className="flex items-center gap-3 bg-white/60 backdrop-blur-md rounded-[1.5rem] p-3 border border-white shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all group"
                                    >
                                        <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-white/80 p-2 shrink-0 border border-black/5">
                                            {product.images?.[0] && (
                                                <Image src={product.images[0]} alt={product.name} fill className="object-contain group-hover:scale-110 transition-transform" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-black text-emerald-950 text-xs uppercase tracking-tight line-clamp-2">{product.name}</p>
                                            <p className="text-[10px] font-bold text-emerald-800/40 uppercase tracking-widest mt-1">{product.weightUnit}</p>
                                            <p className="font-black text-emerald-900 mt-1 tabular-nums">₹{Number(product.basePrice).toFixed(0)}</p>
                                        </div>
                                        <div className="bg-emerald-500/10 p-2 rounded-lg group-hover:bg-emerald-500/20 transition-colors">
                                            <ChevronRight className="h-4 w-4 text-emerald-600" />
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        )}

                        {/* Infinite scroll sentinel */}
                        {hasMore && (
                            <div ref={loadMoreRef} className="flex justify-center py-6">
                                <div className="flex gap-1">
                                    {[0, 1, 2].map((i) => (
                                        <div
                                            key={i}
                                            className="w-2 h-2 bg-green-400 rounded-full animate-bounce"
                                            style={{ animationDelay: `${i * 0.15}s` }}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Filter Drawer */}
            <FilterDrawer
                open={drawerOpen}
                onClose={() => setDrawerOpen(false)}
                filters={filters}
                onApply={setFilters}
            />
        </div>
    );
}
