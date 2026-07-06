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
import { ArrowLeft, SlidersHorizontal, LayoutGrid, List, ChevronRight, Sparkles } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;

function getActivePrice(product: any): { finalPrice: number; originalPrice: number; discountPct: number } {
    const basePrice = Number(product.basePrice);
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

function applyFilters(products: any[], filters: ActiveFilters): any[] {
    let result = [...products];
    if (filters.inStockOnly) {
        result = result.filter((p) => {
            const allInv = [...(p.inventory ?? []), ...(p.variants?.flatMap((v: any) => v.inventory ?? []) ?? [])];
            const stock = allInv.reduce((acc, inv) => acc + Number(inv.currentStock), 0);
            return stock > 0;
        });
    }
    
    const getPrice = (p: any) => {
        const { finalPrice } = getActivePrice(p);
        return finalPrice;
    };

    if (filters.minPrice !== null) result = result.filter((p) => getPrice(p) >= filters.minPrice!);
    if (filters.maxPrice !== null) result = result.filter((p) => getPrice(p) <= filters.maxPrice!);
    
    result.sort((a, b) => {
        switch (filters.sort) {
            case "price_asc": return getPrice(a) - getPrice(b);
            case "price_desc": return getPrice(b) - getPrice(a);
            case "newest": return new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();
            default: return 0;
        }
    });

    return result;
}

function CategorySidebar({ categories, activeId }: { categories: any[]; activeId: string }) {
    return (
        <aside className="w-20 shrink-0 bg-[#fbfdfc] border-r border-slate-100 overflow-y-auto scrollbar-hide flex flex-col pt-3 pb-36 z-10 sticky top-0 self-start h-full">
            <div className="flex flex-col gap-3 flex-1 pb-4">
                {categories.map((cat, idx: number) => {
                    const isActive = cat.id === activeId;
                    return (
                        <Link
                            key={cat.id}
                            href={`/category/${cat.id}`}
                            className={cn(
                                "flex flex-col items-center gap-1.5 py-2 px-1 transition-all text-center relative animate-in slide-in-from-left-4 duration-500",
                                isActive ? "bg-emerald-500/5" : "hover:bg-slate-50/50"
                            )}
                            style={{ animationDelay: `${idx * 40}ms` }}
                        >
                            {/* Active indicator bar on the right of the sidebar item */}
                            {isActive && (
                                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-10 bg-emerald-600 rounded-l-full shadow-[0_0_15px_rgba(16,185,129,0.4)]" />
                            )}

                            {/* Circle Container */}
                            <div className={cn(
                                "w-12 h-12 rounded-full flex items-center justify-center shrink-0 border overflow-hidden transition-all duration-500 relative p-0.5",
                                isActive
                                    ? "bg-white border-emerald-500 scale-105 shadow-md shadow-emerald-500/5"
                                    : "bg-slate-50 border-slate-100 hover:border-slate-200"
                            )}>
                                {cat.imageUrl ? (
                                    <Image
                                        src={cat.imageUrl}
                                        alt={cat.name}
                                        fill
                                        className="object-cover rounded-full"
                                        sizes="48px"
                                    />
                                ) : (
                                    <span className="text-xl">📦</span>
                                )}
                            </div>
                            
                            <span className={cn(
                                "text-[7.5px] font-black leading-tight px-1 transition-colors uppercase tracking-[0.05em] mt-1 max-w-[70px] line-clamp-1",
                                isActive ? "text-emerald-700 font-extrabold" : "text-[#1c2e24]/40"
                            )}>
                                {cat.name.split(" ")[0]}
                            </span>
                        </Link>
                    );
                })}
            </div>
            
            {/* View All Categories Button at Bottom of Sidebar */}
            <Link
                href="/categories"
                className="flex flex-col items-center gap-1.5 py-4 px-1 text-center hover:bg-slate-50 border-t border-slate-100 bg-[#fbfdfc] mt-auto select-none active:scale-95 transition-all"
            >
                <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100/50 text-[#1c2e24]">
                    <LayoutGrid className="w-5 h-5 stroke-[2.5]" />
                </div>
                <span className="text-[7.5px] font-black text-slate-400 uppercase tracking-widest leading-tight max-w-[65px] text-center">
                    View All
                </span>
            </Link>
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

    useEffect(() => setPage(1), [filters]);

    const { data: category, isLoading } = useQuery({
        queryKey: ["category", id],
        queryFn: () => getCategoryById(id),
    });

    const { data: allCategories = [] } = useQuery({
        queryKey: ["categories"],
        queryFn: getCategories,
    });

    const filtered = useMemo(() => applyFilters(category?.products ?? [], filters), [category, filters]);
    const displayed = useMemo(() => filtered.slice(0, page * PAGE_SIZE), [filtered, page]);
    const hasMore = displayed.length < filtered.length;

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
        <div className="flex flex-col h-screen bg-background overflow-hidden">
            {/* Header Area */}
            <div className="z-30 bg-white border-b border-slate-100 pt-4 pb-4 px-5 select-none">
                <div className="max-w-2xl mx-auto space-y-4">
                    <div className="flex items-center gap-3.5">
                        <button
                            onClick={() => router.push("/categories")}
                            className="w-10 h-10 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-[#1c2e24] hover:scale-105 active:scale-95 transition-all shrink-0"
                        >
                            <ArrowLeft className="h-5 w-5 stroke-[2.5]" />
                        </button>
                        <div className="flex-1 min-w-0">
                            <h1 className="text-2xl font-black text-[#1c2e24] uppercase tracking-wider italic leading-none">
                                {category?.name}
                            </h1>
                            <p className="text-[10px] font-bold text-slate-400 mt-1.5 leading-tight tracking-tight line-clamp-1">
                                {category?.icon || `Pure, natural & premium quality products for a healthy you.`}
                            </p>
                        </div>
                        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-100/80 px-3 py-1.5 rounded-full shrink-0">
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">
                                📦 {filtered.length} Items
                            </span>
                        </div>
                    </div>

                    {/* Filter Bar */}
                    <div className="flex items-center justify-between gap-3 pt-1">
                        <button
                            onClick={() => setDrawerOpen(true)}
                            className={cn(
                                "flex items-center gap-2 px-5 py-2.5 rounded-full border text-[9px] font-black uppercase tracking-widest transition-all active:scale-[0.98]",
                                filterCount > 0
                                    ? "bg-[#0b5c3e] text-white border-[#0b5c3e] shadow-md shadow-emerald-950/15"
                                    : "bg-slate-50 text-slate-600 border-slate-200/80 hover:border-slate-300"
                            )}
                        >
                            <SlidersHorizontal className="h-3.5 w-3.5" />
                            Filters {filterCount > 0 && `(${filterCount})`}
                        </button>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex flex-1 overflow-hidden">
                {!isLoading && allCategories.length > 0 && (
                    <CategorySidebar categories={allCategories} activeId={id} />
                )}

                <div className="flex-1 overflow-y-auto bg-background scrollbar-hide">
                    {/* Visual Cover Banner Card */}
                    {!isLoading && category && (
                        <div className="relative mx-5 mt-7 h-36 select-none">
                            {/* Card Background (Rounded and Clipped) */}
                            <div className="absolute inset-0 bg-gradient-to-r from-[#032e1e] to-[#0b5c3e] rounded-[2rem] border border-emerald-500/10 shadow-lg overflow-hidden">
                                {/* Graphic elements */}
                                <div className="absolute inset-0 bg-radial-gradient from-transparent to-black/35 pointer-events-none" />
                                
                                {/* Content */}
                                <div className="absolute inset-0 flex flex-col justify-between p-5 z-10">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[8px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full uppercase tracking-widest">
                                            Premium Selection
                                        </span>
                                    </div>
                                    <div className="max-w-[90%]">
                                        <h2 className="text-xl font-black text-white uppercase tracking-wider italic flex items-center gap-1.5 leading-none">
                                            {category.name} <Sparkles className="h-4 w-4 text-emerald-400 fill-emerald-400/20 animate-pulse" />
                                        </h2>
                                        <p className="text-[9px] font-bold text-white/50 uppercase tracking-widest mt-1.5 leading-snug">
                                            {category.icon || "Handpicked fresh organic products for your kitchen."}
                                        </p>
                                    </div>
                                    
                                    {/* Bottom Highlights row */}
                                    <div className="flex items-center gap-4 text-[7px] font-black text-white/70 uppercase tracking-wider mt-1 border-t border-white/5 pt-1.5">
                                        <span className="flex items-center gap-1">🌿 100% Organic</span>
                                        <span className="flex items-center gap-1">🛡️ Lab Tested</span>
                                        <span className="flex items-center gap-1">💧 Rich In Nutrients</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    
                    <div className="p-5 pb-40">
                        {isLoading ? (
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                {[...Array(8)].map((_, i) => (
                                    <Skeleton key={i} className="h-64 rounded-3xl bg-secondary" />
                                ))}
                            </div>
                        ) : displayed.length === 0 ? (
                            <EmptyState
                                title="Collection Empty"
                                description="Adjust filters to find more organic produce."
                                actionLabel="Reset Filters"
                                onAction={() => setFilters(DEFAULT_FILTERS)}
                            />
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                {displayed.map((product: any) => (
                                    <ProductCard
                                        key={product.id}
                                        id={product.id}
                                        name={product.name}
                                        images={product.images}
                                        basePrice={Number(product.basePrice)}
                                        weight={Number(product.weight)}
                                        weightUnit={product.weightUnit}
                                        inventory={product.inventory}
                                        pricing={product.pricing}
                                        variants={product.variants}
                                        compact
                                    />
                                ))}
                            </div>
                        )}

                        {hasMore && (
                            <div ref={loadMoreRef} className="flex justify-center py-12">
                                <div className="w-10 h-10 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <FilterDrawer
                open={drawerOpen}
                onClose={() => setDrawerOpen(false)}
                filters={filters}
                onApply={setFilters}
            />
        </div>
    );
}
