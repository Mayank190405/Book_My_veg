"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { getCategories } from "@/services/categoryService";
import LocationSelector from "@/components/features/LocationSelector";
import NotificationDrawer from "@/components/ui/NotificationDrawer";
import { useUserStore } from "@/store/useUserStore";
import { useCartStore } from "@/store/useCartStore";
import { getNotifications } from "@/services/notificationService";
import { Bell, Search, ShoppingCart, UserRound, ArrowRight, Leaf, Snowflake, Heart } from "lucide-react";

// Curated pastel themes & icons matching the reference screenshot
const CATEGORY_THEMES: Record<string, { bg: string; icon?: any; customImage?: string }> = {
    vegetable: { bg: "bg-[#eef7f2]" },
    fruits: { bg: "bg-[#fefce8]" },
    dairy: { bg: "bg-[#f0f9ff]" },
    essentials: { bg: "bg-[#f0fdf4]" },
    grains: { bg: "bg-[#f0fdf4]" },
    snacks: { bg: "bg-[#fffbeb]" },
    beverages: { bg: "bg-[#f0fdfa]" },
    meat: { bg: "bg-[#fdf2f2]" },
    bakery: { bg: "bg-[#fffbeb]" },
    frozen: { bg: "bg-[#f0f9ff]", icon: Snowflake },
    health: { bg: "bg-[#f0fdf4]", icon: Heart },
    personal: { bg: "bg-[#f5f3ff]" },
    home: { bg: "bg-[#f7fee7]" },
};

function getCategoryTheme(name: string, index: number) {
    const lower = name.toLowerCase();
    for (const [key, theme] of Object.entries(CATEGORY_THEMES)) {
        if (lower.includes(key)) return theme;
    }
    const defaultBgs = [
        "bg-[#eef7f2]",
        "bg-[#fefce8]",
        "bg-[#f0f9ff]",
        "bg-[#f0fdf4]",
        "bg-[#fffbeb]",
        "bg-[#f0fdfa]",
        "bg-[#fdf2f2]",
        "bg-[#f5f3ff]",
        "bg-[#f7fee7]"
    ];
    return { bg: defaultBgs[index % defaultBgs.length] };
}

export default function CategoriesPage() {
    const [notificationsOpen, setNotificationsOpen] = useState(false);
    const { user, _hasHydrated } = useUserStore();
    const totalItems = useCartStore(state => state.totalItems);
    const signedIn = _hasHydrated && !!user && user.name !== "Guest" && user.role !== "GUEST";

    const { data: notifications } = useQuery({
        queryKey: ["notifications"],
        queryFn: getNotifications,
        enabled: signedIn,
        refetchInterval: 30000,
    });

    const unread = signedIn ? notifications?.filter(item => !item.isRead).length || 0 : 0;

    const { data: categories, isLoading, isError, refetch } = useQuery({
        queryKey: ["categories"],
        queryFn: getCategories,
    });

    const categoryList = Array.isArray(categories) ? categories : (categories as any)?.data || [];

    return (
        <div className="w-full pb-28 bg-white min-h-screen">
            {/* 1. Top Green Header Bar (matching screenshot) */}
            <header className="w-full bg-[#006c45] text-white pt-3 pb-4 px-4 sm:px-6 shadow-md">
                <div className="mx-auto max-w-7xl">
                    {/* Top Row: Location & Actions */}
                    <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                            <LocationSelector isCompact variant="hero" />
                        </div>

                        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                            {/* Notification Bell with green dot */}
                            <button
                                type="button"
                                aria-label="Notifications"
                                onClick={() => setNotificationsOpen(true)}
                                className="relative flex h-11 w-11 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white backdrop-blur-sm transition-all"
                            >
                                <Bell className="h-5 w-5" />
                                {unread > 0 ? (
                                    <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-[#c5ef75] ring-2 ring-[#006c45]" />
                                ) : null}
                            </button>

                            {/* Cart Icon with green count badge */}
                            <Link
                                href="/cart"
                                aria-label={`Cart, ${totalItems} items`}
                                className="relative flex h-11 w-11 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white backdrop-blur-sm transition-all"
                            >
                                <ShoppingCart className="h-5 w-5" />
                                {totalItems > 0 && (
                                    <span className="absolute -right-1 -top-1 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-[#c5ef75] px-1 text-[10px] font-black text-[#07241a] shadow-xs">
                                        {totalItems}
                                    </span>
                                )}
                            </Link>

                            {/* Account Avatar */}
                            <Link
                                href={signedIn ? "/account" : "/login"}
                                aria-label={signedIn ? "My account" : "Log in"}
                                className="flex h-11 w-11 items-center justify-center rounded-full bg-[#c5ef75]/20 hover:bg-[#c5ef75]/30 border border-[#c5ef75]/40 font-bold text-[#c5ef75] text-sm active:scale-95 transition-all"
                            >
                                {signedIn ? user?.name?.charAt(0).toUpperCase() || <UserRound className="h-5 w-5" /> : <UserRound className="h-5 w-5" />}
                            </Link>
                        </div>
                    </div>

                    {/* Search Bar - White Pill */}
                    <div className="mt-3.5">
                        <Link
                            href="/search"
                            className="flex h-12 w-full items-center justify-between gap-3 rounded-full bg-white px-4 text-slate-500 shadow-md hover:bg-slate-50 transition-all border border-white/20"
                        >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                                <Search className="h-5 w-5 text-emerald-800 shrink-0" aria-hidden="true" />
                                <span className="truncate text-sm font-normal text-slate-400">
                                    Search vegetables, fruits and more
                                </span>
                            </div>
                            <ArrowRight className="h-5 w-5 shrink-0 text-[#006c45]" />
                        </Link>
                    </div>
                </div>
            </header>

            {/* 2. Main Categories Grid Section */}
            <main className="mx-auto max-w-7xl px-4 sm:px-6 pt-5 sm:pt-6">
                {/* Title & Subtitle */}
                <div className="mb-4 sm:mb-5">
                    <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
                        Shop by Category
                    </h1>
                    <p className="mt-0.5 text-xs sm:text-sm text-slate-500">
                        Explore our wide range of fresh &amp; daily essentials
                    </p>
                </div>

                {isLoading ? (
                    <div className="grid grid-cols-2 min-[360px]:grid-cols-3 gap-2.5 sm:gap-4 lg:grid-cols-4 xl:grid-cols-6">
                        {Array.from({ length: 9 }, (_, i) => (
                            <div key={i} className="aspect-[4/3] rounded-2xl bg-slate-200/60 animate-pulse" />
                        ))}
                    </div>
                ) : isError ? (
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
                        <p className="text-sm text-slate-600">Could not load categories</p>
                        <button
                            onClick={() => refetch()}
                            className="mt-3 min-h-11 px-4 py-2 bg-[#006c45] text-white text-xs font-bold rounded-lg"
                        >
                            Retry
                        </button>
                    </div>
                ) : categoryList.length === 0 ? (
                    <div className="rounded-2xl border border-[#e0e9df] p-8 text-center text-sm text-[#63786b]">No categories available yet. Please check back soon.</div>
                ) : (
                    <div className="grid grid-cols-2 min-[360px]:grid-cols-3 gap-2.5 sm:gap-4 lg:grid-cols-4 xl:grid-cols-6">
                        {categoryList.map((cat: any, idx: number) => {
                            const theme = getCategoryTheme(cat.name, idx);
                            const IconComponent = theme.icon;

                            return (
                                <Link
                                    key={cat.id}
                                    href={`/category/${cat.id}`}
                                    className={`group relative flex flex-col justify-between ${theme.bg} rounded-2xl sm:rounded-3xl p-3 sm:p-4 aspect-square border border-black/5 shadow-[0_2px_8px_rgba(0,0,0,0.03)] hover:shadow-md transition-all active:scale-[0.98] overflow-hidden`}
                                >
                                    {/* Category Image / Icon */}
                                    <div className="relative w-full flex-1 flex items-center justify-center min-h-[50px] sm:min-h-[70px]">
                                        {cat.imageUrl ? (
                                            <Image
                                                src={cat.imageUrl}
                                                alt={cat.name}
                                                fill
                                                sizes="(max-width: 600px) 30vw, 160px"
                                                className="object-contain p-1 group-hover:scale-105 transition-transform duration-300 drop-shadow-sm"
                                            />
                                        ) : IconComponent ? (
                                            <IconComponent className="h-8 w-8 sm:h-10 sm:w-10 text-[#006c45]" />
                                        ) : (
                                            <Leaf className="h-8 w-8 sm:h-10 sm:w-10 text-[#006c45]" />
                                        )}
                                    </div>

                                    {/* Bottom Title & Arrow */}
                                    <div className="flex items-center justify-between gap-1 mt-1 pt-1 border-t border-black/5">
                                        <span className="font-semibold text-xs sm:text-sm text-slate-900 group-hover:text-[#006c45] transition-colors line-clamp-2">
                                            {cat.name}
                                        </span>
                                        <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-700 shrink-0 group-hover:translate-x-0.5 transition-transform" />
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                )}

                {/* 3. Bottom A little of everything Promo Banner (matching screenshot) */}
                <div className="mt-8 rounded-3xl bg-[#0b3c2c] text-white p-5 sm:p-7 relative overflow-hidden shadow-lg">
                    {/* Subtle glow */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-[#c5ef75]/10 rounded-full blur-2xl pointer-events-none" />

                    <div className="relative z-10 grid grid-cols-[1.2fr_1fr] sm:grid-cols-[1.5fr_1fr] items-center gap-4">
                        <div className="space-y-2">
                            <div className="inline-flex items-center gap-1.5 text-[10px] sm:text-xs font-black uppercase tracking-wider text-[#c5ef75]">
                                <Leaf className="h-3.5 w-3.5 fill-current" />
                                <span>YOUR DAILY SHOP</span>
                            </div>
                            <h2 className="text-xl sm:text-3xl font-black text-white leading-tight">
                                A little of everything
                            </h2>
                            <p className="text-xs sm:text-sm text-white/80 max-w-sm leading-relaxed">
                                Explore products for your kitchen and home.
                            </p>
                            <div className="pt-2">
                                <Link
                                    href="/products"
                                    className="inline-flex items-center gap-2 bg-[#c5ef75] hover:bg-[#aee64c] text-[#07241a] font-black text-xs sm:text-sm px-5 sm:px-6 py-2.5 rounded-full shadow-md active:scale-95 transition-all"
                                >
                                    <span>Explore products</span>
                                    <ArrowRight className="h-4 w-4 stroke-[2.5]" />
                                </Link>
                            </div>
                        </div>

                        {/* Veggie Basket Illustration */}
                        <div className="relative h-28 sm:h-40 flex items-center justify-end">
                            <Image
                                src="/images/hero_grocery_bag.jpg"
                                alt="Fresh Veggie Basket"
                                fill
                                className="object-contain drop-shadow-xl rounded-2xl"
                                sizes="(max-width: 640px) 40vw, 200px"
                            />
                        </div>
                    </div>

                </div>
            </main>

            <NotificationDrawer open={notificationsOpen} onClose={() => setNotificationsOpen(false)} />
        </div>
    );
}
