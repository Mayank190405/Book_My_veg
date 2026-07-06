"use client";

import Image from "next/image";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { getCategories } from "@/services/categoryService";
import { Skeleton } from "@/components/ui/skeleton";
import SearchBar from "@/components/features/SearchBar";
import { cn } from "@/lib/utils";

export default function CategoriesPage() {
    const { data: categories, isLoading } = useQuery({
        queryKey: ["categories"],
        queryFn: getCategories,
    });

    return (
        <div className="pb-36 px-5 max-w-2xl mx-auto scrollbar-hide">
            {/* Search Bar Section */}
            <div className="mb-6 mt-4 w-full">
                <SearchBar />
            </div>

            {/* Grid Section */}
            {isLoading ? (
                <div className="grid grid-cols-4 gap-3">
                    {[...Array(12)].map((_, i) => (
                        <div key={i} className="flex flex-col items-center p-2.5 rounded-3xl border border-slate-100/50 bg-white shadow-xs">
                            <Skeleton className="w-full aspect-square rounded-full bg-slate-100" />
                            <Skeleton className="w-10 h-2 bg-slate-100 rounded mt-2" />
                        </div>
                    ))}
                </div>
            ) : !categories || categories.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4 text-slate-300">
                    <div className="w-16 h-16 bg-white border border-slate-100 rounded-3xl flex items-center justify-center">
                        <span className="text-2xl">📦</span>
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-widest">No categories found</p>
                </div>
            ) : (
                <div className="grid grid-cols-4 gap-3">
                    {categories.map((cat: any) => (
                        <Link
                            key={cat.id}
                            href={`/category/${cat.id}`}
                            className="group flex flex-col items-center justify-between p-2.5 rounded-3xl border border-slate-100 bg-white shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 active:scale-95"
                        >
                            {/* Circular Image Container */}
                            <div className="relative w-full aspect-square rounded-full overflow-hidden bg-slate-50/50 flex items-center justify-center p-0.5 border border-slate-100/30">
                                {cat.imageUrl ? (
                                    <Image
                                        src={cat.imageUrl}
                                        alt={cat.name}
                                        fill
                                        className="object-cover transition-transform duration-500 group-hover:scale-110 rounded-full"
                                        sizes="(max-width: 768px) 80px, 120px"
                                    />
                                ) : (
                                    <span className="text-xl">📦</span>
                                )}
                            </div>

                            {/* Label */}
                            <span className="text-[9px] font-black text-center text-[#1c2e24] mt-2 tracking-wide uppercase leading-tight line-clamp-2 h-[22px] flex items-center justify-center group-hover:text-emerald-700 transition-colors">
                                {cat.name}
                            </span>
                        </Link>
                    ))}
                </div>
            )}

            {/* Quality Promise Promotional Banner */}
            {!isLoading && categories && categories.length > 0 && (
                <div className="relative mt-8 rounded-[2rem] overflow-hidden bg-[#f0fcf6] border border-emerald-500/10 p-5 flex items-center justify-between shadow-sm">
                    <div className="space-y-2.5 z-10 flex-1 pr-2">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 text-[9px] font-black uppercase rounded-full tracking-wider">
                            <svg className="w-3.5 h-3.5 fill-current text-emerald-600" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            100% Original
                        </div>
                        <h3 className="text-[13px] font-black text-[#023324] uppercase tracking-wider leading-snug">
                            Premium Quality Products<br />Delivered to You
                        </h3>
                    </div>
                    <div className="relative w-28 h-20 shrink-0 select-none">
                        <Image
                            src="/images/fresh_produce_banner.png"
                            alt="Fresh organic produce basket"
                            fill
                            className="object-contain"
                            sizes="125px"
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
