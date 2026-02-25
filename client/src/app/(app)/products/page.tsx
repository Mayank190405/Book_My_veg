"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getProducts } from "@/services/productService";
import ProductCard from "@/components/ui/ProductCard";
import SearchInput from "@/components/ui/SearchInput";
import EmptyState from "@/components/ui/EmptyState";
import FilterDrawer, {
    ActiveFilters,
    DEFAULT_FILTERS,
    getActiveFilterCount,
} from "@/components/ui/FilterDrawer";
import { SlidersHorizontal, LayoutGrid, List } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { Package } from "lucide-react";
import { ChevronRight } from "lucide-react";

const PAGE_SIZE = 20;

function applyFilters(products: any[], search: string, filters: ActiveFilters): any[] {
    if (!Array.isArray(products)) return [];
    let result = [...products];

    if (search) {
        result = result.filter((p) =>
            p.name.toLowerCase().includes(search.toLowerCase())
        );
    }

    if (filters.inStockOnly) {
        result = result.filter((p) => (p.inventory?.[0]?.currentStock ?? 0) > 0);
    }

    if (filters.minPrice !== null) {
        result = result.filter((p) => Number(p.basePrice) >= filters.minPrice!);
    }
    if (filters.maxPrice !== null) {
        result = result.filter((p) => Number(p.basePrice) <= filters.maxPrice!);
    }

    if (filters.minDiscount !== null) {
        result = result.filter((p) => {
            const pr = p.pricing?.find((x: any) => x.isActive);
            if (!pr) return false;
            const disc =
                pr.discountType === "PERCENTAGE"
                    ? pr.discountValue
                    : (pr.discountValue / Number(p.basePrice)) * 100;
            return disc >= filters.minDiscount!;
        });
    }

    result.sort((a, b) => {
        switch (filters.sort) {
            case "price_asc": return Number(a.basePrice) - Number(b.basePrice);
            case "price_desc": return Number(b.basePrice) - Number(a.basePrice);
            case "newest":
                return new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();
            case "discount": {
                const disc = (p: any) => {
                    const pr = p.pricing?.find((x: any) => x.isActive);
                    if (!pr) return 0;
                    return pr.discountType === "PERCENTAGE"
                        ? pr.discountValue
                        : (pr.discountValue / Number(p.basePrice)) * 100;
                };
                return disc(b) - disc(a);
            }
            default: return 0;
        }
    });

    return result;
}

import DesktopSidebar from "@/components/ui/DesktopSidebar";

export default function ProductsPage() {
    const [search, setSearch] = useState("");
    const [filters, setFilters] = useState<ActiveFilters>(DEFAULT_FILTERS);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [view, setView] = useState<"grid" | "list">("grid");
    const [page, setPage] = useState(1);
    const loadMoreRef = useRef<HTMLDivElement>(null);

    const { data: productsData, isLoading } = useQuery({
        queryKey: ["all-products"],
        queryFn: () => getProducts(undefined, 100), // Fetch a larger set for client-side filtering
    });

    const products = productsData?.data || [];

    // Reset page when search or filters change
    useEffect(() => setPage(1), [search, filters]);

    const filtered = useMemo(() => applyFilters(products, search, filters), [products, search, filters]);
    const displayed = useMemo(() => filtered.slice(0, page * PAGE_SIZE), [filtered, page]);
    const hasMore = displayed.length < filtered.length;
    const filterCount = getActiveFilterCount(filters);

    // Infinite scroll
    useEffect(() => {
        if (!loadMoreRef.current || !hasMore) return;
        const observer = new IntersectionObserver(
            (entries) => { if (entries[0].isIntersecting) setPage((p) => p + 1); },
            { threshold: 0.1 }
        );
        observer.observe(loadMoreRef.current);
        return () => observer.disconnect();
    }, [hasMore, displayed.length]);

    return (
        <div className="pb-32">
            {/* Sticky toolbar */}
            <div className="sticky top-0 z-30 bg-white/60 backdrop-blur-xl border-b border-black/5 shadow-sm px-5 py-4 space-y-4">
                <div className="flex items-center gap-3">
                    <SearchInput
                        value={search}
                        onChange={setSearch}
                        placeholder="Search our fresh collection…"
                        className="flex-1 lg:max-w-md bg-white/40 border-black/5 rounded-2xl"
                    />

                    {/* Mobile Filter Button */}
                    <button
                        onClick={() => setDrawerOpen(true)}
                        className={cn(
                            "lg:hidden flex items-center gap-2 px-4 py-2.5 rounded-2xl border text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap shadow-sm",
                            filterCount > 0
                                ? "bg-emerald-600 text-white border-emerald-600 shadow-emerald-200/50"
                                : "bg-white text-emerald-950/40 border-black/5 hover:border-emerald-300"
                        )}
                    >
                        <SlidersHorizontal className="h-4 w-4" />
                        {filterCount > 0 ? `Filters (${filterCount})` : "Filter"}
                    </button>

                    <div className="flex-1 hidden lg:block" />

                    {/* View toggle */}
                    <div className="flex items-center bg-emerald-500/5 rounded-2xl p-1 gap-1 border border-emerald-500/10">
                        <button
                            onClick={() => setView("grid")}
                            className={cn("p-2 rounded-xl transition-all", view === "grid" ? "bg-white shadow-sm text-emerald-600" : "text-emerald-900/20")}
                        >
                            <LayoutGrid className="h-4 w-4" />
                        </button>
                        <button
                            onClick={() => setView("list")}
                            className={cn("p-2 rounded-xl transition-all", view === "list" ? "bg-white shadow-sm text-emerald-600" : "text-emerald-900/20")}
                        >
                            <List className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                {/* Mobile Sort chips */}
                <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 lg:hidden">
                    {[
                        { value: "popular", label: "PROMOTED" },
                        { value: "price_asc", label: "PRICE: LOW" },
                        { value: "price_desc", label: "PRICE: HIGH" },
                        { value: "newest", label: "LATEST" },
                        { value: "discount", label: "OFFERS" },
                    ].map((opt) => (
                        <button
                            key={opt.value}
                            onClick={() => setFilters((f) => ({ ...f, sort: opt.value as any }))}
                            className={cn(
                                "flex-none px-4 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all shadow-sm",
                                filters.sort === opt.value
                                    ? "bg-emerald-600 text-white border-emerald-600 shadow-emerald-200/50"
                                    : "bg-white text-emerald-950/40 border-black/5 hover:border-emerald-300"
                            )}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
                <p className="text-[10px] font-black text-emerald-950/40 uppercase tracking-widest lg:hidden">
                    {isLoading ? "REFRESHING..." : `${filtered.length} PRODUCTS FOUND`}
                </p>
            </div>

            <main className="container mx-auto max-w-7xl px-5 pt-6 flex gap-8 items-start">

                {/* Desktop Sidebar */}
                <DesktopSidebar
                    filters={filters}
                    onApply={setFilters}
                    className="w-72 shrink-0"
                />

                <div className="flex-1 min-w-0">
                    {/* Desktop Results Count */}
                    <div className="hidden lg:flex items-center justify-between mb-8 px-1">
                        <p className="text-[10px] font-black text-emerald-950/40 uppercase tracking-[0.3em]">
                            Found {filtered.length} Premium Essentials
                        </p>
                        <div className="h-px flex-1 bg-emerald-900/10 mx-6" />
                    </div>

                    {isLoading ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-6">
                            {[...Array(8)].map((_, i) => (
                                <div key={i} className="h-64 bg-white/40 backdrop-blur-md rounded-[2.5rem] animate-pulse border border-white" />
                            ))}
                        </div>
                    ) : displayed.length === 0 ? (
                        <div className="bg-white/40 backdrop-blur-md rounded-[3rem] p-20 border border-white shadow-sm flex flex-col items-center justify-center text-center gap-6 animate-in zoom-in-95 duration-500">
                            <div className="w-24 h-24 bg-white/60 rounded-[2.5rem] flex items-center justify-center shadow-xl border border-white rotate-6">
                                <Package className="h-10 w-10 text-emerald-900/10" />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-2xl font-black text-emerald-950 uppercase tracking-tight">Nothing Found</h3>
                                <p className="text-[10px] font-black text-emerald-950/30 uppercase tracking-[0.2em] max-w-sm leading-relaxed">
                                    Your current filters didn't match any products. Try clearing them to see all items.
                                </p>
                            </div>
                            <button
                                onClick={() => { setFilters(DEFAULT_FILTERS); setSearch(""); }}
                                className="bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest px-10 py-5 rounded-[1.5rem] shadow-2xl shadow-emerald-200 hover:bg-emerald-700 active:scale-95 transition-all"
                            >
                                Clear All Filters
                            </button>
                        </div>
                    ) : view === "grid" ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-6 animate-fade-in">
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
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="space-y-4 animate-fade-in">
                            {displayed.map((product: any) => (
                                <Link
                                    key={product.id}
                                    href={`/products/${product.id}`}
                                    className="group flex items-center gap-6 bg-white/40 backdrop-blur-md rounded-[2.5rem] p-4 border border-white shadow-sm hover:shadow-xl hover:bg-white/60 transition-all duration-500"
                                >
                                    <div className="relative w-24 h-24 rounded-[2rem] overflow-hidden bg-white/80 border border-black/5 shrink-0 shadow-sm group-hover:scale-105 transition-transform duration-700 p-2">
                                        {product.images?.[0] ? (
                                            <Image src={product.images[0]} alt={product.name} fill className="object-contain" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-emerald-900/10"><Package className="h-10 w-10" /></div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0 space-y-1">
                                        <h3 className="font-black text-emerald-950 text-base uppercase tracking-tight line-clamp-1">{product.name}</h3>
                                        <p className="text-[10px] text-emerald-800/40 font-black uppercase tracking-widest">{product.weightUnit || "Standard Unit"}</p>
                                        <div className="flex items-center gap-3 pt-1">
                                            <p className="font-black text-emerald-900 text-xl tracking-tighter tabular-nums">₹{Number(product.basePrice).toFixed(0)}</p>
                                            <span className="text-[8px] font-black text-emerald-600 bg-emerald-500/10 px-2 py-1 rounded-lg uppercase tracking-widest border border-emerald-500/10">Best Price</span>
                                        </div>
                                    </div>
                                    <div className="p-3 rounded-2xl bg-white border border-black/5 shadow-sm text-emerald-900 group-hover:bg-emerald-600 group-hover:text-white transition-all mr-2">
                                        <ChevronRight className="h-5 w-5" strokeWidth={3} />
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}

                    {/* Infinite scroll sentinel */}
                    {hasMore && (
                        <div ref={loadMoreRef} className="flex justify-center py-8">
                            <div className="flex gap-1.5">
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
            </main>

            {/* Mobile Filter Drawer */}
            <FilterDrawer
                open={drawerOpen}
                onClose={() => setDrawerOpen(false)}
                filters={filters}
                onApply={setFilters}
            />
        </div>
    );
}
