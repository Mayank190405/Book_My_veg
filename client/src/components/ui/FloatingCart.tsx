"use client";

import { useState } from "react";
import { useCartStore } from "@/store/useCartStore";
import { ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";
import CartDrawer from "./CartDrawer";

export default function FloatingCart() {
    const { totalItems, totalPrice } = useCartStore();
    const [drawerOpen, setDrawerOpen] = useState(false);

    if (totalItems === 0) return null;

    return (
        <>
            {/* Floating button */}
            <button
                onClick={() => setDrawerOpen(true)}
                className={cn(
                    "fixed bottom-[4.5rem] left-4 right-4 max-w-md mx-auto z-40 bg-emerald-600 text-white",
                    "flex items-center justify-between px-6 py-4 rounded-[2rem] shadow-[0_20px_50px_rgba(5,150,105,0.3)] transition-all hover:scale-[1.02] active:scale-95 animate-in slide-in-from-bottom-10"
                )}
                aria-label="Open cart"
            >
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <ShoppingBag className="h-6 w-6" />
                        <span className="absolute -top-2 -right-2 bg-white text-emerald-600 text-[10px] font-black h-5 w-5 flex items-center justify-center rounded-full border-2 border-emerald-600">
                            {totalItems}
                        </span>
                    </div>
                    <div className="flex flex-col text-left">
                        <span className="font-black text-sm uppercase tracking-tight">₹{totalPrice.toFixed(0)}</span>
                        <span className="text-[10px] font-bold opacity-80 uppercase tracking-widest">View Cart</span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-xs font-black uppercase tracking-widest">Next</span>
                    <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-white" />
                    </div>
                </div>
            </button>

            {/* Cart Drawer */}
            <CartDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
        </>
    );
}
