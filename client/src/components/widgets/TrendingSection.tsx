"use client";

import { MapPin } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getTrendingProducts } from "@/services/productService";
import { Skeleton } from "@/components/ui/skeleton";
import ProductCard from "@/components/ui/ProductCard";
import { useUserStore } from "@/store/useUserStore";
import Link from "next/link";

export default function TrendingSection() {
    const { location } = useUserStore();
    const pincode = location?.pincode;

    const { data: products, isLoading } = useQuery({
        queryKey: ["trending-products", pincode],
        queryFn: () => getTrendingProducts(pincode),
        refetchInterval: 5 * 60 * 1000,
    });

    if (isLoading) {
        return (
            <div className="space-y-4">
                <Skeleton className="w-48 h-6 bg-secondary" />
                <div className="flex gap-4 overflow-hidden">
                    {[...Array(3)].map((_, i) => (
                        <Skeleton key={i} className="w-44 h-64 rounded-3xl flex-none bg-card border border-border" />
                    ))}
                </div>
            </div>
        );
    }

    if (!products || products.length === 0) return null;

    return (
        <div className="space-y-4 select-none">
            {/* Header section matching Gromuse: "You might need" & "See more ->" */}
            <div className="flex items-center justify-between pt-1">
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                    You might need
                </h2>
                <Link
                    href="/products"
                    className="text-xs font-black text-[#0b5c3e] hover:text-emerald-700 dark:text-emerald-400 flex items-center gap-1 transition-colors group"
                >
                    <span>See more</span>
                    <span className="transform group-hover:translate-x-0.5 transition-transform">→</span>
                </Link>
            </div>

            <div className="flex overflow-x-auto gap-3.5 pb-2 scrollbar-hide snap-x">
                {products.slice(0, 25).map((product: any, idx: number) => (
                    <div
                        key={product.id}
                        className="w-[150px] sm:w-[165px] flex-none snap-start animate-fade-in"
                        style={{ animationDelay: `${idx * 50}ms` }}
                    >
                        <ProductCard
                            id={product.id}
                            name={product.name}
                            images={product.images}
                            basePrice={Number(product.basePrice)}
                            weight={product.weight}
                            weightUnit={product.weightUnit}
                            inventory={product.inventory}
                            pricing={product.pricing}
                            variants={product.variants}
                            badge="trending"
                            compact
                        />
                    </div>
                ))}
            </div>
        </div>
    );
}
