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
    // Deduplicate and strictly show maximum of 6 products
    const items = Array.from(new Map(rawItems.map((p: any) => [p.id, p])).values()).slice(0, 6);

    if (isLoading) {
        return (
            <div className="space-y-4 px-4 sm:px-6 select-none pt-2">
                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <Skeleton className="w-36 h-3 bg-slate-200" />
                        <Skeleton className="w-52 h-6 bg-slate-200" />
                    </div>
                    <Skeleton className="w-16 h-4 bg-slate-200" />
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                    {[...Array(6)].map((_, i) => (
                        <div
                            key={i}
                            className="h-[210px] rounded-xl bg-slate-100 p-2 sm:p-2.5 flex flex-col justify-between animate-pulse"
                        >
                            <Skeleton className="w-full aspect-square rounded-lg bg-slate-200" />
                            <div className="space-y-1.5 mt-2">
                                <Skeleton className="w-3/4 h-2.5 bg-slate-200" />
                                <Skeleton className="w-1/2 h-2.5 bg-slate-200" />
                            </div>
                            <Skeleton className="w-full h-7 rounded-lg bg-slate-200 mt-2" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (isError) {
        return (
            <div className="px-4 sm:px-6">
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
        <section className="space-y-3.5 px-4 sm:px-6 select-none pt-2">
            {/* Header: Recommended for You + See All Link */}
            <div className="flex items-center justify-between mb-1">
                <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                    Recommended for You
                </h2>

                <Link
                    href="/products"
                    className="inline-flex items-center gap-1 text-xs sm:text-sm font-bold text-[#087f5b] hover:text-[#056647] transition-colors"
                >
                    <span>See all</span>
                    <ArrowRight className="h-4 w-4 stroke-[2.5]" />
                </Link>
            </div>

            {/* 3-Column Product Grid (only 6 cards) */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                {items.slice(0, 6).map((product: any, idx: number) => (
                    <div
                        key={product.id}
                        className="w-full animate-fade-in"
                        style={{ animationDelay: `${idx * 30}ms` }}
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
