"use client";

import { useQuery } from "@tanstack/react-query";
import { getProducts } from "@/services/productService";
import { Skeleton } from "@/components/ui/skeleton";
import ProductCard from "@/components/ui/ProductCard";
import SectionHeader from "@/components/ui/SectionHeader";
import { Sparkles } from "lucide-react";

export default function NewArrivals() {
    const { data: products, isLoading } = useQuery({
        queryKey: ["new-arrivals"],
        queryFn: () => getProducts(undefined, 8),
    });

    if (isLoading) {
        return (
            <div className="space-y-4">
                <Skeleton className="w-48 h-8 rounded-lg" />
                <div className="flex gap-4 overflow-hidden py-2">
                    {[...Array(4)].map((_, i) => (
                        <Skeleton key={i} className="w-44 h-64 rounded-[2.25rem]" />
                    ))}
                </div>
            </div>
        );
    }

    if (!products?.data || products.data.length === 0) return null;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-3">
                    <div className="bg-emerald-500/10 p-2 rounded-xl">
                        <Sparkles className="h-4 w-4 text-emerald-600" />
                    </div>
                    <h2 className="text-xl font-black text-emerald-950 tracking-tight uppercase tracking-widest">Newly Added</h2>
                </div>
                <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 px-3 py-1 rounded-full border border-emerald-500/10">Fresh</span>
            </div>

            <div className="flex overflow-x-auto gap-4 pb-4 -mx-5 px-5 scrollbar-hide snap-x">
                {products.data.map((product: any) => (
                    <ProductCard
                        key={product.id}
                        id={product.id}
                        name={product.name}
                        images={product.images}
                        basePrice={Number(product.basePrice)}
                        weightUnit={product.weightUnit}
                        inventory={product.inventory}
                        pricing={product.pricing}
                        compact
                    />
                ))}
            </div>
        </div>
    );
}
