"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getProducts } from "@/services/productService";
import { getCategories } from "@/services/categoryService";
import ProductCard from "@/components/ui/ProductCard";
import { Search, SlidersHorizontal, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUserStore } from "@/store/useUserStore";
import SearchInput from "@/components/ui/SearchInput";

import { Suspense } from "react";

function SearchContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const query = searchParams.get("q") ?? "";

    const [inputValue, setInputValue] = useState(query);
    const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
    const [sort, setSort] = useState<"default" | "price_asc" | "price_desc">("default");

    // Keep input in sync when URL changes (e.g. voice search from header)
    useEffect(() => { setInputValue(query); }, [query]);

    // Check if hydration is complete for Zustand persistence
    const { recentSearches: recent, clearRecentSearches: clear, addRecentSearch, _hasHydrated } = useUserStore();

    const handleSearch = (term: string) => {
        const t = term.trim();
        if (t) {
            addRecentSearch(t);
            router.push(`/search?q=${encodeURIComponent(t)}`);
        } else {
            router.push("/search");
        }
    };

    const { data: allProducts } = useQuery({
        queryKey: ["all-products"],
        queryFn: () => getProducts(undefined, 100),
        staleTime: 5 * 60 * 1000,
    });

    const { data: categories } = useQuery({
        queryKey: ["categories"],
        queryFn: getCategories,
    });

    // Filter & sort — use inputValue for live search (no Enter required)
    const activeSearch = inputValue.trim();
    const results = (allProducts?.data ?? [])
        .filter((p: any) => {
            const matchesQuery = !activeSearch || p.name.toLowerCase().includes(activeSearch.toLowerCase()) || p.description?.toLowerCase().includes(activeSearch.toLowerCase());
            const matchesCategory = !activeCategoryId || p.categoryId === activeCategoryId;
            return matchesQuery && matchesCategory;
        })
        .sort((a: any, b: any) => {
            if (sort === "price_asc") return Number(a.basePrice) - Number(b.basePrice);
            if (sort === "price_desc") return Number(b.basePrice) - Number(a.basePrice);
            return 0;
        });

    const hasQuery = activeSearch.length > 0;

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") handleSearch(inputValue);
    };


    if (!_hasHydrated) {
        return <div className="min-h-screen bg-gray-50 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
        </div>;
    }

    return (
        <div className="pb-32">
            {/* Search input on the page itself */}
            <div className="sticky top-0 z-20 bg-white/60 backdrop-blur-xl px-5 py-4 border-b border-black/5 shadow-sm">
                <div className="relative max-w-2xl mx-auto flex items-center gap-3">
                    <button
                        onClick={() => router.back()}
                        className="p-2.5 rounded-xl bg-white border border-black/5 shadow-sm text-emerald-900 shrink-0"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </button>
                    <div className="flex-1">
                        <SearchInput
                            value={inputValue}
                            onChange={setInputValue}
                            onSearch={handleSearch}
                            autoFocus={!query}
                            className="w-full"
                        />
                    </div>
                </div>
            </div>

            {/* Category chips */}
            <div className="sticky top-[73px] z-10 bg-white/40 backdrop-blur-md border-b border-black/5 px-4 py-3 shadow-sm">
                {categories && categories.length > 0 && (
                    <div className="flex overflow-x-auto gap-2 scrollbar-hide">
                        <button
                            onClick={() => setActiveCategoryId(null)}
                            className={cn(
                                "flex-none text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl border transition-all whitespace-nowrap shadow-sm",
                                !activeCategoryId
                                    ? "bg-emerald-600 text-white border-emerald-600 shadow-emerald-200/50"
                                    : "bg-white text-emerald-950/40 border-black/5 hover:border-emerald-300"
                            )}
                        >
                            All
                        </button>
                        {categories.map((cat: any) => (
                            <button
                                key={cat.id}
                                onClick={() => setActiveCategoryId(activeCategoryId === cat.id ? null : cat.id)}
                                className={cn(
                                    "flex-none text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl border transition-all whitespace-nowrap shadow-sm",
                                    activeCategoryId === cat.id
                                        ? "bg-emerald-600 text-white border-emerald-600 shadow-emerald-200/50"
                                        : "bg-white text-emerald-950/40 border-black/5 hover:border-emerald-300"
                                )}
                            >
                                {cat.name}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div className="px-5 py-8">
                {/* No query yet → show recent searches */}
                {!hasQuery && (
                    <div className="space-y-10 animate-fade-in">
                        {recent.length > 0 && (
                            <div>
                                <div className="flex items-center justify-between mb-4 px-1">
                                    <h3 className="text-[10px] font-black text-emerald-950 uppercase tracking-[0.2em]">Recently Searched</h3>
                                    <button onClick={clear} className="text-[10px] font-black text-red-500 uppercase tracking-widest hover:bg-red-50 px-3 py-1.5 rounded-xl transition-colors">Clear</button>
                                </div>
                                <div className="flex flex-wrap gap-2.5">
                                    {recent.map((term, i) => (
                                        <button
                                            key={i}
                                            onClick={() => handleSearch(term)}
                                            className="flex items-center gap-2 bg-white/40 backdrop-blur-md hover:bg-white/60 text-emerald-950 text-xs font-black uppercase tracking-tight px-4 py-2.5 rounded-2xl border border-white shadow-sm transition-all"
                                        >
                                            <Search className="h-3.5 w-3.5 text-emerald-400" />
                                            {term}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                        {/* Popular / all products hint */}
                        <div>
                            <div className="flex items-center gap-3 mb-6 px-1">
                                <div className="h-px flex-1 bg-emerald-900/10" />
                                <h3 className="text-[10px] font-black text-emerald-950/40 uppercase tracking-[0.3em]">Trending Now</h3>
                                <div className="h-px flex-1 bg-emerald-900/10" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                {(allProducts?.data ?? []).slice(0, 6).map((p: any) => (
                                    <ProductCard
                                        key={p.id}
                                        id={p.id}
                                        name={p.name}
                                        images={p.images}
                                        basePrice={Number(p.basePrice)}
                                        weightUnit={p.weightUnit}
                                        inventory={p.inventory}
                                        pricing={p.pricing}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {hasQuery && (
                    <div className="animate-fade-in">
                        {/* Sort & count row */}
                        <div className="flex items-center justify-between mb-8 px-1">
                            <p className="text-[10px] font-black text-emerald-950/40 uppercase tracking-[0.2em]">{results.length} results for "{query}"</p>
                            <div className="relative flex items-center">
                                <SlidersHorizontal className="h-3.5 w-3.5 text-emerald-900/40 absolute left-3 pointer-events-none" />
                                <select
                                    value={sort}
                                    onChange={(e) => setSort(e.target.value as typeof sort)}
                                    className="pl-9 pr-6 py-2 bg-white/40 backdrop-blur-md border border-white rounded-xl text-[10px] font-black uppercase tracking-widest appearance-none focus:outline-none cursor-pointer shadow-sm hover:bg-white/60 transition-colors"
                                >
                                    <option value="default">Default</option>
                                    <option value="price_asc">Price Low</option>
                                    <option value="price_desc">Price High</option>
                                </select>
                            </div>
                        </div>

                        {results.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-24 gap-4 animate-in zoom-in-95 duration-500">
                                <div className="w-24 h-24 bg-white/40 backdrop-blur-xl rounded-[2.5rem] flex items-center justify-center shadow-2xl border border-white rotate-6">
                                    <Search className="h-10 w-10 text-emerald-900/10" />
                                </div>
                                <p className="text-xl font-black text-emerald-950 uppercase tracking-tight mt-4">Not Found</p>
                                <p className="text-[10px] text-center px-12 font-black text-emerald-950/30 uppercase tracking-[0.2em] leading-relaxed">
                                    Try using generic keywords or check spelling.
                                </p>
                                <button
                                    onClick={() => { setInputValue(""); router.push("/search"); }}
                                    className="mt-4 bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest px-8 py-4 rounded-2xl shadow-xl shadow-emerald-200/50 hover:bg-emerald-700 active:scale-95 transition-all"
                                >
                                    Clear search
                                </button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                {results.map((p: any) => (
                                    <ProductCard
                                        key={p.id}
                                        id={p.id}
                                        name={p.name}
                                        images={p.images}
                                        basePrice={Number(p.basePrice)}
                                        weightUnit={p.weightUnit}
                                        inventory={p.inventory}
                                        pricing={p.pricing}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default function SearchPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
        }>
            <SearchContent />
        </Suspense>
    );
}
