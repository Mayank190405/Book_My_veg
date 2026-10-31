"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Bell, Search, ShoppingCart, UserRound } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import LocationSelector from "@/components/features/LocationSelector";
import NotificationDrawer from "@/components/ui/NotificationDrawer";
import { useUserStore } from "@/store/useUserStore";
import { useCartStore } from "@/store/useCartStore";
import { getNotifications } from "@/services/notificationService";

export default function Header() {
    const pathname = usePathname();
    const isHome = pathname === "/";
    const [scrolled, setScrolled] = useState(false);
    const [notificationsOpen, setNotificationsOpen] = useState(false);
    const [localUnread, setLocalUnread] = useState(0);
    const { user, _hasHydrated } = useUserStore();
    const totalItems = useCartStore(state => state.totalItems);
    const signedIn = _hasHydrated && !!user && user.name !== "Guest" && user.role !== "GUEST";

    const { data: notifications } = useQuery({
        queryKey: ["notifications"],
        queryFn: getNotifications,
        enabled: signedIn,
        refetchInterval: 30000,
    });

    useEffect(() => {
        try {
            const cached = JSON.parse(localStorage.getItem("bookmyveg_local_notifications") || "[]");
            setLocalUnread(Array.isArray(cached) ? cached.filter((item: { isRead?: boolean }) => !item.isRead).length : 0);
        } catch {
            setLocalUnread(0);
        }
    }, [notificationsOpen]);

    useEffect(() => {
        if (!isHome) return;
        const container = document.getElementById("main-scroll-container");
        if (!container) return;

        const handleScroll = () => {
            setScrolled(container.scrollTop > 220);
        };

        container.addEventListener("scroll", handleScroll, { passive: true });
        handleScroll();
        return () => container.removeEventListener("scroll", handleScroll);
    }, [isHome]);

    const unread = signedIn ? notifications?.filter(item => !item.isRead).length || 0 : localUnread;

    // On homepage, the unified green canopy in HeroBanner provides the top header.
    // When scrolled down past the canopy, render a compact sticky dark-green header with NO logo.
    if (isHome) {
        if (!scrolled) return null;

        return (
            <header className="bmv-header bmv-topbar fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#06241a]/95 backdrop-blur-md text-white transition-all duration-300">
                <div className="mx-auto max-w-[1280px] px-4 py-2.5 sm:px-6 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                        <LocationSelector isCompact variant="hero" />
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
                        <Link
                            href="/search"
                            aria-label="Search"
                            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
                        >
                            <Search className="h-4 w-4" />
                        </Link>
                        <button
                            type="button"
                            aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
                            onClick={() => setNotificationsOpen(true)}
                            className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
                        >
                            <Bell className="h-4 w-4" />
                            {unread > 0 && (
                                <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#ef4444] px-1 text-[10px] font-bold text-white">
                                    {unread > 9 ? "9+" : unread}
                                </span>
                            )}
                        </button>
                        <Link
                            href="/cart"
                            aria-label={`Cart, ${totalItems} items`}
                            className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
                        >
                            <ShoppingCart className="h-4 w-4" />
                            {totalItems > 0 && (
                                <span className="absolute -right-1 -top-1 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-[#bef264] px-1 text-[10px] font-black text-[#07241a]">
                                    {totalItems}
                                </span>
                            )}
                        </Link>
                        <Link
                            href={signedIn ? "/account" : "/login"}
                            aria-label={signedIn ? "My account" : "Log in"}
                            className="flex h-10 w-10 items-center justify-center rounded-full bg-[#bef264]/20 border border-[#bef264]/40 font-bold text-[#bef264] text-xs"
                        >
                            {signedIn ? user?.name?.charAt(0).toUpperCase() || <UserRound className="h-4 w-4" /> : <UserRound className="h-4 w-4" />}
                        </Link>
                    </div>
                </div>
                <NotificationDrawer open={notificationsOpen} onClose={() => setNotificationsOpen(false)} />
            </header>
        );
    }

    // Standard header for non-homepage routes
    return (
        <header className="bmv-header bmv-topbar fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#004b30] text-white">
            <div className="mx-auto max-w-[1280px] px-4 py-3 sm:px-6">
                <div className="flex items-center justify-between gap-3">
                    <Link href="/" className="flex min-h-11 items-center gap-2.5">
                        <Image
                            src="/logo.png"
                            alt="Book My Veg"
                            width={36}
                            height={36}
                            priority
                            className="h-9 w-9 object-contain rounded-lg shrink-0"
                        />
                        <span className="text-lg font-bold tracking-tight text-[#087f5b] sm:text-xl">
                            Book My Veg
                        </span>
                    </Link>
                    <div className="flex items-center gap-1 sm:gap-3">
                        <button type="button" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`} onClick={() => setNotificationsOpen(true)} className="relative flex h-11 w-11 items-center justify-center rounded-full text-slate-600 hover:bg-slate-50">
                            <Bell className="h-5 w-5" />
                            {unread > 0 && <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#c92a2a] px-1 text-[10px] font-bold text-white">{unread > 9 ? "9+" : unread}</span>}
                        </button>
                        <Link href="/cart" aria-label={`Cart, ${totalItems} items`} className="relative flex h-11 w-11 items-center justify-center rounded-full text-slate-600 hover:bg-slate-50">
                            <ShoppingCart className="h-5 w-5" />
                            {totalItems > 0 && <span className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#087f5b] px-1 text-[10px] font-bold text-white">{totalItems}</span>}
                        </Link>
                        <Link href={signedIn ? "/account" : "/login"} aria-label={signedIn ? "My account" : "Log in"} className="flex h-11 w-11 items-center justify-center rounded-full bg-[#e8f7ef] font-semibold text-[#087f5b]">
                            {signedIn ? user?.name?.charAt(0).toUpperCase() || <UserRound className="h-5 w-5" /> : <UserRound className="h-5 w-5" />}
                        </Link>
                    </div>
                </div>
                <div className="mt-1 flex min-w-0 items-center gap-6">
                    <div className="min-w-0 flex-1"><LocationSelector isCompact variant="default" /></div>
                    <nav aria-label="Main navigation" className="hidden items-center gap-6 text-sm font-medium text-slate-600 lg:flex">
                        <Link href="/categories">Categories</Link><Link href="/orders">My orders</Link><Link href="/contact">Help & support</Link>
                    </nav>
                </div>
                <Link href="/search" className="bmv-search mt-3 flex h-12 items-center gap-3 rounded-full border border-[#e5ebe7] bg-white px-3 text-sm text-[#64736b]">
                    <Search className="h-4 w-4 shrink-0" aria-hidden="true" /><span className="truncate">Search vegetables, fruits and more</span>
                </Link>
            </div>
            <NotificationDrawer open={notificationsOpen} onClose={() => setNotificationsOpen(false)} />
        </header>
    );
}
