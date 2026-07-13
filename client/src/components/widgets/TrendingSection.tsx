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
            {/* Header section with Location Pin icon and SEE ALL button */}
            <div className="flex items-center justify-between px-5">
                <div className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-[#0b5c3e] fill-emerald-600/20" />
                    <h2 className="text-[17px] font-black text-[#1c2e24] tracking-wider uppercase">TRENDING NEAR YOU</h2>
                </div>
                <Link
                    href="/products"
                    className="text-[10px] font-black text-[#0b5c3e] uppercase tracking-widest border border-emerald-600/35 hover:bg-emerald-50 px-4 py-2 rounded-full transition-all active:scale-95 shadow-sm"
                >
                    SEE ALL
                </Link>
            </div>

            <div className="flex overflow-x-auto gap-4 pb-4 -mx-5 px-5 scrollbar-hide snap-x">
                {products.slice(0, 25).map((product: any, idx: number) => (
                    <div
                        key={product.id}
                        className="w-[140px] flex-none snap-start animate-fade-in"
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
