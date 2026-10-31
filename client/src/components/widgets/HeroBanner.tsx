"use client";

import Image from "next/image";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { getBanners } from "@/services/bannerService";

export default function HeroBanner() {
    const { data: banners } = useQuery({
        queryKey: ["banners"],
        queryFn: getBanners,
    });

    const activeBanner = banners && banners.length > 0 ? banners[0] : null;

    const title = activeBanner?.title || "We bring the store to your door";
    const subtitle = activeBanner?.subtitle || "Get organic produce and sustainably sourced groceries delivery at best market value.";
    const buttonText = activeBanner?.buttonText || "Shop now";
    const buttonLink = activeBanner?.link || "/products";

    return (
        <div className="relative w-full px-4 sm:px-6 select-none animate-fade-in">
            {/* Main Rounded Hero Card */}
            <div className="relative overflow-hidden rounded-[2.2rem] sm:rounded-[2.75rem] bg-[#0c392c] text-white shadow-xl">
                {/* 1. Subtle Radial Glows */}
                <div className="absolute top-0 right-1/4 w-96 h-96 bg-emerald-400/15 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -bottom-10 left-10 w-80 h-80 bg-lime-400/10 rounded-full blur-3xl pointer-events-none" />

                {/* 2. Hand-crafted Organic Produce Line Doodles Overlay */}
                <svg
                    className="absolute inset-0 w-full h-full opacity-[0.08] pointer-events-none"
                    viewBox="0 0 1000 400"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    {/* Carrot */}
                    <path d="M 120 70 Q 140 110 160 160 Q 145 130 115 80 Z" strokeLinecap="round" />
                    <path d="M 115 70 Q 105 50 95 40 M 120 70 Q 120 45 125 35 M 125 70 Q 140 55 150 45" strokeLinecap="round" />
                    {/* Tomato / Apple */}
                    <circle cx="280" cy="110" r="35" />
                    <path d="M 280 75 Q 285 60 295 55 M 275 75 Q 265 65 255 70" strokeLinecap="round" />
                    {/* Bell Pepper */}
                    <path d="M 450 70 C 430 70 420 90 425 130 C 430 150 460 160 480 155 C 500 150 515 135 510 100 C 505 80 490 70 475 70 C 465 70 460 75 450 70 Z" strokeLinecap="round" />
                    {/* Leaves / Greens */}
                    <path d="M 680 100 C 660 70 630 65 610 80 C 590 95 600 130 630 140 C 660 150 680 130 680 100 Z" />
                    <path d="M 610 80 Q 645 110 680 100" />
                    {/* Broccoli outline */}
                    <path d="M 80 260 C 60 240 70 210 95 210 C 110 190 140 190 155 210 C 180 210 190 240 170 260 Z" />
                    <path d="M 115 260 L 115 290 L 135 290 L 135 260" strokeLinecap="round" />
                    {/* Subtle Leaf Sprigs */}
                    <path d="M 820 60 Q 850 80 840 110 Q 820 100 820 60 Z" />
                    <path d="M 860 140 Q 890 155 885 180 Q 865 170 860 140 Z" />
                </svg>

                {/* 3. Hero Content Grid */}
                <div className="relative z-10 grid grid-cols-1 md:grid-cols-12 items-center px-6 sm:px-10 md:px-14 pt-8 sm:pt-12 md:pt-14 pb-14 sm:pb-16 md:pb-20 gap-6">
                    {/* Left Column: Headline, Subtitle, Shop Now Pill */}
                    <div className="md:col-span-7 flex flex-col items-start justify-center space-y-4 sm:space-y-5 max-w-xl">
                        {/* Headline matching Dribbble layout */}
                        <h1 className="text-3xl sm:text-4xl md:text-[44px] lg:text-[50px] font-extrabold tracking-tight leading-[1.08] text-white">
                            We bring the store <br />
                            to your door
                        </h1>

                        {/* Subtitle */}
                        <p className="text-xs sm:text-[13px] md:text-sm text-white/80 font-normal leading-relaxed max-w-sm sm:max-w-md">
                            {subtitle}
                        </p>

                        {/* Pill Button matching Dribbble "Shop now" button */}
                        <div className="pt-2">
                            <Link
                                href={buttonLink}
                                className="inline-flex items-center justify-center bg-[#c6f07a] hover:bg-[#b5e566] text-[#0d3b2e] font-extrabold text-xs sm:text-[13px] px-7 py-3 rounded-full shadow-md shadow-black/15 transition-all transform hover:-translate-y-0.5 active:scale-95"
                            >
                                <span>{buttonText}</span>
                            </Link>
                        </div>
                    </div>

                    {/* Right Column: 3D Tote Bag */}
                    <div className="md:col-span-5 flex items-center justify-center md:justify-end relative mt-2 md:mt-0">
                        <div className="relative w-52 h-52 sm:w-60 sm:h-60 md:w-72 md:h-72 lg:w-80 lg:h-80 flex items-center justify-center">
                            {/* Soft radial shadow under the bag */}
                            <div className="absolute -bottom-2 w-3/4 h-8 bg-black/40 rounded-full blur-md" />
                            
                            <Image
                                src="/images/hero_grocery_bag.jpg"
                                alt="Fresh groceries and produce bag"
                                fill
                                priority
                                className="object-contain drop-shadow-[0_20px_30px_rgba(0,0,0,0.5)] transform hover:scale-105 transition-transform duration-500 rounded-3xl"
                                sizes="(max-width: 768px) 260px, 340px"
                            />
                        </div>
                    </div>
                </div>

                {/* 4. Organic Wavy Bottom Edge Transition */}
                <div className="absolute bottom-0 left-0 right-0 w-full overflow-hidden leading-none pointer-events-none">
                    <svg
                        className="relative block w-full h-5 sm:h-7 md:h-9 text-[#fbfdfc] dark:text-[#061512]"
                        viewBox="0 0 1200 60"
                        preserveAspectRatio="none"
                        fill="currentColor"
                    >
                        <path d="M0,0 C180,45 350,15 600,35 C850,55 1020,20 1200,30 L1200,60 L0,60 Z" />
                    </svg>
                </div>
            </div>
        </div>
    );
}
