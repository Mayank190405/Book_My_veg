"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getProducts } from "@/services/productService";
import { getCategories } from "@/services/categoryService";
import ProductCard from "@/components/ui/ProductCard";
import { Search, SlidersHorizontal, ArrowLeft, History, X, HelpCircle, Flame, Mic } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUserStore } from "@/store/useUserStore";
import { Suspense } from "react";
import { toast } from "sonner";

// Custom category pills with the user's pastel palette
const SEARCH_CATEGORY_PILLS = [
    { key: "all", label: "All", pillBg: "bg-[#DCF4E9]", pillText: "text-[#055b35]", match: () => true },
    { key: "vegetables", label: "Vegetables", pillBg: "bg-[#DCF4E9]", pillText: "text-[#0f5127]", match: (n: string) => /veg/i.test(n) && !/leaf/i.test(n) && !/exotic/i.test(n) },
    { key: "fruits", label: "Fruits", pillBg: "bg-[#FFE5DF]", pillText: "text-[#8e1b1b]", match: (n: string) => /fruit/i.test(n) && !/exotic/i.test(n) },
    { key: "dairy", label: "Dairy", pillBg: "bg-[#E0F0FF]", pillText: "text-[#13497d]", match: (n: string) => /dairy|milk|egg/i.test(n) },
    { key: "leafy", label: "Leafy Veg", pillBg: "bg-[#D8F3E6]", pillText: "text-[#065f46]", match: (n: string) => /leaf/i.test(n) },
    { key: "exotic", label: "Exotics", pillBg: "bg-[#EBE6FF]", pillText: "text-[#5e2296]", match: (n: string) => /exotic/i.test(n) },
    { key: "grains", label: "Grains", pillBg: "bg-[#FFF0D2]", pillText: "text-[#92400e]", match: (n: string) => /grain|pulse|flour/i.test(n) },
    { key: "oil", label: "Oils", pillBg: "bg-[#FCE9D4]", pillText: "text-[#854d0e]", match: (n: string) => /oil|ghee/i.test(n) },
];

const SUGGESTED_TAGS = ["Tomato", "Potato", "Onion", "Spinach", "Apple", "Banana", "Milk", "Butter"];

function SearchContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const query = searchParams.get("q") ?? "";

    const [inputValue, setInputValue] = useState(query);
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(query);
    const [selectedPillKey, setSelectedPillKey] = useState("all");
    const [sort, setSort] = useState<"default" | "price_asc" | "price_desc">("default");
    const [isFocused, setIsFocused] = useState(false);
    const [isListening, setIsListening] = useState(false);

    // Keep input in sync when URL changes
    useEffect(() => {
        setInputValue(query);
        setDebouncedSearchQuery(query);
    }, [query]);

    // 250ms Debounce for typing
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearchQuery(inputValue);
        }, 250);
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
        setInputValue(tag);
        handleSearch(tag);
    };

    const handleVoiceSearch = () => {
        if (typeof window === "undefined") return;
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            toast.error("Voice search is not supported on this browser.");
            return;
        }

        try {
            const recognition = new SpeechRecognition();
            recognition.lang = "en-IN";
            recognition.continuous = false;
            recognition.interimResults = false;

            recognition.onstart = () => {
                setIsListening(true);
                toast.info("Listening... speak product name");
            };

            recognition.onresult = (event: any) => {
                const speechResult = event.results[0][0].transcript;
                if (speechResult) {
                    setInputValue(speechResult);
                    handleSearch(speechResult);
                    toast.success(`Searching for "${speechResult}"`);
                }
            };

            recognition.onerror = () => {
                setIsListening(false);
                toast.error("Could not recognize voice. Please type your search.");
            };

            recognition.onend = () => {
                setIsListening(false);
            };

            recognition.start();
        } catch {
            setIsListening(false);
            toast.error("Could not start microphone.");
        }
    };

    const { data: allProducts, isLoading: isLoadingProducts, isError: isProductsError, refetch: refetchProducts } = useQuery({
        queryKey: ["all-products"],
        queryFn: () => getProducts(undefined, 250),
        staleTime: 5 * 60 * 1000,
    });

    const { data: categoriesData } = useQuery({
        queryKey: ["categories"],
        queryFn: getCategories,
        staleTime: 5 * 60 * 1000,
    });

    const categories: any[] = Array.isArray(categoriesData) ? categoriesData : (categoriesData?.data || []);
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

    const currentPill = SEARCH_CATEGORY_PILLS.find((p) => p.key === selectedPillKey) || SEARCH_CATEGORY_PILLS[0];

    const scoredProducts = (allProducts?.data ?? [])
        .map((p: any) => {
            // Category filter
            if (selectedPillKey !== "all") {
                const catName = p.category?.name || "";
                if (!currentPill.match(catName) && !currentPill.match(p.name)) {
                    return null;
                }
            }

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
                spellingScore,
            };
        })
        .filter(Boolean) as { product: any; tagPosition: number; spellingScore: number }[];

    const results = scoredProducts
        .sort((a, b) => {
            if (sort === "price_asc") return Number(a.product.basePrice) - Number(b.product.basePrice);
            if (sort === "price_desc") return Number(b.product.basePrice) - Number(a.product.basePrice);

            if (a.tagPosition !== b.tagPosition) {
                return a.tagPosition - b.tagPosition;
            }
            if (a.spellingScore !== b.spellingScore) {
                return a.spellingScore - b.spellingScore;
            }
            return a.product.name.localeCompare(b.product.name);
        })
        .map((item) => item.product);

    const hasQuery = query.length > 0 || debouncedSearchQuery.length > 0;

    if (!_hasHydrated) {
        return (
            <div className="min-h-screen bg-[#fafcfb] flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="pb-36 sm:pb-40 bg-[#f8faf8] min-h-screen text-[#17251e] select-none">
            {/* Search Top Bar */}
            <div className="border-b border-slate-200/80 bg-white px-3 sm:px-6 pt-4 pb-3 space-y-3 sticky top-0 z-40 shadow-xs">
                {/* Search Input Box */}
                <div className="max-w-7xl mx-auto flex items-center gap-2.5">
                    <button
                        aria-label="Go back"
                        onClick={() => router.back()}
                        className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700 hover:bg-slate-200 active:scale-95 transition-all shrink-0"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </button>
                    
                    <div className={cn(
                        "min-w-0 flex-1 relative flex items-center bg-slate-50 rounded-2xl border px-3 h-11 sm:h-12 transition-all",
                        isFocused 
                            ? "border-[#017649] bg-white ring-2 ring-[#017649]/20" 
                            : "border-slate-200 hover:border-slate-300"
                    )}>
                        <Search className="h-4.5 w-4.5 mr-2.5 text-slate-400 shrink-0" />
                        <input
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            onFocus={() => setIsFocused(true)}
                            onBlur={() => setTimeout(() => setIsFocused(false), 200)}
                            placeholder="Search fresh vegetables, fruits and more..."
                            aria-label="Search products"
                            className="bg-transparent border-none min-w-0 w-full text-slate-900 text-xs sm:text-sm font-medium focus:outline-none flex-1 placeholder:text-slate-400"
                        />
                        {inputValue ? (
                            <button 
                                onClick={() => {
                                    setInputValue("");
                                    setDebouncedSearchQuery("");
                                    router.push("/search");
                                }} 
                                aria-label="Clear search"
                                className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 shrink-0"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        ) : null}

                        {/* Mic Voice Search */}
                        <button
                            type="button"
                            onClick={handleVoiceSearch}
                            aria-label="Voice search"
                            className={cn(
                                "flex h-8 w-8 items-center justify-center rounded-full shrink-0 transition-colors ml-1",
                                isListening ? "bg-rose-50 text-rose-600 animate-pulse" : "text-[#017649] hover:bg-emerald-50"
                            )}
                        >
                            <Mic className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                {/* Pastel Category Filter Pills Strip */}
                <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide py-1 max-w-7xl mx-auto">
                    {SEARCH_CATEGORY_PILLS.map((pill) => {
                        const isSelected = selectedPillKey === pill.key;
                        return (
                            <div key={pill.key} className="relative flex flex-col items-center shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setSelectedPillKey(pill.key)}
                                    className={cn(
                                        "flex items-center justify-center rounded-full px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer whitespace-nowrap active:scale-95 shadow-xs border border-white/30",
                                        pill.pillBg,
                                        pill.pillText
                                    )}
                                >
                                    <span>{pill.label}</span>
                                </button>
                                {isSelected && (
                                    <span className="absolute -bottom-1 h-[2.5px] w-6 rounded-full bg-[#017649] shadow-xs" />
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Main Content Area */}
            <div className="px-3 sm:px-6 py-5 max-w-7xl mx-auto">
                {isProductsError && (
                    <div role="alert" className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-center">
                        <p className="font-bold text-amber-900 text-xs">Could not load products</p>
                        <button
                            onClick={() => refetchProducts()}
                            className="mt-2 rounded-lg bg-[#017649] px-3 py-1 text-xs font-bold text-white hover:bg-[#015f3b]"
                        >
                            Try again
                        </button>
                    </div>
                )}

                {isLoadingProducts && (
                    <div className="grid grid-cols-3 gap-2 sm:gap-3.5">
                        {Array.from({ length: 9 }, (_, i) => (
                            <div key={i} className="aspect-square rounded-2xl bg-slate-200/60 animate-pulse" />
                        ))}
                    </div>
                )}

                {/* 1. Default Landing State (No search term) */}
                {!hasQuery && (
                    <div className="space-y-6">
                        {/* Recent Searches */}
                        {recent.length > 0 && (
                            <div className="space-y-3">
                                <div className="flex items-center justify-between px-1">
                                    <h2 className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-1.5">
                                        <History className="h-3.5 w-3.5 text-slate-400" />
                                        <span>Recent searches</span>
                                    </h2>
                                    <button 
                                        onClick={clear} 
                                        className="text-[10px] font-bold text-rose-600 hover:text-rose-700 uppercase tracking-wider"
                                    >
                                        Clear All
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {recent.slice(0, 6).map((term, i) => (
                                        <div
                                            key={i}
                                            className="flex items-center bg-white border border-slate-200 text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-full shadow-2xs hover:border-[#017649] transition-all"
                                        >
                                            <button
                                                onClick={() => handleSearch(term)}
                                                className="flex items-center gap-1.5 pr-2"
                                            >
                                                <Search className="h-3 w-3 text-slate-400" />
                                                <span>{term}</span>
                                            </button>
                                            <button
                                                aria-label={`Remove ${term}`}
                                                onClick={() => removeRecentSearch(term)}
                                                className="text-slate-400 hover:text-rose-600"
                                            >
                                                <X className="h-3 w-3" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Popular Keywords / Suggested Tags */}
                        <div className="space-y-3">
                            <h2 className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-1.5 px-1">
                                <Flame className="h-3.5 w-3.5 text-amber-500" />
                                <span>Trending searches</span>
                            </h2>
                            <div className="flex flex-wrap gap-2">
                                {SUGGESTED_TAGS.map((tag) => (
                                    <button
                                        key={tag}
                                        onClick={() => handleSuggestedClick(tag)}
                                        className="bg-white hover:bg-emerald-50 hover:text-[#017649] hover:border-[#017649] text-slate-700 text-xs font-semibold px-3.5 py-1.5 rounded-full border border-slate-200 shadow-2xs transition-all active:scale-95"
                                    >
                                        {tag}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Explore Products Grid in 3x3 layout */}
                        <div className="space-y-3 pt-2">
                            <div className="flex items-center justify-between px-1">
                                <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                                    {selectedPillKey === "all" ? "Recommended picks" : `${currentPill.label} collection`}
                                </h2>
                                <button 
                                    onClick={() => router.push('/categories')}
                                    className="text-xs font-bold text-[#017649] hover:underline"
                                >
                                    View all categories →
                                </button>
                            </div>

                            <div className="grid grid-cols-3 gap-2 sm:gap-3.5">
                                {results.slice(0, 9).map((p: any, idx: number) => (
                                    <div 
                                        key={p.id} 
                                        className="animate-fade-in"
                                        style={{ animationDelay: `${idx * 25}ms` }}
                                    >
                                        <ProductCard
                                            id={p.id}
                                            name={p.name}
                                            images={p.images || []}
                                            basePrice={Number(p.basePrice || 0)}
                                            weight={p.weight}
                                            weightUnit={p.weightUnit}
                                            inventory={p.inventory || []}
                                            pricing={p.pricing || []}
                                            variants={p.variants || []}
                                            compact
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* 2. Results Screen (When query is active) */}
                {hasQuery && (
                    <div className="space-y-4">
                        {/* Filter & Counter Row */}
                        <div className="flex items-center justify-between gap-3 px-1">
                            <div>
                                <h2 className="text-sm sm:text-base font-black text-slate-900 leading-tight">
                                    {results.length} {results.length === 1 ? "product" : "products"} found
                                </h2>
                                <p className="text-[11px] font-medium text-slate-500 mt-0.5">
                                    Results for &ldquo;{debouncedSearchQuery || query}&rdquo;
                                </p>
                            </div>
                            
                            {/* Sort select */}
                            <div className="relative flex items-center">
                                <SlidersHorizontal className="h-3.5 w-3.5 text-[#017649] absolute left-3 pointer-events-none" />
                                <select
                                    value={sort}
                                    onChange={(e) => setSort(e.target.value as typeof sort)}
                                    aria-label="Sort search results"
                                    className="pl-8 pr-6 h-9 bg-white border border-slate-200 rounded-xl text-xs font-bold appearance-none focus:outline-none cursor-pointer text-slate-700 hover:border-[#017649] transition-all shadow-2xs"
                                >
                                    <option value="default">Featured</option>
                                    <option value="price_asc">Price: Low to High</option>
                                    <option value="price_desc">Price: High to Low</option>
                                </select>
                            </div>
                        </div>

                        {/* 3x3 Results Grid or Empty State */}
                        {!isLoadingProducts && !isProductsError && results.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
                                <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center text-[#017649]">
                                    <HelpCircle className="h-8 w-8" />
                                </div>
                                <div className="space-y-1">
                                    <p className="text-base font-bold text-slate-900">No products found</p>
                                    <p className="text-xs text-slate-500 max-w-xs mx-auto">
                                        We couldn&apos;t find anything matching &ldquo;{debouncedSearchQuery || query}&rdquo;. Try simple terms like Tomato, Onion, or Potato.
                                    </p>
                                </div>
                                
                                <div className="flex flex-wrap justify-center gap-2 pt-2">
                                    {["Tomato", "Potato", "Onion", "Milk"].map((tag) => (
                                        <button
                                            key={tag}
                                            onClick={() => handleSuggestedClick(tag)}
                                            className="bg-white text-xs font-semibold px-3 py-1.5 rounded-full border border-slate-200 shadow-2xs hover:border-[#017649] text-[#017649]"
                                        >
                                            {tag}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-3 gap-2 sm:gap-3.5">
                                {results.map((p: any, idx: number) => (
                                    <div 
                                        key={p.id}
                                        className="animate-fade-in"
                                        style={{ animationDelay: `${idx * 25}ms` }}
                                    >
                                        <ProductCard
                                            id={p.id}
                                            name={p.name}
                                            images={p.images || []}
                                            basePrice={Number(p.basePrice || 0)}
                                            weight={p.weight}
                                            weightUnit={p.weightUnit}
                                            inventory={p.inventory || []}
                                            pricing={p.pricing || []}
                                            variants={p.variants || []}
                                            compact
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
