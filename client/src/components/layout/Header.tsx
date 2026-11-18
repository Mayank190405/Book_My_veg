"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { Bell, Search, ShoppingCart, UserRound, Mic } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import LocationSelector from "@/components/features/LocationSelector";
import NotificationDrawer from "@/components/ui/NotificationDrawer";
import { useUserStore } from "@/store/useUserStore";
import { useCartStore } from "@/store/useCartStore";
import { getNotifications } from "@/services/notificationService";
import { useCategoryThemeStore, CATEGORY_THEMES } from "@/store/useCategoryThemeStore";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// Category pill buttons (no emojis)
const CATEGORY_PILLS = [
    {
        id: "all",
        label: "All",
        pillBg: "bg-[#DCF4E9]",
        pillText: "text-[#055b35]",
    },
    {
        id: "vegetables",
        label: "Vegetables",
        pillBg: "bg-[#DCF4E9]",
        pillText: "text-[#0f5127]",
    },
    {
        id: "fruits",
        label: "Fruits",
        pillBg: "bg-[#FFE5DF]",
        pillText: "text-[#8e1b1b]",
    },
    {
        id: "dairy",
        label: "Dairy",
        pillBg: "bg-[#E0F0FF]",
        pillText: "text-[#13497d]",
    },
    {
        id: "leafy",
        label: "Leafy Veg",
        pillBg: "bg-[#D8F3E6]",
        pillText: "text-[#065f46]",
    },
    {
        id: "exotic",
        label: "Exotics",
        pillBg: "bg-[#EBE6FF]",
        pillText: "text-[#5e2296]",
    },
    {
        id: "grains",
        label: "Grains",
        pillBg: "bg-[#FFF0D2]",
        pillText: "text-[#92400e]",
    },
    {
        id: "oils",
        label: "Oils",
        pillBg: "bg-[#FCE9D4]",
        pillText: "text-[#854d0e]",
    },
];

export default function Header() {
    const headerRef = useRef<HTMLElement>(null);
    const [notificationsOpen, setNotificationsOpen] = useState(false);
    const [localUnread, setLocalUnread] = useState(0);
    const [isScrolled, setIsScrolled] = useState(false);
    const lastScrollYRef = useRef(0);

    const selectedCategory = useCategoryThemeStore((state) => state.selectedCategory);
    const setSelectedCategory = useCategoryThemeStore((state) => state.setSelectedCategory);
    const activeTheme = CATEGORY_THEMES[selectedCategory] || CATEGORY_THEMES.all;

    const { user, _hasHydrated } = useUserStore();
    const totalItems = useCartStore((state) => state.totalItems);
    const signedIn = _hasHydrated && !!user && user.name !== "Guest" && user.role !== "GUEST";

    const { data: notificationsData } = useQuery({
        queryKey: ["notifications"],
        queryFn: getNotifications,
        refetchInterval: 30000,
    });

    const unread = (notificationsData?.data?.filter((n: any) => !n.isRead)?.length ?? 0) + localUnread;

    // Track and publish uncollapsed header height so layout container never overlaps
    useEffect(() => {
        const updateHeaderHeight = () => {
            if (headerRef.current && !isScrolled) {
                const height = headerRef.current.offsetHeight;
                if (height > 100) {
                    document.documentElement.style.setProperty("--bmv-header-height", `${height}px`);
                }
            }
        };

        updateHeaderHeight();

        const ro = new ResizeObserver(() => {
            updateHeaderHeight();
        });

        if (headerRef.current) {
            ro.observe(headerRef.current);
        }

        return () => ro.disconnect();
    }, [isScrolled]);

    useEffect(() => {
        const container = document.getElementById("main-scroll-container");
        let ticking = false;

        const updateScrollState = () => {
            const currentScrollY = container ? container.scrollTop : window.scrollY;
            const diff = currentScrollY - lastScrollYRef.current;

            if (currentScrollY <= 20) {
                setIsScrolled(false);
            } else if (diff > 10 && currentScrollY > 100) {
                setIsScrolled(true);
            } else if (diff < -15) {
                setIsScrolled(false);
            }

            lastScrollYRef.current = currentScrollY;
            ticking = false;
        };

        const handleScroll = () => {
            if (!ticking) {
                window.requestAnimationFrame(updateScrollState);
                ticking = true;
            }
        };

        if (container) {
            container.addEventListener("scroll", handleScroll, { passive: true });
        }
        window.addEventListener("scroll", handleScroll, { passive: true });

        return () => {
            if (container) {
                container.removeEventListener("scroll", handleScroll);
            }
            window.removeEventListener("scroll", handleScroll);
        };
    }, []);

    const handleVoiceSearch = () => {
        if (typeof window !== "undefined" && ("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) {
            try {
                const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
                const recognition = new SpeechRecognition();
                recognition.lang = "en-IN";
                recognition.start();
                toast.info("Listening... Speak a vegetable or grocery item", { id: "voice-search", duration: 3000 });
                recognition.onresult = (event: any) => {
                    const transcript = event.results?.[0]?.[0]?.transcript;
                    if (transcript) {
                        window.location.href = `/search?q=${encodeURIComponent(transcript)}`;
                    }
                };
                recognition.onerror = () => {
                    window.location.href = "/search";
                };
            } catch {
                window.location.href = "/search";
            }
        } else {
            window.location.href = "/search";
        }
    };

    return (
        <header
            ref={headerRef}
            style={{ backgroundColor: activeTheme.themeColor }}
            className={cn(
                "bmv-header fixed inset-x-0 top-0 z-50 text-white transition-colors duration-500",
                isScrolled ? "shadow-sm" : "shadow-none"
            )}
        >
            <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-white/5 to-transparent pointer-events-none" />
            <div className="relative mx-auto max-w-[1280px] px-3 sm:px-6 pt-2 pb-2 space-y-2">
                {/* Top Section: Location Selector on Left, Action Icons on Right */}
                <div
                    className={cn(
                        "transition-all duration-300 ease-in-out overflow-hidden",
                        isScrolled
                            ? "max-h-0 opacity-0 -translate-y-2 pointer-events-none mb-0"
                            : "max-h-40 opacity-100 translate-y-0"
                    )}
                >
                    <div className="flex items-center justify-between gap-3 pt-0.5">
                        {/* Properly formatted location trigger */}
                        <div className="min-w-0 flex-1">
                            <LocationSelector isCompact variant="green-header" />
                        </div>

                        {/* Action Icons */}
                        <div className="flex items-center gap-2 shrink-0">
                            {/* Notification Bell */}
                            <button
                                type="button"
                                aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
                                onClick={() => setNotificationsOpen(true)}
                                className="relative flex h-9 w-9 items-center justify-center rounded-full text-white hover:bg-white/15 transition-colors"
                            >
                                <Bell className="h-5 w-5" />
                                {unread > 0 && (
                                    <span className="absolute top-1 right-1 flex h-2.5 w-2.5 rounded-full bg-[#ef4444] ring-2 ring-white" />
                                )}
                            </button>

                            {/* Cart Icon in Solid Round Pill */}
                            <Link
                                href="/cart"
                                aria-label={`Cart, ${totalItems} items`}
                                className="relative flex h-9 w-9 items-center justify-center rounded-full bg-black/20 text-white hover:bg-black/30 transition-colors shadow-xs"
                            >
                                <ShoppingCart className="h-4.5 w-4.5" />
                                {totalItems > 0 && (
                                    <span
                                        style={{ color: activeTheme.themeColor }}
                                        className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-white px-1 text-[10px] font-black shadow-sm"
                                    >
                                        {totalItems}
                                    </span>
                                )}
                            </Link>

                            {/* User Avatar in Solid White Circle */}
                            <Link
                                href={signedIn ? "/account" : "/login"}
                                aria-label={signedIn ? "My account" : "Log in"}
                                className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-900 font-black shadow-xs hover:bg-slate-100 transition-colors"
                            >
                                {signedIn ? (
                                    user?.name?.charAt(0).toUpperCase() || <UserRound className="h-4.5 w-4.5" />
                                ) : (
                                    <UserRound className="h-4.5 w-4.5 text-slate-900" />
                                )}
                            </Link>
                        </div>
                    </div>
                </div>

                {/* Search Bar Row: Crisp White Pill with Integrated Mic & Subtle Divider */}
                <div className="pt-0.5 pb-0.5">
                    <div className="flex h-12 w-full items-center justify-between rounded-full bg-white px-4 shadow-sm border border-white/20 transition-all hover:shadow-md">
                        <Link
                            href="/search"
                            className="flex-1 flex items-center gap-3 min-w-0 pr-2"
                        >
                            <Search className="h-4.5 w-4.5 shrink-0 text-slate-700" aria-hidden="true" />
                            <span className="truncate text-slate-500 font-medium text-xs sm:text-sm">
                                Search &quot;fresh fruits, groceries...&quot;
                            </span>
                        </Link>

                        {/* Subtle vertical divider */}
                        <div className="h-5 w-[1px] bg-slate-200 shrink-0" />

                        {/* Integrated Mic Button adapting to active theme color */}
                        <button
                            type="button"
                            onClick={handleVoiceSearch}
                            aria-label="Voice search"
                            style={{ color: activeTheme.themeColor }}
                            className="pl-3 flex items-center justify-center active:scale-95 transition-colors shrink-0"
                        >
                            <Mic className="h-5 w-5 stroke-[2.2]" />
                        </button>
                    </div>
                </div>

                {/* Category Pills Strip: Exactly matching user Image 2 */}
                <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pt-0.5 pb-1 select-none">
                    {CATEGORY_PILLS.map((pill) => {
                        const isSelected = selectedCategory === pill.id;
                        return (
                            <div key={pill.id} className="relative flex flex-col items-center shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setSelectedCategory(pill.id)}
                                    className={cn(
                                        "flex items-center justify-center rounded-full px-4 py-1.5 text-xs font-bold transition-all cursor-pointer whitespace-nowrap active:scale-95 shadow-xs border border-white/20",
                                        pill.pillBg,
                                        pill.pillText
                                    )}
                                >
                                    <span>{pill.label}</span>
                                </button>

                                {/* Active category underline indicator underneath the selected capsule */}
                                {isSelected && (
                                    <span className="absolute -bottom-1 h-[2.5px] w-7 rounded-full bg-white shadow-xs" />
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            <NotificationDrawer open={notificationsOpen} onClose={() => setNotificationsOpen(false)} />
        </header>
    );
}