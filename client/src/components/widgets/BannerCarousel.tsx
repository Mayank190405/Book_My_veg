"use client";

import { useState, useEffect, useCallback } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import Image from "next/image";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { getBanners } from "@/services/bannerService";
import { cn } from "@/lib/utils";
import { Leaf, ChevronRight } from "lucide-react";

export default function BannerCarousel() {
    const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true }, [
        Autoplay({ delay: 5000, stopOnInteraction: false }),
    ]);

    const [selectedIndex, setSelectedIndex] = useState(0);
    const [scrollSnaps, setScrollSnaps] = useState<number[]>([]);

    const { data: banners, isLoading } = useQuery({
        queryKey: ["banners"],
        queryFn: getBanners,
    });

    const onSelect = useCallback(() => {
        if (!emblaApi) return;
        setSelectedIndex(emblaApi.selectedScrollSnap());
    }, [emblaApi]);

    useEffect(() => {
        if (!emblaApi) return;
        setScrollSnaps(emblaApi.scrollSnapList());
        emblaApi.on("select", onSelect);
        onSelect();
        return () => { emblaApi.off("select", onSelect); };
    }, [emblaApi, onSelect, banners]);

    if (isLoading) {
        return (
            <div className="px-6 mt-2">
                <Skeleton className="w-full aspect-[16/9] rounded-3xl bg-slate-100 animate-pulse" />
            </div>
        );
    }

    if (!banners || banners.length === 0) return null;

    const getBannerHref = (banner: any) => {
        const { redirectType, redirectId, link } = banner;
        if (!redirectType) return link || "#";
        
        switch (redirectType.toLowerCase()) {
            case "category":
                return `/category/${redirectId}`;
            case "product":
                return `/products/${redirectId}`;
            case "coupon":
                return `/offers?coupon=${redirectId}`;
            case "search":
                return `/search?q=${encodeURIComponent(redirectId)}`;
            case "external":
            default:
                return link || "#";
        }
    };

    return (
        <div className="relative group px-6 mt-2 select-none animate-fade-in">
            {/* Carousel viewport */}
            <div className="overflow-hidden rounded-3xl shadow-sm border border-slate-100" ref={emblaRef}>
                <div className="flex">
                    {banners.map((banner: any, idx: number) => {
                        const href = getBannerHref(banner);
                        const isExternal = href.startsWith("http");
                        
                        const isDailyEssentials = banner.title?.toLowerCase() === "daily essentials";

                        const content = (
                            <div className="relative w-full h-full select-none bg-slate-100">
                                <Image
                                    src={banner.imageUrl}
                                    alt={banner.title || `Banner ${idx + 1}`}
                                    fill
                                    className="object-cover object-center scale-100 group-hover:scale-105 transition-all duration-700"
                                    sizes="100vw"
                                    priority={idx === 0}
                                />
                                {(banner.title || banner.subtitle) && (
                                    <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/35 to-transparent flex flex-col justify-center px-8 md:px-16 text-white py-4 select-none">
                                        {isDailyEssentials && (
                                            <div className="flex items-center gap-1.5 self-start bg-[#0b5c3e] border border-emerald-500/20 text-emerald-300 px-2.5 py-1 rounded-full mb-2">
                                                <Leaf className="w-3.5 h-3.5 text-emerald-300 fill-emerald-300/30" />
                                                <span className="text-[9px] font-black tracking-wider uppercase leading-none">FRESH & PURE</span>
                                            </div>
                                        )}
                                        {banner.title && (
                                            <h2 className="text-2xl md:text-4xl font-extrabold uppercase tracking-tight leading-tight max-w-[70%]">
                                                {isDailyEssentials ? (
                                                    <>
                                                        Daily <br className="hidden md:inline" />
                                                        <span className="text-[#bef264] font-black">Essentials</span>
                                                    </>
                                                ) : (
                                                    banner.title
                                                )}
                                            </h2>
                                        )}
                                        {banner.subtitle && (
                                            <p className="text-[10px] md:text-xs font-semibold text-slate-100 uppercase tracking-widest mt-1 max-w-[70%] leading-relaxed">
                                                {banner.subtitle}
                                            </p>
                                        )}
                                        {banner.buttonText && (
                                            <div className="mt-4 flex items-center justify-center bg-white hover:bg-slate-50 text-[#023324] text-[10px] font-black px-4 py-2.5 rounded-full shadow-md select-none self-start active:scale-95 transition-all">
                                                <span className="uppercase tracking-widest mr-2">{banner.buttonText}</span>
                                                <div className="w-5 h-5 rounded-full bg-[#023324] flex items-center justify-center text-white shrink-0">
                                                    <ChevronRight className="w-3.5 h-3.5 stroke-[3]" />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );

                        const slideClass = "relative flex-[0_0_100%] min-w-0 aspect-[16/9] overflow-hidden";

                        return isExternal ? (
                            <a key={banner.id || idx} href={href} target="_blank" rel="noreferrer" className={slideClass}>
                                {content}
                            </a>
                        ) : (
                            <Link key={banner.id || idx} href={href} className={slideClass}>
                                {content}
                            </Link>
                        );
                    })}
                </div>
            </div>

            {/* Indicator dots */}
            {banners.length > 1 && scrollSnaps.length > 0 && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2.5 z-10">
                    {scrollSnaps.map((_, idx: number) => (
                        <button
                            key={idx}
                            onClick={() => emblaApi?.scrollTo(idx)}
                            className={cn(
                                "rounded-full transition-all duration-300",
                                selectedIndex === idx
                                    ? "w-4 h-1.5 bg-white shadow-sm"
                                    : "w-1.5 h-1.5 bg-white/50 hover:bg-white/75"
                            )}
                            aria-label={`Go to slide ${idx + 1}`}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
