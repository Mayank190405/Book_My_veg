"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Share2, Bookmark, Check, Bell, Plus, Minus, Sparkles } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getProductById } from "@/services/productService";
import { useCartStore } from "@/store/useCartStore";
import { useUserStore } from "@/store/useUserStore";
import { useWishlistStore } from "@/store/useWishlistStore";
import { useNotifyStore } from "@/store/useNotifyStore";
import { useShareStore } from "@/store/useShareStore";
import { cn } from "@/lib/utils";

export interface ProductDetailsDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    product: {
        id: string;
        name: string;
        images?: string[];
        basePrice: number;
        originalPrice?: number;
        weight?: number;
        weightUnit?: string;
        minQuantity?: number;
        maxQuantity?: number;
        category?: { name: string; slug: string } | string;
        inventory?: { locationId: string; currentStock: number; thresholdStock: number }[];
        pricing?: { channel?: string; price: number; discountType: string; discountValue: number; isActive: boolean }[];
        variants?: { id: string; name: string; price: number; weight: number; weightUnit: string; inventory?: any[]; pricing?: any[] }[];
        tags?: string[];
        description?: string;
    } | null;
}

export default function ProductDetailsDrawer({ isOpen, onClose, product }: ProductDetailsDrawerProps) {
    const [mounted, setMounted] = useState(false);
    const [activeVariantId, setActiveVariantId] = useState<string | null>(null);
    const [customNote, setCustomNote] = useState("");
    const [localQty, setLocalQty] = useState(1);

    const { items, addItem, updateQuantity } = useCartStore();
    const { activeStore } = useUserStore();
    const openShare = useShareStore((state) => state.openShare);
    const toggleWishlist = useWishlistStore((state) => state.toggleWishlist);
    const inWishlist = useWishlistStore((state) =>
        product ? state.items.some((i) => i.productId === product.id) : false
    );

    const isNotified = useNotifyStore((state) => (product ? !!state.notifiedProducts[product.id] : false));
    const addNotification = useNotifyStore((state) => state.addNotification);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Fetch full product details in background for description/nutrition
    const { data: fullProduct } = useQuery({
        queryKey: ["product-detail-drawer", product?.id],
        queryFn: () => (product?.id ? getProductById(product.id) : null),
        enabled: !!product?.id && isOpen,
        staleTime: 5 * 60 * 1000,
    });

    // Reset state on new product
    useEffect(() => {
        if (product) {
            setCustomNote("");
            if (product.variants && product.variants.length > 0) {
                setActiveVariantId(product.variants[0].id);
            } else {
                setActiveVariantId(null);
            }
        }
    }, [product?.id]);

    // Close on Escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        if (isOpen) {
            window.addEventListener("keydown", handleKeyDown);
            document.body.style.overflow = "hidden";
        }
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            document.body.style.overflow = "";
        };
    }, [isOpen, onClose]);

    if (!mounted || !isOpen || !product) return null;

    const p = fullProduct || product;
    const variants = p.variants && p.variants.length > 0 ? p.variants : product.variants;
    const hasVariants = variants && variants.length > 0;
    const currentVariant = hasVariants ? variants.find((v: any) => v.id === activeVariantId) || variants[0] : null;

    // Pricing calculation
    const activePricing = p.pricing?.find((pr: any) => pr.isActive && (pr.channel === "WEB" || !pr.channel))?.price
        ?? p.pricing?.find((pr: any) => pr.isActive)?.price;
    const variantPricing = (currentVariant as any)?.pricing?.find((pr: any) => pr.isActive && (pr.channel === "WEB" || !pr.channel))?.price
        ?? (currentVariant as any)?.pricing?.find((pr: any) => pr.isActive)?.price;

    const currentPrice = Number(
        variantPricing ??
        activePricing ??
        (currentVariant ? Number(currentVariant.price) : Number(p.basePrice || product.basePrice))
    );

    // Discount check
    const activePricingObj = p.pricing?.find((pr: any) => pr.isActive && pr.discountValue > 0);
    let discountPct = 0;
    let finalPrice = currentPrice;

    if (activePricingObj) {
        if (activePricingObj.discountType === "PERCENTAGE") {
            discountPct = activePricingObj.discountValue;
            finalPrice = currentPrice - (currentPrice * discountPct) / 100;
        } else if (activePricingObj.discountType === "FLAT") {
            discountPct = Math.round((activePricingObj.discountValue / currentPrice) * 100);
            finalPrice = currentPrice - activePricingObj.discountValue;
        }
    }

    // Inventory calculation
    const allInventory = [...(p.inventory ?? []), ...(product.inventory ?? [])];
    if (variants) {
        variants.forEach((v: any) => {
            if (v.inventory) allInventory.push(...v.inventory);
        });
    }

    const relevantInventory = activeStore?.id
        ? allInventory.filter((inv) => inv.locationId === activeStore.id)
        : [];
    const stock = relevantInventory.reduce((acc, inv) => acc + Number(inv.currentStock), 0);
    const isOutOfStock = stock === 0;

    // Cart matching
    const productCartItems = items.filter((i) => i.productId === product.id);
    const activeCartItem = productCartItems.find((i) => {
        const itemVarId = i.variantId || undefined;
        const curVarId = currentVariant?.id || undefined;
        if (curVarId && itemVarId) return curVarId === itemVarId;
        if (!hasVariants) return true;
        return curVarId === itemVarId;
    }) ?? (!hasVariants ? productCartItems[0] : undefined);

    const activeQty = activeCartItem?.quantity ?? 0;
    const displayQty = activeQty > 0 ? activeQty : localQty;

    const images: string[] = (p.images && p.images.length > 0)
        ? p.images
        : (product.images && product.images.length > 0)
            ? product.images
            : ["https://placehold.co/600x600/1e2129/bef264?text=Fresh+Produce"];

    const isNonVeg = /egg|chicken|mutton|fish|meat|prawn|pork/i.test(p.name) || (Array.isArray(p.tags) && p.tags.some((t: string) => /non-?veg|egg|chicken/i.test(t)));

    // Dynamic Social Proof
    const dynamicProof = isOutOfStock
        ? { text: "Restocking soon", barColor: "bg-slate-500", barPercent: 20 }
        : discountPct >= 15
            ? { text: `Best Value • Save ${discountPct}%`, barColor: "bg-emerald-500", barPercent: 90 }
            : { text: "Highly reordered", barColor: "bg-emerald-500", barPercent: 80 };

    const handleShare = () => {
        openShare({
            id: product.id,
            name: p.name,
            image: images[0],
            price: finalPrice,
        });
    };

    const handleQtyChange = (delta: number) => {
        if (activeQty > 0) {
            const minQ = product.minQuantity || 1;
            const maxQ = product.maxQuantity || 10;
            const next = activeQty + delta;
            if (delta > 0 && next > maxQ) {
                import("sonner").then(({ toast }) => toast.error(`Maximum purchase limit is ${maxQ}`));
                return;
            }

            const targetVarId = activeCartItem?.variantId || currentVariant?.id || undefined;
            if (delta < 0 && next < minQ) {
                updateQuantity(product.id, 0, targetVarId);
                return;
            }
            updateQuantity(product.id, Math.max(0, next), targetVarId);
        } else {
            setLocalQty((prev) => Math.max(1, Math.min(10, prev + delta)));
        }
    };

    const handleAdd = () => {
        if (isOutOfStock) return;
        const targetVariantId = currentVariant?.id || undefined;
        const targetName = currentVariant
            ? `${p.name} (${currentVariant.weight} ${currentVariant.weightUnit || ''})`
            : (p.weight ? `${p.name} (${p.weight} ${p.weightUnit || ''})` : p.name);

        const qtyToAdd = activeQty > 0 ? 1 : localQty;

        addItem({
            productId: product.id,
            variantId: targetVariantId,
            name: targetName,
            price: finalPrice,
            image: images[0] || "",
            quantity: qtyToAdd,
            metadata: customNote.trim() ? { customerNote: customNote.trim() } : undefined,
        });

        import("sonner").then(({ toast }) => {
            toast.success(`${targetName} added`, {
                description: customNote.trim() ? "Packing request saved with order" : "Fresh item added to your bag",
                duration: 2000,
            });
        });

        onClose();
    };

    const handleNotify = () => {
        addNotification({
            id: product.id,
            name: p.name,
            image: images[0],
            price: finalPrice,
        });
        import("sonner").then(({ toast }) => {
            toast.success(`We'll notify you when ${p.name} is back in stock!`, {
                description: "Saved to your browser alerts",
                duration: 2500,
            });
        });
    };

    const drawerContent = (
        <div className="fixed inset-0 z-[300] flex flex-col justify-end">
            {/* Backdrop Blur */}
            <div
                onClick={onClose}
                className="fixed inset-0 bg-black/75 backdrop-blur-xs transition-opacity duration-300 animate-in fade-in"
            />

            {/* Floating Close 'X' Button Directly Above Sheet (Exact Zomato Match) */}
            <div className="relative z-[320] w-full max-w-lg mx-auto flex justify-center pb-3">
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    className="w-11 h-11 rounded-full bg-[#252830] text-white flex items-center justify-center shadow-2xl active:scale-90 hover:bg-[#323640] transition-all cursor-pointer border border-white/10"
                >
                    <X className="w-5 h-5 stroke-[2.5]" />
                </button>
            </div>

            {/* Bottom Sheet Drawer Container (Exact Zomato Dark Theme) */}
            <div
                className="relative z-[310] w-full max-w-lg mx-auto bg-[#18191e] text-white rounded-t-[2.2rem] shadow-[0_-20px_80px_rgba(0,0,0,0.6)] border-t border-white/10 flex flex-col max-h-[88vh] overflow-hidden animate-in slide-in-from-bottom duration-300 ease-out"
            >
                {/* Scrollable Content: Photo on Top, Details Below */}
                <div className="flex-1 overflow-y-auto px-5 pt-5 pb-24 space-y-4">
                    
                    {/* 1. PHOTO ON TOP (Rounded Hero Produce Showcase) */}
                    <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden bg-[#22242b] border border-white/5 shadow-md">
                        <Image
                            src={images[0]}
                            alt={p.name}
                            fill
                            unoptimized
                            className={cn(
                                "object-cover transition-transform duration-700 hover:scale-105",
                                isOutOfStock && "opacity-35 grayscale"
                            )}
                            sizes="(max-width: 768px) 100vw, 500px"
                            priority
                        />

                        {/* Out of Stock Scrim */}
                        {isOutOfStock && (
                            <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center z-10">
                                <span className="text-xs font-black text-white px-3 py-1 rounded-full uppercase tracking-widest bg-black/80 border border-white/20">
                                    OUT OF STOCK
                                </span>
                            </div>
                        )}

                        {/* Discount Badge */}
                        {discountPct > 0 && !isOutOfStock && (
                            <div className="absolute top-3 left-3 bg-[#e23744] text-white px-2 py-0.5 rounded-md font-black text-[10px] uppercase tracking-wider shadow-md">
                                {discountPct}% OFF
                            </div>
                        )}
                    </div>

                    {/* 2. TITLE ROW & ACTIONS (Exact Zomato Layout) */}
                    <div className="pt-1">
                        <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1.5 flex-1 min-w-0">
                                {/* Veg / Non-Veg Indicator */}
                                <div className="flex items-center gap-2">
                                    {isNonVeg ? (
                                        <div className="w-4 h-4 border border-amber-600 flex items-center justify-center rounded-[3px] bg-[#1a120e] p-[2px] shrink-0">
                                            <div className="w-0 h-0 border-l-[3.5px] border-l-transparent border-r-[3.5px] border-r-transparent border-b-[6px] border-b-amber-600" />
                                        </div>
                                    ) : (
                                        <div className="w-4 h-4 border border-emerald-500 flex items-center justify-center rounded-[3px] bg-[#0a1813] p-[2px] shrink-0">
                                            <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                        </div>
                                    )}

                                    <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight leading-snug">
                                        {p.name}
                                    </h2>
                                </div>

                                {/* Dynamic Social Proof Badge (e.g. Highly reordered) */}
                                <div className="flex items-center gap-2 pt-0.5">
                                    <div className="w-10 h-1.5 rounded-full bg-white/10 overflow-hidden flex">
                                        <div
                                            className={cn("h-full rounded-full transition-all duration-500", dynamicProof.barColor)}
                                            style={{ width: `${dynamicProof.barPercent}%` }}
                                        />
                                    </div>
                                    <span className="text-xs font-semibold text-slate-300">
                                        {dynamicProof.text}
                                    </span>
                                </div>
                            </div>

                            {/* Right Action Icons: Bookmark & Share */}
                            <div className="flex items-center gap-2 shrink-0 pt-1">
                                <button
                                    type="button"
                                    onClick={() => toggleWishlist({
                                        productId: product.id,
                                        name: p.name,
                                        price: finalPrice,
                                        image: images[0] || "",
                                    })}
                                    title="Save to Wishlist"
                                    className={cn(
                                        "w-9 h-9 rounded-full flex items-center justify-center active:scale-90 transition-all cursor-pointer border border-white/10",
                                        inWishlist
                                            ? "bg-rose-500/20 text-rose-500 border-rose-500/30"
                                            : "bg-[#252830] text-slate-300 hover:text-white"
                                    )}
                                >
                                    <Bookmark className={cn("w-4 h-4", inWishlist && "fill-current text-rose-500")} />
                                </button>
                                <button
                                    type="button"
                                    onClick={handleShare}
                                    title="Share"
                                    className="w-9 h-9 rounded-full bg-[#252830] text-slate-300 hover:text-white flex items-center justify-center active:scale-90 transition-all cursor-pointer border border-white/10"
                                >
                                    <Share2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Description Text */}
                        <p className="text-xs text-slate-400 leading-relaxed mt-2.5">
                            {p.description ||
                                `Fresh and handpicked ${p.name}. Sourced daily from local organic farms to ensure the highest natural nutrients and farm-fresh flavor.`}
                        </p>
                    </div>

                    {/* Pack Size Variants (if customizable) */}
                    {hasVariants && variants.length > 1 && (
                        <div className="pt-1 space-y-2">
                            <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                                Select Size / Quantity
                            </span>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {variants.map((v: any) => {
                                    const isSelected = activeVariantId === v.id;
                                    return (
                                        <button
                                            key={v.id}
                                            type="button"
                                            onClick={() => setActiveVariantId(v.id)}
                                            className={cn(
                                                "p-3 rounded-xl border text-left transition-all active:scale-95 cursor-pointer flex flex-col justify-between",
                                                isSelected
                                                    ? "border-emerald-500 bg-[#142e22] text-white shadow-xs"
                                                    : "border-white/10 bg-[#22242b] text-slate-300 hover:border-white/20"
                                            )}
                                        >
                                            <span className="text-xs font-bold">
                                                {v.weight} {v.weightUnit}
                                            </span>
                                            <span className="text-xs font-black text-[#bef264] mt-1">
                                                ₹{Number(v.price)}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* 3. ADD A PACKING / PREPARATION REQUEST (OPTIONAL) - Exact Zomato Box */}
                    <div className="bg-[#202228] rounded-2xl p-4 border border-white/5 space-y-2.5">
                        <div className="space-y-0.5">
                            <h3 className="text-sm font-bold text-white tracking-tight">
                                Add a packing request (optional)
                            </h3>
                            <p className="text-[11px] text-slate-400 leading-snug">
                                Our packaging team will try their best to fulfil your requests.
                            </p>
                        </div>

                        <div className="relative">
                            <textarea
                                value={customNote}
                                onChange={(e) => setCustomNote(e.target.value.slice(0, 100))}
                                placeholder="e.g. Choose medium-ripe tomatoes, pack leafy greens separately"
                                rows={2}
                                className="w-full bg-[#18191e] border border-white/10 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-emerald-500 resize-none transition-colors"
                            />
                            <span className="absolute bottom-2.5 right-3 text-[10px] font-semibold text-slate-500 tabular-nums">
                                {100 - customNote.length}
                            </span>
                        </div>
                    </div>

                </div>

                {/* 4. BOTTOM STICKY ACTION BAR (Exact Zomato Match) */}
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-[#18191e]/98 backdrop-blur-md border-t border-white/10 flex items-center gap-3 z-20">
                    {/* Left: Stepper Counter [- 1 +] */}
                    <div className="h-12 w-28 rounded-2xl bg-[#262830] border border-white/10 flex items-center justify-between px-3 text-white font-bold shrink-0 select-none">
                        <button
                            type="button"
                            onClick={() => handleQtyChange(-1)}
                            aria-label="Decrease"
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-[#e23744] hover:bg-white/10 active:scale-75 transition-all cursor-pointer"
                        >
                            <Minus className="w-4 h-4 stroke-[3]" />
                        </button>
                        <span
                            key={displayQty}
                            className="text-base font-black min-w-[20px] text-center tabular-nums animate-in fade-in zoom-in-75 duration-150"
                        >
                            {displayQty}
                        </span>
                        <button
                            type="button"
                            onClick={() => handleQtyChange(1)}
                            aria-label="Increase"
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-[#e23744] hover:bg-white/10 active:scale-75 transition-all cursor-pointer"
                        >
                            <Plus className="w-4 h-4 stroke-[3]" />
                        </button>
                    </div>

                    {/* Right: Big Action Button */}
                    <div className="flex-1">
                        {isOutOfStock ? (
                            <button
                                type="button"
                                onClick={handleNotify}
                                disabled={isNotified}
                                className={cn(
                                    "w-full h-12 rounded-2xl font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all",
                                    isNotified
                                        ? "bg-emerald-700 text-white cursor-default"
                                        : "bg-[#252830] text-[#bef264] border border-emerald-500/40 hover:border-emerald-400 cursor-pointer"
                                )}
                            >
                                {isNotified ? (
                                    <>
                                        <Check className="w-4 h-4 stroke-[3]" />
                                        <span>Notified</span>
                                    </>
                                ) : (
                                    <>
                                        <Bell className="w-4 h-4 text-amber-400" />
                                        <span>Notify Me</span>
                                    </>
                                )}
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={handleAdd}
                                className="w-full h-12 rounded-2xl font-black text-sm tracking-wide text-white bg-[#e23744] hover:bg-[#d42d3a] flex items-center justify-center gap-1.5 shadow-lg active:scale-95 transition-all cursor-pointer"
                            >
                                <span>{activeQty > 0 ? "Update item" : "Add item"}</span>
                                <span className="opacity-70">•</span>
                                <span className="tabular-nums">₹{(finalPrice * displayQty).toFixed(0)}</span>
                            </button>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );

    return createPortal(drawerContent, document.body);
}
