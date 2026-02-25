"use client";

import { useQuery } from "@tanstack/react-query";
import { getProducts } from "@/services/productService";
import { Skeleton } from "@/components/ui/skeleton";
import ProductCard from "@/components/ui/ProductCard";
import { ChevronRight } from "lucide-react";
import Link from "next/link";

interface ProductShelfProps {
    title: string;
    subtitle?: string;
    queryKey: string;
    queryFn: () => Promise<any>;
    href?: string;
    icon?: React.ReactNode;
}

export default function ProductShelf({ title, subtitle, queryKey, queryFn, href = "#", icon }: ProductShelfProps) {
    const { data: products, isLoading } = useQuery({
        queryKey: [queryKey],
        queryFn,
    });

    if (isLoading) {
        return (
            <div className="space-y-4">
                <div className="flex justify-between items-end px-1">
                    <Skeleton className="w-48 h-8 rounded-lg" />
                    <Skeleton className="w-16 h-4 rounded-md" />
                </div>
                <div className="flex gap-4 overflow-hidden py-2">
                    {[...Array(3)].map((_, i) => (
                        <Skeleton key={i} className="w-44 h-64 rounded-[2.25rem]" />
                    ))}
                </div>
            </div>
        );
    }

    const items = products?.data || products || [];
    if (!items || items.length === 0) return null;

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-3">
                    {icon && (
                        <div className="bg-emerald-500/10 p-2 rounded-xl border border-emerald-500/10">
                            {icon}
                        </div>
                    )}
                    <div>
                        <h2 className="text-xl font-black text-emerald-950 tracking-tight uppercase tracking-widest leading-none">{title}</h2>
                        {subtitle && <p className="text-[10px] text-emerald-900/40 font-black tracking-[0.2em] uppercase mt-1">{subtitle}</p>}
                    </div>
                </div>
                <Link href={href} className="group flex items-center gap-1.5 text-emerald-600 transition-all hover:gap-2">
                    <span className="text-[10px] font-black uppercase tracking-widest bg-emerald-50 px-3 py-1 rounded-full border border-emerald-500/10">Explore</span>
                    <ChevronRight className="h-4 w-4" />
                </Link>
            </div>

            <div className="flex overflow-x-auto gap-4 pb-4 -mx-5 px-5 scrollbar-hide snap-x">
                {items.slice(0, 10).map((product: any) => (
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
