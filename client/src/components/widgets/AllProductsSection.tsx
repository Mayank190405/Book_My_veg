"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { getProducts } from "@/services/productService";
import { Skeleton } from "@/components/ui/skeleton";
import ProductCard from "@/components/ui/ProductCard";
import { useEffect, useRef } from "react";
import { Loader2, Leaf } from "lucide-react";

export default function AllProductsSection() {
    const observerTarget = useRef<HTMLDivElement>(null);

    const {
        data,
        isLoading,
        isError,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        refetch
    } = useInfiniteQuery({
        queryKey: ["all-products-infinite"],
        queryFn: ({ pageParam }) => getProducts(pageParam as string | undefined, 30),
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

    if (isLoading) {
        return (
            <section className="space-y-4 px-4 sm:px-6 select-none pt-4">
                <div className="space-y-1">
                    <Skeleton className="w-36 h-6 bg-slate-200 dark:bg-white/10 rounded-lg" />
                    <Skeleton className="w-56 h-3.5 bg-slate-200 dark:bg-white/10 rounded-md" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                    {[...Array(6)].map((_, i) => (
                        <div
                            key={i}
                            className="w-full h-32 rounded-2xl bg-slate-100 dark:bg-white/5 p-4 flex items-center justify-between border border-slate-100 dark:border-white/5 animate-pulse"
                        >
                            <div className="space-y-2.5 w-1/2">
                                <Skeleton className="w-16 h-3 bg-slate-200 dark:bg-white/10 rounded" />
                                <Skeleton className="w-3/4 h-4 bg-slate-200 dark:bg-white/10 rounded" />
                                <Skeleton className="w-1/3 h-3 bg-slate-200 dark:bg-white/10 rounded" />
                                <Skeleton className="w-20 h-5 bg-slate-200 dark:bg-white/10 rounded" />
                            </div>
                            <Skeleton className="w-28 h-28 rounded-2xl bg-slate-200 dark:bg-white/10 shrink-0" />
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
                    <span className="text-xs font-bold text-rose-700">Failed to load catalogue products</span>
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

    const allProducts = data?.pages.flatMap((page) => page?.data || []) || [];
    if (allProducts.length === 0) return null;

    return (
        <section className="space-y-4 px-4 sm:px-6 select-none pt-4">
            {/* Header: Title & Subtitle */}
            <div className="flex items-end justify-between">
                <div>
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
                        All Products
                    </h2>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                        Find your everyday essentials
                    </p>
                </div>
                <span className="text-[11px] font-bold text-slate-400 bg-slate-100 dark:bg-white/10 px-2.5 py-1 rounded-full">
                    {allProducts.length} items
                </span>
            </div>

            {/* List Format: Left details, Right Image with ADD button (Zomato Style) */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {allProducts.map((product: any) => (
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
                    <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 text-xs font-bold">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Loading more fresh items...</span>
                    </div>
                ) : hasNextPage ? (
                    <div className="w-2 h-2 rounded-full bg-emerald-500/40 animate-pulse" />
                ) : (
                    <div className="text-center py-4 space-y-1">
                        <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center mx-auto text-emerald-600">
                            <Leaf className="w-4 h-4" />
                        </div>
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                            You’ve seen the full collection
                        </p>
                    </div>
                )}
            </div>
        </section>
    );
}
