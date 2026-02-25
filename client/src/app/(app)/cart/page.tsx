"use client";

import { useCartStore } from "@/store/useCartStore";
import { Trash2, Plus, Minus, ArrowRight, Tag, Info, ShoppingBag, ChevronRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function CartPage() {
    const { items, updateQuantity, removeItem, totalItems, totalPrice, couponCode, discount, applyCoupon, removeCoupon } = useCartStore();
    const [localCode, setLocalCode] = useState("");

    // Sync local input with store
    useEffect(() => {
        if (couponCode) setLocalCode(couponCode);
    }, [couponCode]);

    // Bill Calculations — free delivery over ₹249
    const deliveryFee = totalPrice >= 249 ? 0 : 40;
    const platformFee = 0;
    const taxes = 0;
    const grandTotal = totalPrice + deliveryFee - discount;
    const freeDeliveryThreshold = 249;
    const moreForFreeDelivery = freeDeliveryThreshold - totalPrice;

    const handleApplyCoupon = () => {
        if (!localCode) return;
        applyCoupon(localCode);
    };

    if (items.length === 0) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-6">
                <div className="relative mb-8">
                    <div className="absolute inset-0 bg-emerald-100 rounded-full blur-2xl opacity-40 scale-150 animate-pulse"></div>
                    <div className="w-28 h-28 bg-white/40 backdrop-blur-xl rounded-[2.5rem] flex items-center justify-center shadow-2xl border border-white relative z-10 rotate-3 animate-in zoom-in-90 duration-500">
                        <ShoppingBag className="h-12 w-12 text-emerald-600" />
                    </div>
                </div>
                <h1 className="text-3xl font-black text-emerald-950 tracking-tight mb-2 uppercase">Cart is Empty</h1>
                <p className="text-emerald-950/40 text-center max-w-[280px] text-sm font-bold uppercase tracking-widest leading-relaxed mb-8">
                    Choose from our curated collection of fresh produce.
                </p>
                <Link href="/">
                    <Button size="lg" className="px-10 py-7 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-[2rem] transition-all active:scale-95 shadow-2xl shadow-emerald-200 text-sm uppercase tracking-[0.2em]">
                        Start Shopping
                    </Button>
                </Link>
            </div>
        );
    }

    return (
        <div className="pb-48">
            {/* Glassmorphic Header */}
            <header className="bg-white/60 backdrop-blur-xl border-b border-black/5 sticky top-0 z-30 px-6 py-5 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-black text-emerald-950 tracking-tight uppercase">My Bag</h1>
                    <span className="bg-emerald-600 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest shadow-lg shadow-emerald-200/50">
                        {totalItems} Items
                    </span>
                </div>
                <Link href="/" className="p-2.5 rounded-xl bg-white border border-black/5 shadow-sm text-emerald-900 hover:bg-gray-50 transition-colors">
                    <Plus className="h-5 w-5" />
                </Link>
            </header>

            <main className="max-w-xl mx-auto p-4 space-y-6 animate-in slide-in-from-bottom-4 duration-700">

                {/* Free Delivery Progress */}
                <div className="bg-white/40 backdrop-blur-md p-6 rounded-[2.5rem] border border-white shadow-sm overflow-hidden relative group">
                    {deliveryFee > 0 ? (
                        <>
                            <div className="flex items-center gap-5 relative z-10">
                                <div className="p-4 bg-emerald-500/10 rounded-[1.5rem] text-emerald-600 shadow-inner group-hover:scale-110 transition-transform">
                                    <ShoppingBag className="h-6 w-6" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-[10px] font-black text-emerald-950/40 uppercase tracking-[0.2em] mb-2">
                                        Just <span className="text-emerald-600">₹{moreForFreeDelivery.toFixed(0)}</span> for <span className="text-emerald-900">Free Delivery</span>
                                    </p>
                                    <div className="h-2 w-full bg-emerald-900/5 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-emerald-500 rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                                            style={{ width: `${(totalPrice / freeDeliveryThreshold) * 100}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex items-center justify-center gap-3 py-1 relative z-10">
                            <div className="bg-emerald-100 p-2.5 rounded-full text-emerald-600">
                                <CheckCircle className="h-5 w-5" />
                            </div>
                            <span className="text-emerald-900 font-black tracking-widest text-sm uppercase">FREE DELIVERY UNLOCKED!</span>
                        </div>
                    )}
                </div>

                {/* Premium Items List */}
                <div className="space-y-4">
                    {items.map((item) => (
                        <div
                            key={item.productId}
                            className="group bg-white/40 backdrop-blur-md rounded-[2.5rem] p-4 border border-white shadow-sm hover:shadow-xl hover:bg-white/60 transition-all duration-500 flex gap-5 relative overflow-hidden"
                        >
                            <div className="relative w-24 h-24 rounded-[2rem] overflow-hidden bg-white/80 border border-black/5 shrink-0 shadow-sm group-hover:scale-105 transition-transform duration-700 p-2">
                                <Image
                                    src={item.image || "https://placehold.co/100x100?text=Product"}
                                    alt={item.name}
                                    fill
                                    className="object-contain"
                                />
                            </div>

                            <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
                                <div>
                                    <h3 className="font-black text-emerald-950 line-clamp-1 text-sm uppercase tracking-tight mb-1">{item.name}</h3>
                                    <p className="text-[10px] text-emerald-800/40 font-black uppercase tracking-widest px-2 py-0.5 rounded-lg border border-emerald-900/5 w-fit">Premium</p>
                                </div>

                                <div className="flex items-end justify-between">
                                    <div className="flex flex-col">
                                        <p className="font-black text-emerald-900 text-lg tracking-tighter tabular-nums">₹{(item.price * item.quantity).toFixed(0)}</p>
                                    </div>

                                    <div className="flex items-center bg-white/80 backdrop-blur rounded-2xl border border-black/5 shadow-sm p-1">
                                        <button
                                            onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                                            className="w-9 h-9 flex items-center justify-center text-emerald-900/40 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all active:scale-90"
                                        >
                                            {item.quantity === 1 ? <Trash2 className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
                                        </button>
                                        <span className="w-8 text-center text-sm font-black text-emerald-950 tabular-nums">{item.quantity}</span>
                                        <button
                                            onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                                            className="w-9 h-9 flex items-center justify-center text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl transition-all active:scale-90"
                                        >
                                            <Plus className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Offers Section */}
                <div className="bg-white/40 backdrop-blur-md rounded-[2.5rem] shadow-sm border border-white p-7 relative overflow-hidden group">
                    <div className="flex items-center gap-3 mb-5 relative z-10">
                        <div className="bg-amber-500/10 p-3 rounded-2xl text-amber-600 shadow-inner group-hover:rotate-12 transition-transform">
                            <Tag className="h-6 w-6" />
                        </div>
                        <h2 className="font-black text-emerald-950 text-base uppercase tracking-widest">Offers & Coupons</h2>
                    </div>

                    {couponCode ? (
                        <div className="flex items-center justify-between bg-emerald-500/10 backdrop-blur border-2 border-dashed border-emerald-200 p-4 rounded-2xl relative z-10">
                            <div className="flex items-center gap-4">
                                <div className="bg-emerald-600 p-2.5 rounded-[1.25rem] text-white shadow-lg shadow-emerald-200">
                                    <Tag className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="font-black text-emerald-900 text-sm uppercase tracking-tight">'{couponCode}'</p>
                                    <p className="text-[10px] text-emerald-700 font-black uppercase tracking-widest uppercase">Saved ₹{discount}!</p>
                                </div>
                            </div>
                            <button
                                onClick={() => { removeCoupon(); setLocalCode(""); }}
                                className="text-[10px] text-red-600 font-black hover:bg-red-50 px-4 py-2 rounded-xl transition-colors uppercase tracking-widest"
                            >
                                REMOVE
                            </button>
                        </div>
                    ) : (
                        <div className="flex gap-3 relative z-10">
                            <input
                                type="text"
                                placeholder="PROMO CODE"
                                value={localCode}
                                onChange={(e) => setLocalCode(e.target.value.toUpperCase())}
                                className="flex-1 px-6 py-4 bg-white/40 border border-black/5 rounded-2xl focus:outline-none focus:border-emerald-500 focus:bg-white font-black placeholder:font-black placeholder:text-emerald-900/10 transition-all uppercase tracking-widest text-sm"
                            />
                            <button
                                onClick={handleApplyCoupon}
                                className="px-8 py-4 bg-emerald-950 hover:bg-black text-white font-black rounded-2xl transition-all active:scale-95 shadow-xl shadow-black/10 text-xs uppercase tracking-widest"
                                disabled={!localCode}
                            >
                                APPLY
                            </button>
                        </div>
                    )}
                </div>

                {/* Premium Bill Details */}
                <div className="bg-white/40 backdrop-blur-md rounded-[2.5rem] shadow-sm border border-white p-8 space-y-5">
                    <h2 className="font-black text-emerald-950 text-base uppercase tracking-widest mb-6">Order Summary</h2>

                    <div className="flex justify-between items-center">
                        <span className="font-black uppercase tracking-[0.2em] text-[10px] text-emerald-950/40">Subtotal</span>
                        <span className="font-black text-emerald-950 text-lg tabular-nums">₹{totalPrice.toFixed(0)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="font-black uppercase tracking-[0.2em] text-[10px] text-emerald-950/40">Delivery</span>
                        <span className="font-black text-emerald-900 text-lg tabular-nums uppercase">
                            {deliveryFee === 0 ? <span className="text-emerald-600">FREE</span> : `₹${deliveryFee}`}
                        </span>
                    </div>
                    {discount > 0 && (
                        <div className="flex justify-between items-center bg-emerald-500/10 p-4 rounded-2xl border border-emerald-100">
                            <span className="font-black text-emerald-700 uppercase tracking-widest text-[10px]">Discount</span>
                            <span className="font-black text-emerald-600 text-lg tabular-nums">-₹{discount}</span>
                        </div>
                    )}

                    <div className="pt-8 mt-4 border-t border-black/5 space-y-6">
                        <div className="flex justify-between items-end">
                            <div className="flex flex-col">
                                <span className="text-emerald-950/40 font-black uppercase tracking-widest text-[10px] mb-2">Grand Total</span>
                                <span className="text-4xl font-black text-emerald-950 tracking-tighter tabular-nums">₹{grandTotal.toFixed(0)}</span>
                            </div>
                            <div className="bg-white/80 px-5 py-3 rounded-2xl border border-black/5 shadow-inner text-right">
                                <p className="text-[8px] font-black text-emerald-950/30 uppercase tracking-[0.2em] mb-1">Total Savings</p>
                                <p className="text-sm font-black text-emerald-600">₹{(discount + (totalPrice >= 249 ? 40 : 0)).toFixed(0)}</p>
                            </div>
                        </div>

                        <Link
                            href="/checkout"
                            className="group w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-6 px-10 rounded-[2.5rem] flex items-center justify-center gap-4 shadow-2xl shadow-emerald-200 transition-all active:scale-95"
                        >
                            <span className="text-sm uppercase tracking-[0.2em]">Proceed to Checkout</span>
                            <ChevronRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" strokeWidth={3} />
                        </Link>
                    </div>
                </div>
            </main>
        </div>
    );
}

// Simple internal helper for checking circle if needed
function CheckCircle({ className }: { className?: string }) {
    return (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3} className={className}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
    );
}
