"use client";

import { useState, useEffect } from "react";
import FilterContent from "./FilterContent";
import { ActiveFilters, DEFAULT_FILTERS, getActiveFilterCount } from "./FilterDrawer";
import { cn } from "@/lib/utils";
import { SlidersHorizontal } from "lucide-react";

interface DesktopSidebarProps {
    filters: ActiveFilters;
    onApply: (filters: ActiveFilters) => void;
    className?: string;
}

export default function DesktopSidebar({ filters, onApply, className }: DesktopSidebarProps) {
    const [local, setLocal] = useState<ActiveFilters>(filters);

    // Sync when filters change externally (e.g. clear all)
    useEffect(() => { setLocal(filters); }, [filters]);

    const handleApply = () => onApply(local);
    const handleClear = () => setLocal(DEFAULT_FILTERS);

    const totalActive = getActiveFilterCount(local);
    const hasChanges = JSON.stringify(local) !== JSON.stringify(filters);

    return (
        <aside className={cn("hidden lg:flex flex-col gap-4 h-fit sticky top-24", className)}>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden p-5 space-y-6">
                <div className="flex items-center gap-2 pb-4 border-b border-gray-100">
                    <SlidersHorizontal className="h-5 w-5 text-green-600" />
                    <h2 className="text-lg font-extrabold text-gray-900">Filters</h2>
                    {totalActive > 0 && (
                        <span className="ml-auto bg-green-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                            {totalActive}
                        </span>
                    )}
                </div>

                <div className="pr-1">
                    <FilterContent filters={local} onChange={setLocal} />
                </div>

                <div className="pt-4 border-t border-gray-100 flex gap-2">
                    <button
                        onClick={handleClear}
                        className="flex-1 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                        Reset
                    </button>
                    <button
                        onClick={handleApply}
                        disabled={!hasChanges}
                        className={cn(
                            "flex-1 py-2 rounded-xl text-xs font-bold shadow-sm transition-all",
                            hasChanges
                                ? "bg-green-500 hover:bg-green-600 text-white shadow-green-100"
                                : "bg-gray-100 text-gray-400 cursor-not-allowed"
                        )}
                    >
                        Apply
                    </button>
                </div>
            </div>
        </aside>
    );
}
