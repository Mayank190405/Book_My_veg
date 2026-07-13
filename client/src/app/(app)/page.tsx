"use client";

import { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import BannerCarousel from "@/components/widgets/BannerCarousel";
import CategoryCircles from "@/components/widgets/CategoryCircles";
import TrendingCategories from "@/components/widgets/TrendingCategories";
import TrendingSection from "@/components/widgets/TrendingSection";
import PromoStrip from "@/components/widgets/PromoStrip";
import BuyAgain from "@/components/widgets/BuyAgain";
import AllProductsSection from "@/components/widgets/AllProductsSection";

export default function Home() {
    const queryClient = useQueryClient();
    const [refreshing, setRefreshing] = useState(false);
    const [pullDistance, setPullDistance] = useState(0);

    const pullDistanceRef = useRef(0);

    useEffect(() => {
        const container = document.getElementById("main-scroll-container");
        if (!container) return;

        let startY = 0;
        let isPulling = false;

        const handleTouchStart = (e: TouchEvent) => {
            if (container.scrollTop === 0) {
                startY = e.touches[0].clientY;
                isPulling = true;
            }
        };

        const handleTouchMove = (e: TouchEvent) => {
            if (!isPulling) return;
            const currentY = e.touches[0].clientY;
            const diff = currentY - startY;
            if (diff > 0) {
                const dist = Math.min(80, diff * 0.4);
                pullDistanceRef.current = dist;
                setPullDistance(dist);
                if (diff > 10) {
                    e.preventDefault();
                }
            } else {
                isPulling = false;
                pullDistanceRef.current = 0;
                setPullDistance(0);
            }
        };

        const handleTouchEnd = async () => {
            if (!isPulling) return;
            isPulling = false;

            const dist = pullDistanceRef.current;
            pullDistanceRef.current = 0;
            setPullDistance(0);

            if (dist >= 60) {
                setRefreshing(true);
                await queryClient.refetchQueries();
                setRefreshing(false);
            }
        };

        container.addEventListener("touchstart", handleTouchStart, { passive: true });
        container.addEventListener("touchmove", handleTouchMove, { passive: false });
        container.addEventListener("touchend", handleTouchEnd, { passive: true });

        return () => {
            container.removeEventListener("touchstart", handleTouchStart);
            container.removeEventListener("touchmove", handleTouchMove);
            container.removeEventListener("touchend", handleTouchEnd);
        };
    }, [queryClient]);


    return (
        <div className="relative pb-32 select-none overflow-x-hidden w-full">
            {/* Pull to refresh indicator */}
            <div 
                className="flex items-center justify-center transition-all duration-300 overflow-hidden bg-emerald-500/5 text-emerald-800"
                style={{ 
                    height: refreshing ? "50px" : `${pullDistance}px`,
                    opacity: refreshing || pullDistance > 0 ? 1 : 0
                }}
            >
                <div className="flex items-center gap-2 py-2">
                    <div className={cn("w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full", (refreshing || pullDistance >= 60) && "animate-spin")} />
                    <span className="text-[10px] font-black uppercase tracking-wider">
                        {refreshing ? "Refreshing Freshness..." : pullDistance >= 60 ? "Release to Refresh" : "Pull Down to Refresh"}
                    </span>
                </div>
            </div>

            <div className="space-y-6">
                <BannerCarousel />
                
                <div className="px-5 space-y-8">
                    <CategoryCircles />
                    <TrendingCategories />
                    <TrendingSection />
                    <PromoStrip />
                    <BuyAgain />
                    <AllProductsSection />
                </div>
            </div>
        </div>
    );
}
