"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Search, X, History, TrendingUp, Mic, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useUserStore } from "@/store/useUserStore";
import api from "@/services/api";
import { cn } from "@/lib/utils";
import { createPortal } from "react-dom";

interface SearchInputProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
    inputClassName?: string;
    autoFocus?: boolean;
    onSearch?: (term: string) => void;
    hideSuggestions?: boolean;
    focused?: boolean;
    onFocusChange?: (focused: boolean) => void;
}

export default function SearchInput({
    value,
    onChange,
    placeholder,
    className,
    inputClassName,
    autoFocus = false,
    onSearch,
    hideSuggestions = false,
    focused: controlledFocused,
    onFocusChange,
}: SearchInputProps) {
    const [localFocused, setLocalFocused] = useState(false);
    const focused = controlledFocused !== undefined ? controlledFocused : localFocused;
    const setFocused = (val: boolean) => {
        if (onFocusChange) onFocusChange(val);
        setLocalFocused(val);
    };

    const [isListening, setIsListening] = useState(false);
    const [placeholderIndex, setPlaceholderIndex] = useState(0);
    const [mounted, setMounted] = useState(false);
    const { recentSearches, addRecentSearch } = useUserStore();
    const router = useRouter();
    const inputRef = useRef<HTMLInputElement>(null);

    const { data: popularSearches = [] } = useQuery({
        queryKey: ["popular-searches"],
        queryFn: async () => {
            const { data } = await api.get<string[]>("/search/popular");
            return data;
        },
        staleTime: 5 * 60 * 1000,
    });

    const placeholders = popularSearches.length > 0
        ? popularSearches.map(term => term.charAt(0).toUpperCase() + term.slice(1).toLowerCase())
        : [];

    useEffect(() => {
        setMounted(true);
        if (placeholders.length <= 1) return;
        const interval = setInterval(() => {
            setPlaceholderIndex((prev) => (prev + 1) % placeholders.length);
        }, 3000);
        return () => clearInterval(interval);
    }, [placeholders.length]);

    // Prevent scrolling when search is open
    useEffect(() => {
        if (focused) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "auto";
        }
        return () => {
            document.body.style.overflow = "auto";
        };
    }, [focused]);

    const handleSearch = (term: string) => {
        onChange(term);
        if (term.trim()) {
            addRecentSearch(term);
        }
        setFocused(false);
        if (term.trim()) {
            api.post("/search/history", { query: term }).catch(() => {});
        }

        if (onSearch) {
            onSearch(term);
        } else {
            router.push(`/search?q=${encodeURIComponent(term)}`);
        }
    };

    const startListening = (e: React.MouseEvent) => {
        e.stopPropagation();
        if ("webkitSpeechRecognition" in window) {
            const recognition = new (window as any).webkitSpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = false;
            recognition.lang = "en-US";

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

    const handleClear = useCallback(
        (e: React.MouseEvent) => {
            e.stopPropagation();
            onChange("");
            if (inputRef.current) inputRef.current.focus();
        },
        [onChange]
    );

    return (
        <div className={cn("w-full h-full border-emerald-400 border-[0.7px]  rounded-4xl ", className)}>
            {/* Main Trigger Input */}
            <div
                onClick={() => router.push("/search")}
                className={cn(
                    "relative flex items-center rounded-full transition-all duration-500 bg-white border border-slate-200/80 h-10 cursor-pointer hover:border-[#0b5c3e]/30 px-4 group/input shadow-sm",
                    inputClassName
                )}
            >
                <Search className="h-5 w-5 text-[#0b5c3e] shrink-0 mr-3 group-hover/input:scale-105 transition-transform " />
                <div className="flex-1 flex items-center h-full overflow-hidden ">
                    <p className="font-medium text-[#8A949E] mr-1">Search for</p> 
                    {!value &&(
                        <div className="relative flex-1 h-6 overflow-hidden">
                            <div
                            className="absolute inset-0 transition-transform duration-500 ease-in-out"
                            style={{
                                transform: `translateY(${-placeholderIndex * 24}px)`,
                            }}    
                            >
                                {placeholders.map((text,i)=>(
                                    <div 
                                    key={i}
                                    className="flex h-6 items-center"
                                    >
                                        <span className="truncate text-[15px] font-medium text-[#8A949E]">
                                            "{text}"
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-1">
                    {value && (
                        <button onClick={handleClear} className="p-2.2 text-slate-400 hover:text-[#0b5c3e] transition-colors">
                            <X className="h-5 w-5" />
                        </button>
                    )}
                    <button onClick={startListening} className={cn("p-2.5 rounded-full transition-all", isListening ? "bg-red-500 text-white animate-pulse" : "text-[#0b5c3e]")}>
                        <Mic className="h-5 w-5 " />
                    </button>
                </div>
            </div>

            {/* Immersive Search Overlay via Portal */}
            {mounted && focused && createPortal(
                <div className="fixed inset-0 z-[99999] flex flex-col bg-background animate-in fade-in duration-500">
                    {/* Header Bar within Search */}
                    <div className="px-6 pt-12 pb-6 flex items-center gap-4 border-b border-border bg-background/50 backdrop-blur-xl">
                        <button 
                            onClick={() => setFocused(false)}
                            className="w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center text-foreground/40 hover:text-foreground transition-all active:scale-90"
                        >
                            <ArrowLeft className="h-6 w-6" />
                        </button>
                        <div className="flex-1 relative flex items-center bg-secondary rounded-2xl border border-border px-5 h-14">
                            <Search className="h-5 w-5 text-primary mr-12" />
                            <input 
                                ref={inputRef}
                                autoFocus
                                value={value}
                                onChange={(e) => onChange(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="What are you craving?"
                                className="bg-transparent border-none text-foreground font-black uppercase text-sm focus:outline-none flex-1 placeholder:text-foreground/20"
                            />
                            {value && (
                                <button onClick={() => onChange("")} className="ml-2 text-foreground/20 hover:text-foreground">
                                    <X className="h-4 w-4" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Scrollable Suggestions content */}
                    <div className="flex-1 overflow-y-auto px-8 py-10 scrollbar-hide">
                        <div className="flex items-center justify-between mb-10">
                            <div className="animate-in slide-in-from-left-4 duration-700">
                                <h1 className="text-3xl font-black text-foreground tracking-widest uppercase leading-none">Discovery</h1>
                                <p className="text-[10px] font-black text-primary tracking-[0.4em] uppercase mt-3">Curated Freshness For You</p>
                            </div>
                            <button
                                onClick={() => handleSearch("")}
                                className="text-[10px] font-black text-primary bg-primary/10 border border-primary/20 px-6 py-4 rounded-2xl uppercase tracking-widest hover:bg-primary hover:text-primary-foreground transition-all shadow-sm"
                            >
                                Browse All
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                            {/* Popular Choices */}
                            <div className="space-y-8">
                                <h2 className="text-[10px] font-black text-foreground/30 uppercase tracking-[0.4em] px-1 flex items-center gap-3">
                                    <TrendingUp className="h-3.5 w-3.5 text-primary" /> Trending Searches
                                </h2>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {placeholders.slice(0, 6).map((term, idx: number) => (
                                        <button
                                            key={term}
                                            onClick={() => handleSearch(term)}
                                            className="w-full flex items-center gap-5 p-5 bg-card rounded-[1.75rem] border border-border hover:border-primary/30 hover:bg-secondary group animate-in slide-in-from-bottom-6 duration-700 shadow-sm"
                                            style={{ animationDelay: `${idx * 60}ms` }}
                                        >
                                            <div className="w-11 h-11 bg-primary/10 rounded-2xl flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-all transform group-hover:rotate-12">
                                                <Search className="w-4 h-4 text-primary group-hover:text-primary-foreground" />
                                            </div>
                                            <span className="text-sm font-black text-foreground tracking-tight uppercase group-hover:text-primary transition-colors truncate">
                                                {term}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Recent Searches */}
                            {recentSearches.length > 0 && (
                                <div className="space-y-8">
                                    <h2 className="text-[10px] font-black text-foreground/30 uppercase tracking-[0.4em] px-1 flex items-center gap-3">
                                        <History className="h-3.5 w-3.5 text-primary" /> Your History
                                    </h2>
                                    <div className="flex flex-wrap gap-3">
                                        {recentSearches.map((term, idx: number) => (
                                            <button
                                                key={term}
                                                onClick={() => handleSearch(term)}
                                                className="px-6 py-4 bg-card hover:bg-primary shadow-sm text-foreground hover:text-primary-foreground text-[13px] font-black rounded-2xl transition-all border border-border hover:border-primary flex items-center gap-3 group animate-in zoom-in-95 duration-700"
                                                style={{ animationDelay: `${idx * 50}ms` }}
                                            >
                                                <History className="w-4 h-4 text-foreground/30 group-hover:text-primary-foreground/60 transition-colors" />
                                                <span className="uppercase tracking-tight">{term}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Bottom Branding */}
                    <div className="bg-secondary px-10 py-10 flex items-center justify-between border-t border-border shrink-0">
                        <div className="flex flex-col gap-1">
                            <p className="text-[9px] font-black text-foreground/30 uppercase tracking-[0.5em]">Secure Discovery Network</p>
                            <p className="text-[8px] font-bold text-primary/40 uppercase tracking-[0.2em]">Verified Freshness AI</p>
                        </div>
                        <div className="flex gap-3">
                            <div className="w-2 h-2 rounded-full bg-primary animate-ping" />
                            <div className="w-2 h-2 rounded-full bg-primary/20" />
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
