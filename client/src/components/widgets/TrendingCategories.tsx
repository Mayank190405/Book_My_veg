"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { getCategories } from "@/services/categoryService";
import { Skeleton } from "@/components/ui/skeleton";
import { Flame } from "lucide-react";

const CATEGORY_EMOJIS: Record<string, string> = {
    "Fruits": "🍎",
    "Vegetables": "🥦",
    "Dairy Products": "🥛",
    "Grains": "🌾",
    "Cold Pressed Oils": "🌿",
    "Cold Pressed Juices": "🥤",
    "Exotic Vegetables": "🥬",
    "Exotic Fruits": "🐉",
};

export default function TrendingCategories() {
    const { data: categories, isLoading } = useQuery({
        queryKey: ["categories"],
        queryFn: getCategories,
    });

    if (isLoading) {
        return (
            <div className="grid grid-cols-2 gap-4 px-5">
                {[...Array(4)].map((_, i) => (
                    <Skeleton key={i} className="h-28 rounded-[2rem] bg-black/5" />
                ))}
            </div>
        );
    }

    // Pick top 4 as "trending"
    const trending = categories?.slice(0, 4) || [];

    return (
        <div className="space-y-4">
            <div className="px-5 flex items-center gap-3">
                <div className="bg-orange-500/10 p-2 rounded-xl">
                    <Flame className="h-4 w-4 text-orange-600 fill-current" />
                </div>
                <h2 className="text-xl font-black text-emerald-950 tracking-tight uppercase tracking-widest leading-none">Trending Now</h2>
            </div>

            <div className="grid grid-cols-2 gap-4 px-5">
                {trending.map((category: any) => (
                    <Link
                        key={category.id}
                        href={`/category/${category.id}`}
                        className="group relative overflow-hidden h-28 bg-white/60 backdrop-blur-xl border border-black/5 rounded-[2.25rem] p-5 flex flex-col justify-between transition-all hover:shadow-lg active:scale-[0.98]"
                    >
                        <span className="text-4xl filter drop-shadow-sm group-hover:scale-110 group-hover:rotate-6 transition-transform origin-left">
                            {CATEGORY_EMOJIS[category.name] || "📦"}
                        </span>
                        <div className="flex justify-between items-end">
                            <span className="text-sm font-black text-emerald-950 tracking-tight leading-none uppercase">
                                {category.name}
                            </span>
                            <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                            </div>
                        </div>

                        {/* Decorative background element */}
                        <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/5 rounded-bl-[4rem] group-hover:scale-150 transition-transform" />
                    </Link>
                ))}
            </div>
        </div>
    );
}
