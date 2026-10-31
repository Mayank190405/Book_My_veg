"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useCallback, useEffect } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { Plus, Minus, X, Heart, Leaf, Bell, Check } from "lucide-react";
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
    if (active.discountType === "FLAT") return { pct: Math.round((active.discountValue / basePrice) * 100), finalPrice: basePrice - activePricingValue(active) };
    return null;
}

function activePricingValue(active: any) {
    return active.discountValue;
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

    useEffect(() => {
        setMounted(true);
    }, []);

    // Manage active variant state
    const [activeVariantIndex, setActiveVariantIndex] = useState(0);
    const hasVariants = variants && variants.length > 0;
    const hasMultipleVariants = variants && variants.length > 1;
    const currentVariant = hasVariants ? variants[activeVariantIndex] : null;

    // WEB channel takes precedence for client e-commerce
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

    // Unified Inventory aggregation across product and variants
    const allInventory = [...(inventory ?? [])];
    if (variants) {
        variants.forEach((v: any) => {
            if (v.inventory) allInventory.push(...v.inventory);
        });
    }

    const relevantInventory = activeStore?.id
        ? allInventory.filter(inv => inv.locationId === activeStore.id)
        : []; // No active store = no stock shown; prevents global inventory bleed

    const stock = relevantInventory.reduce((acc, inv) => acc + Number(inv.currentStock), 0);
    const isOutOfStock = stock === 0;

    const categoryLabel = typeof category === "string" ? category : category?.name;

    const handleAdd = useCallback((e: React.MouseEvent, variantId?: string, variantName?: string, variantPrice?: number, variantInventory?: any[]) => {
        e.stopPropagation();

        // Resolve target variant
        const targetVariantId = variantId || currentVariant?.id || undefined;
        const targetVariant = variants?.find(v => v.id === targetVariantId) || currentVariant;

        // Local stock check for the specific call
        const vInv = activeStore?.id
            ? (variantInventory?.filter(vi => vi.locationId === activeStore.id) ?? targetVariant?.inventory?.filter((vi: any) => vi.locationId === activeStore.id) ?? [])
            : (variantInventory ?? targetVariant?.inventory ?? []);
        const vStock = targetVariantId
            ? (vInv.reduce((acc: number, vi: any) => acc + Number(vi.currentStock), 0))
            : stock;

        // If specific variant stock is 0, but total product stock is available, we allow it
        if (vStock === 0 && stock === 0) return;
        setAdding(true);

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

        // Show success feedback
        import("sonner").then(({ toast }) => {
            toast.success(`${targetName} added to cart`, {
                description: "Freshly added to your selection",
                duration: 2000
            });
        });

        setDrawerOpen(false);
        setTimeout(() => setAdding(false), 400);
    }, [addItem, id, name, finalPrice, images, activeStore, stock, weight, weightUnit, minQuantity, variants, currentVariant]);

    const handleQty = (e: React.MouseEvent, delta: number) => {
        e.stopPropagation();

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

    const drawer = hasMultipleVariants ? (
        <DialogPrimitive.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
            <DialogPrimitive.Portal>
                <DialogPrimitive.Overlay className="fixed inset-0 z-[200] bg-black/40" />
                <DialogPrimitive.Content className="fixed bottom-0 left-1/2 z-[210] max-h-[80dvh] w-full max-w-lg -translate-x-1/2 overflow-y-auto rounded-t-3xl bg-white p-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] text-[#17251e] shadow-xl sm:bottom-8 sm:rounded-2xl">
                    <div className="mb-5 flex items-start justify-between gap-4"><div><DialogPrimitive.Title className="text-lg font-semibold">{name}</DialogPrimitive.Title><DialogPrimitive.Description className="mt-1 text-sm text-[#64736b]">Choose a pack size</DialogPrimitive.Description></div><DialogPrimitive.Close aria-label="Close pack sizes" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#f4f7f5]"><X className="h-5 w-5" /></DialogPrimitive.Close></div>
                    <div className="space-y-3">{variants.map((variant, index) => {
                        const variantInventory = activeStore?.id ? variant.inventory?.filter(row => row.locationId === activeStore.id) ?? [] : variant.inventory ?? [];
                        const baseInventory = activeStore?.id ? inventory?.filter(row => row.locationId === activeStore.id) ?? [] : inventory ?? [];
                        const unavailable = variantInventory.reduce((sum, row) => sum + Number(row.currentStock), 0) === 0 && baseInventory.reduce((sum, row) => sum + Number(row.currentStock), 0) === 0;
                        return <button key={variant.id} type="button" disabled={unavailable || adding} onClick={(event) => { setActiveVariantIndex(index); handleAdd(event, variant.id, variant.name, Number(variant.price), variant.inventory); }} className="flex min-h-16 w-full items-center justify-between gap-4 rounded-xl border border-[#e5ebe7] p-4 text-left hover:border-[#087f5b] disabled:opacity-50"><div><p className="text-sm font-semibold">{variant.name}</p><p className="mt-1 text-xs text-[#64736b]">{variant.weight} {variant.weightUnit}{unavailable ? " · Out of stock" : ""}</p></div><span className="font-semibold">₹{variant.price}</span><Plus className="h-5 w-5 text-[#087f5b]" /></button>;
                    })}</div>
                </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
    ) : null;

    return (
        <>
            <article className={cn("bmv-product-card group relative flex h-full min-w-0 flex-col rounded-2xl border border-[#e5ebe7] bg-white p-2.5 transition-colors hover:border-[#b7d9c8]", compact ? "sm:p-3" : "sm:p-3.5")}>
                <div className="relative mb-2 aspect-square overflow-hidden rounded-xl bg-[#fafcfb]">
                    <Link href={`/products/${id}`} aria-label={`View ${name}`} className="absolute inset-0">
                        {images?.[0] ? <Image src={images[0]} alt={name} fill sizes="(max-width: 600px) 45vw, (max-width: 1024px) 28vw, 220px" className={cn("object-contain p-2 transition-transform group-hover:scale-105 motion-reduce:transform-none", isOutOfStock && "opacity-50")} /> : <div className="flex h-full items-center justify-center text-[#a8c7b7]"><Leaf className="h-10 w-10" /></div>}
                    </Link>
                    {discount && <span className="pointer-events-none absolute left-1 top-1 rounded-md bg-[#c92a2a] px-2 py-1 text-[10px] font-bold text-white">{discount.pct}% OFF</span>}
                    <button type="button" aria-label={`${inWishlist ? "Remove" : "Save"} ${name} ${inWishlist ? "from" : "to"} wishlist`} aria-pressed={inWishlist} onClick={() => toggleWishlist({ productId: id, name, price: finalPrice, image: images?.[0] ?? "" })} className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-[#64736b] hover:text-rose-600">
                        <Heart className={cn("h-4 w-4", inWishlist && "fill-rose-500 text-rose-500")} />
                    </button>
                </div>
                <Link href={`/products/${id}`} className="min-h-10 text-sm font-semibold leading-5 text-[#17251e] hover:text-[#087f5b]"><h3 className="line-clamp-2">{name}</h3></Link>
                <p className="mb-3 mt-1 min-h-4 text-xs text-[#64736b]">{currentWeight || categoryLabel || "View product details"}</p>
                <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-baseline gap-1.5"><span className="text-base font-bold tabular-nums text-[#17251e]">₹{finalPrice.toFixed(0)}</span>{discount && <span className="text-xs text-[#64736b] line-through">₹{currentPrice.toFixed(0)}</span>}</div>
                    {activeQty === 0 ? isOutOfStock ? <button type="button" onClick={handleNotify} disabled={isNotified} className="flex min-h-11 items-center gap-1 rounded-lg border border-[#e5ebe7] px-2 text-xs font-semibold text-[#64736b] disabled:opacity-60">{isNotified ? <Check className="h-3 w-3" /> : <Bell className="h-3 w-3" />}{isNotified ? "Saved alert" : "Notify me"}</button> : <button type="button" disabled={adding} aria-label={`Add ${name} to cart`} onClick={(e) => { if (hasMultipleVariants) setDrawerOpen(true); else if (variants?.length === 1) { const v = variants[0]; handleAdd(e, v.id, v.name, Number(v.price), v.inventory); } else handleAdd(e); }} className="flex min-h-11 min-w-16 items-center justify-center gap-1 rounded-lg border border-[#b7d9c8] bg-[#e8f7ef] px-3 text-xs font-bold text-[#087f5b] hover:bg-[#d7eee2] disabled:opacity-60">{adding ? "Adding…" : "ADD"}</button> : <div className="bmv-quantity flex items-center rounded-lg bg-[#087f5b] text-white"><button type="button" aria-label={`Decrease ${name} quantity`} onClick={(e) => handleQty(e, -1)} className="flex h-11 w-11 items-center justify-center"><Minus className="h-4 w-4" /></button><span aria-live="polite" className="bmv-quantity-value min-w-4 text-center text-sm font-semibold tabular-nums">{activeQty}</span><button type="button" aria-label={`Increase ${name} quantity`} onClick={(e) => handleQty(e, 1)} className="flex h-11 w-11 items-center justify-center"><Plus className="h-4 w-4" /></button></div>}
                </div>
                {hasMultipleVariants && <button type="button" onClick={() => setDrawerOpen(true)} className="mt-1 min-h-11 text-left text-xs font-medium text-[#087f5b]">{variants.length} pack sizes available</button>}
            </article>
            {mounted && drawer}
        </>
    );
}
