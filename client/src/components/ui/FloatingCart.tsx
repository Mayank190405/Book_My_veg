"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { useCartStore } from "@/store/useCartStore";
import { ShoppingBag, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import CartDrawer from "./CartDrawer";

export default function FloatingCart() {
    const pathname = usePathname();
    const { totalItems, totalPrice } = useCartStore();
    const [drawerOpen, setDrawerOpen] = useState(false);

    if (totalItems === 0 || pathname.startsWith("/products/")) return null;

    return (
        <>
            {/* Floating centered oval badge */}
            <button
                onClick={() => setDrawerOpen(true)}
                className={cn(
                    "fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 z-50 bg-[#087f5b] text-white w-[calc(100%-2rem)] max-w-lg h-14 shadow-sm",
                    "flex items-center justify-between px-4 py-2 rounded-xl border border-white/20 transition-colors hover:bg-[#056647]"
                )}
                aria-label="Open cart"
            >
                <div className="flex items-center gap-4 pr-4">
                    <div className="flex flex-col items-center">
                        <span className="text-[14px] font-black leading-none">{totalItems}</span>
                        <span className="text-[9px] font-bold uppercase tracking-widest opacity-70">Items</span>
                    </div>
                    <div className="w-[1.5px] h-8 bg-white/20 rounded-full" />
                    <div className="flex flex-col">
                        <span className="text-[9px] font-bold uppercase tracking-[0.2em] opacity-60 leading-none mb-1">Items subtotal</span>
                        <span className="font-black text-[18px] tracking-tight leading-none tabular-nums">₹{Number(totalPrice).toFixed(0)}</span>
                    </div>
                </div>

                <div className="flex items-center justify-center h-10 w-10 bg-black/20 rounded-full group-hover:bg-emerald-500 transition-colors ml-2 shadow-inner">
                    <ChevronRight className="h-5 w-5 text-white" />
                </div>
            </button>

            {/* Cart Drawer */}
            <CartDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
        </>
    );
}
