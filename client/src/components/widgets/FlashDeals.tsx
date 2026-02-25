"use client";

import { useState, useEffect } from "react";
import { Timer, Zap } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getFlashDeals } from "@/services/productService";
import { Skeleton } from "@/components/ui/skeleton";
import { useCartStore } from "@/store/useCartStore";
import { Plus, Minus } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";

export default function FlashDeals() {
    const { data: deals, isLoading } = useQuery({
        queryKey: ["flash-deals"],
        queryFn: getFlashDeals,
    });

    const { items, addItem, updateQuantity } = useCartStore();
    const [timeLeft, setTimeLeft] = useState<{ [key: string]: string }>({});

    useEffect(() => {
        if (!deals) return;

        const tick = () => {
            const newTimeLeft: { [key: string]: string } = {};
            deals.forEach((deal: any) => {
                const diff = new Date(deal.endTime).getTime() - Date.now();
                if (diff <= 0) {
                    newTimeLeft[deal.id] = "EXPIRED";
                } else {
                    const h = Math.floor(diff / 3600000);
                    const m = Math.floor((diff % 3600000) / 60000);
                    const s = Math.floor((diff % 60000) / 1000);
                    newTimeLeft[deal.id] = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
                }
            });
            setTimeLeft(newTimeLeft);
        };

        tick();
        const timer = setInterval(tick, 1000);
        return () => clearInterval(timer);
    }, [deals]);

    if (isLoading) return <Skeleton className="w-full h-52 rounded-xl" />;
    if (!deals || deals.length === 0) return null;

    // Filter out expired deals from display
    const activeDeals = deals.filter((d: any) => timeLeft[d.id] !== "EXPIRED");
    if (activeDeals.length === 0) return null;

    return (
        <div className="relative overflow-hidden rounded-[2.5rem] p-6 shadow-xl border border-black/5 bg-emerald-600 group">
            {/* Animated Shine Effect */}
            <div className="absolute inset-0 bg-gradient-to-tr from-white/10 via-transparent to-white/5 opacity-40 pointer-events-none" />

            {/* Header */}
            <div className="flex justify-between items-center mb-6 relative z-10">
                <div className="flex items-center gap-3">
                    <div className="bg-yellow-400 p-2 rounded-2xl shadow-lg shadow-yellow-400/20 rotate-12">
                        <Zap className="h-5 w-5 fill-white text-white" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black tracking-tighter text-white italic leading-none">FLASH DEALS</h2>
                        <p className="text-[10px] text-white/70 font-black tracking-widest uppercase mt-1">Limited time offers</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 bg-white/10 backdrop-blur-xl px-4 py-2 rounded-2xl text-xs border border-white/20">
                    <Timer className="h-4 w-4 text-yellow-300 animate-pulse" />
                    <span className="text-white font-mono font-black tracking-wider">{Object.values(timeLeft)[0] || "00:00:00"}</span>
                </div>
            </div>

            {/* Cards */}
            <div className="flex gap-4 overflow-x-auto pb-4 -mx-2 px-2 scrollbar-hide snap-x relative z-10">
                {activeDeals.map((deal: any, idx: number) => {
                    const cartItem = items.find((i) => i.productId === deal.productId);
                    const qty = cartItem?.quantity ?? 0;
                    const stockPct = deal.totalStock > 0 ? Math.min(100, Math.round((deal.stock / deal.totalStock) * 100)) : 0;
                    const isOut = deal.stock === 0;

                    const handleAdd = () => {
                        if (isOut) return;
                        addItem({ productId: deal.productId, name: deal.name, price: deal.price, image: deal.image || "", quantity: 1 });
                    };

                    return (
                        <div
                            key={deal.id}
                            className="flex-none w-56 bg-white/95 p-4 rounded-[2rem] text-gray-900 flex flex-col gap-3 shadow-md border border-white/50 backdrop-blur-sm snap-start animate-slide-up"
                            style={{ animationDelay: `${idx * 100}ms` }}
                        >
                            {/* Image + discount */}
                            <div className="relative w-full h-32 bg-gray-50/50 rounded-2xl overflow-hidden group/card">
                                <Image
                                    src={deal.image || "https://placehold.co/200x200/f3f4f6/9ca3af?text=Product"}
                                    alt={deal.name}
                                    fill
                                    className="object-contain p-2 transition-transform duration-500 group-hover/card:scale-110"
                                    sizes="224px"
                                />
                                <div className="absolute top-2 left-2 bg-red-600 text-white text-[10px] font-black px-2 py-1 rounded-lg shadow-lg rotate-[-5deg]">
                                    {Math.round(deal.discount)}{deal.discountType === "PERCENTAGE" ? "%" : "₹"} OFF
                                </div>
                            </div>

                            {/* Info */}
                            <div className="space-y-1">
                                <h3 className="text-sm font-black line-clamp-1 leading-tight text-emerald-950 tracking-tight">{deal.name}</h3>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-lg font-black text-emerald-600">₹{deal.price}</span>
                                    <span className="text-xs text-emerald-950/30 font-bold line-through">₹{deal.originalPrice}</span>
                                </div>
                            </div>

                            {/* Stock & Timer */}
                            <div className="space-y-2">
                                <div className="w-full bg-emerald-50 h-2 rounded-full overflow-hidden p-[2px]">
                                    <div
                                        className={cn("h-full rounded-full transition-all duration-1000", stockPct < 20 ? "bg-red-500" : "bg-emerald-500")}
                                        style={{ width: `${stockPct}%` }}
                                    />
                                </div>
                                <div className="flex justify-between items-center text-[8px]">
                                    <span className={cn("font-black tracking-widest uppercase flex items-center gap-1", stockPct < 20 ? "text-red-500" : "text-emerald-950/30")}>
                                        <div className={cn("w-1 h-1 rounded-full", stockPct < 20 ? "bg-red-500 animate-pulse" : "bg-emerald-500")} />
                                        {isOut ? "OUT OF STOCK" : `${deal.stock} LEFT`}
                                    </span>
                                    <span className="bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded-md font-mono font-black">
                                        {timeLeft[deal.id] ?? "..."}
                                    </span>
                                </div>
                            </div>

                            {/* Add / Stepper */}
                            <div className="mt-auto">
                                {qty === 0 ? (
                                    <button
                                        onClick={handleAdd}
                                        disabled={isOut}
                                        className={cn(
                                            "w-full py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95",
                                            isOut ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-emerald-600 text-white hover:bg-emerald-700"
                                        )}
                                    >
                                        <Plus className="h-3.5 w-3.5" strokeWidth={4} />
                                        Add
                                    </button>
                                ) : (
                                    <div className="flex items-center justify-between bg-emerald-600 rounded-xl overflow-hidden shadow-sm">
                                        <button onClick={() => updateQuantity(deal.productId, qty - 1)} className="flex-1 flex items-center justify-center py-2.5 text-white hover:bg-black/10 transition-colors">
                                            <Minus className="h-3.5 w-3.5" strokeWidth={4} />
                                        </button>
                                        <span className="flex-none w-10 text-center text-xs font-black text-white">{qty}</span>
                                        <button
                                            onClick={() => updateQuantity(deal.productId, qty + 1)}
                                            disabled={deal.stock > 0 && qty >= deal.stock}
                                            className="flex-1 flex items-center justify-center py-2.5 text-white hover:bg-black/10 transition-colors disabled:opacity-40"
                                        >
                                            <Plus className="h-3.5 w-3.5" strokeWidth={4} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
