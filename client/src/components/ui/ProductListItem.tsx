"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { Plus, Minus, X, Leaf, Bell, Check, Bookmark, Share2 } from "lucide-react";
import { useCartStore } from "@/store/useCartStore";
import { useUserStore } from "@/store/useUserStore";
import { useWishlistStore } from "@/store/useWishlistStore";
import { useNotifyStore } from "@/store/useNotifyStore";
import ProductDetailsDrawer from "@/components/ui/ProductDetailsDrawer";
import { useShareStore } from "@/store/useShareStore";
import { cn } from "@/lib/utils";

export interface ProductListItemProps {
    id: string;
    name: string;
    images: string[];
    basePrice: number;
    originalPrice?: number;
    weight?: number;
    weightUnit?: string;
    minQuantity?: number;
    maxQuantity?: number;
    category?: { name: string; slug: string } | string;
    inventory?: { locationId: string; currentStock: number; thresholdStock: number }[];
    pricing?: { channel?: string; price: number; discountType: string; discountValue: number; isActive: boolean }[];
    variants?: { id: string; name: string; price: number; weight: number; weightUnit: string; inventory?: { locationId: string; currentStock: number; thresholdStock: number }[]; pricing?: any[] }[];
    tags?: string[];
    isFavourite?: boolean;
}

function getDiscount(basePrice: number, pricing?: ProductListItemProps["pricing"]) {
    if (!pricing) return null;
    const active = pricing.find((p) => p.isActive && p.discountValue > 0);
    if (!active) return null;
    if (active.discountType === "PERCENTAGE") return { pct: active.discountValue, finalPrice: basePrice - (basePrice * active.discountValue) / 100 };
    if (active.discountType === "FLAT") return { pct: Math.round((active.discountValue / basePrice) * 100), finalPrice: basePrice - active.discountValue };
    return null;
}

function getDynamicBadge(
    id: string,
    stock: number,
    isOutOfStock: boolean,
    discount: { pct: number; finalPrice: number } | null,
    tags?: string[]
) {
    if (isOutOfStock) {
        return {
            text: "Restocking soon",
            barPercent: 15,
            barColor: "bg-slate-400 dark:bg-slate-600",
            textColor: "text-slate-400"
        };
    }

    if (stock > 0 && stock <= 5) {
        return {
            text: `Only ${stock} left in stock`,
            barPercent: 35,
            barColor: "bg-amber-500",
            textColor: "text-amber-600 dark:text-amber-400 font-semibold"
        };
    }

    if (discount && discount.pct >= 20) {
        return {
            text: `Best Value • Save ${discount.pct}%`,
            barPercent: 90,
            barColor: "bg-emerald-500",
            textColor: "text-emerald-700 dark:text-[#bef264] font-semibold"
        };
    }

    if (tags && tags.length > 0 && tags[0] && tags[0].length < 25) {
        return {
            text: tags[0],
            barPercent: 75,
            barColor: "bg-emerald-500",
            textColor: "text-slate-500 dark:text-slate-400"
        };
    }

    // Deterministic dynamic variety across catalog based on product id
    const hash = id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const variantsList = [
        { text: "Highly reordered", barPercent: 80, barColor: "bg-emerald-500", textColor: "text-slate-500 dark:text-slate-400" },
        { text: "Customer Favourite ★ 4.8", barPercent: 95, barColor: "bg-emerald-500", textColor: "text-emerald-600 dark:text-emerald-400 font-medium" },
        { text: "Farm Fresh • Harvested Daily", barPercent: 70, barColor: "bg-emerald-500", textColor: "text-slate-500 dark:text-slate-400" },
        { text: "Top Pick in your area", barPercent: 85, barColor: "bg-emerald-500", textColor: "text-slate-500 dark:text-slate-400" },
    ];

    return variantsList[hash % variantsList.length];
}

export default function ProductListItem({
    id,
    name,
    images,
    basePrice,
    weight,
    weightUnit,
    minQuantity = 1,
    maxQuantity = 10,
    category,
    inventory,
    pricing,
    variants,
    tags,
    isFavourite,
}: ProductListItemProps) {
    const { items, addItem, updateQuantity } = useCartStore();
    const { activeStore } = useUserStore();
    const toggleWishlist = useWishlistStore((state) => state.toggleWishlist);
    const inWishlist = useWishlistStore((state) => state.items.some((i) => i.productId === id));
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [mounted, setMounted] = useState(false);
    const openShare = useShareStore((state) => state.openShare);
    const isNotified = useNotifyStore((state) => !!state.notifiedProducts[id]);
    const addNotification = useNotifyStore((state) => state.addNotification);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Manage active variant state
    const [activeVariantIndex, setActiveVariantIndex] = useState(0);
    const hasVariants = variants && variants.length > 0;
    const hasMultipleVariants = variants && variants.length > 1;
    const currentVariant = hasVariants ? variants[activeVariantIndex] : null;

    // WEB channel pricing precedence
    const activePricing = pricing?.find((pr: any) => pr.isActive && (pr.channel === "WEB" || !pr.channel))?.price
        ?? pricing?.find((pr: any) => pr.isActive)?.price;
    const variantPricing = (currentVariant as any)?.pricing?.find((pr: any) => pr.isActive && (pr.channel === "WEB" || !pr.channel))?.price
        ?? (currentVariant as any)?.pricing?.find((pr: any) => pr.isActive)?.price;

    const currentPrice = Number(
        variantPricing ??
        activePricing ??
        (currentVariant ? Number(currentVariant.price) : Number(basePrice))
    );
    const currentWeight = currentVariant 
        ? `${currentVariant.weight} ${currentVariant.weightUnit}` 
        : (weight ? `${weight} ${weightUnit || ''}` : weightUnit);

    // Cart items for this product
    const cartItemsForProduct = items.filter((i) => i.productId === id);
    const totalProductQty = cartItemsForProduct.reduce((acc, i) => acc + (Number(i.quantity) || 0), 0);

    const activeCartItem = cartItemsForProduct.find((i) => {
        const itemVarId = i.variantId || undefined;
        const curVarId = currentVariant?.id || undefined;
        if (curVarId && itemVarId) return curVarId === itemVarId;
        if (!hasMultipleVariants) return true;
        return curVarId === itemVarId;
    }) ?? (!hasMultipleVariants ? cartItemsForProduct[0] : undefined);

    const activeQty = hasMultipleVariants 
        ? totalProductQty 
        : (activeCartItem?.quantity ?? 0);

    const discount = getDiscount(currentPrice, pricing);
    const finalPrice = Number(discount?.finalPrice ?? currentPrice);

    // Stock inventory check
    const allInventory = [...(inventory ?? [])];
    if (variants) {
        variants.forEach((v: any) => {
            if (v.inventory) allInventory.push(...v.inventory);
        });
    }

    const relevantInventory = activeStore?.id 
        ? allInventory.filter(inv => inv.locationId === activeStore.id)
        : [];
    const stock = relevantInventory.reduce((acc, inv) => acc + Number(inv.currentStock), 0);
    const isOutOfStock = stock === 0;

    const categoryLabel = typeof category === "string" ? category : category?.name;

    const handleAdd = useCallback((e: React.MouseEvent, variantId?: string, variantName?: string, variantPrice?: number, variantInventory?: any[]) => {
        e.stopPropagation();
        e.preventDefault();

        // Resolve target variant
        const targetVariantId = variantId || currentVariant?.id || undefined;
        const targetVariant = variants?.find(v => v.id === targetVariantId) || currentVariant;

        const vInv = activeStore?.id 
            ? (variantInventory?.filter(vi => vi.locationId === activeStore.id) ?? targetVariant?.inventory?.filter((vi: any) => vi.locationId === activeStore.id) ?? [])
            : (variantInventory ?? targetVariant?.inventory ?? []);
        const vStock = targetVariantId 
            ? (vInv.reduce((acc: number, vi: any) => acc + Number(vi.currentStock), 0))
            : stock;

        if (vStock === 0 && stock === 0) return;

        const targetPrice = variantPrice ?? (targetVariant ? Number(targetVariant.price) : finalPrice);
        const targetName = variantName 
            ? `${name} (${variantName})` 
            : (targetVariant 
                ? `${name} (${targetVariant.weight} ${targetVariant.weightUnit || ''})`
                : (weight ? `${name} (${weight} ${weightUnit || ''})` : name));

        const initialQty = minQuantity || 1;

        addItem({
            productId: id,
            variantId: targetVariantId,
            name: targetName,
            price: targetPrice,
            image: images?.[0] ?? "",
            quantity: initialQty,
        });

        import("sonner").then(({ toast }) => {
            toast.success(`${targetName} added`, {
                description: "Fresh item added to your bag",
                duration: 2000
            });
        });

        setDrawerOpen(false);
    }, [isOutOfStock, addItem, id, name, finalPrice, images, activeStore, stock, weight, weightUnit, minQuantity, variants, currentVariant]);

    const handleQty = (e: React.MouseEvent, delta: number) => {
        e.stopPropagation();
        e.preventDefault();

        if (hasMultipleVariants) {
            setDrawerOpen(true);
            return;
        }

        const minQ = minQuantity || 1;
        const maxQ = maxQuantity || 10;
        const next = activeQty + delta;
        if (delta > 0 && next > maxQ) {
            import("sonner").then(({ toast }) => {
                toast.error(`Maximum purchase limit is ${maxQ}`);
            });
            return;
        }

        const targetVarId = activeCartItem?.variantId || currentVariant?.id || undefined;

        if (delta < 0 && next < minQ) {
            updateQuantity(id, 0, targetVarId);
            return;
        }
        updateQuantity(id, Math.max(0, next), targetVarId);
    };

    const handleNotify = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        addNotification({
            id,
            name,
            image: images?.[0],
            price: finalPrice,
        });
        import("sonner").then(({ toast }) => {
            toast.success(`We'll notify you when ${name} is back in stock!`, {
                description: "Saved to your browser alerts",
                duration: 2500,
            });
        });
    };

    const handleShare = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        openShare({
            id,
            name,
            image: images?.[0],
            price: finalPrice,
        });
    };

    // Variant Selection Drawer / Modal
    const drawer = (hasMultipleVariants && drawerOpen) ? (
        <>
            <div
                onClick={() => setDrawerOpen(false)}
                className="fixed inset-0 bg-black/70 z-[200] transition-opacity duration-300 backdrop-blur-xs"
            />
            <div
                className="fixed bottom-0 left-0 right-0 z-[210] bg-[#121815] text-white rounded-t-[2rem] shadow-2xl flex flex-col items-center max-h-[75vh] w-full border-t border-white/10 pb-8"
            >
                <div className="w-full flex justify-center pt-3 pb-2">
                    <div className="w-12 h-1.5 bg-white/20 rounded-full" />
                </div>

                <div className="w-full flex items-center justify-between px-6 py-4 border-b border-white/10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center border border-emerald-500/20">
                            <Leaf className="h-5 w-5 text-[#bef264]" />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-white uppercase tracking-tight leading-none">
                                {name}
                            </h2>
                            <p className="text-[10px] font-bold text-[#bef264] uppercase tracking-widest mt-1">
                                Choose pack size
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => setDrawerOpen(false)}
                        className="p-2 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="w-full overflow-y-auto px-6 py-4 space-y-3">
                    {variants.map((v, i) => {
                        const vActivePricing = (v as any)?.pricing?.find((pr: any) => pr.isActive && (pr.channel === "WEB" || !pr.channel))?.price
                            ?? (v as any)?.pricing?.find((pr: any) => pr.isActive)?.price;
                        const vPrice = Number(vActivePricing ?? v.price);
                        const vCartItem = items.find((it) => it.productId === id && it.variantId === v.id);
                        const vQty = vCartItem?.quantity ?? 0;

                        const vInv = activeStore?.id 
                            ? (v.inventory?.filter(vi => vi.locationId === activeStore.id) ?? [])
                            : (v.inventory ?? []);
                        const vStock = vInv.reduce((acc, vi) => acc + Number(vi.currentStock), 0);
                        const vOutOfStock = vStock === 0 && stock === 0;

                        return (
                            <div
                                key={v.id || i}
                                className={cn(
                                    "flex items-center justify-between p-3.5 rounded-2xl border transition-all",
                                    activeVariantIndex === i
                                        ? "border-emerald-500/50 bg-[#0c241e]"
                                        : "border-white/5 bg-white/5"
                                )}
                            >
                                <div className="space-y-0.5">
                                    <div className="flex items-center gap-2">
                                        <span className="font-black text-sm text-white">
                                            {v.weight} {v.weightUnit}
                                        </span>
                                        {v.name && v.name !== "Standard" && (
                                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/10 text-slate-300">
                                                {v.name}
                                            </span>
                                        )}
                                    </div>
                                    <span className="text-sm font-black text-[#bef264]">
                                        ₹{vPrice}
                                    </span>
                                </div>

                                <div>
                                    {vOutOfStock ? (
                                        <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider px-2 py-1 bg-rose-950/40 border border-rose-500/30 rounded-lg">
                                            Sold Out
                                        </span>
                                    ) : vQty > 0 ? (
                                        <div className="flex items-center gap-2 bg-[#0b5c3e] text-white px-2.5 py-1 rounded-xl shadow-xs border border-emerald-400">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    updateQuantity(id, vQty - 1, v.id);
                                                }}
                                                className="p-1 hover:opacity-80 active:scale-90"
                                            >
                                                <Minus className="w-3 h-3 stroke-[3]" />
                                            </button>
                                            <span className="text-xs font-black min-w-[16px] text-center">{vQty}</span>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    updateQuantity(id, vQty + 1, v.id);
                                                }}
                                                className="p-1 hover:opacity-80 active:scale-90"
                                            >
                                                <Plus className="w-3 h-3 stroke-[3]" />
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={(e) => {
                                                setActiveVariantIndex(i);
                                                handleAdd(e, v.id, `${v.weight} ${v.weightUnit}`, vPrice, v.inventory);
                                            }}
                                            className="px-4 py-1.5 bg-[#0b5c3e] hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-xs active:scale-95 transition-all"
                                        >
                                            Add
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </>
    ) : null;

    const isNonVeg = /egg|chicken|mutton|fish|meat|prawn|pork/i.test(name) || /non-?veg/i.test(name) || (Array.isArray(tags) && tags.some(t => /non-?veg|egg|chicken/i.test(t)));
    const dynamicBadge = getDynamicBadge(id, stock, isOutOfStock, discount, tags);

    return (
        <>
            <div className="group relative w-full border-b border-dashed border-slate-200 dark:border-white/10 pb-5 mb-5 flex items-start justify-between gap-4">
                
                {/* 1. LEFT SIDE: DETAILS (Zomato Style) */}
                <div className="flex-1 min-w-0 flex flex-col justify-between self-stretch pr-1">
                    <div className="space-y-1.5">
                        {/* Veg / Non-Veg Indicator + Category Tag */}
                        <div className="flex items-center gap-1.5">
                            {isNonVeg ? (
                                /* Non-Veg / Egg Mark (Brown border with brown triangle) */
                                <div className="w-4 h-4 border border-amber-800 dark:border-amber-600 flex items-center justify-center rounded-[3px] bg-white dark:bg-[#1a120e] p-[2px] shrink-0 shadow-2xs">
                                    <div className="w-0 h-0 border-l-[3.5px] border-l-transparent border-r-[3.5px] border-r-transparent border-b-[6px] border-b-amber-800 dark:border-b-amber-600" />
                                </div>
                            ) : (
                                /* Pure Veg Mark (Square box with filled green dot) */
                                <div className="w-4 h-4 border border-emerald-600 dark:border-emerald-500 flex items-center justify-center rounded-[3px] bg-white dark:bg-[#0a1813] p-[2px] shrink-0 shadow-2xs">
                                    <div className="w-2 h-2 rounded-full bg-emerald-600 dark:bg-emerald-500" />
                                </div>
                            )}

                            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider truncate">
                                {categoryLabel || (isNonVeg ? "Eggs & Protein" : "Pure Veg")}
                            </span>
                        </div>

                        {/* Product Title - Opens Product Details Drawer */}
                        <div onClick={() => setDetailsOpen(true)} className="block group/link cursor-pointer">
                            <h3 className="font-bold text-slate-900 dark:text-white text-base sm:text-lg tracking-tight leading-snug line-clamp-2 group-hover/link:text-emerald-600 dark:group-hover/link:text-[#bef264] transition-colors">
                                {name}
                            </h3>
                        </div>

                        {/* Dynamic Social Proof Progress Capsule */}
                        <div className="flex items-center gap-1.5 pt-0.5">
                            <div className="w-10 h-1.5 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden flex">
                                <div 
                                    className={cn("h-full rounded-full transition-all duration-500", dynamicBadge.barColor)} 
                                    style={{ width: `${dynamicBadge.barPercent}%` }} 
                                />
                            </div>
                            <span className={cn("text-[11px]", dynamicBadge.textColor)}>
                                {dynamicBadge.text}
                            </span>
                        </div>

                        {/* Price */}
                        <div className="flex items-baseline gap-2 pt-1">
                            <span className="text-base sm:text-lg font-black text-slate-900 dark:text-white tabular-nums tracking-tight">
                                ₹{finalPrice}
                            </span>

                            {discount && (
                                <>
                                    <span className="text-xs font-semibold text-slate-400 line-through tabular-nums">
                                        ₹{currentPrice}
                                    </span>
                                    <span className="text-[10px] font-black text-emerald-700 dark:text-[#bef264] bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded">
                                        {discount.pct}% OFF
                                    </span>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Bottom Left Action Icons: Bookmark + Share (Exact Zomato match) */}
                    <div className="flex items-center gap-2 pt-3">
                        {/* Bookmark / Wishlist */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                toggleWishlist({
                                    productId: id,
                                    name,
                                    price: finalPrice,
                                    image: images?.[0] ?? ""
                                });
                            }}
                            aria-label="Save to Wishlist"
                            className={cn(
                                "w-8 h-8 rounded-full border flex items-center justify-center transition-all active:scale-90",
                                inWishlist
                                    ? "bg-rose-50 border-rose-300 text-rose-500 dark:bg-rose-950/40 dark:border-rose-500/40"
                                    : "bg-slate-50 dark:bg-[#1a221f] border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-300 hover:text-emerald-500"
                            )}
                        >
                            <Bookmark className={cn("w-3.5 h-3.5", inWishlist && "fill-current text-rose-500")} />
                        </button>

                        {/* Share Button */}
                        <button
                            onClick={handleShare}
                            aria-label="Share Product"
                            className="w-8 h-8 rounded-full bg-slate-50 dark:bg-[#1a221f] border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-500 dark:text-slate-300 hover:text-emerald-500 transition-all active:scale-90"
                        >
                            <Share2 className="w-3.5 h-3.5" />
                        </button>

                        {/* Weight Indicator if present */}
                        {currentWeight && (
                            <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 ml-1">
                                • {currentWeight}
                            </span>
                        )}
                    </div>
                </div>

                {/* 2. RIGHT SIDE: IMAGE WITH OVERLAPPING ADD BUTTON (Zomato Style) */}
                <div className="relative shrink-0 flex flex-col items-center">
                    {/* Food / Produce Image Card - Opens Product Details Drawer */}
                    <div className="relative w-32 h-32 sm:w-36 sm:h-36 rounded-2xl overflow-hidden select-none bg-slate-100 dark:bg-[#151f1a] border border-slate-100 dark:border-white/5 shadow-sm">
                        <div onClick={() => setDetailsOpen(true)} className="w-full h-full relative block cursor-pointer">
                            {images?.[0] ? (
                                <Image
                                    src={images[0]}
                                    alt={name}
                                    fill
                                    unoptimized
                                    className={cn(
                                        "object-cover transition-transform duration-500 group-hover:scale-105",
                                        isOutOfStock && "opacity-35 grayscale"
                                    )}
                                    sizes="(max-width: 768px) 128px, 144px"
                                />
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center text-emerald-800/40 dark:text-emerald-400/40">
                                    <Leaf className="w-8 h-8 stroke-[1.5]" />
                                    <span className="text-[9px] font-bold mt-1 text-slate-400">Fresh</span>
                                </div>
                            )}
                        </div>

                        {/* Out of Stock Scrim */}
                        {isOutOfStock && (
                            <div className="absolute inset-0 bg-black/50 backdrop-blur-[1px] flex items-center justify-center pointer-events-none z-10">
                                <span className="text-[9px] font-black text-white px-2 py-0.5 rounded-md uppercase tracking-wider bg-black/70">
                                    OUT OF STOCK
                                </span>
                            </div>
                        )}
                    </div>

                    {/* ADD Button Container (Overlaps bottom of the image) */}
                    <div className="relative -mt-4 z-20 flex flex-col items-center">
                        {isOutOfStock ? (
                            <button
                                onClick={handleNotify}
                                disabled={isNotified}
                                className={cn(
                                    "h-8 px-3.5 rounded-xl font-black text-[10px] uppercase tracking-wider shadow-lg active:scale-95 transition-all flex items-center gap-1 border",
                                    isNotified
                                        ? "bg-emerald-700/80 text-white border-emerald-600/60 cursor-default"
                                        : "bg-[#14261e] text-[#bef264] border-emerald-500/40 hover:border-emerald-400 cursor-pointer"
                                )}
                            >
                                {isNotified ? (
                                    <>
                                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                                        <span>Notified</span>
                                    </>
                                ) : (
                                    <>
                                        <Bell className="w-3.5 h-3.5 text-amber-400" />
                                        <span>Notify Me</span>
                                    </>
                                )}
                            </button>
                        ) : activeQty > 0 ? (
                            /* Stepper Quantity Capsule - Smooth Morph & Pulse */
                            <div className="w-[100px] sm:w-[110px] h-8 rounded-xl bg-gradient-to-b from-[#0f6b47] to-[#0a4d34] text-white flex items-center justify-between px-1.5 font-black shadow-[0_4px_14px_rgba(11,92,62,0.4)] border border-emerald-400/80 select-none animate-in fade-in zoom-in-95 duration-200 ease-out">
                                <button
                                    type="button"
                                    onClick={(e) => handleQty(e, -1)}
                                    aria-label="Decrease quantity"
                                    className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-white/15 active:scale-75 active:bg-white/25 transition-all duration-150 cursor-pointer"
                                >
                                    <Minus className="w-3.5 h-3.5 stroke-[3]" />
                                </button>
                                <span
                                    key={activeQty}
                                    className="inline-block text-xs font-black min-w-[20px] text-center select-none tabular-nums animate-in fade-in zoom-in-75 duration-150"
                                >
                                    {activeQty}
                                </span>
                                <button
                                    type="button"
                                    onClick={(e) => handleQty(e, 1)}
                                    aria-label="Increase quantity"
                                    className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-white/15 active:scale-75 active:bg-white/25 transition-all duration-150 cursor-pointer"
                                >
                                    <Plus className="w-3.5 h-3.5 stroke-[3]" />
                                </button>
                            </div>
                        ) : (
                            /* Zomato-Style ADD Button: dark capsule with ADD + */
                            <button
                                type="button"
                                onClick={(e) => {
                                    if (hasMultipleVariants) {
                                        setDrawerOpen(true);
                                    } else {
                                        handleAdd(e);
                                    }
                                }}
                                className="w-[100px] sm:w-[110px] h-8 rounded-xl font-black text-xs uppercase tracking-wider bg-[#10241b] dark:bg-[#0d1e16] text-[#bef264] hover:text-white border border-emerald-500/40 hover:border-emerald-400 shadow-xl flex items-center justify-center gap-1 active:scale-95 hover:scale-[1.02] transition-all duration-200 group/btn animate-in fade-in zoom-in-95 cursor-pointer"
                            >
                                <span>ADD</span>
                                <span className="text-sm font-bold opacity-80 group-hover/btn:translate-x-0.5 transition-transform">+</span>
                            </button>
                        )}

                        {/* "customisable" Subtext below button */}
                        {hasMultipleVariants && (
                            <span className="text-[10px] text-slate-400 dark:text-slate-400 font-medium tracking-wide mt-1 text-center">
                                customisable
                            </span>
                        )}
                    </div>
                </div>

            </div>

            {/* Portal Drawer for Variants */}
            {mounted && drawer && createPortal(drawer, document.body)}

            {/* Product Details Drawer: photo on top, details below without navigating away */}
            <ProductDetailsDrawer
                isOpen={detailsOpen}
                onClose={() => setDetailsOpen(false)}
                product={{
                    id,
                    name,
                    images,
                    basePrice,
                    weight,
                    weightUnit,
                    minQuantity,
                    maxQuantity,
                    category,
                    inventory,
                    pricing,
                    variants,
                    tags,
                }}
            />
        </>
    );
}
