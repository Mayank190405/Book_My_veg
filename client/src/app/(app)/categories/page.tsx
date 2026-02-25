"use client";

import Image from "next/image";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { getCategories } from "@/services/categoryService";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronRight, LayoutGrid } from "lucide-react";

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

export default function CategoriesPage() {
    const { data: categories, isLoading } = useQuery({
        queryKey: ["categories"],
        queryFn: getCategories,
    });

    return (
        <div className="pb-32 px-5 pt-20">
            <div className="mb-8 px-1">
                <h1 className="text-2xl font-black text-emerald-950 tracking-tight flex items-center gap-3 uppercase tracking-widest leading-none">
                    All Categories 📦
                </h1>
                <p className="text-[10px] font-bold text-emerald-950/40 uppercase tracking-widest mt-2">Explore our entire collection</p>
            </div>

            {isLoading ? (
                <div className="grid grid-cols-2 gap-4">
                    {[...Array(10)].map((_, i) => (
                        <Skeleton key={i} className="h-28 rounded-[2.25rem] bg-white/60 blur-sm" />
                    ))}
                </div>
            ) : !categories || categories.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 gap-3 text-emerald-950/20">
                    <LayoutGrid className="h-12 w-12 opacity-30" />
                    <p className="text-sm font-black uppercase tracking-widest">No categories yet</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-4">
                    {categories.map((cat: any, idx: number) => (
                        <Link
                            key={cat.id}
                            href={`/category/${cat.id}`}
                            className="group relative overflow-hidden h-28 bg-white/60 backdrop-blur-xl border border-black/5 rounded-[2.25rem] p-5 flex flex-col justify-between transition-all hover:shadow-lg active:scale-[0.98] animate-fade-in"
                            style={{ animationDelay: `${idx * 40}ms` }}
                        >
                            <span className="text-4xl filter drop-shadow-sm group-hover:scale-110 group-hover:rotate-6 transition-transform origin-left">
                                {CATEGORY_EMOJIS[cat.name] || "📦"}
                            </span>
                            <div className="flex justify-between items-end">
                                <span className="text-sm font-black text-emerald-950 tracking-tight leading-none uppercase">
                                    {cat.name}
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
            )}
        </div>
    );
}
