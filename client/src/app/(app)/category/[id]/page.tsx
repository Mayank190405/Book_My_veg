"use client";

import { useState, useMemo, useRef, useEffect } from "react";
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
import { ArrowLeft, SlidersHorizontal, LayoutGrid, Search, ShoppingCart } from "lucide-react";
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
        <aside aria-label="Product categories" className="w-[72px] shrink-0 border-r border-[#e5ebe7] bg-white sm:w-24 lg:w-48">
            <nav className="sticky top-0 flex max-h-[75vh] flex-col overflow-y-auto pb-6">
                {categories.map((cat) => {
                    const isActive = cat.id === activeId;
                    return <Link key={cat.id} href={`/category/${cat.id}`} aria-current={isActive ? "page" : undefined} className={cn("relative flex min-h-20 flex-col items-center gap-2 border-l-[3px] px-1.5 py-3 text-center lg:flex-row lg:gap-3 lg:px-3 lg:text-left", isActive ? "border-[#087f5b] bg-[#e8f7ef] text-[#056647]" : "border-transparent text-[#64736b] hover:bg-[#f8faf8]")}>
                        <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-[#f4f8f3]">
                            {cat.imageUrl ? <Image src={cat.imageUrl} alt="" fill className="object-contain p-1" sizes="44px" /> : <LayoutGrid aria-hidden="true" className="absolute inset-0 m-auto h-5 w-5" />}
                        </div>
                        <span className="break-words text-[11px] font-medium leading-snug sm:text-xs lg:text-sm">{cat.name}</span>
                    </Link>;
                })}
                <Link href="/categories" className="flex min-h-16 items-center justify-center gap-2 px-2 py-3 text-center text-[11px] font-semibold text-[#087f5b] lg:text-sm"><LayoutGrid className="h-4 w-4 shrink-0" aria-hidden="true" /><span>View all</span></Link>
            </nav>
        </aside>
    );
}

export default function CategoryDetailPage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const [filters, setFilters] = useState<ActiveFilters>(DEFAULT_FILTERS);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [page, setPage] = useState(1);
    const loadMoreRef = useRef<HTMLDivElement>(null);

    useEffect(() => setPage(1), [filters]);

    const { data: category, isLoading, isError, refetch } = useQuery({
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
        <div className="mx-auto flex min-h-screen w-full max-w-[1440px] flex-col bg-[#f8faf8]">
            <header className="border-b border-[#e5ebe7] bg-white px-3 py-4 sm:px-6">
                <div className="flex items-center gap-3">
                    <button aria-label="Back to categories" onClick={() => router.push("/categories")} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl hover:bg-[#f4f8f3]"><ArrowLeft className="h-5 w-5" /></button>
                    <div className="min-w-0 flex-1"><h1 className="text-lg font-bold leading-tight text-[#17251e] sm:text-2xl">{category?.name || "Browse products"}</h1><p className="mt-1 text-xs text-[#64736b]">{isLoading ? "Loading products…" : `${filtered.length} products in this collection`}</p></div>
                    <Link href="/search" aria-label="Search products" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl hover:bg-[#f4f8f3]"><Search className="h-5 w-5" /></Link>
                    <Link href="/cart" aria-label="View cart" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#e8f7ef] text-[#087f5b]"><ShoppingCart className="h-5 w-5" /></Link>
                </div>
            </header>
            <div className="flex flex-1">
                {allCategories.length > 0 && <CategorySidebar categories={allCategories} activeId={id} />}
                <section aria-label="Products" className="min-w-0 flex-1">
                    <div className="sticky top-0 z-20 flex items-center gap-2 overflow-x-auto border-b border-[#e5ebe7] bg-white px-3 py-2 sm:px-5">
                        <button onClick={() => setDrawerOpen(true)} className={cn("flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-xs font-semibold", filterCount > 0 ? "border-[#087f5b] bg-[#e8f7ef] text-[#056647]" : "border-[#e5ebe7] bg-[#f8faf8] text-[#17251e]")}><SlidersHorizontal className="h-4 w-4" />Filters {filterCount > 0 && `(${filterCount})`}</button>
                        {filterCount > 0 && <button onClick={() => setFilters(DEFAULT_FILTERS)} className="min-h-11 px-3 text-xs font-semibold text-[#087f5b]">Clear filters</button>}
                    </div>
                    <div className="px-2 py-3 pb-36 sm:p-5 sm:pb-36">
                        {isLoading ? <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 sm:gap-3">{Array.from({ length: 10 }, (_, i) => <Skeleton key={i} className="h-56 rounded-2xl bg-[#e5ebe7]" />)}</div> : isError ? <div role="alert" className="rounded-2xl border border-[#e5ebe7] bg-white p-5 text-center"><h2 className="text-base font-semibold">We couldn’t load this collection</h2><button onClick={() => refetch()} className="mt-4 min-h-11 rounded-lg bg-[#087f5b] px-5 text-sm font-semibold text-white">Try again</button></div> : displayed.length === 0 ? <EmptyState title="No products found" description="Try adjusting your filters or browse another category." actionLabel="Reset filters" onAction={() => setFilters(DEFAULT_FILTERS)} /> : <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 sm:gap-3">{displayed.map((product: any) => <ProductCard key={product.id} id={product.id} name={product.name} images={product.images} basePrice={Number(product.basePrice)} weight={Number(product.weight)} weightUnit={product.weightUnit} inventory={product.inventory} pricing={product.pricing} variants={product.variants} compact />)}</div>}
                        {hasMore && <div ref={loadMoreRef} role="status" aria-label="Loading more products" className="flex justify-center py-8"><div className="h-7 w-7 animate-spin rounded-full border-2 border-[#e5ebe7] border-t-[#087f5b]" /></div>}
                    </div>
                </section>
            </div>
            <FilterDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} filters={filters} onApply={setFilters} />
        </div>
    );
}
