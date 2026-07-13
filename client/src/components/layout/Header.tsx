"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Search, Bell, User } from "lucide-react";
import { cn } from "@/lib/utils";
import LocationSelector from "@/components/features/LocationSelector";
import SearchBar from "@/components/features/SearchBar";
import { useUserStore } from "@/store/useUserStore";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getNotifications } from "@/services/notificationService";
import NotificationDrawer from "@/components/ui/NotificationDrawer";

export default function Header() {
    const [scrolled, setScrolled] = useState(false);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [notificationsOpen, setNotificationsOpen] = useState(false);
    const pathname = usePathname();
    const { user, _hasHydrated } = useUserStore();

    const { data: notifications } = useQuery({
        queryKey: ["notifications"],
        queryFn: getNotifications,
        enabled: _hasHydrated && !!user,
        refetchInterval: 30000,
    });

    const unreadCount = notifications ? notifications.filter(n => !n.isRead).length : 0;

    useEffect(() => {
        const scrollContainer = document.getElementById("main-scroll-container");
        if (!scrollContainer) return;

        const handleScroll = () => {
            setScrolled(scrollContainer.scrollTop > 40);
        };

        scrollContainer.addEventListener("scroll", handleScroll, { passive: true });
        return () => scrollContainer.removeEventListener("scroll", handleScroll);
    }, [pathname]);

    // Hide on specific pages where we have custom headers
    if (
        pathname.startsWith("/admin") ||
        pathname === "/search" ||
        pathname.startsWith("/products/") ||
        pathname === "/privacy" ||
        pathname === "/terms" ||
        pathname === "/exchange-policy" ||
        pathname === "/payment-flow" ||
        pathname.startsWith("/pages/")
    ) return null;

    const isHome = pathname === "/";
    const showSearchByDefault = isHome;

    return (
        <header
            className={cn(
                "fixed top-0 left-0 right-0 z-50 transition-all duration-300 px-6 flex flex-col justify-center",
                (scrolled && isHome)
                    ? "bg-white/95 backdrop-blur-3xl border-b border-slate-200/50 shadow-md pt-3 pb-3 gap-0"
                    : isHome
                        ? "bg-white/95 backdrop-blur-md pt-6 pb-6 gap-3 border-b border-slate-150/50 shadow-sm"
                        : "bg-white/95 border-b border-slate-150/50 shadow-sm pt-4 pb-4 gap-0"
            )}
        >
            {/* Top Bar Wrapper */}
            <div className={cn(
                "flex justify-between items-center transition-all duration-300 ease-in-out overflow-hidden",
                (scrolled && isHome) ? "h-0 opacity-0 pointer-events-none mb-0" : "h-11 opacity-100 mb-1"
            )}>
                <LocationSelector isCompact={false} />

                <div className="flex items-center gap-2">
                    <button
                        className="w-10 h-10 rounded-full bg-[#f4fbf7] hover:bg-emerald-50 border border-emerald-500/10 text-[#0b5c3e] flex items-center justify-center transition-all shadow-sm active:scale-90"
                        onClick={() => setIsSearchOpen(true)}
                    >
                        <Search className="h-4 w-4 stroke-[2.5]" />
                    </button>

                    <button
                        onClick={() => setNotificationsOpen(true)}
                        className="w-10 h-10 rounded-full bg-[#f4fbf7] hover:bg-emerald-50 border border-emerald-500/10 text-[#0b5c3e] flex items-center justify-center transition-all shadow-sm active:scale-90 relative cursor-pointer"
                    >
                        <Bell className="h-4 w-4 stroke-[2.5]" />
                        {unreadCount > 0 && (
                            <span className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-emerald-600 border border-white rounded-full shadow-sm animate-pulse" />
                        )}
                    </button>

                    <Link
                        href={!_hasHydrated ? "/login" : (user && user.name !== "Guest" ? "/account" : "/login")}
                        className="w-10 h-10 rounded-full bg-[#f4fbf7] hover:bg-emerald-50 border border-emerald-500/10 text-[#0b5c3e] flex items-center justify-center transition-all shadow-sm active:scale-90"
                    >
                        <User className="h-4 w-4 stroke-[2.5]" />
                    </Link>
                </div>
            </div>

            {/* Search Bar - Full-width focused mode when scrolled or shown by default */}
            {!["/cart", "/account", "/orders"].includes(pathname) && (
                <div className={cn(
                    "flex items-center transition-all duration-300 ease-in-out",
                    ((scrolled && isHome) || showSearchByDefault)
                        ? "opacity-100 scale-100 h-14"
                        : "h-0 opacity-0 pointer-events-none scale-90 overflow-hidden"
                )}>
                    <div className="flex-1">
                        <SearchBar focused={isSearchOpen} onFocusChange={setIsSearchOpen} />
                    </div>
                </div>
            )}

            {notificationsOpen && (
                <NotificationDrawer open={notificationsOpen} onClose={() => setNotificationsOpen(false)} />
            )}
        </header>
    );
}
