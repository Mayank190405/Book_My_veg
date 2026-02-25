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

export default function BannerCarousel() {
    const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true }, [
        Autoplay({ delay: 3000, stopOnInteraction: false }),
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
    }, [emblaApi, onSelect]);

    if (isLoading) {
        return <Skeleton className="w-full h-52 md:h-72 rounded-[2rem] bg-white/5" />;
    }

    if (!banners || banners.length === 0) {
        return null;
    }

    return (
        <div className="relative group">
            {/* Carousel viewport */}
            <div className="overflow-hidden rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/5" ref={emblaRef}>
                <div className="flex">
                    {banners.map((banner: any, idx: number) => {
                        const href = banner.link || "#";
                        const isExternal = href.startsWith("http");
                        const content = (
                            <div className="relative flex-[0_0_100%] min-w-0 h-56 md:h-80">
                                <Image
                                    src={banner.imageUrl || "https://placehold.co/800x400/0b2820/ffffff?text=Premium+Selection"}
                                    alt={banner.title || `Banner ${idx + 1}`}
                                    fill
                                    className="object-cover transition-transform duration-1000 group-hover:scale-105"
                                    sizes="100vw"
                                    priority={idx === 0}
                                />
                                {/* Premium Overlay Gradient */}
                                <div className="absolute inset-0 bg-gradient-to-t from-[#061512] via-transparent to-black/10" />

                                {/* Glass Overlay with title */}
                                {banner.title && (
                                    <div className="absolute bottom-6 left-6 right-6">
                                        <div className="bg-white/10 backdrop-blur-xl p-4 rounded-2xl border border-white/10 shadow-2xl max-w-max animate-fade-in">
                                            <p className="text-white font-black text-xl md:text-2xl tracking-tighter drop-shadow-lg">{banner.title}</p>
                                            {banner.description && (
                                                <p className="text-white/60 text-xs md:text-sm font-bold mt-1 line-clamp-1 uppercase tracking-widest">{banner.description}</p>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );

                        return isExternal ? (
                            <a key={banner.id} href={href} target="_blank" rel="noreferrer" className="block w-full">
                                {content}
                            </a>
                        ) : (
                            <Link key={banner.id} href={href} className="block w-full">
                                {content}
                            </Link>
                        );
                    })}
                </div>
            </div>

            {/* Indicator dots */}
            {banners.length > 1 && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 z-10 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 shadow-xl">
                    {scrollSnaps.map((_, idx) => (
                        <button
                            key={idx}
                            onClick={() => emblaApi?.scrollTo(idx)}
                            className={cn(
                                "rounded-full transition-all duration-500",
                                selectedIndex === idx
                                    ? "w-8 h-1.5 bg-green-400 shadow-[0_0_10px_rgba(74,222,128,0.5)]"
                                    : "w-1.5 h-1.5 bg-white/20 hover:bg-white/40"
                            )}
                            aria-label={`Go to slide ${idx + 1}`}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
