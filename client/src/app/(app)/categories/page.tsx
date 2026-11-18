"use client";

import Image from "next/image";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { getCategories } from "@/services/categoryService";
import { Skeleton } from "@/components/ui/skeleton";
import SearchBar from "@/components/features/SearchBar";
import { LayoutGrid, ArrowRight, RefreshCw } from "lucide-react";
import { useCategoryThemeStore } from "@/store/useCategoryThemeStore";
import { cn } from "@/lib/utils";

interface CategoryDefinition {
    key: string;
    defaultName: string;
    photo: string;
    bgColor: string;
    aspectRatio: string;
    match: (c: { name: string; slug?: string }) => boolean;
}

const CARD_BG = "#FEF6D1";

// Core Category Cards matching user reference (4 on Row 1, 3 on Row 2)
const ROW_1_CARDS: CategoryDefinition[] = [
    {
        key: "vegetables",
        defaultName: "Vegetables",
        photo: "/images/cutout_vegetables_perfect.png",
        bgColor: CARD_BG,
        aspectRatio: "aspect-[1/1.22]",
        match: (c) => /veg/i.test(c.name) && !/leaf/i.test(c.name) && !/exotic/i.test(c.name),
    },
    {
        key: "fruits",
        defaultName: "Fruits",
        photo: "/images/cutout_fruits_perfect.png",
        bgColor: CARD_BG,
        aspectRatio: "aspect-[1/1.22]",
        match: (c) => /fruit/i.test(c.name) && !/exotic/i.test(c.name),
    },
    {
        key: "dairy",
        defaultName: "Dairy",
        photo: "/images/cutout_dairy_perfect.png",
        bgColor: CARD_BG,
        aspectRatio: "aspect-[1/1.22]",
        match: (c) => /dairy|milk|egg/i.test(c.name),
    },
    {
        key: "exotic",
        defaultName: "Exotic",
        photo: "/images/cutout_exotic_perfect.png",
        bgColor: CARD_BG,
        aspectRatio: "aspect-[1/1.22]",
        match: (c) => /exotic/i.test(c.name),
    },
];

const ROW_2_CARDS: CategoryDefinition[] = [
    {
        key: "leafy",
        defaultName: "Leafy Vegetables",
        photo: "/images/cutout_leafy_perfect.png",
        bgColor: CARD_BG,
        aspectRatio: "aspect-[1/1.08]",
        match: (c) => /leaf/i.test(c.name),
    },
    {
        key: "grains",
        defaultName: "Grains",
        photo: "/images/cutout_grains_perfect.png",
        bgColor: CARD_BG,
        aspectRatio: "aspect-[1/1.08]",
        match: (c) => /grain|pulse|flour/i.test(c.name),
    },
    {
        key: "oil",
        defaultName: "Oil",
        photo: "/images/cutout_oil_perfect.png",
        bgColor: CARD_BG,
        aspectRatio: "aspect-[1/1.08]",
        match: (c) => /oil|ghee/i.test(c.name),
    },
];

const EXTRA_PALETTES = ["#DCF4E9", "#FFE5DF", "#E0F0FF", "#EBE6FF", "#D8F3E6", "#FFF0D2", "#FCE9D4"];

export default function CategoriesPage() {
    const setSelectedCategory = useCategoryThemeStore((state) => state.setSelectedCategory);

    const { data, isLoading, isError, refetch } = useQuery({
        queryKey: ["categories"],
        queryFn: getCategories,
        staleTime: 5 * 60 * 1000,
    });

    const rawCategories: Array<{ id: string; name: string; slug?: string; imageUrl?: string }> =
        Array.isArray(data) ? data : data?.data || [];

    // Map 7 core cards
    const mappedRow1 = ROW_1_CARDS.map((config) => {
        const matched = rawCategories.find((c) => config.match(c));
        return { config, category: matched };
    });

    const mappedRow2 = ROW_2_CARDS.map((config) => {
        const matched = rawCategories.find((c) => config.match(c));
        return { config, category: matched };
    });

    // Find any remaining categories not covered by the 7 primary cards
    const matchedIds = new Set(
        [...mappedRow1, ...mappedRow2]
            .map((m) => m.category?.id)
            .filter(Boolean)
    );
    const otherCategories = rawCategories.filter((c) => !matchedIds.has(c.id));

    const handleCategoryClick = (key: string) => {
        setSelectedCategory(key);
    };

    return (
        <div className="mx-auto w-full max-w-7xl px-3 sm:px-6 lg:px-8 py-5 pb-28 select-none">
            {/* Page Header */}
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-[#017649]">
                        Everyday Essentials
                    </span>
                    <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 mt-1">
                        Shop by category
                    </h1>
                    <p className="mt-1 text-xs sm:text-sm text-slate-500 font-medium">
                        Farm-fresh produce and daily pantry essentials handpicked for you.
                    </p>
                </div>
                <div className="w-full sm:max-w-sm">
                    <SearchBar />
                </div>
            </div>

            {/* Featured 4x3 Categories Section */}
            {isLoading ? (
                <div className="space-y-2 sm:space-y-3.5 mb-8">
                    <div className="grid grid-cols-4 gap-2 sm:gap-3.5">
                        {ROW_1_CARDS.map((cfg, idx) => (
                            <div
                                key={idx}
                                style={{ backgroundColor: cfg.bgColor }}
                                className="aspect-[1/1.22] animate-pulse rounded-2xl sm:rounded-3xl opacity-70"
                            />
                        ))}
                    </div>
                    <div className="grid grid-cols-3 gap-2 sm:gap-3.5">
                        {ROW_2_CARDS.map((cfg, idx) => (
                            <div
                                key={idx}
                                style={{ backgroundColor: cfg.bgColor }}
                                className="aspect-[1/1.08] animate-pulse rounded-2xl sm:rounded-3xl opacity-70"
                            />
                        ))}
                    </div>
                </div>
            ) : isError ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center my-6">
                    <p className="font-bold text-amber-900 text-sm">Could not load categories</p>
                    <button
                        onClick={() => refetch()}
                        className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[#017649] px-4 py-2 font-bold text-white text-xs hover:bg-[#015f3b]"
                    >
                        <RefreshCw className="h-3.5 w-3.5" /> Try again
                    </button>
                </div>
            ) : (
                <div className="space-y-2 sm:space-y-3.5 mb-8">
                    {/* Row 1: 4 Cards (Vegetables, Fruits, Dairy, Exotic) */}
                    <div className="grid grid-cols-4 gap-2 sm:gap-3.5">
                        {mappedRow1.map(({ config, category }, idx) => {
                            const displayName = category?.name || config.defaultName;
                            const targetHref = category?.id ? `/category/${category.id}` : "/categories";

                            return (
                                <Link
                                    key={`r1-${config.key}-${idx}`}
                                    href={targetHref}
                                    onClick={() => handleCategoryClick(config.key)}
                                    aria-label={`Shop ${displayName} category`}
                                    style={{ backgroundColor: config.bgColor }}
                                    className="group relative flex flex-col items-center justify-between p-2 sm:p-3 rounded-2xl sm:rounded-3xl shadow-xs transition-all duration-300 hover:shadow-md hover:scale-[1.02] active:scale-[0.98] overflow-hidden"
                                >
                                    <span className="font-black text-slate-800 text-[11px] sm:text-xs md:text-sm tracking-tight text-center leading-tight pt-1 min-h-[26px] flex items-center justify-center">
                                        {displayName}
                                    </span>
                                    <div className="relative w-full aspect-square max-h-[85px] sm:max-h-[120px] flex items-center justify-center mt-1 pb-1">
                                        <Image
                                            src={config.photo}
                                            alt={displayName}
                                            fill
                                            sizes="(max-width: 640px) 25vw, 200px"
                                            className="object-contain drop-shadow-sm transition-transform duration-300 group-hover:scale-105"
                                            priority
                                        />
                                    </div>
                                </Link>
                            );
                        })}
                    </div>

                    {/* Row 2: 3 Cards (Leafy Vegetables, Grains, Oil) */}
                    <div className="grid grid-cols-3 gap-2 sm:gap-3.5">
                        {mappedRow2.map(({ config, category }, idx) => {
                            const displayName = category?.name || config.defaultName;
                            const targetHref = category?.id ? `/category/${category.id}` : "/categories";

                            return (
                                <Link
                                    key={`r2-${config.key}-${idx}`}
                                    href={targetHref}
                                    onClick={() => handleCategoryClick(config.key)}
                                    aria-label={`Shop ${displayName} category`}
                                    style={{ backgroundColor: config.bgColor }}
                                    className="group relative flex flex-col items-center justify-between p-2 sm:p-3 rounded-2xl sm:rounded-3xl shadow-xs transition-all duration-300 hover:shadow-md hover:scale-[1.02] active:scale-[0.98] overflow-hidden"
                                >
                                    <span className="font-black text-slate-800 text-[11px] sm:text-xs md:text-sm tracking-tight text-center leading-tight pt-1 min-h-[26px] flex items-center justify-center">
                                        {displayName}
                                    </span>
                                    <div className="relative w-full aspect-square max-h-[85px] sm:max-h-[120px] flex items-center justify-center mt-1 pb-1">
                                        <Image
                                            src={config.photo}
                                            alt={displayName}
                                            fill
                                            sizes="(max-width: 640px) 33vw, 220px"
                                            className="object-contain drop-shadow-sm transition-transform duration-300 group-hover:scale-105"
                                            priority
                                        />
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Additional Categories Section (if catalog has extra collections) */}
            {otherCategories.length > 0 && (
                <div className="mt-8 space-y-3">
                    <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                        More Collections
                    </h2>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 sm:gap-3.5">
                        {otherCategories.map((cat, idx) => {
                            const pastelColor = EXTRA_PALETTES[idx % EXTRA_PALETTES.length];
                            return (
                                <Link
                                    key={cat.id}
                                    href={`/category/${cat.id}`}
                                    style={{ backgroundColor: pastelColor }}
                                    className="group relative flex flex-col items-center justify-between p-2.5 sm:p-3.5 rounded-2xl sm:rounded-3xl shadow-xs transition-all duration-300 hover:shadow-md hover:scale-[1.02] active:scale-[0.98] overflow-hidden aspect-square"
                                >
                                    <span className="font-black text-slate-800 text-[11px] sm:text-xs tracking-tight text-center leading-tight pt-1">
                                        {cat.name}
                                    </span>
                                    <div className="relative w-full aspect-square max-h-[65px] sm:max-h-[85px] flex items-center justify-center mt-1">
                                        {cat.imageUrl ? (
                                            <Image
                                                src={cat.imageUrl}
                                                alt={cat.name}
                                                fill
                                                sizes="(max-width: 600px) 30vw, 150px"
                                                className="object-contain drop-shadow-sm transition-transform duration-300 group-hover:scale-105"
                                            />
                                        ) : (
                                            <LayoutGrid className="h-8 w-8 text-slate-400/60" />
                                        )}
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Search Banner Prompt */}
            <Link
                href="/search"
                className="mt-8 flex items-center justify-between gap-4 rounded-2xl bg-[#DCF4E9] p-4 sm:p-5 text-[#017649] hover:bg-[#d0efe1] transition-colors shadow-xs"
            >
                <div>
                    <h3 className="text-sm sm:text-base font-black text-[#015f3b]">Looking for something specific?</h3>
                    <p className="mt-0.5 text-xs sm:text-sm text-[#017649] font-medium">Search across fresh farm vegetables, fruits, groceries and more.</p>
                </div>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[#017649] shadow-xs">
                    <ArrowRight className="h-4 w-4 stroke-[2.5]" />
                </div>
            </Link>
        </div>
    );
}
