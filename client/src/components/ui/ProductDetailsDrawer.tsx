"use client";

import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X, Share2, Bookmark, Check, Bell, Plus, Minus, Leaf } from "lucide-react";
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
    const modalRef = useRef<HTMLDivElement>(null);
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

    useEffect(() => {
        if (!mounted || !isOpen) return;
        const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const modal = modalRef.current;
        const first = modal?.querySelector<HTMLElement>("button");
        first?.focus();
        const trapFocus = (event: KeyboardEvent) => {
            if (event.key !== "Tab" || !modal) return;
            const controls = Array.from(modal.querySelectorAll<HTMLElement>('button:not([disabled]), textarea, a[href]'));
            const start = controls[0];
            const end = controls[controls.length - 1];
            if (!start) { event.preventDefault(); return; }
            if (event.shiftKey && document.activeElement === start) { event.preventDefault(); end.focus(); }
            else if (!event.shiftKey && document.activeElement === end) { event.preventDefault(); start.focus(); }
        };
        document.addEventListener("keydown", trapFocus);
        return () => { document.removeEventListener("keydown", trapFocus); previous?.focus(); };
    }, [mounted, isOpen]);

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
            : [];

    const isNonVeg = /egg|chicken|mutton|fish|meat|prawn|pork/i.test(p.name) || (Array.isArray(p.tags) && p.tags.some((t: string) => /non-?veg|egg|chicken/i.test(t)));

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
        <div ref={modalRef} role="dialog" aria-modal="true" aria-label={p.name} className="bmv-theme bmv-product-sheet fixed inset-0 z-[300] flex flex-col justify-end [&_button:focus-visible]:outline-2 [&_button:focus-visible]:outline-offset-2 [&_button:focus-visible]:outline-[#006c45]">
            {/* Backdrop Blur */}
            <div
                onClick={onClose}
                className="fixed inset-0 bg-black/75 backdrop-blur-xs transition-opacity duration-300 animate-in fade-in"
            />

            {/* Floating Close 'X' Button Directly Above Sheet (Reference-inspired close action) */}
            <div className="relative z-[320] w-full max-w-lg mx-auto flex justify-center pb-3">
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    className="w-11 h-11 rounded-full bg-[#eef6ed] text-[#14251c] flex items-center justify-center shadow-2xl active:scale-90 hover:bg-[#e0e9e2] transition-all cursor-pointer border border-[#e0e9e2]"
                >
                    <X className="w-5 h-5 stroke-[2.5]" />
                </button>
            </div>

            {/* Bottom Sheet Drawer Container (Book My Veg light surface) */}
            <div
                className="relative z-[310] w-full max-w-lg mx-auto bg-white text-[#14251c] rounded-t-[2.2rem] shadow-[0_-20px_80px_rgba(0,0,0,0.6)] border-t border-[#e0e9e2] flex flex-col max-h-[88vh] overflow-hidden animate-in slide-in-from-bottom duration-300 ease-out"
            >
                {/* Scrollable Content: Photo on Top, Details Below */}
                <div className="flex-1 overflow-y-auto px-5 pt-5 pb-32 space-y-4">
                    
                    {/* 1. PHOTO ON TOP (Rounded Hero Produce Showcase) */}
                    <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden bg-[#f4f8f1] border border-[#e0e9e2] shadow-md">
                        {images[0] ? <Image
                            src={images[0]}
                            alt={p.name}
                            fill
                            unoptimized
                            className={cn(
                                "object-contain p-4 transition-transform duration-700 hover:scale-105",
                                isOutOfStock && "opacity-35 grayscale"
                            )}
                            sizes="(max-width: 768px) 100vw, 500px"
                            priority
                        /> : <div className="flex h-full flex-col items-center justify-center gap-3 text-[#617166]"><Leaf className="h-12 w-12" /><span className="text-sm">Image unavailable</span></div>}

                        {/* Out of Stock Scrim */}
                        {isOutOfStock && (
                            <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center z-10">
                                <span className="text-xs font-semibold text-white px-3 py-1 rounded-full  tracking-normal bg-black/80 border border-white/20">
                                    OUT OF STOCK
                                </span>
                            </div>
                        )}

                        {/* Discount Badge */}
                        {discountPct > 0 && !isOutOfStock && (
                            <div className="absolute top-3 left-3 bg-[#006c45] text-white px-2 py-0.5 rounded-md font-semibold text-xs  tracking-normal shadow-md">
                                {discountPct}% OFF
                            </div>
                        )}
                    </div>

                    {/* 2. TITLE ROW & ACTIONS (Product information and actions) */}
                    <div className="pt-1">
                        <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1.5 flex-1 min-w-0">
                                {/* Veg / Non-Veg Indicator */}
                                <div className="flex items-center gap-2">
                                    {isNonVeg ? (
                                        <div className="w-4 h-4 border border-amber-600 flex items-center justify-center rounded-[3px] bg-amber-50 p-[2px] shrink-0">
                                            <div className="w-0 h-0 border-l-[3.5px] border-l-transparent border-r-[3.5px] border-r-transparent border-b-[6px] border-b-amber-600" />
                                        </div>
                                    ) : (
                                        <div className="w-4 h-4 border border-emerald-500 flex items-center justify-center rounded-[3px] bg-emerald-50 p-[2px] shrink-0">
                                            <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                        </div>
                                    )}

                                    <h2 className="text-xl sm:text-2xl font-bold text-[#14251c] tracking-tight leading-snug">
                                        {p.name}
                                    </h2>
                                </div>

                                <p className="text-sm text-[#617166]">{currentVariant ? `${currentVariant.weight} ${currentVariant.weightUnit || ''}` : p.weight ? `${p.weight} ${p.weightUnit || ''}` : "Select your preferred pack"}</p>
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
                                    aria-label={inWishlist ? "Remove from wishlist" : "Save to wishlist"}
                                    aria-pressed={inWishlist}
                                    className={cn(
                                        "w-11 h-11 rounded-full flex items-center justify-center active:scale-90 transition-all cursor-pointer border border-[#e0e9e2]",
                                        inWishlist
                                            ? "bg-[#eef6ed] text-[#006c45] border-[#006c45]"
                                            : "bg-[#eef6ed] text-[#617166] hover:text-[#14251c]"
                                    )}
                                >
                                    <Bookmark className={cn("w-4 h-4", inWishlist && "fill-current text-[#006c45]")} />
                                </button>
                                <button
                                    type="button"
                                    onClick={handleShare}
                                    aria-label="Share product"
                                    className="w-11 h-11 rounded-full bg-[#eef6ed] text-[#617166] hover:text-[#14251c] flex items-center justify-center active:scale-90 transition-all cursor-pointer border border-[#e0e9e2]"
                                >
                                    <Share2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Description Text */}
                        <p className="text-xs text-[#617166] leading-relaxed mt-2.5">
                            {p.description || "Choose a pack size and add this item to your cart."}
                        </p>
                    </div>

                    {/* Pack Size Variants (if customizable) */}
                    {hasVariants && variants.length > 1 && (
                        <div className="pt-1 space-y-2">
                            <span className="text-xs font-bold text-[#617166]  tracking-normal">
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
                                            aria-pressed={isSelected}
                                            className={cn(
                                                "min-h-14 p-3 rounded-xl border text-left transition-all active:scale-95 cursor-pointer flex flex-col justify-between",
                                                isSelected
                                                    ? "border-emerald-500 bg-[#eef6ed] text-[#14251c] shadow-xs"
                                                    : "border-[#e0e9e2] bg-[#f4f8f1] text-[#617166] hover:border-white/20"
                                            )}
                                        >
                                            <span className="text-xs font-bold">
                                                {v.weight} {v.weightUnit}
                                            </span>
                                            <span className="text-xs font-semibold text-[#006c45] mt-1">
                                                ₹{Number(v.price)}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* 3. ADD A PACKING / PREPARATION REQUEST (OPTIONAL) - Optional packing note */}
                    <div className="bg-[#f8faf8] rounded-2xl p-4 border border-[#e0e9e2] space-y-2.5">
                        <div className="space-y-0.5">
                            <h3 className="text-sm font-bold text-[#14251c] tracking-tight">
                                Add a packing request (optional)
                            </h3>
                            <p className="text-xs text-[#617166] leading-snug">
                                Our packaging team will try their best to fulfil your requests.
                            </p>
                        </div>

                        <div className="relative">
                            <textarea
                                aria-label="Packing request (optional)"
                                value={customNote}
                                onChange={(e) => setCustomNote(e.target.value.slice(0, 100))}
                                placeholder="e.g. Choose medium-ripe tomatoes, pack leafy greens separately"
                                rows={2}
                                className="w-full bg-white border border-[#e0e9e2] rounded-xl p-3 text-xs text-[#14251c] placeholder-slate-500 focus:outline-hidden focus:border-emerald-500 resize-none transition-colors"
                            />
                            <span className="absolute bottom-2.5 right-3 text-xs font-semibold text-[#617166] tabular-nums">
                                {100 - customNote.length}
                            </span>
                        </div>
                    </div>

                </div>

                {/* 4. BOTTOM STICKY ACTION BAR (Reference-inspired close action) */}
                <div className="absolute bottom-0 left-0 right-0 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] bg-white backdrop-blur-md border-t border-[#e0e9e2] flex items-center gap-3 z-20">
                    {/* Left: Stepper Counter [- 1 +] */}
                    <div className="h-12 w-28 rounded-2xl bg-[#eef6ed] border border-[#e0e9e2] flex items-center justify-between px-0 text-[#14251c] font-bold shrink-0 select-none">
                        <button
                            type="button"
                            onClick={() => handleQtyChange(-1)}
                            aria-label="Decrease"
                            className="w-11 h-11 rounded-lg flex items-center justify-center text-[#006c45] hover:bg-white/10 active:scale-75 transition-all cursor-pointer"
                        >
                            <Minus className="w-4 h-4 stroke-[3]" />
                        </button>
                        <span
                            key={displayQty}
                            className="text-base font-semibold min-w-[20px] text-center tabular-nums animate-in fade-in zoom-in-75 duration-150"
                        >
                            {displayQty}
                        </span>
                        <button
                            type="button"
                            onClick={() => handleQtyChange(1)}
                            aria-label="Increase"
                            className="w-11 h-11 rounded-lg flex items-center justify-center text-[#006c45] hover:bg-white/10 active:scale-75 transition-all cursor-pointer"
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
                                    "w-full h-12 rounded-2xl font-semibold text-sm  tracking-normal flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all",
                                    isNotified
                                        ? "bg-emerald-700 text-white cursor-default"
                                        : "bg-[#eef6ed] text-[#006c45] border border-emerald-500/40 hover:border-emerald-400 cursor-pointer"
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
                                className="w-full h-12 rounded-2xl font-semibold text-sm tracking-wide text-white bg-[#006c45] hover:bg-[#005537] flex items-center justify-center gap-1.5 shadow-lg active:scale-95 transition-all cursor-pointer"
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
