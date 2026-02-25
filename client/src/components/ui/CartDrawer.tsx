"use client";

import { useCartStore } from "@/store/useCartStore";
import { X, Trash2, ShoppingBag, Plus, Minus, ArrowRight, ShieldCheck, Zap } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface CartDrawerProps {
    open: boolean;
    onClose: () => void;
}

export default function CartDrawer({ open, onClose }: CartDrawerProps) {
    const { items, updateQuantity, removeItem, totalItems, totalPrice } = useCartStore();

    return (
        <>
            {/* Immersive Backdrop */}
            <div
                onClick={onClose}
                className={cn(
                    "fixed inset-0 bg-emerald-950/20 z-[100] transition-all duration-500",
                    open ? "opacity-100 backdrop-blur-md pointer-events-auto" : "opacity-0 backdrop-blur-0 pointer-events-none"
                )}
            />

            {/* Premium Panel */}
            <div
                className={cn(
                    "fixed bottom-0 left-0 right-0 z-[110] bg-white rounded-t-[3rem] shadow-[0_-20px_80px_rgba(6,78,59,0.15)] transition-transform duration-500 cubic-bezier(0.16, 1, 0.3, 1) flex flex-col items-center",
                    "max-h-[85vh] w-full",
                    open ? "translate-y-0" : "translate-y-full"
                )}
            >
                {/* Elegant Handle */}
                <div className="w-full flex justify-center pt-4 pb-2">
                    <div className="w-12 h-1.5 bg-emerald-900/10 rounded-full" />
                </div>

                {/* Header */}
                <div className="w-full flex items-center justify-between px-8 py-5 border-b border-emerald-950/5">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center animate-pulse">
                            <ShoppingBag className="h-6 w-6 text-emerald-600" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-emerald-950 uppercase tracking-tight leading-none">
                                Your Basket
                            </h2>
                            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mt-1.5 flex items-center gap-1.5 opacity-60">
                                <Zap className="h-3 w-3 fill-current" /> Fast Delivery in 10-15 mins
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-3 rounded-2xl bg-emerald-50 text-emerald-950 hover:bg-emerald-100 transition-all active:scale-90"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Main Content Area */}
                <div className="w-full flex-1 overflow-y-auto px-6 py-4 space-y-4 max-w-2xl scrollbar-hide">
                    {items.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-6 text-center">
                            <div className="relative">
                                <ShoppingBag className="h-24 w-24 text-emerald-900/5" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-4xl animate-bounce">🛒</span>
                                </div>
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-emerald-950 uppercase tracking-tight">Your cart is empty</h3>
                                <p className="text-[10px] font-bold text-emerald-950/40 uppercase tracking-widest mt-2 max-w-[200px] mx-auto leading-relaxed">
                                    Looks like you haven't added anything to your basket yet.
                                </p>
                            </div>
                            <button
                                onClick={onClose}
                                className="px-8 py-4 bg-emerald-600 text-white text-xs font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-emerald-500/20 hover:bg-emerald-700 transition-all active:scale-95"
                            >
                                Start Shopping
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {items.map((item, idx) => (
                                <div
                                    key={item.productId}
                                    className="flex gap-4 bg-white border border-emerald-950/5 rounded-[2rem] p-4 items-center transition-all hover:shadow-lg hover:border-emerald-500/20 group animate-in slide-in-from-bottom-4 duration-500"
                                    style={{ animationDelay: `${idx * 50}ms` }}
                                >
                                    {/* Premium Image Container */}
                                    <div className="relative w-20 h-20 rounded-[1.5rem] overflow-hidden bg-emerald-50/50 p-3 shrink-0 group-hover:scale-105 transition-transform">
                                        <Image
                                            src={item.image || "https://placehold.co/64x64/f3f4f6/9ca3af?text=P"}
                                            alt={item.name}
                                            fill
                                            className="object-contain"
                                            onError={(e) => { (e.target as HTMLImageElement).src = "https://placehold.co/64x64/f3f4f6/9ca3af?text=P"; }}
                                        />
                                    </div>

                                    {/* Info Panel */}
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-sm font-black text-emerald-950 uppercase tracking-tight line-clamp-1 group-hover:text-emerald-600 transition-colors">
                                            {item.name}
                                        </h3>
                                        <p className="text-[10px] font-bold text-emerald-800/40 uppercase tracking-widest mt-1">
                                            Unit Price: ₹{item.price.toFixed(0)}
                                        </p>
                                        <div className="mt-2 flex items-baseline gap-1">
                                            <span className="text-lg font-black text-emerald-900 tabular-nums">
                                                ₹{(item.price * item.quantity).toFixed(0)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Enhanced Stepper Controls */}
                                    <div className="flex flex-col items-end gap-3 shrink-0">
                                        <div className="flex items-center bg-white border border-emerald-950/5 rounded-2xl p-1 shadow-sm">
                                            <button
                                                onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                                                className="flex items-center justify-center w-8 h-8 rounded-xl text-emerald-600 hover:bg-emerald-50 transition-all active:scale-90"
                                            >
                                                <Minus className="h-3.5 w-3.5" strokeWidth={3} />
                                            </button>
                                            <span className="w-8 text-center text-sm font-black text-emerald-950 tabular-nums">{item.quantity}</span>
                                            <button
                                                onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                                                className="flex items-center justify-center w-8 h-8 rounded-xl bg-emerald-600 text-white shadow-lg shadow-emerald-500/30 hover:bg-emerald-700 transition-all active:scale-90"
                                            >
                                                <Plus className="h-3.5 w-3.5" strokeWidth={3} />
                                            </button>
                                        </div>
                                        <button
                                            onClick={() => removeItem(item.productId)}
                                            className="text-[10px] font-black text-red-400 uppercase tracking-widest hover:text-red-600 transition-colors flex items-center gap-1.5 px-2"
                                        >
                                            <Trash2 className="h-3 w-3" /> Remove
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Safety Badge */}
                    {items.length > 0 && (
                        <div className="mt-8 p-4 bg-emerald-50/50 rounded-2xl flex items-center gap-3 border border-emerald-500/10">
                            <ShieldCheck className="h-5 w-5 text-emerald-600" />
                            <p className="text-[10px] font-bold text-emerald-900/60 uppercase tracking-widest leading-relaxed">
                                100% Safe & Secure Payments. Fast delivery guaranteed.
                            </p>
                        </div>
                    )}
                </div>

                {/* Action Footer */}
                {items.length > 0 && (
                    <div className="w-full bg-white border-t border-emerald-950/5 px-8 pt-6 pb-12 rounded-t-[3rem] shadow-[0_-10px_40px_rgba(0,0,0,0.03)] z-20">
                        <div className="flex items-center justify-between max-w-2xl mx-auto">
                            <div className="flex flex-col">
                                <p className="text-[10px] font-bold text-emerald-950/40 uppercase tracking-widest">Total Bill</p>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-3xl font-black text-emerald-950 tabular-nums tracking-tighter">₹{totalPrice.toFixed(0)}</span>
                                    <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1.5 italic">Incl. Taxes</span>
                                </div>
                            </div>
                            <Link
                                href="/checkout"
                                onClick={onClose}
                                className="group relative flex items-center gap-4 bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-5 rounded-[2rem] shadow-2xl shadow-emerald-500/40 transition-all hover:scale-[1.03] active:scale-95"
                            >
                                <span className="text-sm font-black uppercase tracking-widest">Checkout</span>
                                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center group-hover:translate-x-1 transition-transform">
                                    <ArrowRight className="h-4 w-4 text-white" />
                                </div>
                            </Link>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
