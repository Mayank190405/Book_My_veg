"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useCallback, useEffect } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { Plus, Minus, X, Heart, Leaf, Bell, Check, Clock } from "lucide-react";
import { useCartStore } from "@/store/useCartStore";
import { useUserStore } from "@/store/useUserStore";
import { useWishlistStore } from "@/store/useWishlistStore";
import { useNotifyStore } from "@/store/useNotifyStore";
import { cn } from "@/lib/utils";

export interface ProductCardProps {
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
    variants?: { id: string; name: string; price: number; weight: number; weightUnit: string; inventory?: { locationId: string; currentStock: number; thresholdStock: number }[] }[];
    badge?: "trending" | "flash" | null;
    compact?: boolean;
    tags?: string[];
}

function getDiscount(basePrice: number, pricing?: ProductCardProps["pricing"]) {
    if (!pricing) return null;
    const active = pricing.find((p) => p.isActive && p.discountValue > 0);
    if (!active) return null;
    if (active.discountType === "PERCENTAGE") return { pct: active.discountValue, finalPrice: basePrice - (basePrice * active.discountValue) / 100 };
    if (active.discountType === "FLAT") return { pct: Math.round((active.discountValue / basePrice) * 100), finalPrice: basePrice - active.discountValue };
    return null;
}

export default function ProductCard({
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
    compact = false,
}: ProductCardProps) {
    const { items, addItem, updateQuantity } = useCartStore();
    const { activeStore } = useUserStore();
    const toggleWishlist = useWishlistStore((state) => state.toggleWishlist);
    const inWishlist = useWishlistStore((state) => state.items.some((i) => i.productId === id));
    const [adding, setAdding] = useState(false);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [mounted, setMounted] = useState(false);
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
        : (weight ? `${weight} ${weightUnit || 'g'}` : (weightUnit || '500 g'));

    // Cart items for this product
    const cartItemsForProduct = items.filter((i) => i.productId === id);
    const totalProductQty = cartItemsForProduct.reduce((acc, i) => acc + (Number(i.quantity) || 0), 0);

    const activeCartItem = cartItemsForProduct.find((i) => {
        const itemVarId = i.variantId || undefined;
        const curVarId = currentVariant?.id || undefined;
        if (curVarId && itemVarId) return curVarId === itemVarId;
        if (!hasMultipleVariants) return true;
        return curVarId === itemVarId;
    });

    const activeQty = activeCartItem ? Number(activeCartItem.quantity) : (hasMultipleVariants ? totalProductQty : 0);

    const discount = getDiscount(currentPrice, pricing);
    const finalPrice = Number(discount?.finalPrice ?? currentPrice);

    // Inventory check
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

    const handleAdd = useCallback((e: React.MouseEvent, variantId?: string, variantName?: string, variantPrice?: number, variantInventory?: any[]) => {
        e.stopPropagation();

        const targetVariantId = variantId || currentVariant?.id || undefined;
        const targetVariantName = variantName || currentVariant?.name || undefined;
        const targetPrice = variantPrice !== undefined ? variantPrice : finalPrice;
        const targetInventory = variantInventory || currentVariant?.inventory || inventory;

        const effectiveMinQ = Math.max(1, minQuantity || 1);

        setAdding(true);
        addItem({
            productId: id,
            name,
            price: targetPrice,
            image: images?.[0],
            quantity: effectiveMinQ,
            variantId: targetVariantId,
            variantName: targetVariantName,
            weight: currentVariant?.weight ?? weight,
            weightUnit: currentVariant?.weightUnit ?? weightUnit,
            inventory: targetInventory,
        });

        setTimeout(() => setAdding(false), 300);
    }, [id, name, finalPrice, images, currentVariant, minQuantity, weight, weightUnit, inventory, addItem]);

    const handleQty = (e: React.MouseEvent, delta: number) => {
        e.stopPropagation();
        const minQ = Math.max(1, minQuantity || 1);
        const maxQ = Math.max(minQ, maxQuantity || 10);
        const next = activeQty + delta;
        const targetVarId = currentVariant?.id || activeCartItem?.variantId;

        if (delta > 0 && next > maxQ) return;
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
                duration: 2500,
            });
        });
    };

    const drawer = hasMultipleVariants ? (
        <DialogPrimitive.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
            <DialogPrimitive.Portal>
                <DialogPrimitive.Overlay className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-xs" />
                <DialogPrimitive.Content className="fixed bottom-0 left-1/2 z-[210] max-h-[80dvh] w-full max-w-lg -translate-x-1/2 overflow-y-auto rounded-t-3xl bg-white p-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] text-[#17251e] shadow-xl sm:bottom-8 sm:rounded-2xl">
                    <div className="mb-5 flex items-start justify-between gap-4">
                        <div>
                            <DialogPrimitive.Title className="text-lg font-bold text-slate-900">{name}</DialogPrimitive.Title>
                            <DialogPrimitive.Description className="mt-0.5 text-xs text-slate-500">Choose a pack size</DialogPrimitive.Description>
                        </div>
                        <DialogPrimitive.Close aria-label="Close pack sizes" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 transition-colors">
                            <X className="h-4 w-4" />
                        </DialogPrimitive.Close>
                    </div>
                    <div className="space-y-2.5">
                        {variants.map((variant, index) => {
                            const variantInventory = activeStore?.id ? variant.inventory?.filter(row => row.locationId === activeStore.id) ?? [] : variant.inventory ?? [];
                            const baseInventory = activeStore?.id ? inventory?.filter(row => row.locationId === activeStore.id) ?? [] : inventory ?? [];
                            const unavailable = variantInventory.reduce((sum, row) => sum + Number(row.currentStock), 0) === 0 && baseInventory.reduce((sum, row) => sum + Number(row.currentStock), 0) === 0;
                            return (
                                <button
                                    key={variant.id}
                                    type="button"
                                    disabled={unavailable || adding}
                                    onClick={(event) => {
                                        setActiveVariantIndex(index);
                                        handleAdd(event, variant.id, variant.name, Number(variant.price), variant.inventory);
                                    }}
                                    className="flex min-h-14 w-full items-center justify-between gap-4 rounded-xl border border-slate-200 p-3.5 text-left hover:border-emerald-600 hover:bg-emerald-50/20 transition-all disabled:opacity-40"
                                >
                                    <div>
                                        <p className="text-sm font-bold text-slate-900">{variant.name}</p>
                                        <p className="mt-0.5 text-xs text-slate-500">{variant.weight} {variant.weightUnit}{unavailable ? " · Out of stock" : ""}</p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="font-black text-sm text-slate-900">₹{variant.price}</span>
                                        <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-600 bg-emerald-50 text-emerald-700 font-bold text-xs">
                                            <Plus className="h-4 w-4" />
                                        </span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
    ) : null;

    return (
        <>
            {/* 3x3 Grid Compatible Card matching user reference layout */}
            <article className="bmv-product-card group relative flex h-full min-w-0 flex-col rounded-2xl border border-slate-200/80 bg-white p-2 sm:p-2.5 transition-all duration-200 hover:shadow-sm hover:border-slate-300">
                {/* Product Image Area with Veg icon & Wishlist */}
                <div className="relative mb-1.5 aspect-square w-full overflow-hidden rounded-xl bg-slate-50 flex items-center justify-center p-1 sm:p-2">
                    <Link href={`/products/${id}`} aria-label={`View ${name}`} className="absolute inset-0 flex items-center justify-center">
                        {images?.[0] ? (
                            <Image
                                src={images[0]}
                                alt={name}
                                fill
                                sizes="(max-width: 600px) 33vw, (max-width: 1024px) 25vw, 200px"
                                className={cn("object-contain p-1 sm:p-2 transition-transform duration-300 group-hover:scale-105", isOutOfStock && "opacity-40 grayscale")}
                            />
                        ) : (
                            <Leaf className="h-7 w-7 text-emerald-300" />
                        )}
                    </Link>

                    {/* Veg Square Badge */}
                    <div className="pointer-events-none absolute right-1 bottom-1 flex h-3 w-3 items-center justify-center rounded-xs border border-[#0f8a3c] bg-white shadow-2xs">
                        <div className="h-1 w-1 rounded-full bg-[#0f8a3c]" />
                    </div>

                    {/* Discount badge */}
                    {discount && (
                        <span className="pointer-events-none absolute left-1 top-1 rounded bg-[#2563eb] px-1 py-0.5 text-[8px] sm:text-[9px] font-black uppercase text-white shadow-xs">
                            {discount.pct}% OFF
                        </span>
                    )}

                    {/* Wishlist Button */}
                    <button
                        type="button"
                        aria-label="Wishlist"
                        onClick={() => toggleWishlist({ productId: id, name, price: finalPrice, image: images?.[0] ?? "" })}
                        className="absolute right-1.5 top-1.5 flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-full bg-white/95 text-slate-400 hover:text-rose-500 shadow-2xs border border-slate-100/80 transition-colors"
                    >
                        <Heart className={cn("h-3 w-3 sm:h-3.5 sm:w-3.5", inWishlist && "fill-rose-500 text-rose-500")} />
                    </button>
                </div>

                {/* Product Title (2-line clamp) */}
                <Link
                    href={`/products/${id}`}
                    className="line-clamp-2 text-[11px] sm:text-xs font-bold leading-tight text-slate-900 hover:text-emerald-700 transition-colors min-h-[26px] sm:min-h-[28px]"
                >
                    {name}
                </Link>

                {/* Weight */}
                <span className="text-[10px] sm:text-[11px] font-semibold text-slate-400 truncate mt-0.5 block uppercase">
                    {currentWeight}
                </span>

                {/* Bottom Row: Price on Left + Action Button on Right */}
                <div className="mt-auto pt-1.5 flex items-center justify-between gap-1">
                    <div className="flex flex-col min-w-0">
                        <div className="flex items-baseline gap-1">
                            <span className="text-xs sm:text-sm font-black tabular-nums text-slate-950">
                                ₹{finalPrice.toFixed(0)}
                            </span>
                            {discount && (
                                <span className="text-[9px] sm:text-[10px] font-semibold text-slate-400 line-through">
                                    ₹{currentPrice.toFixed(0)}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* ADD / Stepper / Notify Button matching user reference */}
                    {activeQty === 0 ? (
                        isOutOfStock ? (
                            <button
                                type="button"
                                onClick={handleNotify}
                                disabled={isNotified}
                                className={cn(
                                    "flex h-6 sm:h-7 items-center gap-1 rounded-lg px-1.5 sm:px-2 text-[9px] sm:text-[10px] font-bold whitespace-nowrap transition-all shadow-2xs active:scale-95",
                                    isNotified
                                        ? "border border-emerald-200 bg-emerald-50/70 text-emerald-700"
                                        : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                )}
                            >
                                {isNotified ? (
                                    <>
                                        <Check className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-emerald-600 stroke-[3]" />
                                        <span>Saved alert</span>
                                    </>
                                ) : (
                                    <>
                                        <Bell className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-slate-500" />
                                        <span>Notify me</span>
                                    </>
                                )}
                            </button>
                        ) : (
                            <button
                                type="button"
                                disabled={adding}
                                onClick={(e) => {
                                    if (hasMultipleVariants) setDrawerOpen(true);
                                    else if (variants?.length === 1) {
                                        const v = variants[0];
                                        handleAdd(e, v.id, v.name, Number(v.price), v.inventory);
                                    } else handleAdd(e);
                                }}
                                className="flex h-6 sm:h-7 min-w-[46px] sm:min-w-[56px] items-center justify-center rounded-lg border border-[#3da872]/60 bg-[#e8f7ef] hover:bg-[#d5f3e2] hover:border-[#017649] px-2.5 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-[#017649] transition-all duration-200 active:scale-95 shadow-2xs"
                            >
                                <span>ADD</span>
                            </button>
                        )
                    ) : (
                        <div className="flex items-center rounded-lg bg-[#017649] text-white shadow-xs overflow-hidden h-6 sm:h-7">
                            <button
                                type="button"
                                aria-label="Decrease quantity"
                                onClick={(e) => handleQty(e, -1)}
                                className="flex h-full w-5 sm:w-6 items-center justify-center hover:bg-[#015f3b] active:scale-95 transition-colors"
                            >
                                <Minus className="h-2.5 w-2.5 stroke-[3]" />
                            </button>
                            <span className="min-w-3 text-center text-[10px] sm:text-xs font-black tabular-nums">
                                {activeQty}
                            </span>
                            <button
                                type="button"
                                aria-label="Increase quantity"
                                onClick={(e) => handleQty(e, 1)}
                                className="flex h-full w-5 sm:w-6 items-center justify-center hover:bg-[#015f3b] active:scale-95 transition-colors"
                            >
                                <Plus className="h-2.5 w-2.5 stroke-[3]" />
                            </button>
                        </div>
                    )}
                </div>
            </article>

            {mounted && drawer}
        </>
    );
}
