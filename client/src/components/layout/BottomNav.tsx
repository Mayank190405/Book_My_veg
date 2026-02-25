"use client";

import { Home, LayoutGrid, ShoppingBag, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useCartStore } from "@/store/useCartStore";

const navItems = [
    { label: "Home", icon: Home, href: "/" },
    { label: "Categories", icon: LayoutGrid, href: "/categories" },
    { label: "Cart", icon: ShoppingBag, href: "/cart" },
    { label: "Account", icon: User, href: "/account" },
];

export default function BottomNav() {
    const pathname = usePathname();
    const { items } = useCartStore();
    const cartCount = items.length;

    // Hide BottomNav on admin paths
    if (pathname?.startsWith("/admin")) return null;

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-safe pt-2">
            <div className="bg-white/80 backdrop-blur-2xl border border-black/5 rounded-t-[2.5rem] flex items-center justify-around py-3 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
                {navItems.map((item) => {
                    const isActive = pathname === item.href;
                    const Icon = item.icon;

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "flex flex-col items-center gap-1 transition-all duration-300 active:scale-90",
                                isActive ? "text-emerald-600" : "text-emerald-950/40 hover:text-emerald-950/70"
                            )}
                        >
                            <div className="relative">
                                <Icon className={cn("h-6 w-6", isActive && "fill-current")} />
                                {item.label === "Cart" && cartCount > 0 && (
                                    <span className="absolute -top-1 -right-1.5 bg-emerald-600 text-white text-[10px] font-black h-4 min-w-[1rem] px-1 flex items-center justify-center rounded-full border border-white/20">
                                        {cartCount}
                                    </span>
                                )}
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-widest">{item.label}</span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
