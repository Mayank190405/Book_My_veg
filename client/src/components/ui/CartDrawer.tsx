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

const DeliveryBoyIllustration = () => (
    <svg width="45" height="32" viewBox="0 0 45 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0 text-emerald-600 opacity-80">
        {/* Speed lines */}
        <line x1="2" y1="10" x2="8" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="0.5" y1="15" x2="6.5" y2="15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="3" y1="20" x2="9" y2="20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        
        {/* Scooter body */}
        <path d="M19 25.5H35" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M17 19.5H30.5L34.5 13.5H23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M34.5 13.5L37.5 25.5" stroke="currentColor" strokeWidth="2" />
        <path d="M37.5 11.5L38.5 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />

        {/* Wheels */}
        <circle cx="17.5" cy="25.5" r="4.5" stroke="currentColor" strokeWidth="2" />
        <circle cx="36.5" cy="25.5" r="4.5" stroke="currentColor" strokeWidth="2" />

        {/* Delivery Box */}
        <rect x="13" y="10.5" width="8.5" height="9" rx="1.5" fill="currentColor" />

        {/* Rider */}
        <circle cx="26.5" cy="6.5" r="3" fill="currentColor" />
        <path d="M24 10.5C25.5 9 27.5 9 29 10.5L31.5 16.5H21.5L24 10.5Z" fill="currentColor" />
    </svg>
);

export default function CartDrawer({ open, onClose }: CartDrawerProps) {
    const { items, updateQuantity, removeItem, totalItems, totalPrice } = useCartStore();

    return (
        <>
            {/* Immersive Backdrop */}
            <div
                onClick={onClose}
                className={cn(
                    "fixed inset-0 bg-black/60 z-[100] transition-all duration-500",
                    open ? "opacity-100 backdrop-blur-md pointer-events-auto" : "opacity-0 backdrop-blur-0 pointer-events-none"
                )}
            />

            {/* Premium Panel */}
            <div
                className={cn(
                    "fixed bottom-0 left-0 right-0 z-[110] bg-white rounded-t-[3rem] shadow-[0_-20px_80px_rgba(0,0,0,0.1)] transition-transform duration-500 cubic-bezier(0.16, 1, 0.3, 1) flex flex-col items-center select-none",
                    "max-h-[85vh] w-full md:max-w-[430px] md:mx-auto border-t border-emerald-500/5",
                    open ? "translate-y-0" : "translate-y-full"
                )}
            >
                {/* Elegant Handle */}
                <div className="w-full flex justify-center pt-4 pb-2">
                    <div className="w-12 h-1 bg-[#10b981]/30 rounded-full" />
                </div>

                {/* Header */}
                <div className="w-full flex items-center justify-between px-7 py-4 border-b border-slate-50">
                    <div className="flex items-center gap-4 text-left">
                        <div className="w-13 h-13 bg-[#f0fbf8] rounded-full flex items-center justify-center text-emerald-600 shrink-0">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M5 8V18C5 20.2091 6.79086 22 9 22H15C17.2091 22 19 20.2091 19 18V8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                                <path d="M9 8V6C9 4.34315 10.3431 3 12 3C13.6569 3 15 4.34315 15 6V8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                                <path d="M12 11C12 14.5 13.5 16 15 16C15 14 13.5 12.5 12 11Z" fill="currentColor" />
                                <path d="M12 11C12 14.5 10.5 16 9 16C9 14 10.5 12.5 12 11Z" fill="#047857" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-slate-800 tracking-tight uppercase leading-none">
                                Your Basket
                            </h2>
                            <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mt-1.5 flex items-center gap-1.5">
                                <Zap className="h-3 w-3 fill-current animate-pulse text-emerald-500" /> Fast Delivery in 10-15 mins
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-11 h-11 rounded-full bg-[#f0fbf8] text-slate-700 hover:bg-[#e6f7f3] flex items-center justify-center transition-all active:scale-90"
                    >
                        <X className="h-4.5 w-4.5" strokeWidth={2.5} />
                    </button>
                </div>

                {/* Main Content Area */}
                <div className="w-full flex-1 overflow-y-auto px-6 py-4 space-y-4 scrollbar-hide">
                    {items.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-24 gap-6 text-center">
                            <div className="relative">
                                <ShoppingBag className="h-20 w-20 text-slate-200" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-3xl animate-bounce">🛒</span>
                                </div>
                            </div>
                            <div>
                                <h3 className="text-sm font-black text-slate-700 uppercase tracking-wider">Your cart is empty</h3>
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-2 max-w-[200px] mx-auto leading-relaxed">
                                    Looks like you haven't added anything to your basket yet.
                                </p>
                            </div>
                            <button
                                onClick={onClose}
                                className="px-8 py-3.5 bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-emerald-500/20 hover:bg-emerald-700 transition-all active:scale-95"
                            >
                                Start Shopping
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-3.5">
                            {items.map((item, idx: number) => (
                                <div
                                    key={item.productId}
                                    className="flex gap-4 bg-white border border-slate-100 rounded-[22px] p-4 items-center shadow-[0_6px_24px_rgba(4,64,48,0.015)] transition-all hover:bg-slate-50/50 group animate-in slide-in-from-bottom-4 duration-500 text-left"
                                    style={{ animationDelay: `${idx * 50}ms` }}
                                >
                                    {/* Premium Image Container */}
                                    <div className="relative w-18 h-18 rounded-2xl overflow-hidden bg-slate-50/50 border border-slate-100 p-2 shrink-0 group-hover:scale-105 transition-transform">
                                        <Image
                                            src={item.image || "https://placehold.co/64x64/f8fafc/0f172a?text=P"}
                                            alt={item.name}
                                            fill
                                            className="object-contain"
                                        />
                                    </div>

                                    {/* Info Panel */}
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-xs font-black text-slate-800 uppercase tracking-tight line-clamp-1 group-hover:text-[#10b981] transition-colors leading-tight">
                                            {item.name}
                                        </h3>
                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                                            ₹{Number(item.price).toFixed(0)} / UNIT
                                        </p>
                                        <div className="mt-2.5">
                                            <span className="text-base font-black text-slate-800 tabular-nums">
                                                ₹{(Number(item.price) * item.quantity).toFixed(0)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Enhanced Stepper Controls */}
                                    <div className="flex flex-col items-center gap-1.5 shrink-0">
                                        <div className="flex items-center bg-[#f7faf8] border border-slate-100 rounded-3xl p-1 shadow-sm select-none">
                                            <button
                                                onClick={() => updateQuantity(item.productId, item.quantity - 1, item.variantId)}
                                                className="flex items-center justify-center w-7 h-7 rounded-full text-slate-500 hover:text-slate-800 hover:bg-white/80 transition-all active:scale-90"
                                            >
                                                <Minus className="h-3 w-3" strokeWidth={3} />
                                            </button>
                                            <span className="w-6 text-center text-xs font-black text-slate-800 tabular-nums">{item.quantity}</span>
                                            <button
                                                onClick={() => updateQuantity(item.productId, item.quantity + 1, item.variantId)}
                                                className="flex items-center justify-center w-7 h-7 rounded-full bg-[#10b981] text-white shadow-[0_4px_10px_rgba(16,185,129,0.2)] hover:bg-[#0e9d6d] transition-all active:scale-90"
                                            >
                                                <Plus className="h-3 w-3" strokeWidth={3} />
                                            </button>
                                        </div>
                                        <button
                                            onClick={() => removeItem(item.productId, item.variantId)}
                                            className="text-[9px] font-black text-rose-500/80 uppercase tracking-widest hover:text-rose-600 transition-colors flex items-center gap-1 px-2 mt-0.5 justify-center"
                                        >
                                            <Trash2 className="h-2.5 w-2.5" /> Remove
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Safety Badge */}
                    {items.length > 0 && (
                        <div className="mt-8 p-4 bg-emerald-500/[0.03] rounded-3xl flex items-center justify-between gap-4 border border-emerald-500/5 text-left">
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-[#10b981] shrink-0">
                                    <ShieldCheck className="h-4.5 w-4.5" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[9px] font-black text-slate-700 uppercase tracking-wider leading-none">100% Safe & Secure Payments.</p>
                                    <p className="text-[7.5px] font-bold text-slate-400 uppercase tracking-widest mt-1">Fast delivery guaranteed.</p>
                                </div>
                            </div>
                            
                            {/* Delivery illustration */}
                            <DeliveryBoyIllustration />
                        </div>
                    )}
                </div>

                {/* Action Footer */}
                {items.length > 0 && (
                    <div className="w-full bg-white border-t border-slate-50 px-7 pt-5 pb-8 rounded-t-[2.5rem] shadow-[0_-12px_40px_rgba(0,0,0,0.03)] z-20">
                        <div className="flex items-center justify-between max-w-2xl mx-auto gap-4">
                            <div className="flex flex-col text-left">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5 pl-0.5">Total Bill</p>
                                <div className="flex flex-col">
                                    <span className="text-2xl font-black text-slate-800 tabular-nums tracking-tighter leading-none">₹{Number(totalPrice).toFixed(0)}</span>
                                    <span className="text-[8px] font-black text-emerald-600 uppercase tracking-widest mt-1 italic pl-0.5">Incl. Taxes</span>
                                </div>
                            </div>
                            <Link
                                href="/checkout"
                                onClick={onClose}
                                className="bg-[#10b981] hover:bg-[#0e9d6d] text-white h-14 pl-6 pr-3.5 rounded-[22px] flex items-center justify-between gap-4 shadow-[0_12px_24px_rgba(16,185,129,0.15)] active:scale-[0.98] transition-all shrink-0 min-w-[180px]"
                            >
                                <span className="text-[11px] font-black uppercase tracking-[0.2em]">Checkout</span>
                                <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shrink-0 text-[#10b981]">
                                    <ArrowRight className="h-4 w-4" strokeWidth={3} />
                                </div>
                            </Link>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
