"use client";

import Image from "next/image";
import { useState, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { Plus, Minus, X, Leaf, Bookmark, Share2 } from "lucide-react";
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
                className="bmv-theme bmv-product-sheet fixed bottom-0 left-0 right-0 z-[210] bg-white text-[#14251c] rounded-t-[2rem] shadow-2xl flex flex-col items-center max-h-[75vh] w-full border-t border-[#e0e9e2] pb-8"
            >
                <div className="w-full flex justify-center pt-3 pb-2">
                    <div className="w-12 h-1.5 bg-white/20 rounded-full" />
                </div>

                <div className="w-full flex items-center justify-between px-6 py-4 border-b border-[#e0e9e2]">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center border border-emerald-500/20">
                            <Leaf className="h-5 w-5 text-[#006c45]" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-[#14251c]  tracking-tight leading-none">
                                {name}
                            </h2>
                            <p className="text-xs font-bold text-[#006c45]  tracking-normal mt-1">
                                Choose pack size
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => setDrawerOpen(false)}
                        aria-label="Close pack options" className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#eef6ed] text-[#14251c] hover:bg-white/20 transition-colors"
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
                                        ? "border-emerald-500/50 bg-[#eef6ed]"
                                        : "border-[#e0e9e2] bg-[#f8faf8]"
                                )}
                            >
                                <div className="space-y-0.5">
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold text-sm text-[#14251c]">
                                            {v.weight} {v.weightUnit}
                                        </span>
                                        {v.name && v.name !== "Standard" && (
                                            <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-[#eef6ed] text-[#617166]">
                                                {v.name}
                                            </span>
                                        )}
                                    </div>
                                    <span className="text-sm font-semibold text-[#006c45]">
                                        ₹{vPrice}
                                    </span>
                                </div>

                                <div>
                                    {vOutOfStock ? (
                                        <span className="text-xs font-bold text-rose-700 tracking-wider px-2 py-1 bg-rose-50 border border-rose-500/30 rounded-lg">
                                            Sold Out
                                        </span>
                                    ) : vQty > 0 ? (
                                        <div className="flex items-center gap-2 bg-[#006c45] text-white px-2.5 py-1 rounded-xl shadow-xs border border-emerald-400">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    updateQuantity(id, vQty - 1, v.id);
                                                }}
                                                className="flex h-11 w-11 items-center justify-center hover:opacity-80"
                                            >
                                                <Minus className="w-3 h-3 stroke-[3]" />
                                            </button>
                                            <span className="text-xs font-semibold min-w-[16px] text-center">{vQty}</span>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    updateQuantity(id, vQty + 1, v.id);
                                                }}
                                                className="flex h-11 w-11 items-center justify-center hover:opacity-80"
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
                                            className="min-h-11 px-4 py-1.5 bg-[#006c45] hover:bg-[#005537] text-white font-semibold text-xs  tracking-wider rounded-xl shadow-xs active:scale-95 transition-all"
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



    return (
        <>
            <article className="bmv-product-list-item flex w-full items-center gap-3 rounded-3xl border border-[var(--bmv-border)] bg-white shadow-[0_3px_14px_rgba(18,54,33,0.04)] p-3 sm:gap-5 sm:p-4 [&_button:focus-visible]:outline-2 [&_button:focus-visible]:outline-offset-2 [&_button:focus-visible]:outline-[#006c45]">
                <button type="button" onClick={() => setDetailsOpen(true)} aria-label={`View ${name}`} className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-[#f4f8f1] sm:h-28 sm:w-28">
                    {images?.[0] ? <Image src={images[0]} alt={name} fill className={cn("object-contain p-2", isOutOfStock && "opacity-50")} sizes="112px" /> : <Leaf className="m-auto h-8 w-8 text-[#006c45]" />}
                </button>
                <div className="min-w-0 flex-1">
                    <button type="button" onClick={() => setDetailsOpen(true)} className="min-h-11 w-full text-left"><h3 className="break-words text-sm font-semibold leading-5 text-[#14251c] sm:text-base">{name}</h3>{currentWeight && <p className="mt-1 text-xs text-[#617166]">{currentWeight}</p>}</button>
                    <div className="mt-2 flex flex-wrap items-baseline gap-2"><span className="text-base font-bold text-[#14251c]">₹{finalPrice}</span>{discount && <><span className="text-xs text-[#617166] line-through">₹{currentPrice}</span><span className="text-xs font-semibold text-[#006c45]">{discount.pct}% off</span></>}</div>
                    {isOutOfStock && <p className="mt-1 text-xs text-[#617166]">Out of stock</p>}
                    <div className="mt-1 flex items-center gap-1">
                        <button type="button" onClick={() => toggleWishlist({ productId: id, name, price: finalPrice, image: images?.[0] ?? "" })} aria-label={inWishlist ? `Remove ${name} from wishlist` : `Save ${name} to wishlist`} aria-pressed={inWishlist} className="flex h-11 w-11 items-center justify-center rounded-full text-[#006c45] hover:bg-[#eef6ed]"><Bookmark className={cn("h-4 w-4", inWishlist && "fill-current")} /></button>
                        <button type="button" onClick={handleShare} aria-label={`Share ${name}`} className="flex h-11 w-11 items-center justify-center rounded-full text-[#617166] hover:bg-[#eef6ed]"><Share2 className="h-4 w-4" /></button>
                    </div>
                </div>
                <div className="flex shrink-0 flex-col items-center gap-2">
                    {isOutOfStock ? <button onClick={handleNotify} disabled={isNotified} className="min-h-11 rounded-xl border border-[#e0e9e2] bg-[#eef6ed] px-3 text-xs font-semibold text-[#006c45]">{isNotified ? "Saved" : "Notify me"}</button> : activeQty > 0 ? <div className="flex flex-col items-center rounded-xl border border-[#e0e9e2] bg-[#eef6ed] text-[#006c45] sm:flex-row"><button type="button" onClick={event => handleQty(event, -1)} aria-label={`Decrease ${name} quantity`} className="flex h-11 w-11 items-center justify-center"><Minus className="h-4 w-4" /></button><span className="min-w-5 text-center text-sm font-semibold">{activeQty}</span><button type="button" onClick={event => handleQty(event, 1)} aria-label={`Increase ${name} quantity`} className="flex h-11 w-11 items-center justify-center"><Plus className="h-4 w-4" /></button></div> : <button type="button" onClick={event => hasMultipleVariants ? setDrawerOpen(true) : handleAdd(event)} aria-label={`Add ${name} to cart`} className="flex min-h-11 items-center gap-1 rounded-xl bg-[#006c45] px-3 text-sm font-semibold text-white hover:bg-[#005537]">Add <Plus className="h-4 w-4" /></button>}
                    {hasMultipleVariants && <span className="text-[11px] text-[#617166]">Options</span>}
                </div>
            </article>

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
