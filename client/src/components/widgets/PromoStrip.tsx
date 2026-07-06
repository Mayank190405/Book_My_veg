"use client";

import { useQuery } from "@tanstack/react-query";
import { getPageBySlug } from "@/services/pageContentService";
import { Percent, Truck } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function PromoStrip() {
    const { data: pageContent, isLoading } = useQuery({
        queryKey: ["page-content-promos"],
        queryFn: () => getPageBySlug("promos"),
    });

    if (isLoading) {
        return (
            <div className="w-full h-16 rounded-[1.5rem] bg-slate-50 border border-slate-100 flex items-center justify-between px-6">
                <Skeleton className="w-[45%] h-8 rounded-lg bg-slate-100" />
                <div className="h-8 w-px bg-slate-200" />
                <Skeleton className="w-[45%] h-8 rounded-lg bg-slate-100" />
            </div>
        );
    }

    if (!pageContent || !pageContent.content) return null;

    let promos = [];
    try {
        promos = JSON.parse(pageContent.content);
    } catch (e) {
        console.error("Error parsing promos JSON content:", e);
        return null;
    }

    if (!Array.isArray(promos) || promos.length < 2) return null;

    const promo1 = promos[0];
    const promo2 = promos[1];

    return (
        <div className="w-full py-1.5 select-none">
            <div className="w-full bg-[#f4fbf8] border border-emerald-500/10 rounded-[1.75rem] py-4 px-6 flex items-center justify-between shadow-sm">
                {/* Left Promo Item */}
                <div className="flex-1 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#0b5c3e] text-white flex items-center justify-center shadow-md shadow-emerald-950/10 shrink-0">
                        <Percent className="h-5 w-5 stroke-[2.5]" />
                    </div>
                    <div className="flex flex-col text-left leading-tight">
                        <span className="text-[11px] font-black text-emerald-950 tracking-wider uppercase leading-none">
                            {promo1.title || "FREE DELIVERY"}
                        </span>
                        <span className="text-[9px] font-bold text-emerald-800/80 mt-0.5 leading-none">
                            {promo1.subtitle || "On orders above ₹499"}
                        </span>
                    </div>
                </div>

                {/* Vertical Divider */}
                <div className="h-8 w-px bg-emerald-500/15 mx-4" />

                {/* Right Promo Item */}
                <div className="flex-1 flex items-center gap-3 justify-end">
                    <div className="w-10 h-10 rounded-full bg-[#fcf8eb] text-amber-600 flex items-center justify-center border border-amber-500/10 shrink-0">
                        <Truck className="h-5 w-5 stroke-[2.2]" />
                    </div>
                    <div className="flex flex-col text-left leading-tight flex-1 pl-1">
                        <span className="text-[11px] font-black text-emerald-950 tracking-wider uppercase leading-none">
                            {promo2.title || "EXPRESS DELIVERY"}
                        </span>
                        <span className="text-[9px] font-bold text-emerald-800/80 mt-0.5 leading-none">
                            {promo2.subtitle || "10-20 mins delivery"}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
