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
        <nav aria-label="Customer navigation" className="fixed inset-x-0 bottom-0 z-50 border-t border-[#e5ebe7] bg-white pb-[env(safe-area-inset-bottom)]">
            <div className="mx-auto grid max-w-3xl grid-cols-5">
                {destinations.map(({ label, href, icon: Icon }) => {
                    const active = href === "/" ? pathname === href : pathname.startsWith(href) || (href === "/categories" && pathname.startsWith("/category/"));
                    return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={cn("flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 text-[11px] font-medium", active ? "text-[#087f5b]" : "text-[#64736b] hover:text-[#087f5b]")}>
                        <span className="relative"><Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 1.8} />{href === "/cart" && totalItems > 0 && <span className="absolute -right-3 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#c92a2a] px-1 text-[9px] text-white">{totalItems}</span>}</span>{label}
                    </Link>;
                })}
            </div>
        </nav>
    );
}
