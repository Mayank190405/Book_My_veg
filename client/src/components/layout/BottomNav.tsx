"use client";

import { Home, LayoutGrid, ShoppingCart, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCartStore } from "@/store/useCartStore";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "HOME", icon: Home, href: "/" },
  { label: "CATEGORIES", icon: LayoutGrid, href: "/categories" },
  { label: "CART", icon: ShoppingCart, href: "/cart" },
  { label: "ACCOUNT", icon: User, href: "/account" },
];

export default function BottomNav() {
  const pathname = usePathname();
  const { items } = useCartStore();

  if (pathname.startsWith("/admin")) return null;

  return (
    <div className="fixed bottom-4 left-0 right-0 z-50 flex justify-center px-4">
      <div className="relative w-full max-w-md bg-white rounded-[32px] shadow-[0_12px_40px_rgba(0,0,0,0.15)] border border-gray-100">

        {/* Active Indicator */}
        <div className="absolute top-0 left-0 w-full flex justify-around">
          {navItems.map((item) => {
            const active = pathname === item.href;

            return (
              <div
                key={item.href}
                className="flex-1 flex justify-center"
              >
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-4 pt-4 pb-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center justify-center gap-1"
              >
                <div className="relative">

                  <Icon
                    size={24}
                    strokeWidth={2.3}
                    className={cn(
                      active
                        ? "text-[#0B7A53]"
                        : "text-gray-400"
                    )}
                  />

                  {item.label === "CART" &&
                    items.length > 0 && (
                      <span className="absolute -top-2 -right-2 h-4 min-w-[16px] rounded-full bg-[#0B7A53] text-white text-[9px] font-bold flex items-center justify-center px-1">
                        {items.length}
                      </span>
                    )}
                </div>

                <span
                  className={cn(
                    "text-[10px] tracking-[0.18em] font-bold",
                    active
                      ? "text-[#0B7A53]"
                      : "text-gray-400"
                  )}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}