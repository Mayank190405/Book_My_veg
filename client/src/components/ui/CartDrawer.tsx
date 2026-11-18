"use client";

import { useCartStore } from "@/store/useCartStore";
import { X, Trash2, ShoppingBag, Plus, Minus, ArrowRight, ShieldCheck } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface CartDrawerProps {
    open: boolean;
    onClose: () => void;
}

export default function CartDrawer({ open, onClose }: CartDrawerProps) {
    const { items, updateQuantity, removeItem, totalItems, totalPrice } = useCartStore();
    const freeDeliveryThreshold = 249;
    const isFreeDelivery = totalPrice >= freeDeliveryThreshold;
    const amountNeeded = Math.max(0, freeDeliveryThreshold - totalPrice);
    const progressPercent = Math.min(100, Math.round((totalPrice / freeDeliveryThreshold) * 100));

    return (
        <>
            {/* Backdrop */}
            <div
                onClick={onClose}
                className={cn(
                    "fixed inset-0 bg-black/60 z-[100] transition-all duration-300",
                    open ? "opacity-100 backdrop-blur-xs pointer-events-auto" : "opacity-0 backdrop-blur-0 pointer-events-none"
                )}
            />

            {/* Slide-over Drawer Panel */}
            <div
                className={cn(
                    "fixed bottom-0 left-0 right-0 z-[110] bg-white rounded-t-3xl shadow-xl transition-transform duration-300 flex flex-col items-center select-none",
                    "max-h-[85vh] w-full md:max-w-[450px] md:mx-auto border-t border-slate-100",
                    open ? "translate-y-0" : "translate-y-full"
                )}
            >
                {/* Drag Handle */}
                <div className="w-full flex justify-center pt-3 pb-1">
                    <div className="w-10 h-1 bg-slate-200 rounded-full" />
                </div>

                {/* Header */}
                <div className="w-full flex items-center justify-between px-5 py-3 border-b border-slate-100">
                    <div className="text-left">
                        <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                            My Basket ({totalItems} {totalItems === 1 ? "item" : "items"})
                        </h2>
                        <p className="text-[11px] font-semibold text-[#017649] mt-0.5">
                            {isFreeDelivery ? "Free Delivery Unlocked" : `Add ₹${amountNeeded.toFixed(0)} more for Free Delivery`}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        aria-label="Close basket"
                        className="w-9 h-9 rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200 flex items-center justify-center transition-all active:scale-95"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Free Delivery Progress Bar */}
                {items.length > 0 && (
                    <div className="w-full px-5 py-2.5 bg-[#DCF4E9]/50 border-b border-[#DCF4E9]">
                        <div className="flex items-center justify-between text-[11px] font-bold text-[#015f3b] mb-1">
                            <span>{isFreeDelivery ? "You get FREE delivery on this order" : `₹${amountNeeded.toFixed(0)} to FREE delivery`}</span>
                            <span>₹{totalPrice.toFixed(0)} / ₹{freeDeliveryThreshold}</span>
                        </div>
                        <div className="w-full h-1.5 bg-white/80 rounded-full overflow-hidden">
                            <div
                                style={{ width: `${progressPercent}%` }}
                                className="h-full bg-[#017649] rounded-full transition-all duration-300"
                            />
                        </div>
                    </div>
                )}

                {/* Main Items List */}
                <div className="w-full flex-1 overflow-y-auto px-4 py-3 space-y-2.5 scrollbar-hide">
                    {items.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
                            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-300">
                                <ShoppingBag className="h-8 w-8" />
                            </div>
                            <div>
                                <h3 className="text-base font-black text-slate-800">Your basket is empty</h3>
                                <p className="text-xs text-slate-500 mt-1 max-w-[220px] mx-auto">
                                    Explore fresh fruits, vegetables and groceries to add items.
                                </p>
                            </div>
                            <button
                                onClick={onClose}
                                className="px-6 py-2.5 bg-[#017649] hover:bg-[#015f3b] text-white text-xs font-black rounded-full shadow-sm active:scale-95 transition-all"
                            >
                                Start Shopping
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {items.map((item) => (
                                <div
                                    key={`${item.productId}-${item.variantId || "default"}`}
                                    className="flex items-center gap-3 bg-white border border-slate-200/80 rounded-2xl p-2.5 shadow-2xs text-left"
                                >
                                    {/* Thumbnail */}
                                    <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-slate-50 p-1 shrink-0">
                                        <Image
                                            src={item.image || "/empty-cart.png"}
                                            alt={item.name}
                                            fill
                                            className="object-contain p-1"
                                            sizes="56px"
                                        />
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-xs font-bold text-slate-900 leading-tight truncate">
                                            {item.name}
                                        </h3>
                                        <p className="text-[10px] font-semibold text-slate-400 mt-0.5">
                                            {item.weight ? `${item.weight} ${item.weightUnit || "g"}` : "Standard"}
                                        </p>
                                        <div className="mt-1">
                                            <span className="text-xs sm:text-sm font-black text-slate-900 tabular-nums">
                                                ₹{(Number(item.price) * item.quantity).toFixed(0)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Stepper Controls */}
                                    <div className="flex items-center gap-2 shrink-0">
                                        <div className="flex items-center rounded-lg bg-[#017649] text-white shadow-2xs h-7 overflow-hidden">
                                            <button
                                                onClick={() => updateQuantity(item.productId, item.quantity - 1, item.variantId)}
                                                aria-label="Decrease quantity"
                                                className="flex h-7 w-6 items-center justify-center hover:bg-[#015f3b] active:scale-95 transition-colors"
                                            >
                                                <Minus className="h-2.5 w-2.5 stroke-[3]" />
                                            </button>
                                            <span className="min-w-4 text-center text-xs font-black tabular-nums">
                                                {item.quantity}
                                            </span>
                                            <button
                                                onClick={() => updateQuantity(item.productId, item.quantity + 1, item.variantId)}
                                                aria-label="Increase quantity"
                                                className="flex h-7 w-6 items-center justify-center hover:bg-[#015f3b] active:scale-95 transition-colors"
                                            >
                                                <Plus className="h-2.5 w-2.5 stroke-[3]" />
                                            </button>
                                        </div>

                                        <button
                                            onClick={() => removeItem(item.productId, item.variantId)}
                                            aria-label={`Remove ${item.name}`}
                                            className="text-slate-400 hover:text-rose-600 p-1 transition-colors"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Action Footer */}
                {items.length > 0 && (
                    <div className="w-full bg-white border-t border-slate-100 px-5 pt-3 pb-6 rounded-t-2xl shadow-xs">
                        <div className="flex items-center justify-between max-w-xl mx-auto gap-4">
                            <div className="flex flex-col text-left">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Bill</span>
                                <span className="text-xl font-black text-slate-900 tabular-nums">₹{Number(totalPrice).toFixed(0)}</span>
                            </div>
                            <Link
                                href="/checkout"
                                onClick={onClose}
                                className="bg-[#017649] hover:bg-[#015f3b] text-white h-11 px-6 rounded-full flex items-center gap-2 font-black text-xs shadow-md active:scale-95 transition-all"
                            >
                                <span>Proceed to Checkout</span>
                                <ArrowRight className="h-3.5 w-3.5 stroke-[2.5]" />
                            </Link>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
