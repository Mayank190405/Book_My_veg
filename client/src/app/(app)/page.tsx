"use client";

import BannerCarousel from "@/components/widgets/BannerCarousel";
import TrendingCategories from "@/components/widgets/TrendingCategories";
import TrendingSection from "@/components/widgets/TrendingSection";
import BuyAgain from "@/components/widgets/BuyAgain";
import ShopByInterest from "@/components/widgets/ShopByInterest";
import CategoryGrid from "@/components/widgets/CategoryGrid";
import AllProductsSection from "@/components/widgets/AllProductsSection";
import Link from "next/link";

export default function Home() {
  return (
    <div className="relative pb-32">
      <main className="space-y-12 pt-28">
        {/* ── 1. Premium Promotions ── */}
        <section className="px-6">
          <BannerCarousel />
        </section>

        {/* ── 2. Trending Selection ── */}
        <div className="space-y-10">
          <section>
            <TrendingCategories />
          </section>

          <section className="px-5">
            <TrendingSection />
          </section>
        </div>

        {/* ── 3. Personalized ── */}
        <section className="px-5">
          <BuyAgain />
        </section>

        {/* ── 4. Quick-Scan Categories ── */}
        <section className="px-5">
          <div className="px-1 mb-4">
            <h2 className="text-xl font-black text-emerald-950 tracking-tight uppercase tracking-widest leading-none">Browse All</h2>
          </div>
          <CategoryGrid />
        </section>

        {/* ── 5. Interest Based ── */}
        <section className="px-5">
          <ShopByInterest />
        </section>

        {/* ── 6. All Products ── */}
        <section className="px-5">
          <AllProductsSection />
        </section>
      </main>
    </div>
  );
}
