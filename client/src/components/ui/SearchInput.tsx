"use client";

import { useState, useCallback, useEffect } from "react";
import { Search, X, History, TrendingUp, Mic } from "lucide-react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useUserStore } from "@/store/useUserStore";
import api from "@/services/api";
import { cn } from "@/lib/utils";

interface SearchInputProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
    inputClassName?: string;
    autoFocus?: boolean;
    onSearch?: (term: string) => void;
}

export default function SearchInput({
    value,
    onChange,
    placeholder,
    className,
    inputClassName,
    autoFocus = false,
    onSearch,
}: SearchInputProps) {
    const [focused, setFocused] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [placeholderIndex, setPlaceholderIndex] = useState(0);
    const { recentSearches, addRecentSearch } = useUserStore();
    const router = useRouter();

    const placeholders = [
        "'ORGANIC'",
        "'FRESH FRUITS'",
        "'VEGETABLES'",
        "'COLD PRESSED OILS'",
        "'DAIRY PRODUCTS'"
    ];

    useEffect(() => {
        const interval = setInterval(() => {
            setPlaceholderIndex((prev) => (prev + 1) % placeholders.length);
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    // Fetch popular searches
    const { data: popularSearches = [] } = useQuery({
        queryKey: ["popular-searches"],
        queryFn: async () => {
            try {
                const res = await api.get("/search/popular");
                return res.data || [];
            } catch (e) {
                return ["Milk", "Bread", "Eggs", "Rice"];
            }
        },
        staleTime: 1000 * 60 * 60, // 1 hour
        enabled: focused,
    });

    const handleSearch = (term: string) => {
        onChange(term);
        addRecentSearch(term);
        setFocused(false);
        // Record on backend (fire and forget)
        api.post("/search/history", { query: term }).catch(() => { });

        if (onSearch) {
            onSearch(term);
        } else {
            router.push(`/search?q=${encodeURIComponent(term)}`);
        }
    };

    const startListening = () => {
        if ('webkitSpeechRecognition' in window) {
            const recognition = new (window as any).webkitSpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = false;
            recognition.lang = 'en-US';

            recognition.onstart = () => setIsListening(true);
            recognition.onend = () => setIsListening(false);
            recognition.onresult = (event: any) => {
                const transcript = event.results[0][0].transcript;
                if (transcript) handleSearch(transcript);
            };
            recognition.onerror = () => setIsListening(false);
            recognition.start();
        } else {
            alert("Voice search is not supported in this browser.");
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && value.trim()) {
            handleSearch(value.trim());
        }
    };

    const handleClear = useCallback(() => {
        onChange("");
    }, [onChange]);

    const handleBlur = () => {
        setTimeout(() => setFocused(false), 200);
    };

    const currentPlaceholder = isListening ? "Listening..." : placeholder;

    return (
        <div className={cn(
            "relative flex items-center rounded-xl transition-all duration-300",
            focused || isListening
                ? "bg-white border-transparent z-[100] shadow-2xl"
                : "bg-white border border-gray-200 hover:border-gray-300",
            className
        )}>
            <Search className="absolute left-3 h-4 w-4 text-emerald-950/40 shrink-0 z-30" />

            <div className="relative flex-1 h-11 group">
                {/* Rotating Placeholder Container */}
                {!value && !focused && !isListening && (
                    <div className="absolute left-9 inset-y-0 flex items-center pointer-events-none overflow-hidden h-full gap-1.5">
                        <span className="text-sm font-black text-emerald-950/20 whitespace-nowrap tracking-wide uppercase">
                            SEARCH
                        </span>
                        <div className="relative h-11 flex-1 overflow-hidden">
                            <div
                                className="flex flex-col transition-transform duration-700 cubic-bezier(0.16, 1, 0.3, 1)"
                                style={{ transform: `translateY(-${placeholderIndex * 100}%)` }}
                            >
                                {placeholders.map((text, i) => (
                                    <div key={i} className="h-11 flex items-center">
                                        <span className="text-sm font-black text-emerald-950/20 whitespace-nowrap tracking-wide">
                                            {text}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                <input
                    type="text"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={focused || isListening ? (isListening ? "Listening..." : "Search for fresh produce...") : ""}
                    autoFocus={autoFocus}
                    onFocus={() => setFocused(true)}
                    onBlur={handleBlur}
                    className={cn(
                        "w-full h-full pl-15 pr-16 bg-transparent text-sm font-normal text-emerald-950 placeholder:text-emerald-950/40 focus:outline-none rounded-xl relative z-10",
                        inputClassName
                    )}
                />
            </div>

            <div className="absolute right-2 flex items-center gap-1 z-10">
                {value && (
                    <button
                        type="button"
                        onClick={handleClear}
                        className="p-1 text-gray-400 hover:text-emerald-600 transition-colors"
                        aria-label="Clear search"
                    >
                        <X className="h-4 w-4" />
                    </button>
                )}
                <button
                    type="button"
                    onClick={startListening}
                    className={cn(
                        "p-1.5 rounded-full transition-all",
                        isListening
                            ? "bg-red-100 text-red-500 animate-pulse"
                            : "text-gray-400 hover:text-emerald-600 hover:bg-emerald-50"
                    )}
                    aria-label="Voice search"
                >
                    <Mic className="h-4 w-4" />
                </button>
            </div>

            {/* Premium Search Dropdown Overlay */}
            {focused && !isListening && (
                <>
                    {/* Immersive Backdrop */}
                    <div className="fixed inset-0 bg-emerald-950/20 z-[80] animate-fade-in" />

                    {/* Suggestion Dropdown - BOTTOM Sheet Style */}
                    <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-[3rem] shadow-2xl z-[90] animate-in slide-in-from-bottom-full duration-500 max-h-[85vh] overflow-y-auto border-t border-black/5">
                        {/* Top Decorator / Handle */}
                        <div className="absolute top-4 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-gray-200 rounded-full mb-4" />

                        <div className="px-8 pt-10 pb-12 overflow-y-auto">
                            <div className="flex items-center justify-between mb-10">
                                <h1 className="text-xl font-black text-emerald-950 tracking-tight flex items-center gap-3 uppercase tracking-widest leading-none">
                                    Quick Discovery 🔍
                                </h1>
                                <button className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-4 py-2 rounded-xl uppercase tracking-widest">Explore All</button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-35 gap-y-10">
                                {/* Popular Choices */}
                                <div>
                                    <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-6 px-1">Trending Today</h2>
                                    <div className="space-y-5">
                                        {(popularSearches.length > 0 ? popularSearches : ["Organic Potato", "Fresh Onion", "Alphonso Mango", "Mint Leaves", "Garlic"]).map((term: string, idx: number) => (
                                            <button
                                                key={term}
                                                onClick={() => handleSearch(term)}
                                                className="w-full flex items-center gap-5 group animate-fade-in"
                                                style={{ animationDelay: `${idx * 40}ms` }}
                                            >
                                                <div className="w-11 h-11 bg-emerald-500/10 rounded-2xl flex items-center justify-center transition-all group-hover:scale-110 group-active:scale-95 group-hover:bg-emerald-500/20">
                                                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                                                </div>
                                                <span className="text-base font-black text-emerald-950 tracking-tight group-hover:text-emerald-600 transition-colors">
                                                    {term}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Recent Searches */}
                                {recentSearches.length > 0 && (
                                    <div>
                                        <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-6 px-1">Your History</h2>
                                        <div className="flex flex-wrap gap-2.5">
                                            {recentSearches.map((term) => (
                                                <button
                                                    key={term}
                                                    onClick={() => handleSearch(term)}
                                                    className="px-5 py-3 bg-white hover:bg-emerald-50 text-emerald-950 text-sm font-black rounded-2xl transition-all border border-black/5 hover:border-emerald-500/30 flex items-center gap-2 group shadow-sm"
                                                >
                                                    <History className="w-3.5 h-3.5 text-emerald-900/30 group-hover:text-emerald-500 transition-colors" />
                                                    {term}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Bottom Decorator */}
                        <div className="h-6 w-full bg-gradient-to-b from-emerald-50/50 to-transparent" />
                    </div>
                </>
            )}
        </div>
    );
}
