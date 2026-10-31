"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, Leaf, Search, ShoppingCart, UserRound } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import LocationSelector from "@/components/features/LocationSelector";
import NotificationDrawer from "@/components/ui/NotificationDrawer";
import { useUserStore } from "@/store/useUserStore";
import { useCartStore } from "@/store/useCartStore";
import { getNotifications } from "@/services/notificationService";

export default function Header() {
    const [notificationsOpen, setNotificationsOpen] = useState(false);
    const [localUnread, setLocalUnread] = useState(0);
    const { user, _hasHydrated } = useUserStore();
    const totalItems = useCartStore(state => state.totalItems);
    const signedIn = _hasHydrated && !!user && user.name !== "Guest" && user.role !== "GUEST";
    const { data: notifications } = useQuery({
        queryKey: ["notifications"], queryFn: getNotifications,
        enabled: signedIn, refetchInterval: 30000,
    });
    useEffect(() => {
        try {
            const cached = JSON.parse(localStorage.getItem("bookmyveg_local_notifications") || "[]");
            setLocalUnread(Array.isArray(cached) ? cached.filter((item: { isRead?: boolean }) => !item.isRead).length : 0);
        } catch { setLocalUnread(0); }
    }, [notificationsOpen]);
    const unread = signedIn ? notifications?.filter(item => !item.isRead).length || 0 : localUnread;
    return (
        <header className="bmv-header fixed inset-x-0 top-0 z-50 border-b border-[#e5ebe7] bg-white">
            <div className="mx-auto max-w-[1280px] px-4 py-3 sm:px-6">
                <div className="flex items-center justify-between gap-3">
                    <Link href="/" className="flex min-h-11 items-center gap-2 text-lg font-bold tracking-tight text-[#087f5b] sm:text-xl">
                        <Leaf className="h-6 w-6" aria-hidden="true" /> Book My Veg
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
                <Link href="/search" className="mt-3 flex h-11 items-center gap-3 rounded-xl border border-[#e5ebe7] bg-[#f5f7f6] px-3 text-sm text-[#64736b]">
                    <Search className="h-4 w-4 shrink-0" aria-hidden="true" /><span className="truncate">Search vegetables, fruits and more</span>
                </Link>
            </div>
            <NotificationDrawer open={notificationsOpen} onClose={() => setNotificationsOpen(false)} />
        </header>
    );
}
