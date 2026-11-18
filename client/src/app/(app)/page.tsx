"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import RecommendationSection from "@/components/widgets/RecommendationSection";
import EditorialCategoryGrid from "@/components/widgets/EditorialCategoryGrid";
import AllProductsSection from "@/components/widgets/AllProductsSection";
import { useCategoryThemeStore, CATEGORY_THEMES } from "@/store/useCategoryThemeStore";

export default function Home() {
    const selectedCategory = useCategoryThemeStore((state) => state.selectedCategory);
    const activeTheme = CATEGORY_THEMES[selectedCategory] || CATEGORY_THEMES.all;

    return (
        <div 
            style={{ backgroundColor: activeTheme.lightBg || "#e9f6ef" }}
            className="w-full space-y-6 pb-36 sm:pb-40 transition-colors duration-500 min-h-screen"
        >
            {/* Seamless Header-to-Hero Canopy - Matches User Mockup */}
            <section
                style={{ backgroundColor: activeTheme.themeColor }}
                className="relative w-full text-white pt-2 sm:pt-4 pb-4 px-4 sm:px-8 shadow-xs transition-colors duration-500"
            >
                <div className="mx-auto max-w-[1280px]">
                    <div className="flex flex-col items-start justify-center py-3 sm:py-5 max-w-2xl min-h-[140px] sm:min-h-[170px]">
                        {/* Eyebrow Pill */}
                        <div className="inline-flex items-center gap-2 rounded-full bg-white/15 backdrop-blur-md px-3.5 py-1 text-xs font-semibold text-white shadow-xs mb-2.5 border border-white/20">
                            {activeTheme.icon ? <span className="text-sm">{activeTheme.icon}</span> : null}
                            <span>{activeTheme.tagline || "Everyday essentials"}</span>
                        </div>

                        {/* Main Headline */}
                        <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight leading-[1.08] whitespace-pre-line">
                            {activeTheme.heroTitle}
                        </h1>

                        {/* Subtitle */}
                        <p className="mt-2 mb-4 max-w-xl text-xs sm:text-sm md:text-base text-white/90 font-medium leading-relaxed">
                            {activeTheme.heroSubtitle}
                        </p>

                        {/* Shop Now Button */}
                        <Link
                            href={selectedCategory === "all" ? "/categories" : `/products?category=${selectedCategory}`}
                            style={{ color: activeTheme.themeColor }}
                            className="inline-flex min-h-10 items-center gap-2 rounded-full bg-white px-6 py-2.5 text-xs sm:text-sm font-black shadow-md transition-all duration-300 hover:bg-slate-50 active:scale-95"
                        >
                            <span>Shop now</span>
                            <ArrowRight className="h-4 w-4 stroke-[2.5]" />
                        </Link>
                    </div>

                    {/* Integrated Today's Deal Bar (Soft, Less Dense Glassmorphism) */}
                    <div className="pt-3">
                        <Link
                            href={selectedCategory === "all" ? "/categories" : `/products?category=${selectedCategory}`}
                            className="group flex w-full items-center justify-between gap-3 rounded-full bg-black/15 hover:bg-black/20 backdrop-blur-md px-4 py-2 text-xs sm:text-sm text-white transition-all shadow-xs border border-white/15"
                        >
                            <div className="flex items-center gap-2 min-w-0">
                                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#f59e0b] text-[#78350f] font-black text-[10px]">
                                    %
                                </span>
                                <span className="font-black text-[#fcd34d] shrink-0">TODAY&apos;S DEAL:</span>
                                <span className="truncate text-white/95 font-medium text-xs">
                                    {activeTheme.dealText}
                                </span>
                            </div>
                            <ArrowRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-1 text-white/80" />
                        </Link>
                    </div>
                </div>
            </section>

            {/* Main Content Area on clean background */}
            <div className="mx-auto w-full max-w-[1280px] space-y-6 px-4 sm:px-6">
                {selectedCategory === "all" ? (
                    <>
                        <EditorialCategoryGrid />
                        <RecommendationSection />
                        <AllProductsSection />
                    </>
                ) : (
                    <AllProductsSection />
                )}
            </div>
        </div>
    );
}