"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useCallback } from "react";
import { Plus, Minus, Star } from "lucide-react";
import { useCartStore } from "@/store/useCartStore";
import { cn } from "@/lib/utils";

export interface ProductCardProps {
    id: string;
    name: string;
    images: string[];
    basePrice: number;
    originalPrice?: number;
    weightUnit?: string;
    inventory?: { currentStock: number; thresholdStock: number }[];
    pricing?: { price: number; discountType: string; discountValue: number; isActive: boolean }[];
    badge?: "trending" | "flash" | null;
    compact?: boolean;
    variant?: "default" | "transparent";
    variants?: {
        id: string;
        name: string;
        price: number;
        weight: number;
        weightUnit: string;
        pricing?: ProductCardProps["pricing"];
        inventory?: ProductCardProps["inventory"];
    }[];
}

function getDiscount(basePrice: number, pricing?: ProductCardProps["pricing"]) {
    if (!pricing) return null;
    const active = pricing.find((p) => p.isActive && p.discountValue > 0);
    if (!active) return null;
    if (active.discountType === "PERCENTAGE") return { pct: active.discountValue, finalPrice: basePrice - (basePrice * active.discountValue) / 100 };
    if (active.discountType === "FLAT") return { pct: Math.round((active.discountValue / basePrice) * 100), finalPrice: basePrice - active.discountValue };
    return null;
}

export default function ProductCard({ id, name, images, basePrice, weightUnit, inventory, pricing, badge, compact = false, variant = "default", variants = [] }: ProductCardProps) {
    const { items, addItem, updateQuantity, removeItem } = useCartStore();
    const [adding, setAdding] = useState(false);
    const [selectedVariantId, setSelectedVariantId] = useState<string | null>(variants && variants.length > 0 ? variants[0].id : null);

    const selectedVariant = variants?.find(v => v.id === selectedVariantId);

    // Use variant price if available, otherwise base price
    const currentPrice = selectedVariant ? Number(selectedVariant.price) : Number(basePrice);
    const currentPricing = selectedVariant?.pricing || pricing;
    const currentWeight = selectedVariant ? selectedVariant.name : weightUnit;

    const cartItem = items.find((i) => i.productId === id && i.variantId === (selectedVariantId || undefined));
    const qty = cartItem?.quantity ?? 0;

    const discount = getDiscount(currentPrice, currentPricing);
    const finalPrice = Number(discount?.finalPrice ?? currentPrice);

    // Combine inventory for the product or use variant-specific inventory
    const currentInventory = selectedVariant?.inventory || inventory;
    const stock = currentInventory?.reduce((acc, inv) => acc + inv.currentStock, 0) ?? 0;
    const isOutOfStock = stock === 0;

    const handleAdd = useCallback(async () => {
        if (isOutOfStock) return;
        setAdding(true);
        addItem({
            productId: id,
            variantId: selectedVariantId || undefined,
            name: selectedVariant ? `${name} (${selectedVariant.name})` : name,
            price: finalPrice,
            image: images?.[0] ?? "",
            quantity: 1,
        });
        setTimeout(() => setAdding(false), 400);
    }, [isOutOfStock, addItem, id, name, finalPrice, images, selectedVariantId, selectedVariant]);

    const handleQty = (delta: number) => {
        if (qty + delta <= 0) {
            // Remove logic handled by store usually, but we call update with 0
            updateQuantity(id, 0, selectedVariantId || undefined);
        } else {
            updateQuantity(id, qty + delta, selectedVariantId || undefined);
        }
    };

    return (
        <div className={cn(
            "relative flex flex-col overflow-hidden transition-all duration-500 hover:-translate-y-1.5 group",
            variant === "default"
                ? "bg-white rounded-[2rem] border border-black/5 shadow-xl shadow-black/5"
                : "bg-white/30 backdrop-blur-xl rounded-[2.25rem] border border-black/5",
            compact ? "w-44 flex-none" : "w-full"
        )}>
            {/* Trending Badge */}
            {badge === "trending" && (
                <div className="absolute top-2 left-2 z-20 bg-orange-500 text-white text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest shadow-lg flex items-center gap-1">
                    <Star className="h-3 w-3 fill-current" />
                    Trending
                </div>
            )}

            {/* Speed Badge */}
            {!isOutOfStock && !badge && (
                <div className="absolute top-2 left-2 z-20 bg-white/80 backdrop-blur-md text-emerald-600 text-[8px] font-black px-2 py-0.5 rounded-full border border-emerald-500/10 flex items-center gap-1 shadow-sm">
                    <span className="text-emerald-500">⚡</span>
                    <span className="tracking-tighter">10 MINS</span>
                </div>
            )}

            {/* Favorite Button */}
            <button className="absolute top-3 right-3 z-20 p-2 rounded-full bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity">
                <Star className="h-3.5 w-3.5 text-gray-400" />
            </button>

            {/* Product Image */}
            <Link href={`/products/${id}`} className="relative w-full aspect-square bg-gray-50/50 p-6 overflow-hidden block">
                <Image
                    src={images?.[0] || "https://placehold.co/200"}
                    alt={name}
                    fill
                    className={cn("object-contain p-2 transition-transform duration-700 group-hover:scale-110", isOutOfStock && "opacity-30 grayscale")}
                />
            </Link>

            {/* Content */}
            <div className="flex flex-col p-2.5 sm:p-4 gap-1.5 sm:gap-2">
                <div className="flex items-center justify-between">
                    <div className="bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-md">
                        <span className="text-[9px] sm:text-[10px] font-black text-emerald-800 uppercase tracking-tighter">{currentWeight || "1 unit"}</span>
                    </div>
                </div>

                <Link href={`/products/${id}`} className="min-h-[32px] sm:min-h-[40px]">
                    <h3 className="text-[11px] sm:text-[13px] font-black text-emerald-950 line-clamp-2 leading-tight tracking-tight hover:text-emerald-700 transition-colors">{name}</h3>
                </Link>

                {/* Variant Selector */}
                {variants && variants.length > 0 && (
                    <div className="flex flex-wrap gap-1 my-1">
                        {variants.map((v) => (
                            <button
                                key={v.id}
                                onClick={() => setSelectedVariantId(v.id)}
                                className={cn(
                                    "px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] font-black transition-all border",
                                    selectedVariantId === v.id
                                        ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                                        : "bg-white text-emerald-900 border-emerald-100 hover:border-emerald-300"
                                )}
                            >
                                {v.name}
                            </button>
                        ))}
                    </div>
                )}
                {/* Compact Preference Slider for Fruits/Veg */}
                {(name.toLowerCase().includes("potato") || name.toLowerCase().includes("banana") || name.toLowerCase().includes("tomato")) && (
                    <div className="bg-emerald-50/50 rounded-xl p-2 space-y-1.5 border border-emerald-100/30">
                        <div className="flex justify-between text-[7px] font-black text-emerald-900/40 uppercase tracking-widest">
                            <span>Raw</span>
                            <span>Ripe</span>
                        </div>
                        <input
                            type="range"
                            min="1"
                            max="5"
                            defaultValue="3"
                            className="w-full h-1 bg-emerald-200 rounded-full appearance-none cursor-pointer accent-emerald-600"
                        />
                    </div>
                )}

                <div className="flex items-center justify-between mt-auto">
                    <div className="flex flex-col">
                        <div className="flex items-baseline gap-1">
                            <span className="text-sm sm:text-xl font-black text-emerald-950 tracking-tighter tabular-nums leading-none">₹{finalPrice.toFixed(0)}</span>
                            {discount && (
                                <span className="text-[8px] sm:text-[10px] text-black/30 line-through font-black tracking-tighter">₹{currentPrice.toFixed(0)}</span>
                            )}
                        </div>
                        <span className="text-[8px] sm:text-[9px] text-black/40 font-bold tracking-widest uppercase mt-0.5">Price</span>
                    </div>

                    <div className="w-16 sm:w-20">
                        {qty === 0 ? (
                            <button
                                onClick={handleAdd}
                                disabled={isOutOfStock}
                                className={cn(
                                    "w-full h-8 sm:h-11 flex items-center justify-center rounded-lg sm:rounded-xl text-[9px] sm:text-[11px] font-black border-2 transition-all transition-duration-300 shadow-sm",
                                    isOutOfStock
                                        ? "bg-transparent text-gray-300 border-gray-100"
                                        : "bg-emerald-500 text-white border-emerald-500 hover:bg-emerald-600 hover:border-emerald-600 active:scale-95 shadow-emerald-200"
                                )}
                            >
                                <span className="uppercase tracking-widest">ADD</span>
                            </button>
                        ) : (
                            <div className="w-full h-8 sm:h-11 flex items-center justify-between bg-emerald-600 rounded-lg sm:rounded-xl overflow-hidden shadow-lg shadow-emerald-900/10">
                                <button onClick={() => handleQty(-1)} className="h-full flex-1 flex items-center justify-center text-white hover:bg-black/10 transition-colors">
                                    <Minus className="h-2.5 sm:h-3.5 w-2.5 sm:w-3.5" strokeWidth={4} />
                                </button>
                                <span className="flex-none text-[10px] sm:text-sm font-black text-white tabular-nums">{qty}</span>
                                <button onClick={() => handleQty(1)} className="h-full flex-1 flex items-center justify-center text-white hover:bg-black/10 transition-colors">
                                    <Plus className="h-2.5 sm:h-3.5 w-2.5 sm:w-3.5" strokeWidth={4} />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
