"use client";

import { useQuery } from "@tanstack/react-query";
import { getTrendingProducts } from "@/services/productService";
import { Skeleton } from "@/components/ui/skeleton";
import ProductCard from "@/components/ui/ProductCard";
import { useUserStore } from "@/store/useUserStore";
import Link from "next/link";
import { ArrowRight, AlertCircle } from "lucide-react";

export default function RecommendationSection() {
    const { location } = useUserStore();
    const pincode = location?.pincode;
    const lat = location?.coords?.lat;
    const lng = location?.coords?.lng;

    const {
        data: products,
        isLoading,
        isError,
        refetch,
    } = useQuery({
        queryKey: ["recommendations-trending", pincode, lat, lng],
        queryFn: () => getTrendingProducts(pincode, lat, lng),
        staleTime: 3 * 60 * 1000,
    });

    const rawItems: any[] = Array.isArray(products) ? products : (products?.data || []);
    // Show 3x3 layout (9 products)
    const items = Array.from(new Map(rawItems.map((p: any) => [p.id, p])).values()).slice(0, 9);

    if (isLoading) {
        return (
            <div className="space-y-3.5 px-3 sm:px-6 select-none pt-2">
                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <Skeleton className="w-36 h-3 bg-slate-200" />
                        <Skeleton className="w-52 h-6 bg-slate-200" />
                    </div>
                    <Skeleton className="w-16 h-4 bg-slate-200" />
                </div>
                {/* 3x3 Skeleton Grid (3 columns on all viewports) */}
                <div className="grid grid-cols-3 gap-2 sm:gap-3.5">
                    {[...Array(9)].map((_, i) => (
                        <div
                            key={i}
                            className="rounded-2xl border border-slate-200/80 bg-white p-2 sm:p-2.5 flex flex-col justify-between animate-pulse"
                        >
                            <Skeleton className="w-full aspect-square rounded-xl bg-slate-100" />
                            <div className="space-y-1 mt-2">
                                <Skeleton className="w-full h-3 bg-slate-200 rounded" />
                                <Skeleton className="w-2/3 h-2.5 bg-slate-200 rounded" />
                            </div>
                            <div className="flex items-center justify-between mt-2 pt-1">
                                <Skeleton className="w-10 h-4 bg-slate-200 rounded" />
                                <Skeleton className="w-12 h-6 bg-slate-200 rounded-lg" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (isError) {
        return (
            <div className="px-3 sm:px-6">
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-center flex items-center justify-between">
                    <div className="flex items-center gap-2 text-amber-800 text-xs font-bold">
                        <AlertCircle className="w-4 h-4 text-amber-600" />
                        <span>Could not refresh recommendations</span>
                    </div>
                    <button
                        onClick={() => refetch()}
                        className="px-3 py-1 bg-amber-600 text-white rounded-lg text-xs font-bold active:scale-95 transition-all"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    if (!items || items.length === 0) return null;

    return (
        <section className="space-y-3 px-3 sm:px-6 select-none pt-2">
            {/* Header: Recommended for you + See All Link */}
            <div className="flex items-center justify-between">
                <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                    Recommended for you
                </h2>

                <Link
                    href="/products"
                    className="text-xs sm:text-sm font-bold text-[#017649] hover:text-[#015f3b] flex items-center gap-1 transition-all group pb-0.5"
                >
                    <span>See all</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform stroke-[2.5]" />
                </Link>
            </div>

            {/* 3x3 Product Grid (3 columns, 9 cards total) */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3.5">
                {items.slice(0, 9).map((product: any, idx: number) => (
                    <div
                        key={product.id}
                        className="w-full animate-fade-in"
                        style={{ animationDelay: `${idx * 25}ms` }}
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
        </section>
    );
}
