"use client";

import Link from "next/link";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import { getCategories } from "@/services/categoryService";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, Sparkles, Check, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

// Curated pastel themes for each category pill
const cardStyles = [
    { bg: "bg-[#eef7f2]", border: "border-[#d8ede1]", textAccent: "text-[#0c4a34]", sub: "Local market" },
    { bg: "bg-[#fdf7ee]", border: "border-[#f7ebd4]", textAccent: "text-[#8a5d13]", sub: "Daily delivery" },
    { bg: "bg-[#edf5fb]", border: "border-[#d8eaf5]", textAccent: "text-[#1a5b8c]", sub: "Chemical free" },
    { bg: "bg-[#faeff3]", border: "border-[#f5dae3]", textAccent: "text-[#8c234a]", sub: "Organic fresh" },
    { bg: "bg-[#f5f8ed]", border: "border-[#e5edd3]", textAccent: "text-[#4b6b19]", sub: "Morning harvest" },
    { bg: "bg-[#f4f4f7]", border: "border-[#e2e2ea]", textAccent: "text-[#4a4a5a]", sub: "Pantry pick" },
];

interface CategoryCardsRowProps {
    selectedCategoryId?: string | null;
    onSelectCategory?: (categoryId: string | null, categoryName: string) => void;
}

export default function CategoryCardsRow({
    selectedCategoryId = null,
    onSelectCategory
}: CategoryCardsRowProps) {
    const { data: categories, isLoading, isError, refetch } = useQuery({
        queryKey: ["categories"],
        queryFn: getCategories,
        staleTime: 5 * 60 * 1000,
    });

    if (isLoading) {
        return (
            <div className="w-full px-4 sm:px-6">
                <div className="flex gap-3 overflow-hidden">
                    {[...Array(6)].map((_, i) => (
                        <Skeleton key={i} className="w-44 h-22 rounded-2xl bg-slate-100 dark:bg-emerald-950/20 flex-none" />
                    ))}
                </div>
            </div>
        );
    }

    if (isError) {
        return (
            <div className="w-full px-4 sm:px-6">
                <div className="flex items-center justify-between p-3.5 bg-rose-50 border border-rose-200/60 rounded-2xl text-rose-800 text-xs">
                    <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-rose-600" />
                        <span>Failed to load categories from server.</span>
                    </div>
                    <button
                        onClick={() => refetch()}
                        className="px-3 py-1 bg-rose-600 text-white rounded-lg font-bold text-[10px] uppercase tracking-wider hover:bg-rose-700 active:scale-95 transition-all"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    const items = categories || [];
    if (items.length === 0) return null;

    const handleSelect = (e: React.MouseEvent<HTMLButtonElement>, id: string | null, name: string) => {
        // Move clicked element toward the center of the carousel
        e.currentTarget.scrollIntoView({
            behavior: "smooth",
            inline: "center",
            block: "nearest"
        });

        if (onSelectCategory) {
            onSelectCategory(id, name);
        }
    };

    return (
        <div className="w-full px-4 sm:px-6 select-none">
            <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-hide snap-x">
                {/* 1. "All" Pill Category */}
                <button
                    onClick={(e) => handleSelect(e, null, "All Products")}
                    className={cn(
                        "flex items-center justify-between min-w-[140px] sm:min-w-[160px] h-[84px] px-4 py-3 rounded-2xl transition-all duration-300 hover:-translate-y-0.5 active:scale-95 snap-start group flex-none cursor-pointer text-left",
                        selectedCategoryId === null
                            ? "bg-[#0c392c] text-white border-2 border-[#bef264] shadow-md shadow-emerald-950/20"
                            : "bg-[#eef7f2] border border-[#d8ede1] text-slate-800 hover:shadow-md"
                    )}
                >
                    <div className="flex flex-col justify-center pr-2">
                        <h3 className={cn(
                            "font-extrabold text-xs sm:text-[13px] tracking-tight leading-tight line-clamp-1",
                            selectedCategoryId === null ? "text-white" : "text-slate-800 group-hover:text-emerald-700"
                        )}>
                            All Fresh
                        </h3>
                        <span className={cn(
                            "text-[10px] font-semibold tracking-wide mt-1 line-clamp-1",
                            selectedCategoryId === null ? "text-[#bef264]" : "text-slate-400"
                        )}>
                            Trending picks
                        </span>
                    </div>

                    <div className={cn(
                        "relative w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-2xs border transition-all",
                        selectedCategoryId === null
                            ? "bg-[#bef264] text-[#083324] border-[#bef264]"
                            : "bg-white/80 text-emerald-800 border-white"
                    )}>
                        {selectedCategoryId === null ? (
                            <Check className="w-5 h-5 stroke-[3]" />
                        ) : (
                            <Sparkles className="w-5 h-5 text-emerald-700" />
                        )}
                    </div>
                </button>

                {/* 2. Backend Live Categories */}
                {items.map((cat: any, idx: number) => {
                    const isSelected = selectedCategoryId === cat.id;
                    const style = cardStyles[idx % cardStyles.length];
                    const subtitle = cat.description || style.sub;

                    return (
                        <button
                            key={cat.id}
                            onClick={(e) => handleSelect(e, cat.id, cat.name)}
                            className={cn(
                                `flex items-center justify-between min-w-[170px] sm:min-w-[190px] h-[84px] px-4 py-3 rounded-2xl border transition-all duration-300 hover:-translate-y-0.5 active:scale-95 snap-start group flex-none cursor-pointer text-left`,
                                isSelected
                                    ? "bg-[#0c392c] text-white border-2 border-[#bef264] shadow-md shadow-emerald-950/20"
                                    : `${style.bg} ${style.border} hover:shadow-md`
                            )}
                        >
                            <div className="flex flex-col justify-center pr-2">
                                <h3 className={cn(
                                    "font-extrabold text-xs sm:text-[13px] tracking-tight leading-tight line-clamp-1",
                                    isSelected ? "text-white" : "text-slate-800 group-hover:text-emerald-700"
                                )}>
                                    {cat.name}
                                </h3>
                                <span className={cn(
                                    "text-[10px] font-semibold tracking-wide mt-1 line-clamp-1",
                                    isSelected ? "text-[#bef264]" : "text-slate-400"
                                )}>
                                    {subtitle}
                                </span>
                            </div>

                            <div className={cn(
                                "relative w-12 h-12 rounded-xl overflow-hidden flex items-center justify-center shrink-0 border transition-all",
                                isSelected
                                    ? "bg-white/95 border-[#bef264] shadow-xs"
                                    : "bg-white/80 border-white/80 shadow-2xs"
                            )}>
                                {cat.imageUrl ? (
                                    <Image
                                        src={cat.imageUrl}
                                        alt={cat.name}
                                        fill
                                        className="object-cover p-1 group-hover:scale-110 transition-transform duration-300"
                                        sizes="48px"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-xs font-black text-emerald-800">
                                        🌱
                                    </div>
                                )}
                            </div>
                        </button>
                    );
                })}

                {/* 3. "See all" card linking to /categories */}
                <Link
                    href="/categories"
                    className="flex flex-col items-center justify-center min-w-[90px] h-[84px] px-3 rounded-2xl bg-[#c5ef82] hover:bg-[#b5e46f] text-[#083324] border border-[#b2e566] shadow-sm hover:shadow-md transition-all duration-300 active:scale-95 snap-start group flex-none cursor-pointer"
                >
                    <div className="w-8 h-8 rounded-full bg-[#083324] text-white flex items-center justify-center mb-1 group-hover:scale-110 transition-transform shadow-xs">
                        <ArrowRight className="w-4 h-4 stroke-[3]" />
                    </div>
                    <span className="text-[11px] font-black uppercase tracking-wider">
                        See all
                    </span>
                </Link>
            </div>
        </div>
    );
}
