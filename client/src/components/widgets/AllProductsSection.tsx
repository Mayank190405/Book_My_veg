"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { getProducts, getProductsByCategory } from "@/services/productService";
import { getCategories } from "@/services/categoryService";
import { Skeleton } from "@/components/ui/skeleton";
import ProductCard from "@/components/ui/ProductCard";
import { useEffect, useRef, useMemo } from "react";
import { Loader2, Leaf, ArrowRight } from "lucide-react";
import { useCategoryThemeStore } from "@/store/useCategoryThemeStore";

export default function AllProductsSection() {
    const observerTarget = useRef<HTMLDivElement>(null);

    const selectedCategory = useCategoryThemeStore((state) => state.selectedCategory);
    const getActiveTheme = useCategoryThemeStore((state) => state.getActiveTheme);
    const setSelectedCategory = useCategoryThemeStore((state) => state.setSelectedCategory);
    const activeTheme = getActiveTheme();

    // Query categories to resolve database category ID for the active theme
    const { data: categoriesData } = useQuery({
        queryKey: ["categories"],
        queryFn: getCategories,
        staleTime: 5 * 60 * 1000,
    });

    const categories: any[] = Array.isArray(categoriesData) ? categoriesData : (categoriesData?.data || []);
    const matchedCategory = useMemo(() => {
        if (selectedCategory === "all") return null;
        return categories.find((c) => activeTheme.matchSlug(c.name || c.slug || ""));
    }, [categories, selectedCategory, activeTheme]);

    const {
        data,
        isLoading,
        isError,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        refetch
    } = useInfiniteQuery({
        queryKey: ["all-products-infinite", selectedCategory, matchedCategory?.id],
        queryFn: async ({ pageParam }) => {
            if (matchedCategory?.id) {
                try {
                    const res = await getProductsByCategory(matchedCategory.id, pageParam as string | undefined, 40);
                    if (res?.data && res.data.length > 0) return res;
                } catch {
                    // Fall back to general products if category-specific endpoint fails
                }
            }
            return getProducts(pageParam as string | undefined, 40);
        },
        getNextPageParam: (lastPage) => lastPage?.nextCursor || undefined,
        initialPageParam: undefined,
        staleTime: 2 * 60 * 1000,
    });

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
                    fetchNextPage();
                }
            },
            { threshold: 0.1 }
        );

        if (observerTarget.current) {
            observer.observe(observerTarget.current);
        }

        return () => observer.disconnect();
    }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

    const rawProducts = data?.pages.flatMap((page) => page?.data || []) || [];

    // Filter products: if "all", show everything; if specific category, filter by category or name match
    const filteredProducts = useMemo(() => {
        if (selectedCategory === "all") return rawProducts;
        return rawProducts.filter((p: any) => {
            if (matchedCategory?.id && (p.categoryId === matchedCategory.id || p.category?.id === matchedCategory.id)) {
                return true;
            }
            const catName = p.category?.name || p.category?.slug || "";
            const prodName = p.name || "";
            return activeTheme.matchSlug(catName) || activeTheme.matchSlug(prodName);
        });
    }, [rawProducts, selectedCategory, activeTheme, matchedCategory]);

    if (isLoading) {
        return (
            <section className="space-y-4 px-4 sm:px-6 select-none pt-4">
                <div className="space-y-1">
                    <Skeleton className="w-36 h-6 bg-slate-200 dark:bg-white/10 rounded-lg" />
                    <Skeleton className="w-56 h-3.5 bg-slate-200 dark:bg-white/10 rounded-md" />
                </div>
                <div className="grid grid-cols-3 gap-2 sm:gap-3.5">
                    {[...Array(6)].map((_, i) => (
                        <div
                            key={i}
                            className="w-full h-44 rounded-2xl bg-slate-100 p-3 flex flex-col justify-between border border-slate-100 animate-pulse"
                        >
                            <Skeleton className="w-full aspect-square rounded-xl bg-slate-200" />
                            <div className="space-y-1.5 mt-2">
                                <Skeleton className="w-3/4 h-3 bg-slate-200 rounded" />
                                <Skeleton className="w-1/2 h-3 bg-slate-200 rounded" />
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        );
    }

    if (isError) {
        return (
            <div className="px-4 sm:px-6 pt-4">
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-center flex items-center justify-between">
                    <span className="text-xs font-bold text-rose-700">Failed to load {activeTheme.label.toLowerCase()} products</span>
                    <button
                        onClick={() => refetch()}
                        className="px-3 py-1 bg-rose-600 text-white rounded-lg text-xs font-bold active:scale-95 transition-all"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    // Friendly empty state when no products match the selected category
    if (filteredProducts.length === 0) {
        return (
            <section className="space-y-4 px-4 sm:px-6 select-none pt-4">
                <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-center shadow-xs">
                    <span className="text-4xl mb-3 block">{activeTheme.icon}</span>
                    <h3 className="text-base sm:text-lg font-black text-slate-800 tracking-tight">
                        Fresh {activeTheme.label} arriving soon!
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
                        We are currently harvesting and restocking our {activeTheme.label.toLowerCase()} inventory. Check back shortly or explore our other farm produce.
                    </p>
                    <button
                        onClick={() => setSelectedCategory("all")}
                        style={{ backgroundColor: activeTheme.themeColor }}
                        className="mt-4 inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-xs font-black text-white shadow-md active:scale-95 transition-all"
                    >
                        <span>Browse All Products</span>
                        <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                    </button>
                </div>
            </section>
        );
    }

    return (
        <section className="space-y-4 px-4 sm:px-6 select-none pt-4">
            {/* Header: Title & Subtitle matching the selected category */}
            <div className="flex items-end justify-between">
                <div>
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
                        {selectedCategory === "all" ? "All Products" : `${activeTheme.label} Collection`}
                    </h2>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                        {selectedCategory === "all" ? "Find your everyday essentials" : `Farm-fresh ${activeTheme.label.toLowerCase()} handpicked for you`}
                    </p>
                </div>
                <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full shadow-xs">
                    {filteredProducts.length} items
                </span>
            </div>

            {/* 3-Column Product Cards Grid (3x3 Layout) */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3.5">
                {filteredProducts.map((product: any) => (
                    <ProductCard
                        key={product.id}
                        id={product.id}
                        name={product.name}
                        images={product.images}
                        basePrice={Number(product.basePrice || 0)}
                        weight={product.weight}
                        weightUnit={product.weightUnit}
                        minQuantity={product.minQuantity}
                        maxQuantity={product.maxQuantity}
                        category={product.category}
                        inventory={product.inventory}
                        pricing={product.pricing}
                        variants={product.variants}
                        tags={product.tags}
                    />
                ))}
            </div>

            {/* Infinite Scroll Sentinel / Loading More */}
            <div ref={observerTarget} className="flex flex-col items-center justify-center pt-8 pb-12">
                {isFetchingNextPage ? (
                    <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-500/20 text-xs font-bold">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Loading more fresh items...</span>
                    </div>
                ) : hasNextPage ? (
                    <div className="w-2 h-2 rounded-full bg-emerald-500/40 animate-pulse" />
                ) : (
                    <div className="text-center py-4 space-y-1">
                        <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center mx-auto text-emerald-600">
                            <Leaf className="w-4 h-4" />
                        </div>
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                            You’ve seen the full {selectedCategory === "all" ? "collection" : activeTheme.label.toLowerCase()}
                        </p>
                    </div>
                )}
            </div>
        </section>
    );
}
