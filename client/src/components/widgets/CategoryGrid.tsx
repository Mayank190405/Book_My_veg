"use client";

import Link from "next/link";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import { getCategories } from "@/services/categoryService";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const pastelStyles = [
    { bgColor: "bg-[#eaf4ed]", borderClass: "border-[#d1e6d7]/40", textClass: "text-emerald-955" }, // Soft green
    { bgColor: "bg-[#fcf8eb]", borderClass: "border-[#f6ebcf]/40", textClass: "text-amber-955" }, // Soft gold
    { bgColor: "bg-[#edf4f8]", borderClass: "border-[#d8e7f1]/40", textClass: "text-blue-955" }, // Soft blue
    { bgColor: "bg-[#faeff2]", borderClass: "border-[#f4dae1]/40", textClass: "text-pink-955" }, // Soft pink
    { bgColor: "bg-[#f4f7f0]", borderClass: "border-[#e3ebd9]/40", textClass: "text-slate-900" }, // Soft olive
    { bgColor: "bg-[#f5f5f7]", borderClass: "border-[#e5e5eb]/40", textClass: "text-slate-800" }  // Soft grey
];

const categoryMeta: Record<string, { bgColor: string; borderClass: string; textClass: string }> = {
    "oil": { bgColor: "bg-[#fcf8eb]", borderClass: "border-[#f6ebcf]/40", textClass: "text-amber-955" },
    "grains": { bgColor: "bg-[#fcf8eb]", borderClass: "border-[#f6ebcf]/40", textClass: "text-amber-955" },
    "dairy": { bgColor: "bg-[#edf4f8]", borderClass: "border-[#d8e7f1]/40", textClass: "text-blue-955" },
    "fruits": { bgColor: "bg-[#eaf4ed]", borderClass: "border-[#d1e6d7]/40", textClass: "text-emerald-955" },
    "personal-care": { bgColor: "bg-[#faeff2]", borderClass: "border-[#f4dae1]/40", textClass: "text-rose-955" },
    "packaged-foods": { bgColor: "bg-[#f4f7f0]", borderClass: "border-[#e3ebd9]/40", textClass: "text-emerald-955" }
};

export default function CategoryGrid() {
    const { data: categories, isLoading } = useQuery({
        queryKey: ["categories"],
        queryFn: getCategories,
    });

    if (isLoading) {
        return (
            <div className="grid grid-cols-3 gap-3 px-6 py-4">
                {[...Array(6)].map((_, i) => (
                    <div key={i} className="flex flex-col items-center gap-2 p-3 rounded-2xl border border-slate-100 bg-slate-50/50">
                        <Skeleton className="w-16 h-16 rounded-full bg-slate-100" />
                        <Skeleton className="w-14 h-3 bg-slate-100 rounded" />
                    </div>
                ))}
            </div>
        );
    }

    const items = categories || [];
    if (items.length === 0) return null;

    return (
        <div className="px-6 py-4 select-none">
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-[#1c2e24]/60 mb-3 px-0.5">Shop by Category</h2>
            <div className="grid grid-cols-3 gap-3">
                {items.map((category: any, idx: number) => {
                    const slug = category.slug || "";
                    const style = categoryMeta[slug] || pastelStyles[idx % pastelStyles.length];
                    const imgUrl = category.imageUrl || "";

                    return (
                        <Link
                            key={category.id}
                            href={`/category/${category.id}`}
                            className={cn(
                                "group flex flex-col items-center justify-between p-3 rounded-2xl border shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-0.5 active:scale-95",
                                style.bgColor,
                                style.borderClass
                            )}
                        >
                            {/* Image container */}
                            <div className="relative w-16 h-16 rounded-xl overflow-hidden flex items-center justify-center bg-white/40 p-1 group-hover:bg-white/60 transition-colors">
                                <Image
                                    src={imgUrl}
                                    alt={category.name}
                                    width={64}
                                    height={64}
                                    className="object-contain transition-transform duration-500 group-hover:scale-110"
                                />
                            </div>

                            {/* Label */}
                            <span className={cn(
                                "text-[9px] font-black text-center mt-2 tracking-wide uppercase leading-tight line-clamp-2 h-[24px] flex items-center justify-center",
                                style.textClass
                            )}>
                                {category.name}
                            </span>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}
