"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getProducts } from "@/services/productService";
import { getCategories } from "@/services/categoryService";
import ProductCard from "@/components/ui/ProductCard";
import { Search, SlidersHorizontal, ArrowLeft, History, X, Sparkles, HelpCircle, ArrowUpDown, Flame, Droplet, Milk, ShoppingBag, Leaf, Mic } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUserStore } from "@/store/useUserStore";
import { Suspense } from "react";

const getCategoryIcon = (name: string, active: boolean) => {
    const n = name.toLowerCase();
    const iconClass = cn("h-4 w-4 shrink-0 transition-colors", active ? "text-white" : "text-slate-400");
    if (n.includes("oil") || n.includes("ghee")) return <Droplet className={iconClass} />;
    if (n.includes("dairy") || n.includes("milk")) return <Milk className={iconClass} />;
    if (n.includes("exo")) return <ShoppingBag className={iconClass} />;
    if (n.includes("leaf") || n.includes("veg") || n.includes("greens")) return <Leaf className={iconClass} />;
    return <Sparkles className={iconClass} />;
};

const SUGGESTED_TAGS = ["Carrot 🥕", "Potato 🥔", "Tomato 🍅", "Onion 🧅", "Dairy 🥛", "Mango 🍎"];

function SearchContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const query = searchParams.get("q") ?? "";

    const [inputValue, setInputValue] = useState(query);
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(query);
    const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
    const [sort, setSort] = useState<"default" | "price_asc" | "price_desc">("default");
    const [isFocused, setIsFocused] = useState(false);

    // Keep input in sync when URL changes
    useEffect(() => {
        setInputValue(query);
        setDebouncedSearchQuery(query);
    }, [query]);

    // 300ms Debounce for typing
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearchQuery(inputValue);
        }, 300);
        return () => clearTimeout(handler);
    }, [inputValue]);

    const { 
        recentSearches: recent, 
        clearRecentSearches: clear, 
        addRecentSearch, 
        removeRecentSearch,
        _hasHydrated 
    } = useUserStore();

    const handleSearch = (term: string) => {
        const t = term.trim();
        if (t) {
            addRecentSearch(t);
            router.push(`/search?q=${encodeURIComponent(t)}`);
        } else {
            router.push("/search");
        }
        setIsFocused(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            handleSearch(inputValue);
        }
    };

    const handleSuggestedClick = (tag: string) => {
        // Strip emoji
        const cleanTag = tag.replace(/[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD00-\uDFFF]/g, "").trim();
        setInputValue(cleanTag);
        handleSearch(cleanTag);
    };

    const { data: allProducts } = useQuery({
        queryKey: ["all-products"],
        queryFn: () => getProducts(undefined, 250),
        staleTime: 5 * 60 * 1000,
    });

    const { data: categories } = useQuery({
        queryKey: ["categories"],
        queryFn: getCategories,
    });

    const activeSearch = debouncedSearchQuery.trim().toLowerCase();

    // Helper for Levenshtein Distance (spelling matching)
    const getLevenshteinDistance = (a: string, b: string): number => {
        const matrix = [];
        for (let i = 0; i <= b.length; i++) {
            matrix[i] = [i];
        }
        for (let j = 0; j <= a.length; j++) {
            matrix[0][j] = j;
        }
        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                if (b.charAt(i - 1) === a.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }
        return matrix[b.length][a.length];
    };

    const scoredProducts = (allProducts?.data ?? [])
        .map((p: any) => {
            const matchesCategory = !activeCategoryId || p.categoryId === activeCategoryId;
            if (!matchesCategory) return null;

            if (!activeSearch) {
                return { product: p, tagPosition: 0, spellingScore: 0 };
            }

            const nameLower = p.name.toLowerCase();
            const descLower = (p.description || "").toLowerCase();
            
            // Safe tags parsing
            let tagsArray: string[] = [];
            if (Array.isArray(p.tags)) {
                tagsArray = p.tags;
            } else if (typeof p.tags === "string") {
                try {
                    tagsArray = JSON.parse(p.tags);
                } catch {
                    tagsArray = [];
                }
            }
            tagsArray = tagsArray.map((t: any) => String(t).trim().toLowerCase());

            let isMatch = false;
            let tagPosition = 9999;

            // Check tags first to identify keyword index position
            const matchedTagIdx = tagsArray.findIndex((tag: string) => tag.includes(activeSearch));
            if (matchedTagIdx !== -1) {
                isMatch = true;
                tagPosition = matchedTagIdx;
            }

            if (nameLower.includes(activeSearch) || descLower.includes(activeSearch)) {
                isMatch = true;
            }

            if (!isMatch) return null;

            const spellingScore = getLevenshteinDistance(activeSearch, nameLower);

            return {
                product: p,
                tagPosition,
                spellingScore
            };
        })
        .filter(Boolean) as { product: any; tagPosition: number; spellingScore: number }[];

    const results = scoredProducts
        .sort((a, b) => {
            if (sort === "price_asc") return Number(a.product.basePrice) - Number(b.product.basePrice);
            if (sort === "price_desc") return Number(b.product.basePrice) - Number(a.product.basePrice);

            // Priority sorting
            if (a.tagPosition !== b.tagPosition) {
                return a.tagPosition - b.tagPosition;
            }
            if (a.spellingScore !== b.spellingScore) {
                return a.spellingScore - b.spellingScore;
            }
            return a.product.name.localeCompare(b.product.name);
        })
        .map(item => item.product);

    const hasQuery = query.length > 0 || debouncedSearchQuery.length > 0;

    if (!_hasHydrated) {
        return (
            <div className="min-h-screen bg-[#fafcfb] flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="pb-36 bg-[#fafcfb] min-h-screen text-foreground transition-colors duration-300">
            
            {/* Header: Matching Mockup Image 2 */}
            <div className="bg-[#fafcfb] px-6 pt-12 pb-4 space-y-6">
                
                {/* Search Input and Circular Back Button */}
                <div className="max-w-2xl mx-auto flex items-center gap-4">
                    <button
                        onClick={() => router.back()}
                        className="w-12 h-12 rounded-full bg-white border border-slate-100 flex items-center justify-center text-slate-500 hover:text-emerald-600 transition-all active:scale-90 shadow-sm shrink-0"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </button>
                    
                    <div className={cn(
                        "flex-1 relative flex items-center bg-white rounded-full border px-5 h-14 transition-all duration-300 shadow-sm",
                        isFocused 
                            ? "border-emerald-500/40 shadow-md scale-[1.01]" 
                            : "border-slate-200/80"
                    )}>
                        <Search className="h-5 w-5 mr-3 text-slate-400 shrink-0" />
                        <input
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            onFocus={() => setIsFocused(true)}
                            onBlur={() => setTimeout(() => setIsFocused(false), 200)}
                            placeholder="Search fresh veggies..."
                            className="bg-transparent border-none w-full text-slate-700 text-sm focus:outline-none flex-1 placeholder:text-slate-400 placeholder:normal-case"
                        />
                        {inputValue ? (
                            <button 
                                onClick={() => setInputValue("")} 
                                className="ml-2 hover:text-slate-700 text-slate-450 transition-colors shrink-0"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        ) : (
                            <button className="ml-2 text-slate-400 hover:text-emerald-650 transition-colors shrink-0">
                                <Mic className="h-4.5 w-4.5" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Horizontal Category Chips with Green Line matching Mockup */}
                <div className="flex overflow-x-auto gap-4 scrollbar-hide py-2 max-w-2xl mx-auto px-1">
                    <div className="flex flex-col items-center shrink-0">
                        <button
                            onClick={() => setActiveCategoryId(null)}
                            className={cn(
                                "flex items-center gap-2 text-xs font-bold uppercase tracking-wider px-5 py-3 rounded-full border transition-all duration-300 active:scale-95 shadow-sm",
                                !activeCategoryId
                                    ? "bg-[#0B7A53] text-white border-[#0B7A53] shadow-md shadow-emerald-950/10 scale-102"
                                    : "bg-white text-slate-500 border-slate-200/80 hover:bg-slate-50"
                            )}
                        >
                            All
                        </button>
                        {!activeCategoryId && (
                            <div className="w-5 h-1 bg-[#0B7A53] rounded-full mt-2 animate-in fade-in duration-300" />
                        )}
                    </div>
                    {categories?.map((cat: any) => {
                        const active = activeCategoryId === cat.id;
                        return (
                            <div key={cat.id} className="flex flex-col items-center shrink-0">
                                <button
                                    onClick={() => setActiveCategoryId(active ? null : cat.id)}
                                    className={cn(
                                        "flex items-center gap-2 text-xs font-bold uppercase tracking-wider px-5 py-3 rounded-full border transition-all duration-300 active:scale-95 shadow-sm",
                                        active
                                            ? "bg-[#0B7A53] text-white border-[#0B7A53] shadow-md shadow-emerald-950/10 scale-102"
                                            : "bg-white text-slate-500 border-slate-200/80 hover:bg-slate-50"
                                    )}
                                >
                                    {getCategoryIcon(cat.name, active)}
                                    <span>{cat.name}</span>
                                </button>
                                {active && (
                                    <div className="w-5 h-1 bg-[#0B7A53] rounded-full mt-2 animate-in fade-in duration-300" />
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Main Content Area */}
            <div className="px-6 py-8 max-w-2xl mx-auto">
                
                {/* 1. Default Landing State (No search term) */}
                {!hasQuery && (
                    <div className="space-y-10 animate-in fade-in duration-500">
                        
                        {/* Recent Searches Block */}
                        {recent.length > 0 && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between px-1">
                                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-2">
                                        <History className="h-4 w-4 text-slate-350" /> 
                                        Recently Searched
                                    </h3>
                                    <button 
                                        onClick={clear} 
                                        className="text-[10px] font-black text-red-500 uppercase tracking-widest hover:text-red-650 transition-colors"
                                    >
                                        Clear All
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-2.5">
                                    {recent.slice(0, 5).map((term, i) => (
                                        <div
                                            key={i}
                                            className="flex items-center bg-white border border-slate-200/60 text-slate-700 text-[10px] font-bold uppercase tracking-wider px-4.5 py-2.5 rounded-2xl shadow-sm hover:border-emerald-500/20 transition-all hover:scale-102 group relative overflow-hidden"
                                        >
                                            <button
                                                onClick={() => handleSearch(term)}
                                                className="flex items-center gap-2 pr-6"
                                            >
                                                <Search className="h-3 w-3 text-emerald-600/30" />
                                                {term}
                                            </button>
                                            <button
                                                onClick={() => removeRecentSearch(term)}
                                                className="absolute right-2 text-slate-350 hover:text-red-500 p-0.5 rounded-md hover:bg-red-500/5 transition-colors"
                                            >
                                                <X className="h-3 w-3" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Popular Keywords / Suggested Tags */}
                        <div className="space-y-4">
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-2 px-1">
                                <Flame className="h-4 w-4 text-amber-500" />
                                Trending Veggies
                            </h3>
                            <div className="flex flex-wrap gap-2.5">
                                {SUGGESTED_TAGS.map((tag) => (
                                    <button
                                        key={tag}
                                        onClick={() => handleSuggestedClick(tag)}
                                        className="bg-white hover:bg-emerald-50 hover:text-[#0b5c3e] text-slate-600 text-[10px] font-bold uppercase tracking-wider px-4.5 py-3 rounded-2xl border border-slate-200/80 shadow-sm transition-all hover:scale-105 active:scale-95 flex items-center gap-1.5"
                                    >
                                        {tag}
                                    </button>
                                ))}
                            </div>
                        </div>
                        
                        {/* Recommended Products Grid matching Mockup Image 2 */}
                        <div className="space-y-6 pt-2">
                            <div className="flex items-center justify-between px-1">
                                <div className="flex items-center gap-3 flex-1">
                                    <h3 className="text-[11px] font-black text-[#0B7A53] uppercase tracking-[0.2em] whitespace-nowrap">
                                        Recommended For You
                                    </h3>
                                    <div className="h-px bg-slate-100 flex-1" />
                                </div>
                                <button 
                                    onClick={() => router.push('/categories')}
                                    className="text-[11px] font-black text-[#0B7A53] uppercase tracking-wider pl-4 shrink-0 hover:underline"
                                >
                                    View All &gt;
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                {(allProducts?.data ?? []).slice(0, 4).map((p: any, idx: number) => (
                                    <div 
                                        key={p.id} 
                                        className="animate-in fade-in slide-in-from-bottom-6 duration-500"
                                        style={{ animationDelay: `${idx * 80}ms` }}
                                    >
                                        <ProductCard
                                            id={p.id}
                                            name={p.name}
                                            images={p.images}
                                            basePrice={Number(p.basePrice)}
                                            weight={Number(p.weight)}
                                            weightUnit={p.weightUnit}
                                            inventory={p.inventory}
                                            pricing={p.pricing}
                                            variants={p.variants}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* 2. Results Screen (When query is active) */}
                {hasQuery && (
                    <div className="animate-in fade-in slide-in-from-bottom-6 duration-500">
                        
                        {/* Filter & Counter Row */}
                        <div className="flex items-center justify-between mb-8 px-1">
                            <div>
                                <h2 className="text-lg font-black text-slate-800 tracking-tight uppercase leading-none flex items-center gap-2">
                                    <span>{results.length} Matches Found</span>
                                </h2>
                                <p className="text-[9px] font-black text-emerald-600 uppercase tracking-[0.2em] mt-2">
                                    Searching for &ldquo;{debouncedSearchQuery || query}&rdquo;
                                </p>
                            </div>
                            
                            {/* Sort select */}
                            <div className="relative flex items-center">
                                <SlidersHorizontal className="h-4 w-4 text-emerald-600 absolute left-4 pointer-events-none" />
                                <select
                                    value={sort}
                                    onChange={(e) => setSort(e.target.value as typeof sort)}
                                    className="pl-11 pr-10 h-12 bg-white border border-slate-200 rounded-2xl text-[9px] font-black uppercase tracking-widest appearance-none focus:outline-none cursor-pointer text-slate-655 hover:bg-[#f4f7f5] hover:border-emerald-500/20 transition-all shadow-sm focus:ring-2 focus:ring-emerald-500/25"
                                >
                                    <option value="default">Sort: Featured</option>
                                    <option value="price_asc">Price: Low to High</option>
                                    <option value="price_desc">Price: High to Low</option>
                                </select>
                            </div>
                        </div>

                        {/* Results Grid / Empty state */}
                        {results.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-6 animate-in zoom-in-95 duration-500">
                                <div className="w-24 h-24 bg-white rounded-[2rem] flex items-center justify-center border border-slate-100 shadow-sm">
                                    <HelpCircle className="h-10 w-10 text-emerald-550/20" />
                                </div>
                                <div className="text-center space-y-2">
                                    <p className="text-xl font-black text-slate-800 uppercase tracking-tight">No Matches Found</p>
                                    <p className="text-[10px] text-center px-8 font-bold text-slate-400 uppercase tracking-[0.2em] leading-relaxed">
                                        We couldn&apos;t find anything for &ldquo;{debouncedSearchQuery || query}&rdquo;. <br/>Try simple terms like &ldquo;Potato&rdquo;, &ldquo;Onion&rdquo;, or &ldquo;Fresh&rdquo;.
                                    </p>
                                </div>
                                
                                {/* Smart Alternative suggestions */}
                                <div className="space-y-3 w-full max-w-sm pt-4">
                                    <p className="text-[9px] font-black text-emerald-800 dark:text-emerald-400 uppercase tracking-[0.3em] text-center">
                                        Suggested searches
                                    </p>
                                    <div className="flex flex-wrap justify-center gap-2">
                                        {["Potato 🥔", "Onion 🧅", "Tomato 🍅", "Dairy 🥛"].map(tag => (
                                            <button
                                                key={tag}
                                                onClick={() => handleSuggestedClick(tag)}
                                                className="bg-white hover:bg-emerald-50 hover:text-[#0b5c3e] text-slate-655 text-[10px] font-bold uppercase tracking-wider px-3.5 py-2 rounded-xl border border-slate-200 shadow-sm transition-all"
                                            >
                                                {tag}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-4">
                                {results.map((p: any, idx: number) => (
                                    <div 
                                        key={p.id}
                                        className="animate-in fade-in slide-in-from-bottom-4 duration-500"
                                        style={{ animationDelay: `${idx * 40}ms` }}
                                    >
                                        <ProductCard
                                            id={p.id}
                                            name={p.name}
                                            images={p.images}
                                            basePrice={Number(p.basePrice)}
                                            weight={Number(p.weight)}
                                            weightUnit={p.weightUnit}
                                            inventory={p.inventory}
                                            pricing={p.pricing}
                                            variants={p.variants}
                                        />
                                    </div>
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
            <div className="min-h-screen bg-[#fafcfb] flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
            </div>
        }>
            <SearchContent />
        </Suspense>
    );
}
