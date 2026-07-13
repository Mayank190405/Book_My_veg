"use client";

import Link from "next/link";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import { getCategories } from "@/services/categoryService";
import { Skeleton } from "@/components/ui/skeleton";
import { Flame, ChevronRight } from "lucide-react";

const categoryPromoMeta: Record<string, { bgColor: string; borderColor: string }> = {
    "oil": {
        bgColor: "bg-[#eaf4ed]",
        borderColor: "border-[#d1e6d7]/30"
    },
    "grains": {
        bgColor: "bg-[#fcf8eb]",
        borderColor: "border-[#f6ebcf]/30"
    },
    "dairy": {
        bgColor: "bg-[#edf4f8]",
        borderColor: "border-[#d8e7f1]/30"
    },
    "fruits": {
        bgColor: "bg-[#faeff2]",
        borderColor: "border-[#f4dae1]/30"
    },
    "personal-care": {
        bgColor: "bg-[#faeff2]",
        borderColor: "border-[#f4dae1]/30"
    },
    "packaged-foods": {
        bgColor: "bg-[#f4f7f0]",
        borderColor: "border-[#e3ebd9]/30"
    }
};

const categoryShortNames: Record<string, string> = {
    "oil": "OIL",
    "grains": "GRAINS",
    "dairy": "DAIRY",
    "fruits": "FRUITS"
};

export default function TrendingCategories() {
    const { data: categories, isLoading } = useQuery({
        queryKey: ["categories"],
        queryFn: getCategories,
    });

    if (isLoading) {
        return (
            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <Skeleton className="w-32 h-6 bg-slate-100" />
                    <Skeleton className="w-16 h-8 bg-slate-100 rounded-full" />
                </div>
                <div className="flex gap-4 overflow-hidden">
                    {[...Array(3)].map((_, i) => (
                        <Skeleton key={i} className="w-[140px] h-[190px] rounded-3xl flex-none bg-slate-100" />
                    ))}
                </div>
            </div>
        );
    }

    const order = ["oil", "grains", "dairy", "fruits"];
    const items = categories
        ? categories
            .filter((c: any) => order.includes(c.slug.toLowerCase()))
            .sort((a: any, b: any) => order.indexOf(a.slug.toLowerCase()) - order.indexOf(b.slug.toLowerCase()))
        : [];
    if (items.length === 0) return null;

    return (
        <div className="space-y-4 select-none">
            {/* Header section with Flame icon and SEE ALL button */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Flame className="h-5 w-5 text-orange-500 fill-orange-500" />
                    <h2 className="text-[17px] font-black text-[#1c2e24] tracking-wider uppercase">TRENDING NOW</h2>
                </div>
                <Link
                    href="/categories"
                    className="text-[10px] font-black text-[#0b5c3e] uppercase tracking-widest border border-emerald-600/35 hover:bg-emerald-50 px-4 py-2 rounded-full transition-all active:scale-95 shadow-sm"
                >
                    SEE ALL
                </Link>
            </div>

            {/* Scrolling grid list of cards */}
            <div className="flex overflow-x-auto gap-4 pb-4 scrollbar-hide snap-x">
                {items.map((category: any, idx: number) => {
                    const slug = category.slug || "";
                    const meta = categoryPromoMeta[slug] || { bgColor: "bg-slate-100", borderColor: "border-slate-200/30" };
                    const imgUrl = category.imageUrl || "";

                    return (
                        <Link
                            key={category.id}
                            href={`/category/${category.id}`}
                            className={`w-[140px] flex-none snap-start group relative overflow-hidden ${meta.bgColor} border ${meta.borderColor} rounded-3xl p-3 flex flex-col justify-between transition-all hover:-translate-y-0.5 hover:shadow-md active:scale-95`}
                        >
                            {/* Upper image content */}
                            <div className="relative w-full aspect-square rounded-2xl overflow-hidden shadow-inner bg-white/20 select-none">
                                <Image
                                    src={imgUrl}
                                    alt={category.name}
                                    fill
                                    className="object-contain p-1.5 group-hover:scale-105 transition-transform duration-500 rounded-2xl"
                                    sizes="120px"
                                />
                            </div>

                            {/* Lower text and button row */}
                            <div className="flex flex-col gap-0.5 mt-1.5 z-10">
                                <span className="text-xs font-black text-[#1c2e24] tracking-wide uppercase italic">
                                    {categoryShortNames[slug] || category.name}
                                </span>
                                <span className="text-[8px] font-bold text-[#1c2e24]/60 leading-tight tracking-tight max-w-[85%] line-clamp-2 h-[22px]">
                                    {category.icon || ""}
                                </span>
                            </div>

                            {/* Sticky Chevron Button at bottom right */}
                            <div className="absolute bottom-3 right-3 w-7 h-7 rounded-full bg-[#0b5c3e] text-white flex items-center justify-center shadow-md active:scale-90 select-none">
                                <ChevronRight className="w-4 h-4 stroke-[3]" />
                            </div>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}
