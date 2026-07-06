"use client";

import Link from "next/link";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import { getCategories } from "@/services/categoryService";
import { Skeleton } from "@/components/ui/skeleton";

const pastelStyles = [
    { bgColor: "bg-[#eaf4ed]", borderClass: "border-[#d1e6d7]/40" }, // Soft green
    { bgColor: "bg-[#fcf8eb]", borderClass: "border-[#f6ebcf]/40" }, // Soft gold
    { bgColor: "bg-[#edf4f8]", borderClass: "border-[#d8e7f1]/40" }, // Soft blue
    { bgColor: "bg-[#faeff2]", borderClass: "border-[#f4dae1]/40" }, // Soft pink
    { bgColor: "bg-[#f4f7f0]", borderClass: "border-[#e3ebd9]/40" }, // Soft olive
    { bgColor: "bg-[#f5f5f7]", borderClass: "border-[#e5e5eb]/40" }  // Soft grey
];

const categoryCircleMeta: Record<string, { bgColor: string; borderClass: string }> = {
    "oil": { bgColor: "bg-[#fcf8eb]", borderClass: "border-[#f6ebcf]/40" }, // Yellow/Gold
    "grains": { bgColor: "bg-[#fcf8eb]", borderClass: "border-[#f6ebcf]/40" }, // Gold
    "dairy": { bgColor: "bg-[#edf4f8]", borderClass: "border-[#d8e7f1]/40" }, // Blue
    "fruits": { bgColor: "bg-[#eaf4ed]", borderClass: "border-[#d1e6d7]/40" }, // Green
    "personal-care": { bgColor: "bg-[#faeff2]", borderClass: "border-[#f4dae1]/40" }, // Pink
    "packaged-foods": { bgColor: "bg-[#f4f7f0]", borderClass: "border-[#e3ebd9]/40" } // Olive
};

export default function CategoryCircles() {
    const { data: categories, isLoading } = useQuery({
        queryKey: ["categories"],
        queryFn: getCategories,
    });

    if (isLoading) {
        return (
            <div className="flex gap-5 overflow-x-auto py-2 scrollbar-none px-5">
                {[...Array(6)].map((_, i) => (
                    <div key={i} className="flex flex-col items-center gap-2 flex-none">
                        <Skeleton className="w-[72px] h-[72px] rounded-2xl bg-slate-100" />
                        <Skeleton className="w-12 h-2.5 bg-slate-100" />
                    </div>
                ))}
            </div>
        );
    }

    const items = categories || [];
    if (items.length === 0) return null;

    const displayedItems = items.slice(0, 7);
    const hasMore = items.length > 7;

    return (
        <div className="w-full py-4 select-none">
            <div className="flex overflow-x-auto gap-5 px-5 pb-2 scrollbar-none snap-x">
                {displayedItems.map((category: any, idx: number) => {
                    const slug = category.slug || "";
                    const style = categoryCircleMeta[slug] || pastelStyles[idx % pastelStyles.length];
                    const imgUrl = category.imageUrl || "";
                    
                    return (
                        <Link
                            key={category.id}
                            href={`/category/${category.id}`}
                            className="flex flex-col items-center flex-none snap-start group cursor-pointer active:scale-95 transition-all"
                            style={{ width: "80px" }}
                        >
                            {/* Outer Box Container */}
                            <div className={`w-[72px] h-[72px] rounded-2xl overflow-hidden ${style.bgColor} border ${style.borderClass} flex items-center justify-center shadow-sm group-hover:shadow-md transition-all relative`}>
                                <div className="relative w-full h-full">
                                    <Image
                                        src={imgUrl}
                                        alt={category.name}
                                        fill
                                        className="object-cover scale-100 group-hover:scale-110 transition-transform duration-500 rounded-2xl"
                                        sizes="72px"
                                    />
                                </div>
                            </div>

                            {/* Label */}
                            <span className="text-[9px] font-black text-center text-[#1c2e24]/80 mt-2.5 tracking-wider uppercase leading-tight line-clamp-2 h-[24px] max-w-[76px] group-hover:text-[#0b5c3e] transition-colors">
                                {category.name}
                            </span>
                        </Link>
                    );
                })}
                {hasMore && (
                    <Link
                        href="/products"
                        className="flex flex-col items-center flex-none snap-start group cursor-pointer active:scale-95 transition-all"
                        style={{ width: "80px" }}
                    >
                        <div className="w-[72px] h-[72px] rounded-2xl bg-emerald-600/10 border border-emerald-500/20 flex items-center justify-center shadow-sm group-hover:shadow-md group-hover:bg-emerald-600/20 transition-all">
                            <span className="text-[10px] font-black text-emerald-800 tracking-wider">ALL</span>
                        </div>
                        <span className="text-[9px] font-extrabold text-center text-emerald-800 mt-2 tracking-wide uppercase leading-tight line-clamp-2 h-[24px]">
                            See All
                        </span>
                    </Link>
                )}
            </div>
        </div>
    );
}
