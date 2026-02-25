"use client";

import { useState, useEffect } from "react";
import { X, SlidersHorizontal, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type SortOption = "popular" | "price_asc" | "price_desc" | "newest" | "discount";

export interface ActiveFilters {
    sort: SortOption;
    minPrice: number | null;
    maxPrice: number | null;
    inStockOnly: boolean;
    minDiscount: number | null; // 0 | 10 | 25 | 50
}

export const DEFAULT_FILTERS: ActiveFilters = {
    sort: "popular",
    minPrice: null,
    maxPrice: null,
    inStockOnly: false,
    minDiscount: null,
};

export function getActiveFilterCount(filters: ActiveFilters): number {
    let count = 0;
    if (filters.sort !== "popular") count++;
    if (filters.minPrice !== null || filters.maxPrice !== null) count++;
    if (filters.inStockOnly) count++;
    if (filters.minDiscount !== null) count++;
    return count;
}

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
    { value: "popular", label: "🔥 Popularity" },
    { value: "price_asc", label: "Price: Low → High" },
    { value: "price_desc", label: "Price: High → Low" },
    { value: "newest", label: "✨ New Arrivals" },
    { value: "discount", label: "💰 Discount %" },
];

const DISCOUNT_OPTIONS = [
    { label: "10% & above", value: 10 },
    { label: "25% & above", value: 25 },
    { label: "50% & above", value: 50 },
];

interface FilterDrawerProps {
    open: boolean;
    onClose: () => void;
    filters: ActiveFilters;
    onApply: (filters: ActiveFilters) => void;
}

import FilterContent from "./FilterContent";

export default function FilterDrawer({ open, onClose, filters, onApply }: FilterDrawerProps) {
    const [local, setLocal] = useState<ActiveFilters>(filters);
    const [isMobile, setIsMobile] = useState(false);

    // Sync when filters change externally
    useEffect(() => { setLocal(filters); }, [filters]);

    // Check if mobile to allow scroll lock
    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 1024);
        checkMobile();
        window.addEventListener("resize", checkMobile);
        return () => window.removeEventListener("resize", checkMobile);
    }, []);

    // Prevent body scroll when open (only on mobile usually, or full screen drawer)
    useEffect(() => {
        if (open && isMobile) document.body.style.overflow = "hidden";
        else document.body.style.overflow = "";
        return () => { document.body.style.overflow = ""; };
    }, [open, isMobile]);

    const handleApply = () => { onApply(local); onClose(); };
    const handleClear = () => setLocal(DEFAULT_FILTERS);

    const totalActive = getActiveFilterCount(local);

    if (!open) return null;

    return (
        <>
            <div
                className="fixed inset-0 bg-black/40 z-50 backdrop-blur-sm lg:hidden"
                onClick={onClose}
            />

            <div className={cn(
                "fixed z-50 bg-white flex flex-col shadow-2xl",
                "bottom-0 left-0 right-0 rounded-t-3xl max-h-[85vh]",
                "lg:hidden",
                "animate-in slide-in-from-bottom duration-300"
            )}>
                <div className="flex justify-center pt-3 pb-1">
                    <div className="w-10 h-1 bg-gray-200 rounded-full" />
                </div>

                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                        <SlidersHorizontal className="h-5 w-5 text-green-600" />
                        <h2 className="text-lg font-extrabold text-gray-900">Sort & Filter</h2>
                        {totalActive > 0 && (
                            <span className="ml-1 bg-green-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
                                {totalActive}
                            </span>
                        )}
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
                        <X className="h-5 w-5 text-gray-500" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-4">
                    <FilterContent filters={local} onChange={setLocal} />
                </div>

                <div className="border-t border-gray-100 px-5 py-4 flex gap-3 bg-white pb-safe">
                    <button
                        onClick={handleClear}
                        className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                        Clear All
                    </button>
                    <button
                        onClick={handleApply}
                        className="flex-1 py-3 rounded-xl bg-green-500 hover:bg-green-600 text-white text-sm font-bold shadow-md shadow-green-100 transition-all active:scale-95"
                    >
                        Apply{totalActive > 0 ? ` (${totalActive})` : ""}
                    </button>
                </div>
            </div>
        </>
    );
}
