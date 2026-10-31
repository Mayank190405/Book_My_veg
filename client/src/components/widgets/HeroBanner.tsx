"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Bell, Search, ShoppingCart, UserRound, Leaf, ArrowRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import LocationSelector from "@/components/features/LocationSelector";
import NotificationDrawer from "@/components/ui/NotificationDrawer";
import { useUserStore } from "@/store/useUserStore";
import { useCartStore } from "@/store/useCartStore";
import { getNotifications } from "@/services/notificationService";

interface HeroBannerProps {
    title?: string;
    highlightTitle?: string;
    subtitle?: string;
    ctaText?: string;
    ctaLink?: string;
}

export default function HeroBanner({
    title = "FRESHNESS AT",
    highlightTitle = "YOUR DOORSTEP",
    subtitle = "Explore vegetables, fruits and daily essentials for your kitchen.",
    ctaText = "SHOP FRESH NOW",
    ctaLink = "/categories"
}: HeroBannerProps) {
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

    const unread = signedIn ? notifications?.filter(item => !item.isRead).length || 0 : localUnread;

    return (
        <section className="bmv-hero relative w-full overflow-hidden bg-[#004b30] text-white">
            <div className="relative z-10 mx-auto max-w-[1280px] px-4 pt-4 sm:px-6 sm:pt-6">
                <div className="bmv-topbar flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1"><LocationSelector isCompact variant="hero" /></div>
                    <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
                        <button type="button" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`} onClick={() => setNotificationsOpen(true)} className="relative flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-white/5 text-white hover:bg-white/15"><Bell className="h-5 w-5" />{unread > 0 && <span className="absolute -right-0.5 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#c5ef75] px-1 text-[10px] font-bold text-[#004b30]">{unread > 9 ? "9+" : unread}</span>}</button>
                        <Link href="/cart" aria-label={`Cart, ${totalItems} items`} className="relative flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-white/5 text-white hover:bg-white/15"><ShoppingCart className="h-5 w-5" />{totalItems > 0 && <span className="absolute -right-0.5 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#c5ef75] px-1 text-[10px] font-bold text-[#004b30]">{totalItems}</span>}</Link>
                        <Link href={signedIn ? "/account" : "/login"} aria-label={signedIn ? "My account" : "Log in"} className="flex h-11 w-11 items-center justify-center rounded-full border border-[#c5ef75]/60 bg-[#c5ef75]/10 text-sm font-bold text-[#c5ef75]">{signedIn ? user?.name?.charAt(0).toUpperCase() || <UserRound className="h-5 w-5" /> : <UserRound className="h-5 w-5" />}</Link>
                    </div>
                </div>
                <Link href="/search" className="mt-4 flex min-h-12 items-center gap-3 rounded-full bg-white px-4 text-sm text-slate-500 sm:min-h-14 sm:px-5"><Search className="h-5 w-5 shrink-0 text-[#006c45]" aria-hidden="true" /><span className="truncate">Search fresh vegetables, fruits and more…</span></Link>
                <div className="relative grid min-h-[260px] grid-cols-[1.2fr_.8fr] items-center pb-9 pt-6 sm:min-h-[390px] sm:grid-cols-2 sm:py-12">
                    <div className="relative z-10 -mr-8 sm:mr-0">
                        <p className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.14em] text-[#d2efbc] sm:text-xs"><Leaf className="h-4 w-4 text-[#c5ef75]" />Book My Veg groceries</p>
                        <h1 className="max-w-xl text-[27px] font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl"><span className="block">{title === "FRESHNESS AT" ? "Freshness at" : title}</span><span className="mt-1 block text-[#c5ef75]">{highlightTitle === "YOUR DOORSTEP" ? "Your Doorstep" : highlightTitle}</span></h1>
                        <p className="mb-5 mt-4 max-w-[230px] text-xs leading-relaxed text-white/85 sm:max-w-md sm:text-base">{subtitle}</p>
                        <Link href={ctaLink} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#c5ef75] px-5 text-xs font-bold text-[#063d28] hover:bg-[#d4f79a] sm:min-h-12 sm:px-7 sm:text-sm">{ctaText === "SHOP FRESH NOW" ? "Shop Fresh Now" : ctaText}<ArrowRight className="h-4 w-4" /></Link>
                    </div>
                    <div className="pointer-events-none absolute -right-12 bottom-0 top-4 w-[62%] sm:-right-6 sm:top-0 sm:w-[54%]" style={{maskImage:"linear-gradient(to right, transparent, black 20%)"}}><Image src="/images/hero_banner.png" alt="A basket of vegetables and grocery essentials" fill priority sizes="(max-width: 640px) 65vw, 650px" className="object-cover object-[center_65%]" /></div>
                </div>
            </div>
            <NotificationDrawer open={notificationsOpen} onClose={() => setNotificationsOpen(false)} />
        </section>
    );
}
