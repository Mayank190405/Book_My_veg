"use client";

import { useQuery } from "@tanstack/react-query";
import api from "@/services/api";
import ProductCard from "@/components/ui/ProductCard";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

export default function SimilarProducts({ productId }: { productId: string }) {
    const { data: products, isLoading } = useQuery({
        queryKey: ["similar-products", productId],
        queryFn: async () => {
            const res = await api.get(`/products/${productId}/similar`);
            return res.data;
        },
        enabled: !!productId,
    });

    if (isLoading) {
        return (
            <div className="space-y-4 py-8">
                <Skeleton className="h-6 w-48" />
                <div className="flex gap-4 overflow-hidden">
                    {[1, 2, 3, 4].map((i) => (
                        <Skeleton key={i} className="h-64 w-48 shrink-0 rounded-xl" />
                    ))}
                </div>
            </div>
        );
    }

    if (!products || products.length === 0) return null;

    return (
        <section className="py-8 border-t border-gray-100">
            <h3 className="text-xl font-bold text-gray-900 mb-6">Similar Products</h3>
            <ScrollArea className="w-full whitespace-nowrap pb-4">
                <div className="flex gap-4">
                    {products.map((product: any) => (
                        <div key={product.id} className="w-[180px] shrink-0">
                            <ProductCard {...product} compact />
                        </div>
                    ))}
                </div>
                <ScrollBar orientation="horizontal" />
            </ScrollArea>
        </section>
    );
}
