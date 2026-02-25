"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { User, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import LocationSelector from "@/components/features/LocationSelector";
import SearchBar from "@/components/features/SearchBar";
import { useUserStore } from "@/store/useUserStore";
import { useCartStore } from "@/store/useCartStore";
import { usePathname } from "next/navigation";

function HeaderProfile() {
    const { user, _hasHydrated } = useUserStore();
    if (!_hasHydrated) return <div className="w-12 h-12 bg-black/5 rounded-2xl animate-pulse" />;

    return (
        <Link href={user ? "/account" : "/login"} className="p-3 rounded-2xl bg-white border border-black/5 shadow-sm hover:shadow-md hover:bg-emerald-50 transition-all active:scale-95 group">
            <User className="h-6 w-6 text-emerald-900 group-hover:text-emerald-600 transition-colors" />
        </Link>
    );
}



export default function Header() {
    const [scrolled, setScrolled] = useState(false);
    const pathname = usePathname();

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 40);
        window.addEventListener("scroll", handleScroll, { passive: true });
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    // Hide on specific pages where we have custom headers or need more space
    if (pathname.startsWith("/admin") || pathname === "/search") return null;

    return (
        <header
            className={cn(
                "fixed top-0 left-0 right-0 z-50 transition-all duration-500",
                scrolled
                    ? "bg-white/80 backdrop-blur-xl border-b border-black/5 py-4"
                    : "bg-transparent pt-4 pb-6"
            )}
        >
            <div className="px-5 flex flex-col gap-4">
                {/* Top Bar: Location & Profile/Wallet */}
                <div className={cn(
                    "flex justify-between items-center transition-all duration-300",
                    scrolled ? "h-0 opacity-0 overflow-hidden pointer-events-none" : "opacity-100"
                )}>
                    <LocationSelector />
                    <div className="flex items-center gap-2">
                        <HeaderProfile />
                    </div>
                </div>

                {/* Search Bar - Stays constant but adjusts context if needed */}
                {!["/cart", "/account"].includes(pathname) && (
                    <div className={cn(
                        "flex items-center transition-all duration-300",
                        scrolled && "mt-0"
                    )}>
                        <div className="flex-1">
                            <SearchBar />
                        </div>
                    </div>
                )}
            </div>
        </header>
    );
}
