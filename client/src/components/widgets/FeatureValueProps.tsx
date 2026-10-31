"use client";

import { ShoppingBasket, Layers, PackageCheck, MessageCircle } from "lucide-react";
import Link from "next/link";

const features = [
    { icon: ShoppingBasket, title: "Shop groceries", subtitle: "Explore the catalog", href: "/categories" },
    { icon: Layers, title: "Choose your pack", subtitle: "Browse product details", href: "/products" },
    { icon: PackageCheck, title: "Your orders", subtitle: "View the latest status", href: "/orders" },
    { icon: MessageCircle, title: "Here to help", subtitle: "Contact support", href: "/contact" },
];

export default function FeatureValueProps() {
    return (
        <section className="px-4 sm:px-6 -mt-2 sm:-mt-4 relative z-20">
            <div className="mx-auto max-w-[1280px] rounded-2xl sm:rounded-3xl border border-[#eef2ef] bg-white p-3 sm:p-4 shadow-[0_4px_24px_rgba(0,0,0,0.04)]">
                <div className="grid grid-cols-4 divide-x divide-slate-100">
                    {features.map((feature, idx) => {
                        const Icon = feature.icon;
                        return (
                            <Link
                                href={feature.href}
                                key={idx}
                                className="flex min-h-20 flex-col items-center justify-center rounded-xl px-1 text-center hover:bg-[#f4f9ed] sm:px-3"
                            >
                                <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-xl text-[#087f5b]">
                                    <Icon className="h-5 w-5 sm:h-6 sm:w-6 stroke-[2]" />
                                </div>
                                <h3 className="mt-1 font-bold text-[11px] sm:text-sm text-slate-900 leading-tight">
                                    {feature.title}
                                </h3>
                                <p className="mt-0.5 text-[11px] sm:text-xs text-slate-500 leading-tight line-clamp-2 max-w-full">
                                    {feature.subtitle}
                                </p>
                            </Link>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
