"use client";

import Image from "next/image";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { getCategories } from "@/services/categoryService";
import { ArrowRight, Leaf } from "lucide-react";

// Soft pastel tint palettes matching the reference screenshot
const pastelBgs = [
    "bg-[#eef7f2]", // Vegetables (soft green)
    "bg-[#fefce8]", // Fruits (soft yellow)
    "bg-[#f0f9ff]", // Dairy (soft sky blue)
    "bg-[#f0fdf4]", // Essentials (soft mint)
    "bg-[#fff7ed]", // Snacks (soft peach)
    "bg-[#faf5ff]", // Exotic (soft purple)
    "bg-[#fdf2f8]", // Leafy (soft pink)
    "bg-[#f5f8ed]", // Organic (soft sage)
];

export default function EditorialCategoryGrid() {
    const { data, isLoading, isError, refetch } = useQuery({
        queryKey: ["categories"],
        queryFn: getCategories,
        staleTime: 5 * 60 * 1000,
    });

    const raw = Array.isArray(data) ? data : data?.data || [];
    const categories = raw.slice(0, 5); // 5 primary categories displayed matching reference

    return (
        <section className="px-4 sm:px-6 select-none" aria-label="Shop by category">
            {/* Header: Shop by Category & See all → */}
            <div className="mb-3.5 sm:mb-4 flex items-center justify-between">
                <h2 className="text-lg sm:text-xl font-black tracking-tight text-slate-900">
                    Shop by Category
                </h2>
                <Link
                    href="/categories"
                    className="inline-flex items-center gap-1 text-xs sm:text-sm font-bold text-[#087f5b] hover:text-[#056647] transition-colors"
                >
                    <span>See all</span>
                    <ArrowRight className="h-4 w-4 stroke-[2.5]" />
                </Link>
            </div>

            {isLoading ? (
                <div className="grid grid-cols-5 gap-2.5 sm:gap-4">
                    {Array.from({ length: 5 }, (_, i) => (
                        <div key={i} className="flex flex-col items-center gap-2">
                            <div className="aspect-square w-full rounded-2xl sm:rounded-3xl bg-slate-100 animate-pulse" />
                            <div className="h-3 w-12 bg-slate-100 rounded-full animate-pulse" />
                        </div>
                    ))}
                </div>
            ) : isError ? (
                <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 text-xs">
                    <p className="text-slate-600">Could not load categories</p>
                    <button
                        onClick={() => refetch()}
                        className="font-bold text-[#087f5b] hover:underline"
                    >
                        Retry
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-5 gap-2.5 sm:gap-4">
                    {categories.map((category: any, idx: number) => {
                        const bgClass = pastelBgs[idx % pastelBgs.length];
                        return (
                            <Link
                                key={category.id}
                                href={`/category/${category.id}`}
                                className="group flex flex-col items-center text-center active:scale-95 transition-transform"
                            >
                                <div
                                    className={`relative aspect-square w-full rounded-2xl sm:rounded-3xl ${bgClass} flex items-center justify-center p-2.5 sm:p-4 shadow-[0_2px_8px_rgba(0,0,0,0.03)] border border-black/5 transition-transform duration-300 group-hover:scale-105`}
                                >
                                    {category.imageUrl ? (
                                        <Image
                                            src={category.imageUrl}
                                            alt={category.name}
                                            fill
                                            sizes="(max-width: 640px) 20vw, 120px"
                                            className="object-contain p-2 sm:p-3 drop-shadow-sm transition-transform duration-300 group-hover:scale-110"
                                        />
                                    ) : (
                                        <Leaf className="h-7 w-7 text-[#087f5b]" />
                                    )}
                                </div>
                                <span className="mt-2 line-clamp-1 text-xs sm:text-sm font-bold text-slate-800 group-hover:text-[#087f5b] transition-colors leading-tight">
                                    {category.name}
                                </span>
                            </Link>
                        );
                    })}
                </div>
            )}
        </section>
    );
}
