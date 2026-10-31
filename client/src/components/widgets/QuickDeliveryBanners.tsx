"use client";

import Image from "next/image";
import Link from "next/link";
import { Clock, Sparkles } from "lucide-react";

export default function QuickDeliveryBanners() {
    return (
        <div className="w-full px-4 sm:px-6 select-none">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Banner 1: Express Grocery */}
                <Link
                    href="/products"
                    className="relative overflow-hidden rounded-2xl bg-[#fef5ea] border border-[#fde4cb] p-4 flex items-center justify-between shadow-xs hover:shadow-md transition-all duration-300 group hover:-translate-y-0.5 active:scale-98"
                >
                    <div className="flex flex-col space-y-1 z-10">
                        <div className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-amber-800 bg-amber-100/70 px-2 py-0.5 rounded-full w-fit">
                            <Clock className="w-2.5 h-2.5" />
                            <span>By 12:15 PM</span>
                        </div>
                        <h4 className="text-base sm:text-lg font-black text-slate-800 tracking-tight leading-none group-hover:text-amber-900 transition-colors">
                            Fresh Produce
                        </h4>
                        <span className="text-xs font-bold text-amber-700/80">
                            Free delivery on orders
                        </span>
                    </div>

                    <div className="relative w-20 h-20 sm:w-24 sm:h-24 shrink-0 transform group-hover:scale-105 transition-transform duration-300">
                        <Image
                            src="/images/avocado_cutout.jpg"
                            alt="Avocado fresh produce"
                            fill
                            className="object-contain"
                            sizes="96px"
                        />
                    </div>
                </Link>

                {/* Banner 2: Wholesale / Farm Direct */}
                <Link
                    href="/products"
                    className="relative overflow-hidden rounded-2xl bg-[#fdeeed] border border-[#fbd3d1] p-4 flex items-center justify-between shadow-xs hover:shadow-md transition-all duration-300 group hover:-translate-y-0.5 active:scale-98"
                >
                    <div className="flex flex-col space-y-1 z-10">
                        <div className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-rose-800 bg-rose-100/70 px-2 py-0.5 rounded-full w-fit">
                            <Sparkles className="w-2.5 h-2.5" />
                            <span>Farm Direct</span>
                        </div>
                        <h4 className="text-base sm:text-lg font-black text-slate-800 tracking-tight leading-none group-hover:text-rose-900 transition-colors">
                            Wholesale & Bulk
                        </h4>
                        <span className="text-xs font-bold text-rose-700/80">
                            Fresh farm crates at Best Value
                        </span>
                    </div>

                    <div className="relative w-20 h-20 sm:w-24 sm:h-24 shrink-0 transform group-hover:scale-105 transition-transform duration-300">
                        <Image
                            src="/images/beetroot_cutout.jpg"
                            alt="Beetroot fresh produce"
                            fill
                            className="object-contain"
                            sizes="96px"
                        />
                    </div>
                </Link>
            </div>
        </div>
    );
}
