"use client";

import { Flame } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getTrendingProducts } from "@/services/productService";
import { Skeleton } from "@/components/ui/skeleton";
import ProductCard from "@/components/ui/ProductCard";
import { useUserStore } from "@/store/useUserStore";

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
                <Skeleton className="w-48 h-6 bg-white/5" />
                <div className="flex gap-4 overflow-hidden">
                    {[...Array(3)].map((_, i) => (
                        <Skeleton key={i} className="w-44 h-64 rounded-[2rem] flex-none bg-white/5" />
                    ))}
                </div>
            </div>
        );
    }

    if (!products || products.length === 0) return null;

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-3">
                    <div className="bg-orange-500/10 p-2 rounded-xl border border-orange-500/10">
                        <Flame className="h-5 w-5 text-orange-600 fill-current" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-emerald-950 tracking-tight">
                            Trending {pincode ? "Near You" : "Now"}
                        </h2>
                        <p className="text-[10px] text-emerald-900/40 font-black tracking-[0.2em] uppercase">
                            Popular choices {pincode && `in ${pincode}`}
                        </p>
                    </div>
                </div>
                <button className="text-[10px] font-black text-emerald-600 uppercase tracking-widest hover:underline bg-emerald-50 px-3 py-1 rounded-full border border-emerald-500/10">See All</button>
            </div>

            <div className="flex overflow-x-auto gap-4 pb-4 -mx-5 px-5 scrollbar-none snap-x">
                {products.slice(0, 10).map((product: any, idx: number) => (
                    <div
                        key={product.id}
                        className="flex-none snap-start animate-fade-in"
                        style={{ animationDelay: `${idx * 50}ms` }}
                    >
                        <ProductCard
                            id={product.id}
                            name={product.name}
                            images={product.images}
                            basePrice={Number(product.basePrice)}
                            weightUnit={product.weightUnit}
                            inventory={product.inventory}
                            pricing={product.pricing}
                            badge="trending"
                            compact
                            variant="transparent"
                        />
                    </div>
                ))}
            </div>
        </div>
    );
}
