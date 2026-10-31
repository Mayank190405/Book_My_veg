"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Leaf, MessageCircle, ShoppingBag } from "lucide-react";
import RecommendationSection from "@/components/widgets/RecommendationSection";
import EditorialCategoryGrid from "@/components/widgets/EditorialCategoryGrid";
import AllProductsSection from "@/components/widgets/AllProductsSection";

export default function Home() {
    return (
        <div className="mx-auto w-full max-w-[1280px] space-y-7 pb-8">
            <section className="mx-4 mt-4 grid min-h-[180px] grid-cols-[1.15fr_1fr] overflow-hidden rounded-2xl bg-[#e8f7ef] sm:mx-6 sm:min-h-[280px]">
                <div className="relative z-10 flex flex-col items-start justify-center px-4 py-4 sm:px-10 sm:py-8">
                    <span className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#056647] sm:text-xs">Everyday essentials</span>
                    <h1 className="text-[25px] font-bold leading-[1.12] tracking-tight text-[#17251e] sm:text-4xl lg:text-5xl">Fresh picks.<br />For you.</h1>
                    <p className="mb-4 mt-3 max-w-xs text-xs leading-relaxed text-[#486052] sm:text-base">Vegetables, fruits and more.</p>
                    <Link href="/categories" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#087f5b] px-4 text-sm font-semibold text-white hover:bg-[#056647]">Shop now <ArrowRight className="h-4 w-4" /></Link>
                </div>
                <div className="relative min-h-full"><Image src="/images/hero_grocery_bag.jpg" alt="A grocery bag filled with vegetables" fill priority sizes="(max-width: 640px) 45vw, 600px" className="object-cover" /></div>
            </section>
            <EditorialCategoryGrid />
            <RecommendationSection />
            <section className="mx-4 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#e5ebe7] bg-white p-4 sm:mx-6 sm:p-6">
                <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#e8f7ef] text-[#087f5b]"><ShoppingBag className="h-5 w-5" /></span><div><h2 className="text-base font-semibold">Everything for your next meal</h2><p className="text-xs text-[#64736b]">Explore the full grocery collection.</p></div></div>
                <Link href="/products" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#087f5b]">Browse all <ArrowRight className="h-4 w-4" /></Link>
            </section>
            <AllProductsSection />
            <footer className="mx-4 border-t border-[#e5ebe7] pt-6 sm:mx-6">
                <div className="flex flex-wrap items-center justify-between gap-4"><span className="flex items-center gap-2 font-semibold text-[#087f5b]"><Leaf className="h-5 w-5" /> Book My Veg</span><Link href="/chat" className="flex min-h-11 items-center gap-2 text-sm text-[#64736b]"><MessageCircle className="h-4 w-4" />Need a hand? Talk to us</Link></div>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[#64736b]">{[["Privacy", "/privacy"], ["Terms", "/terms"], ["Exchange policy", "/exchange-policy"], ["Contact", "/contact"]].map(([label, href]) => <Link key={href} href={href} className="inline-flex min-h-11 items-center">{label}</Link>)}</div>
            </footer>
        </div>
    );
}
