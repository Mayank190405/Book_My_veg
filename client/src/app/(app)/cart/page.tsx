"use client";

import { useCartStore } from "@/store/useCartStore";
import { useUserStore } from "@/store/useUserStore";
import {
    Trash2, Plus, Minus, ArrowRight, ShoppingCart,
    CheckCircle2, Truck, ShieldCheck, Flame, RotateCcw,
    Zap, ChevronRight, Tag, ArrowLeft
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { getTrendingProducts, getBuyAgainProducts } from "@/services/productService";

/* ─── Types ─── */
interface RecoProduct {
    id: string;
    name: string;
    basePrice: number;
    images: string[];
    pricing?: { price: number; discountType?: string; discountValue?: number; isActive?: boolean }[];
    variants?: { price: number }[];
}

const getRecoPrice = (p: RecoProduct): number => {
    const activePricing = p.pricing?.find(pr => pr.isActive);
    if (activePricing) return Number(activePricing.price) || Number(p.basePrice) || 0;
    return Number(p.basePrice) || Number(p.variants?.[0]?.price) || 0;
};

export default function CartPage() {
    const router = useRouter();
    const { items, updateQuantity, removeItem, totalItems, totalPrice, couponCode, discount, applyCoupon, removeCoupon, clearCart, addItem } = useCartStore();
    const { location } = useUserStore();
    const [localCode, setLocalCode] = useState("");
    const [trending, setTrending] = useState<RecoProduct[]>([]);
    const [buyAgain, setBuyAgain] = useState<RecoProduct[]>([]);
    const [loadingReco, setLoadingReco] = useState(true);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (couponCode) setLocalCode(couponCode);
    }, [couponCode]);

    /* Fetch recommendations */
    useEffect(() => {
        const fetchRecos = async () => {
            try {
                const [tr, ba] = await Promise.allSettled([
                    getTrendingProducts(location?.pincode, location?.coords?.lat, location?.coords?.lng),
                    getBuyAgainProducts(),
                ]);
                if (tr.status === "fulfilled") {
                    const data = tr.value?.products || tr.value || [];
                    setTrending(data.slice(0, 8));
                }
                if (ba.status === "fulfilled") {
                    const data = ba.value?.products || ba.value || [];
                    setBuyAgain(data.slice(0, 8));
                }
            } catch (_) {}
            setLoadingReco(false);
        };
        fetchRecos();
    }, [location]);

    const deliveryFee = totalPrice >= 249 ? 0 : 40;
    const grandTotal = totalPrice + deliveryFee - discount;
    const totalSaved = discount + (totalPrice >= 249 ? 40 : 0);
    const getMrp = (price: number) => Math.ceil(price * 1.12);

    const handleAddReco = (p: RecoProduct) => {
        addItem({
            productId: p.id,
            name: p.name,
            price: getRecoPrice(p),
            image: p.images?.[0] || "/placeholder.png",
            quantity: 1,
        });
    };

    /* ─── Empty State ─── */
    if (items.length === 0) {
        return (
            <div className="fixed inset-0 bg-white flex flex-col">
                <div className="px-5 pt-6 pb-2 flex items-center gap-3.5">
                    <button
                        onClick={() => router.back()}
                        className="w-10 h-10 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-[#1a2e1a] hover:scale-105 active:scale-95 transition-all shrink-0"
                    >
                        <ArrowLeft className="h-5 w-5 stroke-[2.5]" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-black text-[#1a2e1a]">My Cart</h1>
                        <p className="text-slate-400 text-[13px] mt-0.5 font-medium leading-snug">
                            Looks like you haven't added anything to your cart yet.
                        </p>
                    </div>
                </div>

                <div className="flex-1 flex flex-col items-center justify-center px-8">
                    <div className="relative mb-6">
                        <div className="absolute inset-0 rounded-full bg-emerald-50 scale-110 animate-pulse opacity-60" />
                        <div className="relative w-56 h-56 rounded-full bg-emerald-50 flex items-center justify-center overflow-hidden">
                            <Image src="/empty-cart.png" alt="Your cart is empty" width={220} height={220} className="object-contain scale-90" priority />
                        </div>
                    </div>

                    <h2 className="text-[22px] font-black text-[#1a2e1a] text-center mb-2 tracking-tight">Your cart is empty</h2>
                    <p className="text-slate-400 text-[13px] text-center mb-8 max-w-[230px] leading-relaxed font-medium">
                        Add items to get started and enjoy fresh, organic products.
                    </p>

                    <button
                        onClick={() => router.push("/categories")}
                        className="w-full max-w-[300px] h-[52px] bg-[#1a5c2e] hover:bg-[#154d26] active:scale-[0.97] transition-all duration-200 rounded-full font-black uppercase tracking-[0.15em] text-white text-[11px] shadow-[0_8px_24px_rgba(26,92,46,0.3)]"
                    >
                        Shop Categories
                    </button>
                </div>

                {/* Trending Picks even on empty cart */}
                {trending.length > 0 && (
                    <div className="pb-6 py-6">
                        <div className="flex items-center gap-2 px-5 mb-3">
                            <Flame className="w-4 h-4 text-orange-500" />
                            <span className="text-[11px] font-black text-[#1a2e1a] uppercase tracking-widest">Popular Near You</span>
                        </div>
                        <div className="flex gap-3 overflow-x-auto px-5 pb-1 scrollbar-hide">
                            {trending.slice(0, 6).map((p) => (
                                <button
                                    key={p.id}
                                    onClick={() => handleAddReco(p)}
                                    className="flex-shrink-0 w-28 bg-white border border-slate-100 rounded-2xl p-2.5 shadow-sm active:scale-95 transition-all text-left"
                                >
                                    <div className="w-full aspect-square rounded-xl bg-slate-50 overflow-hidden relative mb-2">
                                        <Image src={p.images?.[0] || "/placeholder.png"} alt={p.name} fill className="object-contain p-1" />
                                    </div>
                                    <p className="text-[10px] font-black text-[#1a2e1a] line-clamp-2 leading-tight mb-1">{p.name}</p>
                                    <p className="text-[11px] font-black text-[#1a5c2e]">{getRecoPrice(p) > 0 ? `₹${getRecoPrice(p)}` : ""}</p>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Trust badges */}
                <div className="pb-10 px-6">
                    <div className="flex items-start justify-around gap-2">
                        {[
                            { icon: CheckCircle2, label: "100% Organic", sub: "Premium quality" },
                            { icon: Truck, label: "Fast Delivery", sub: "On time, every time" },
                            { icon: ShieldCheck, label: "Secure Pay", sub: "100% safe & secure" },
                        ].map(({ icon: Icon, label, sub }) => (
                            <div key={label} className="flex flex-col items-center text-center gap-2 flex-1">
                                <div className="w-11 h-11 rounded-full border-2 border-emerald-100 bg-emerald-50 flex items-center justify-center">
                                    <Icon className="w-5 h-5 text-[#1a5c2e] stroke-[1.8]" />
                                </div>
                                <span className="text-[9px] font-black text-[#1a2e1a] uppercase tracking-wider">{label}</span>
                                <span className="text-[9px] text-slate-400 font-medium">{sub}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    /* ─── Cart with Items ─── */
    return (
        <div className="min-h-screen bg-[#f5f6f5] pb-64">

            {/* Header */}
            <div className="bg-white px-5 pt-5 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3.5">
                    <button
                        onClick={() => router.back()}
                        className="w-10 h-10 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-[#1a2e1a] hover:scale-105 active:scale-95 transition-all shrink-0"
                    >
                        <ArrowLeft className="h-5 w-5 stroke-[2.5]" />
                    </button>
                    <div className="flex-1 min-w-0">
                        <h1 className="text-2xl font-black text-[#1a2e1a] tracking-tight">
                            My Cart <span className="text-slate-300 font-bold text-lg">({totalItems})</span>
                        </h1>
                        <p className="text-slate-400 text-[13px] mt-0.5 font-medium leading-none">Review your items and proceed to checkout.</p>
                    </div>
                    <button
                        onClick={() => clearCart()}
                        className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest border border-slate-200 rounded-xl px-3 py-2 hover:border-red-200 hover:text-red-400 transition-all active:scale-95 shrink-0"
                    >
                        <Trash2 className="w-3 h-3" />
                        Clear
                    </button>
                </div>
            </div>

            {/* Delivery estimate banner */}
            <div className="mx-4 mt-3 bg-[#1a5c2e] rounded-2xl px-4 py-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                    <Zap className="w-4 h-4 text-[#7fffc4]" />
                </div>
                <div>
                    <p className="text-white font-black text-[13px]">Express Delivery in <span className="text-[#7fffc4]">30 mins</span></p>
                    <p className="text-white/50 text-[10px] font-semibold mt-0.5">Fresh straight to your door · {location?.address || "your location"}</p>
                </div>
            </div>

            {/* Free delivery progress */}
            {deliveryFee > 0 && (
                <div className="mx-4 mt-3 bg-white rounded-2xl px-4 py-3 border border-slate-100 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-[11px] font-black text-[#1a2e1a]">
                            Add <span className="text-[#1a5c2e]">₹{249 - totalPrice}</span> more for <span className="text-[#1a5c2e]">FREE delivery</span>
                        </p>
                        <Truck className="w-4 h-4 text-slate-300" />
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-emerald-500 to-[#1a5c2e] rounded-full transition-all duration-700"
                            style={{ width: `${Math.min((totalPrice / 249) * 100, 100)}%` }}
                        />
                    </div>
                </div>
            )}
            {deliveryFee === 0 && (
                <div className="mx-4 mt-3 bg-emerald-50 border border-emerald-100 rounded-2xl px-4 py-3 flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-[#1a5c2e]" />
                    <p className="text-[12px] font-black text-[#1a5c2e]">🎉 Free delivery unlocked!</p>
                </div>
            )}

            {/* Item List */}
            <div className="px-4 pt-3 space-y-3">
                {items.map((item, idx) => {
                    const mrp = getMrp(item.price);
                    return (
                        <div
                            key={`${item.productId}-${item.variantId}`}
                            className="bg-white rounded-2xl border border-slate-100 p-4 flex items-center gap-4 shadow-sm"
                            style={{ animationDelay: `${idx * 60}ms` }}
                        >
                            {/* Circular image */}
                            <div className="w-[68px] h-[68px] rounded-full bg-slate-50 border border-slate-100 flex-shrink-0 overflow-hidden relative shadow-sm">
                                <Image src={item.image || "/placeholder.png"} alt={item.name} fill className="object-contain p-1.5" />
                            </div>

                            <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                    <h3 className="text-[13px] font-black text-[#1a2e1a] leading-tight line-clamp-2">{item.name}</h3>
                                    <button
                                        onClick={() => removeItem(item.productId, item.variantId)}
                                        className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center text-slate-300 hover:text-red-400 hover:bg-red-50 transition-all flex-shrink-0 active:scale-90"
                                    >
                                        <Trash2 className="w-3 h-3" />
                                    </button>
                                </div>
                                <p className="text-[10px] text-slate-400 font-semibold mt-0.5">1 unit</p>

                                <div className="flex items-center justify-between mt-2.5">
                                    <div className="flex items-baseline gap-1.5">
                                        <span className="text-base font-black text-[#1a2e1a]">₹{item.price}</span>
                                        <span className="text-[10px] text-slate-300 line-through font-semibold">₹{mrp}</span>
                                        <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">
                                            {Math.round(((mrp - item.price) / mrp) * 100)}% off
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2.5 border border-slate-200 rounded-xl px-2.5 py-1.5 bg-slate-50">
                                        <button onClick={() => updateQuantity(item.productId, item.quantity - 1, item.variantId)} className="text-[#1a5c2e] active:scale-75 transition-all">
                                            <Minus className="w-3.5 h-3.5" strokeWidth={3} />
                                        </button>
                                        <span className="text-sm font-black text-[#1a2e1a] min-w-[14px] text-center tabular-nums">{item.quantity}</span>
                                        <button onClick={() => updateQuantity(item.productId, item.quantity + 1, item.variantId)} className="text-[#1a5c2e] active:scale-75 transition-all">
                                            <Plus className="w-3.5 h-3.5" strokeWidth={3} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Savings Banner */}
            {totalSaved > 0 && (
                <div className="mx-4 mt-3 bg-emerald-50 border border-emerald-100 rounded-2xl px-4 py-3 flex items-center gap-2.5">
                    <span className="text-xl">🥬</span>
                    <p className="text-[11px] font-black text-[#1a5c2e]">
                        Yay! You are saving <span className="text-emerald-600">₹{totalSaved}</span> on this order 😊
                    </p>
                </div>
            )}

            {/* Coupon */}
            <div className="mx-4 mt-3 bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                    <Tag className="w-3.5 h-3.5 text-[#1a5c2e]" />
                    <span className="text-[10px] font-black text-[#1a2e1a] uppercase tracking-widest">Promo Code</span>
                </div>
                {couponCode ? (
                    <div className="flex items-center justify-between bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                        <div>
                            <p className="text-xs font-black text-[#1a2e1a] uppercase tracking-widest">{couponCode}</p>
                            <p className="text-[10px] text-emerald-600 font-black mt-0.5">Saved ₹{discount}</p>
                        </div>
                        <button onClick={() => { removeCoupon(); setLocalCode(""); }} className="text-[10px] text-red-400 font-black px-3 py-1.5 border border-red-100 rounded-lg hover:bg-red-50 transition-all">
                            REMOVE
                        </button>
                    </div>
                ) : (
                    <div className="flex gap-2">
                        <input
                            type="text"
                            placeholder="Enter promo code"
                            value={localCode}
                            onChange={(e) => setLocalCode(e.target.value.toUpperCase())}
                            className="flex-1 h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-400 font-semibold placeholder:text-slate-300 text-[#1a2e1a] text-sm tracking-widest"
                        />
                        <button
                            onClick={() => localCode && applyCoupon(localCode)}
                            disabled={!localCode}
                            className="px-5 h-11 bg-[#1a5c2e] disabled:bg-slate-200 disabled:text-slate-400 text-white font-black rounded-xl text-[10px] uppercase tracking-widest transition-all active:scale-95"
                        >
                            APPLY
                        </button>
                    </div>
                )}
            </div>

            {/* ── RECOMMENDATIONS: Frequently Bought Together ── */}
            {trending.length > 0 && (
                <div className="mt-4">
                    <div className="flex items-center justify-between px-5 mb-3">
                        <div className="flex items-center gap-2">
                            <Flame className="w-4 h-4 text-orange-500" />
                            <span className="text-[12px] font-black text-[#1a2e1a] uppercase tracking-widest">Trending Near You</span>
                        </div>
                        <button onClick={() => router.push("/categories")} className="flex items-center gap-1 text-[10px] font-black text-[#1a5c2e]">
                            See all <ChevronRight className="w-3 h-3" />
                        </button>
                    </div>
                    <div className="flex gap-3 overflow-x-auto px-4 pb-2 scrollbar-hide">
                        {trending.map((p) => {
                            const inCart = items.some(i => i.productId === p.id);
                            return (
                                <div key={p.id} className="flex-shrink-0 w-32 bg-white border border-slate-100 rounded-2xl p-3 shadow-sm">
                                    <div className="w-full aspect-square rounded-xl bg-slate-50 overflow-hidden relative mb-2">
                                        <Image src={p.images?.[0] || "/placeholder.png"} alt={p.name} fill className="object-contain p-1.5" />
                                    </div>
                                    <p className="text-[10px] font-black text-[#1a2e1a] line-clamp-2 leading-tight mb-1.5">{p.name}</p>
                                    <div className="flex items-center justify-between">
                                        <span className="text-[12px] font-black text-[#1a5c2e]">{getRecoPrice(p) > 0 ? `₹${getRecoPrice(p)}` : ""}</span>
                                        <button
                                            onClick={() => inCart ? null : handleAddReco(p)}
                                            className={cn(
                                                "w-7 h-7 rounded-lg flex items-center justify-center transition-all active:scale-90 text-white font-black text-xs",
                                                inCart ? "bg-emerald-100 text-emerald-600" : "bg-[#1a5c2e]"
                                            )}
                                        >
                                            {inCart ? "✓" : "+"}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── RECOMMENDATIONS: Buy Again ── */}
            {buyAgain.length > 0 && (
                <div className="mt-4">
                    <div className="flex items-center gap-2 px-5 mb-3">
                        <RotateCcw className="w-4 h-4 text-blue-500" />
                        <span className="text-[12px] font-black text-[#1a2e1a] uppercase tracking-widest">Buy Again</span>
                    </div>
                    <div className="flex gap-3 overflow-x-auto px-4 pb-2 scrollbar-hide">
                        {buyAgain.map((p) => {
                            const inCart = items.some(i => i.productId === p.id);
                            return (
                                <div key={p.id} className="flex-shrink-0 w-32 bg-white border border-slate-100 rounded-2xl p-3 shadow-sm">
                                    <div className="w-full aspect-square rounded-xl bg-slate-50 overflow-hidden relative mb-2">
                                        <Image src={p.images?.[0] || "/placeholder.png"} alt={p.name} fill className="object-contain p-1.5" />
                                    </div>
                                    <p className="text-[10px] font-black text-[#1a2e1a] line-clamp-2 leading-tight mb-1.5">{p.name}</p>
                                    <div className="flex items-center justify-between">
                                        <span className="text-[12px] font-black text-[#1a5c2e]">{getRecoPrice(p) > 0 ? `₹${getRecoPrice(p)}` : ""}</span>
                                        <button
                                            onClick={() => inCart ? null : handleAddReco(p)}
                                            className={cn(
                                                "w-7 h-7 rounded-lg flex items-center justify-center transition-all active:scale-90 text-white font-black text-xs",
                                                inCart ? "bg-emerald-100 text-emerald-600" : "bg-[#1a5c2e]"
                                            )}
                                        >
                                            {inCart ? "✓" : "+"}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Bill Summary */}
            <div className="mx-4 mt-4 bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Bill Summary</h3>
                <div className="space-y-3">
                    <div className="flex justify-between items-center">
                        <span className="text-[12px] text-slate-500 font-semibold">Item Total</span>
                        <span className="text-[13px] font-black text-[#1a2e1a]">₹{totalPrice.toFixed(0)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-[12px] text-slate-500 font-semibold">Delivery Fee</span>
                        <span className={cn("text-[13px] font-black", deliveryFee === 0 ? "text-emerald-600" : "text-[#1a2e1a]")}>
                            {deliveryFee === 0 ? "FREE" : `₹${deliveryFee}`}
                        </span>
                    </div>
                    {discount > 0 && (
                        <div className="flex justify-between items-center">
                            <span className="text-[12px] text-emerald-600 font-semibold">Coupon Discount</span>
                            <span className="text-[13px] font-black text-emerald-600">-₹{discount}</span>
                        </div>
                    )}
                    <div className="border-t border-dashed border-slate-100 pt-3 flex justify-between items-center">
                        <span className="text-[13px] font-black text-[#1a2e1a]">Total</span>
                        <div className="text-right">
                            <span className="text-[18px] font-black text-[#1a2e1a]">₹{grandTotal.toFixed(0)}</span>
                            {totalSaved > 0 && <p className="text-[9px] text-emerald-600 font-black">You save ₹{totalSaved}</p>}
                        </div>
                    </div>
                </div>
            </div>

            {/* Spacer to scroll past the sticky checkout bar */}
            <div className="h-48 w-full" />

            {/* Sticky Checkout Bar */}
            {mounted && createPortal(
                <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-100 px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex flex-col">
                            <span className="text-[10px] text-slate-400 font-semibold mb-0.5">Total Amount</span>
                            <div className="flex items-baseline gap-2">
                                <span className="text-xl font-black text-[#1a2e1a]">₹{grandTotal.toFixed(0)}</span>
                                <span className="text-xs text-slate-300 line-through font-semibold">₹{(totalPrice + deliveryFee).toFixed(0)}</span>
                            </div>
                            {totalSaved > 0 && <span className="text-[10px] text-emerald-600 font-black mt-0.5">You saved ₹{totalSaved}</span>}
                        </div>
                        <Link
                            href="/checkout"
                            className="flex items-center gap-2.5 bg-[#1a5c2e] hover:bg-[#154d26] active:scale-[0.97] transition-all rounded-full pl-6 pr-2 py-2 shadow-[0_4px_16px_rgba(26,92,46,0.3)]"
                        >
                            <span className="font-black uppercase text-[10px] tracking-widest text-white">Proceed to Checkout</span>
                            <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center flex-shrink-0">
                                <ArrowRight className="w-4 h-4 text-[#1a5c2e]" strokeWidth={3} />
                            </div>
                        </Link>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
