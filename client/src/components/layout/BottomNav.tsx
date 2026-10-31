"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, LayoutGrid, Search, ShoppingCart, UserRound } from "lucide-react";
import { useCartStore } from "@/store/useCartStore";
import { cn } from "@/lib/utils";

const destinations = [
    { label: "Home", href: "/", icon: Home },
    { label: "Categories", href: "/categories", icon: LayoutGrid },
    { label: "Search", href: "/search", icon: Search },
    { label: "Cart", href: "/cart", icon: ShoppingCart },
    { label: "Account", href: "/account", icon: UserRound },
];

export default function BottomNav() {
    const pathname = usePathname();
    const totalItems = useCartStore(state => state.totalItems);

    return (
        <nav
            aria-label="Customer navigation"
            className="fixed inset-x-0 bottom-0 z-50 rounded-t-[24px] border-t border-slate-100 bg-white/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_20px_rgba(0,0,0,0.04)]"
        >
            <div className="mx-auto grid max-w-lg grid-cols-5 py-1.5 px-2">
                {destinations.map(({ label, href, icon: Icon }) => {
                    const active = href === "/"
                        ? pathname === href
                        : pathname.startsWith(href) || (href === "/categories" && pathname.startsWith("/category/"));

                    return (
                        <Link
                            key={href}
                            href={href}
                            aria-current={active ? "page" : undefined}
                            className="flex flex-col items-center justify-center min-h-13 min-w-0"
                        >
                            <div
                                className={cn(
                                    "flex flex-col items-center justify-center gap-1 transition-all",
                                    active
                                        ? "bg-[#e8f7ef] rounded-2xl px-3.5 py-1 text-[#087f5b]"
                                        : "text-slate-500 hover:text-[#087f5b]"
                                )}
                            >
                                <span className="relative">
                                    <Icon
                                        className={cn("h-5 w-5", active ? "stroke-[2.5]" : "stroke-[1.75]")}
                                    />
                                    {href === "/cart" && totalItems > 0 && (
                                        <span className="absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#087f5b] px-1 text-[10px] font-black text-white shadow-xs">
                                            {totalItems}
                                        </span>
                                    )}
                                </span>
                                <span
                                    className={cn(
                                        "text-[11px] leading-none",
                                        active ? "font-bold" : "font-medium"
                                    )}
                                >
                                    {label}
                                </span>
                            </div>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
