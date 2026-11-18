"use client";

import Image from "next/image";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { getCategories } from "@/services/categoryService";
import { ArrowRight, RefreshCw } from "lucide-react";
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

// Row 1: 4 Cards
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

// Row 2: 3 Cards
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

interface CreamCardProps {
    config: CategoryDefinition;
    category?: { id?: string; name?: string; imageUrl?: string };
}

function CreamCategoryCard({ config, category }: CreamCardProps) {
    const setSelectedCategory = useCategoryThemeStore((state) => state.setSelectedCategory);
    const displayName = category?.name || config.defaultName;
    const targetHref = category?.id ? `/category/${category.id}` : "/categories";

    const handleClick = (e: React.MouseEvent) => {
        e.preventDefault();
        setSelectedCategory(config.key);
        const container = document.getElementById("main-scroll-container");
        if (container) {
            container.scrollTo({ top: 0, behavior: "smooth" });
        } else {
            window.scrollTo({ top: 0, behavior: "smooth" });
        }
    };

    return (
        <Link
            href={targetHref}
            onClick={handleClick}
            aria-label={`Shop ${displayName} category`}
            style={{ backgroundColor: config.bgColor }}
            className="group relative flex flex-col items-center justify-between p-2 sm:p-3 rounded-2xl sm:rounded-3xl shadow-xs transition-all duration-300 hover:shadow-md hover:scale-[1.02] active:scale-[0.98] overflow-hidden"
        >
            <span className="font-bold text-slate-900 text-[12px] sm:text-sm md:text-base tracking-tight text-center leading-tight pt-1 min-h-[28px] sm:min-h-[32px] flex items-center justify-center">
                {displayName === "Leafy Vegetables" ? (
                    <span>
                        Leafy<br className="sm:hidden" /> Vegetables
                    </span>
                ) : (
                    displayName
                )}
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
}

export default function EditorialCategoryGrid() {
    const { data, isLoading, isError, refetch } = useQuery({
        queryKey: ["categories"],
        queryFn: getCategories,
        staleTime: 5 * 60 * 1000,
    });

    const rawCategories: Array<{ id: string; name: string; slug?: string; imageUrl?: string }> =
        Array.isArray(data) ? data : data?.data || [];

    const mappedRow1 = ROW_1_CARDS.map((config) => {
        const matched = rawCategories.find((c) => config.match(c));
        return { config, category: matched };
    });

    const mappedRow2 = ROW_2_CARDS.map((config) => {
        const matched = rawCategories.find((c) => config.match(c));
        return { config, category: matched };
    });

    return (
        <section className="px-3 sm:px-6 select-none" aria-label="Shop by category">
            {/* Header: "Shop by category" + "See all →" */}
            <div className="mx-auto mb-3 flex max-w-[1280px] items-center justify-between px-1">
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                    Shop by category
                </h2>
                <Link
                    href="/categories"
                    className="flex items-center gap-1 text-sm sm:text-base font-bold text-[#017649] hover:text-[#015f3b] transition-colors"
                >
                    <span>See all</span>
                    <ArrowRight className="h-4 w-4 stroke-[2.5]" />
                </Link>
            </div>

            {/* Category Cards: Row 1 (4 cards) + Row 2 (3 cards) */}
            <div className="mx-auto max-w-[1280px] space-y-2 sm:space-y-3.5">
                {isLoading ? (
                    <div className="space-y-2 sm:space-y-3.5">
                        <div className="grid grid-cols-4 gap-2 sm:gap-3.5">
                            {ROW_1_CARDS.map((config, idx) => (
                                <div
                                    key={`r1-${config.key}-${idx}`}
                                    style={{ backgroundColor: config.bgColor }}
                                    className={cn("animate-pulse rounded-2xl sm:rounded-3xl opacity-70", config.aspectRatio)}
                                />
                            ))}
                        </div>
                        <div className="grid grid-cols-3 gap-2 sm:gap-3.5">
                            {ROW_2_CARDS.map((config, idx) => (
                                <div
                                    key={`r2-${config.key}-${idx}`}
                                    style={{ backgroundColor: config.bgColor }}
                                    className={cn("animate-pulse rounded-2xl sm:rounded-3xl opacity-70", config.aspectRatio)}
                                />
                            ))}
                        </div>
                    </div>
                ) : isError ? (
                    <div
                        role="status"
                        className="flex items-center justify-between gap-3 rounded-2xl bg-amber-50 p-4 text-xs shadow-xs"
                    >
                        <p className="font-semibold text-amber-900">Could not refresh category tiles.</p>
                        <button
                            onClick={() => refetch()}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-[#017649] px-3 py-1 font-bold text-white hover:bg-[#015f3b]"
                        >
                            <RefreshCw className="h-3.5 w-3.5" /> Retry
                        </button>
                    </div>
                ) : (
                    <>
                        {/* Row 1: 4 Columns (Vegetables, Fruits, Dairy, Exotic) */}
                        <div className="grid grid-cols-4 gap-2 sm:gap-3.5">
                            {mappedRow1.map(({ config, category }, idx) => (
                                <CreamCategoryCard
                                    key={`row1-${config.key}-${idx}`}
                                    config={config}
                                    category={category}
                                />
                            ))}
                        </div>

                        {/* Row 2: 3 Columns (Leafy Vegetables, Grains, Oil) */}
                        <div className="grid grid-cols-3 gap-2 sm:gap-3.5">
                            {mappedRow2.map(({ config, category }, idx) => (
                                <CreamCategoryCard
                                    key={`row2-${config.key}-${idx}`}
                                    config={config}
                                    category={category}
                                />
                            ))}
                        </div>
                    </>
                )}
            </div>
        </section>
    );
}
