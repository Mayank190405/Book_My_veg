"use client";

import Link from "next/link";
import { ArrowRight, Leaf, MessageCircle, ShoppingBag } from "lucide-react";
import HeroBanner from "@/components/widgets/HeroBanner";
import FeatureValueProps from "@/components/widgets/FeatureValueProps";
import RecommendationSection from "@/components/widgets/RecommendationSection";
import EditorialCategoryGrid from "@/components/widgets/EditorialCategoryGrid";
import AllProductsSection from "@/components/widgets/AllProductsSection";

export default function Home() {
    return (
        <div className="w-full space-y-6 sm:space-y-8 pb-8">
            {/* Single Color Hero Banner */}
            <HeroBanner />

            {/* 4 Value Props Feature Strip */}
            <FeatureValueProps />

            <div className="mx-auto w-full max-w-[1280px] space-y-6 sm:space-y-8">
                {/* Shop by Category */}
                <EditorialCategoryGrid />

                {/* Recommended for You */}
                <RecommendationSection />

                <section className="mx-4 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#e5ebe7] bg-white p-4 sm:mx-6 sm:p-6 shadow-xs">
                    <div className="flex items-center gap-3">
                        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#e8f7ef] text-[#087f5b]">
                            <ShoppingBag className="h-5 w-5" />
                        </span>
                        <div>
                            <h2 className="text-base font-semibold text-slate-800">Everything for your daily meals</h2>
                            <p className="text-xs text-[#64736b]">Browse vegetables, fruits and everyday essentials.</p>
                        </div>
                    </div>
                    <Link href="/products" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#087f5b]">
                        Browse all <ArrowRight className="h-4 w-4" />
                    </Link>
                </section>

                <AllProductsSection />

                <footer className="mx-4 border-t border-[#e5ebe7] pt-6 sm:mx-6">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <span className="flex items-center gap-2 font-semibold text-[#087f5b]">
                            <Leaf className="h-5 w-5" /> Book My Veg
                        </span>
                        <Link href="/chat" className="flex min-h-11 items-center gap-2 text-sm text-[#64736b]">
                            <MessageCircle className="h-4 w-4" />Need a hand? Talk to us
                        </Link>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[#64736b]">
                        {[["Privacy", "/privacy"], ["Terms", "/terms"], ["Exchange policy", "/exchange-policy"], ["Contact", "/contact"]].map(([label, href]) => (
                            <Link key={href} href={href} className="inline-flex min-h-11 items-center">
                                {label}
                            </Link>
                        ))}
                    </div>
                </footer>
            </div>
        </div>
    );
}
