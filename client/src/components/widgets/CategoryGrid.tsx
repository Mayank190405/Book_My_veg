"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { getCategories } from "@/services/categoryService";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

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

export default function CategoryGrid() {
    const { data: categories, isLoading } = useQuery({
        queryKey: ["categories"],
        queryFn: getCategories,
    });

    if (isLoading) {
        return (
            <div className="flex gap-6 overflow-x-auto py-2 scrollbar-none px-5">
                {[...Array(6)].map((_, i) => (
                    <div key={i} className="flex flex-col items-center gap-2 flex-none">
                        <Skeleton className="w-16 h-16 rounded-2xl bg-black/5" />
                        <Skeleton className="w-12 h-2 bg-black/5" />
                    </div>
                ))}
            </div>
        );
    }

    // Show all categories in the main grid
    const browseAll = categories || [];

    return (
        <div className="grid grid-cols-2 gap-4">
            {browseAll.map((category: any, idx: number) => (
                <Link
                    key={category.id}
                    href={`/category/${category.id}`}
                    className="group relative overflow-hidden h-28 bg-white/60 backdrop-blur-xl border border-black/5 rounded-[2.25rem] p-5 flex flex-col justify-between transition-all hover:shadow-lg active:scale-[0.98] animate-fade-in"
                    style={{ animationDelay: `${idx * 40}ms` }}
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
    );
}
