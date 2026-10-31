"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { getTrendingProducts, getProductsByCategory } from "@/services/productService";
import { Skeleton } from "@/components/ui/skeleton";
import ProductCard from "@/components/ui/ProductCard";
import { useUserStore } from "@/store/useUserStore";
import { Sparkles, AlertCircle, PackageOpen, RotateCcw } from "lucide-react";

interface CategoryProductListingProps {
    categoryId: string | null;
    categoryName: string;
    onResetCategory: () => void;
}

export default function CategoryProductListing({
    categoryId,
    categoryName,
    onResetCategory
}: CategoryProductListingProps) {
    const { location, activeStore } = useUserStore();
    const pincode = location?.pincode;
    const lat = location?.coords?.lat;
    const lng = location?.coords?.lng;
    const locationId = activeStore?.id;

    // 1. Fetch Trending when categoryId is null, or category products when selected
    const isTrending = categoryId === null;

    const {
        data,
        isLoading,
        isError,
        refetch
    } = useQuery({
        queryKey: isTrending
            ? ["trending-products", pincode, lat, lng]
            : ["category-products", categoryId, locationId],
        queryFn: async () => {
            if (isTrending) {
                return await getTrendingProducts(pincode, lat, lng);
            } else {
                const res = await getProductsByCategory(categoryId, undefined, 30, locationId);
                return res?.data || [];
            }
        },
        staleTime: 2 * 60 * 1000,
    });

    const products: any[] = Array.isArray(data) ? data : (data?.data || []);

    // 2. Loading Skeleton State
    if (isLoading) {
        return (
            <div className="space-y-4 select-none">
                <div className="flex items-center justify-between">
                    <Skeleton className="w-44 h-7 rounded-xl bg-slate-100" />
                    <Skeleton className="w-20 h-4 rounded-md bg-slate-100" />
                </div>
                <div className="flex gap-3.5 overflow-hidden">
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="w-[155px] sm:w-[170px] h-[260px] rounded-[1.75rem] bg-slate-50 border border-slate-100 p-3 flex flex-col justify-between flex-none">
                            <Skeleton className="w-full aspect-square rounded-2xl bg-slate-200/60" />
                            <div className="space-y-2 mt-2">
                                <Skeleton className="w-3/4 h-3 bg-slate-200/60" />
                                <Skeleton className="w-1/2 h-3 bg-slate-200/60" />
                            </div>
                            <Skeleton className="w-full h-8 rounded-xl bg-slate-200/60 mt-2" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // 3. Error State with Retry
    if (isError) {
        return (
            <div className="p-6 rounded-3xl bg-rose-50/60 border border-rose-200/60 text-center space-y-3">
                <div className="flex items-center justify-center gap-2 text-rose-700 font-bold text-sm">
                    <AlertCircle className="w-4 h-4" />
                    <span>Failed to load products from server</span>
                </div>
                <p className="text-xs text-rose-600/80 max-w-sm mx-auto">
                    We encountered an issue communicating with the product catalogue.
                </p>
                <button
                    onClick={() => refetch()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs active:scale-95 transition-all"
                >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Retry Request</span>
                </button>
            </div>
        );
    }

    // 4. Empty Category State
    if (products.length === 0) {
        return (
            <div className="p-8 rounded-[2rem] bg-white border border-slate-100 text-center space-y-4 shadow-xs">
                <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto shadow-2xs">
                    <PackageOpen className="w-7 h-7 stroke-[1.75]" />
                </div>
                <div className="space-y-1">
                    <h3 className="text-base font-extrabold text-slate-800 tracking-tight">
                        No products found in {categoryName}
                    </h3>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto">
                        Items in this category might be temporarily out of stock for your selected area.
                    </p>
                </div>
                <button
                    onClick={onResetCategory}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0c392c] hover:bg-[#092b21] text-[#bef264] rounded-full text-xs font-extrabold uppercase tracking-wider shadow-sm active:scale-95 transition-all"
                >
                    <span>View All Products</span>
                </button>
            </div>
        );
    }

    // 5. Success State: Header & Product Carousel
    return (
        <div className="space-y-4 select-none">
            {/* Header: Title & Action Link */}
            <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2">
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                        {isTrending ? "You might need" : categoryName}
                    </h2>
                    {!isTrending && (
                        <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded-full uppercase tracking-wider">
                            {products.length} {products.length === 1 ? "item" : "items"}
                        </span>
                    )}
                </div>

                <Link
                    href={isTrending ? "/products" : `/category/${categoryId}`}
                    className="text-xs font-black text-[#0b5c3e] hover:text-emerald-700 dark:text-emerald-400 flex items-center gap-1 transition-colors group"
                >
                    <span>{isTrending ? "See more" : `See all in ${categoryName}`}</span>
                    <span className="transform group-hover:translate-x-0.5 transition-transform">→</span>
                </Link>
            </div>

            {/* Product Cards Snap Carousel */}
            <div className="flex overflow-x-auto gap-3.5 pb-2 scrollbar-hide snap-x">
                {products.map((product: any, idx: number) => (
                    <div
                        key={product.id}
                        className="w-[155px] sm:w-[170px] flex-none snap-start animate-fade-in"
                        style={{ animationDelay: `${idx * 40}ms` }}
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
                            badge={isTrending ? "trending" : null}
                            compact
                        />
                    </div>
                ))}
            </div>
        </div>
    );
}
