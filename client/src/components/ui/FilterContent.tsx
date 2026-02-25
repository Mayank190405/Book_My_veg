"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { ActiveFilters, SortOption } from "./FilterDrawer";

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

interface FilterContentProps {
    filters: ActiveFilters;
    onChange: (filters: ActiveFilters) => void;
}

export default function FilterContent({ filters, onChange }: FilterContentProps) {
    const update = (patch: Partial<ActiveFilters>) => {
        onChange({ ...filters, ...patch });
    };

    return (
        <div className="space-y-6">
            {/* Sort */}
            <section>
                <h3 className="text-sm font-bold text-gray-700 mb-3">Sort by</h3>
                <div className="space-y-2">
                    {SORT_OPTIONS.map((opt) => (
                        <button
                            key={opt.value}
                            onClick={() => update({ sort: opt.value })}
                            className={cn(
                                "w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-medium transition-all text-left",
                                filters.sort === opt.value
                                    ? "border-green-400 bg-green-50 text-green-700"
                                    : "border-gray-100 bg-gray-50 text-gray-600 hover:border-gray-200"
                            )}
                        >
                            {opt.label}
                            {filters.sort === opt.value && <Check className="h-4 w-4 text-green-600" />}
                        </button>
                    ))}
                </div>
            </section>

            {/* Price Range */}
            <section>
                <h3 className="text-sm font-bold text-gray-700 mb-3">Price Range (₹)</h3>
                <div className="flex items-center gap-3">
                    <div className="flex-1">
                        <label className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">Min</label>
                        <input
                            type="number"
                            placeholder="0"
                            value={filters.minPrice ?? ""}
                            onChange={(e) => update({ minPrice: e.target.value ? Number(e.target.value) : null })}
                            className="mt-1 w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                            min={0}
                        />
                    </div>
                    <div className="mt-4 text-gray-300 font-medium">—</div>
                    <div className="flex-1">
                        <label className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">Max</label>
                        <input
                            type="number"
                            placeholder="Any"
                            value={filters.maxPrice ?? ""}
                            onChange={(e) => update({ maxPrice: e.target.value ? Number(e.target.value) : null })}
                            className="mt-1 w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                            min={0}
                        />
                    </div>
                </div>
            </section>

            {/* Discount */}
            <section>
                <h3 className="text-sm font-bold text-gray-700 mb-3">Minimum Discount</h3>
                <div className="flex flex-wrap gap-2">
                    {DISCOUNT_OPTIONS.map((opt) => (
                        <button
                            key={opt.value}
                            onClick={() => update({
                                minDiscount: filters.minDiscount === opt.value ? null : opt.value,
                            })}
                            className={cn(
                                "px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all",
                                filters.minDiscount === opt.value
                                    ? "bg-green-500 text-white border-green-500"
                                    : "bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-300"
                            )}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </section>

            {/* Availability */}
            <section>
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-bold text-gray-700">In Stock Only</h3>
                        <p className="text-xs text-gray-400 mt-0.5">Hide out-of-stock products</p>
                    </div>
                    <button
                        onClick={() => update({ inStockOnly: !filters.inStockOnly })}
                        className={cn(
                            "relative w-11 h-6 rounded-full transition-colors duration-200",
                            filters.inStockOnly ? "bg-green-500" : "bg-gray-200"
                        )}
                        role="switch"
                        aria-checked={filters.inStockOnly}
                    >
                        <span className={cn(
                            "absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-all duration-200",
                            filters.inStockOnly && "translate-x-5"
                        )} />
                    </button>
                </div>
            </section>
        </div>
    );
}
