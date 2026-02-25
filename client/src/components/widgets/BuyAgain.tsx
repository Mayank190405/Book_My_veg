"use client";

import { RefreshCw } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useCartStore } from "@/store/useCartStore";
import { useUserStore } from "@/store/useUserStore";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import ProductCard from "@/components/ui/ProductCard";
import { getBuyAgainProducts } from "@/services/productService";

export default function BuyAgain() {
    const { addItem, items } = useCartStore();
    const { user } = useUserStore();

    const { data: products, isLoading } = useQuery({
        queryKey: ["buy-again"],
        queryFn: getBuyAgainProducts,
        enabled: !!user,
    });

    if (!user) return null;

    if (isLoading) {
        return (
            <div className="flex gap-4 overflow-hidden py-2">
                {[...Array(2)].map((_, i) => (
                    <Skeleton key={i} className="w-44 h-64 rounded-[2.25rem] bg-white/5 flex-none" />
                ))}
            </div>
        );
    }

    if (!products || products.length === 0) return null;

    const handleReorderAll = () => {
        products.forEach((p: any) => {
            addItem({
                productId: p.id,
                name: p.name,
                price: Number(p.basePrice),
                image: p.images?.[0] ?? "",
                quantity: 1,
            });
        });
    };

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-3">
                    <div className="bg-emerald-500/10 p-2 rounded-xl">
                        <RefreshCw className="h-4 w-4 text-emerald-600" />
                    </div>
                    <h2 className="text-xl font-black text-emerald-950 tracking-tight uppercase tracking-widest leading-none">Buy it again</h2>
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleReorderAll}
                    className="text-emerald-600 hover:text-emerald-900 hover:bg-emerald-50 text-[10px] font-black uppercase tracking-widest h-8 px-4 rounded-full border border-emerald-500/10"
                >
                    Reorder All
                </Button>
            </div>

            <div className="flex overflow-x-auto gap-4 pb-4 -mx-5 px-5 scrollbar-none snap-x relative z-10">
                {products.map((product: any, idx: number) => (
                    <div
                        key={product.id}
                        className="flex-none snap-start animate-fade-in"
                        style={{ animationDelay: `${idx * 40}ms` }}
                    >
                        <ProductCard
                            id={product.id}
                            name={product.name}
                            images={product.images}
                            basePrice={Number(product.basePrice)}
                            weightUnit={product.weightUnit}
                            inventory={product.inventory}
                            pricing={product.pricing}
                            compact
                            variant="transparent"
                        />
                    </div>
                ))}
            </div>
        </div>
    );
}
