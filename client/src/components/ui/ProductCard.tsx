"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { Plus, Minus, X, Zap, Heart } from "lucide-react";
import { useCartStore } from "@/store/useCartStore";
import { useUserStore } from "@/store/useUserStore";
import { useWishlistStore } from "@/store/useWishlistStore";
import { cn } from "@/lib/utils";

export interface ProductCardProps {
    id: string;
    name: string;
    images: string[];
    basePrice: number;
    originalPrice?: number;
    weight?: number;
    weightUnit?: string;
    inventory?: { locationId: string; currentStock: number; thresholdStock: number }[];
    pricing?: { price: number; discountType: string; discountValue: number; isActive: boolean }[];
    variants?: { id: string; name: string; price: number; weight: number; weightUnit: string; inventory?: { locationId: string; currentStock: number; thresholdStock: number }[] }[];
    badge?: "trending" | "flash" | null;
    compact?: boolean;
}

function getDiscount(basePrice: number, pricing?: ProductCardProps["pricing"]) {
    if (!pricing) return null;
    const active = pricing.find((p) => p.isActive && p.discountValue > 0);
    if (!active) return null;
    if (active.discountType === "PERCENTAGE") return { pct: active.discountValue, finalPrice: basePrice - (basePrice * active.discountValue) / 100 };
    if (active.discountType === "FLAT") return { pct: Math.round((active.discountValue / basePrice) * 100), finalPrice: basePrice - active.discountValue };
    return null;
}

export default function ProductCard({ id, name, images, basePrice, weight, weightUnit, inventory, pricing, variants, compact = false }: ProductCardProps) {
    const { items, addItem, updateQuantity } = useCartStore();
    const { activeStore } = useUserStore();
    const toggleWishlist = useWishlistStore((state) => state.toggleWishlist);
    const inWishlist = useWishlistStore((state) => state.items.some((i) => i.productId === id));
    const [adding, setAdding] = useState(false);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);
    
    // Manage active variant state
    const [activeVariantIndex, setActiveVariantIndex] = useState(0);
    const hasVariants = variants && variants.length > 0;
    const hasMultipleVariants = variants && variants.length > 1;
    const currentVariant = hasVariants ? variants[activeVariantIndex] : null;

    const activePricing = pricing?.find((pr: any) => pr.isActive)?.price;
    const variantPricing = (currentVariant as any)?.pricing?.find((pr: any) => pr.isActive)?.price;

    const currentPrice = Number(
        variantPricing ??
        activePricing ??
        (currentVariant ? Number(currentVariant.price) : Number(basePrice))
    );
    const currentWeight = currentVariant 
        ? `${currentVariant.weight} ${currentVariant.weightUnit}` 
        : (weight ? `${weight} ${weightUnit || ''}` : weightUnit);
    
    // Identity in cart for active selection
    const activeCartItem = items.find((i) => i.productId === id && i.variantId === currentVariant?.id);
    const activeQty = activeCartItem?.quantity ?? 0;

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

    const handleAdd = useCallback((e: React.MouseEvent, variantId?: string, variantName?: string, variantPrice?: number, variantInventory?: any[]) => {
        e.stopPropagation();
        
        // Local stock check for the specific call
        const vInv = activeStore?.id 
            ? (variantInventory?.filter(vi => vi.locationId === activeStore.id) ?? [])
            : (variantInventory ?? []);
        const vStock = variantId 
            ? (vInv.reduce((acc, vi) => acc + Number(vi.currentStock), 0))
            : stock;

        // If specific variant stock is 0, but total product stock is available, we allow it
        if (vStock === 0 && stock === 0) return;
        setAdding(true);

        const targetPrice = variantPrice ?? finalPrice;
        const targetName = variantName 
            ? `${name} (${variantName})` 
            : (weight ? `${name} (${weight} ${weightUnit || ''})` : name);

        addItem({
            productId: id,
            variantId: variantId,
            name: targetName,
            price: targetPrice,
            image: images?.[0] ?? "",
            quantity: 1,
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
    }, [isOutOfStock, addItem, id, name, finalPrice, images, activeStore, stock, weight, weightUnit]);

    const handleQty = (e: React.MouseEvent, delta: number) => {
        e.stopPropagation();
        updateQuantity(id, Math.max(0, activeQty + delta), currentVariant?.id);
    };

    const drawer = (hasMultipleVariants && drawerOpen) ? (
        <>
            <div
                onClick={() => setDrawerOpen(false)}
                className="fixed inset-0 bg-black/60 z-[200] transition-all duration-500 opacity-100 backdrop-blur-md pointer-events-auto"
            />
            <div
                className="fixed bottom-0 left-0 right-0 z-[210] bg-background rounded-t-[2rem] shadow-[0_-20px_80px_rgba(0,0,0,0.1)] transition-transform duration-500 cubic-bezier(0.16, 1, 0.3, 1) flex flex-col items-center max-h-[70vh] w-full border-t border-border pb-10 translate-y-0"
            >
                <div className="w-full flex justify-center pt-4 pb-2">
                    <div className="w-12 h-1.5 bg-foreground/10 rounded-full" />
                </div>

                <div className="w-full flex items-center justify-between px-8 py-5 border-b border-border">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center">
                            <Zap className="h-6 w-6 text-emerald-500 fill-current" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-foreground uppercase tracking-tight leading-none italic">
                                {name}
                            </h2>
                            <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mt-1.5 opacity-60">
                                Select Pack Size
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => setDrawerOpen(false)}
                        className="p-3 rounded-2xl bg-secondary text-foreground"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="w-full px-6 py-8 space-y-4 overflow-y-auto">
                    {variants.map((v, idx: number) => {
                        const vInv = activeStore?.id 
                            ? (v.inventory?.filter(vi => vi.locationId === activeStore.id) ?? [])
                            : (v.inventory ?? []);
                        
                        const baseInv = activeStore?.id
                            ? (inventory?.filter(bi => bi.locationId === activeStore.id) ?? [])
                            : (inventory ?? []);

                        const vStock = vInv.reduce((acc, vi) => acc + Number(vi.currentStock), 0);
                        const baseStock = baseInv.reduce((acc, bi) => acc + Number(bi.currentStock), 0);
                        const vOutOfStock = vStock === 0 && baseStock === 0;

                        return (
                            <button
                                key={v.id || idx}
                                disabled={vOutOfStock}
                                onClick={(e) => {
                                    setActiveVariantIndex(idx);
                                    handleAdd(e, v.id, v.name, Number(v.price), v.inventory);
                                }}
                                className={cn(
                                    "w-full group flex items-center justify-between p-6 rounded-3xl border transition-all active:scale-[0.98]",
                                    vOutOfStock 
                                        ? "bg-secondary/40 border-border opacity-40 cursor-not-allowed"
                                        : "bg-secondary/40 border-border hover:bg-emerald-500 hover:-translate-y-1"
                                )}
                            >
                                <div className="flex flex-col items-start gap-1">
                                    <span className="text-xs font-black text-foreground group-hover:text-white uppercase tracking-widest leading-none">
                                        {v.name}
                                    </span>
                                    <span className="text-[9px] font-bold text-foreground/20 group-hover:text-white/60 uppercase tracking-widest">
                                        {vOutOfStock ? "Out of Stock" : "Hand-Picked Quality"}
                                    </span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className="text-2xl font-black text-foreground italic tabular-nums group-hover:text-white">₹{v.price}</span>
                                    <div className={cn(
                                        "w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-colors",
                                        vOutOfStock ? "bg-secondary/50" : "bg-emerald-500 group-hover:bg-white"
                                    )}>
                                        {vOutOfStock ? <X className="h-4 w-4 text-foreground/20" /> : <Plus className="h-5 w-5 text-white group-hover:text-emerald-500" strokeWidth={4} />}
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>
        </>
    ) : null;

    if (compact) {
        return (
            <>
                <div className="group relative flex flex-col justify-between w-full bg-white border border-slate-200/50 rounded-[1.75rem] p-3 shadow-sm hover:shadow-md transition-all duration-300">
                    {/* Image block centered */}
                    <div className="relative w-full aspect-square flex items-center justify-center bg-slate-50/50 rounded-2xl overflow-hidden select-none mb-1">
                        {/* Circular Backdrop */}
                        <div className="absolute inset-0 flex items-center justify-center z-0">
                            <div className="w-[85px] h-[85px] rounded-full bg-[#fdf9ee]/75" />
                        </div>
                        <Link href={`/products/${id}`} className="w-full h-full relative z-10 flex items-center justify-center">
                            <Image
                                src={images?.[0] || ""}
                                alt={name}
                                fill
                                className={cn(
                                    "object-contain p-2 transition-transform duration-700 group-hover:scale-105",
                                    isOutOfStock && "opacity-30 grayscale"
                                )}
                                sizes="(max-width: 768px) 120px, 150px"
                            />
                        </Link>
                        
                        {isOutOfStock && (
                            <div className="absolute inset-0 bg-black/30 backdrop-blur-[1px] flex items-center justify-center pointer-events-none z-20">
                                <span className="text-[8px] font-black text-white px-2 py-1 rounded-full uppercase tracking-wider bg-black/50">OUT OF STOCK</span>
                            </div>
                        )}

                        {discount && (
                            <div className="absolute top-1.5 left-1.5 z-20 px-1.5 py-0.5 bg-[#bef264] text-[#023324] text-[8px] font-black uppercase rounded-full shadow-sm">
                                {discount.pct}% OFF
                            </div>
                        )}

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
                            className="absolute top-1.5 right-1.5 z-20 p-1 rounded-full bg-white/80 hover:bg-white text-rose-500 shadow-sm active:scale-90 transition-all border border-slate-100/50"
                        >
                            <Heart className={cn("h-3 w-3", inWishlist ? "fill-current text-rose-500" : "text-slate-400")} />
                        </button>
                    </div>

                    {/* Product Name and Weight (Left-aligned) */}
                    <div className="flex-1 flex flex-col justify-start px-0.5 mt-1.5">
                        <Link href={`/products/${id}`} className="block">
                            <h3 className="font-extrabold text-[#1c2e24] text-[11px] uppercase tracking-tight leading-tight line-clamp-1 hover:text-emerald-700 transition-colors">
                                {name}
                            </h3>
                        </Link>
                        <span className="text-[9px] font-semibold text-slate-400 mt-0.5 block">
                            {currentWeight || "1 Unit"}
                        </span>
                        
                        {/* Price and discount */}
                        <div className="flex items-baseline gap-1.5 mt-1.5">
                            <span className="text-xs font-black text-[#1c2e24] tabular-nums">
                                ₹{finalPrice.toFixed(0)}
                            </span>
                            {discount && (
                                <span className="text-[8px] text-slate-400 line-through font-bold">
                                    ₹{currentPrice.toFixed(0)}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Add Button Action */}
                    <div className="mt-2 pt-2 border-t border-slate-100/50">
                        {activeQty === 0 ? (
                            isOutOfStock ? (
                                <span className="w-full h-8 flex items-center justify-center text-[8px] font-black text-rose-500 bg-rose-50 border border-rose-200/30 rounded-xl uppercase tracking-wide select-none">
                                    OUT OF STOCK
                                </span>
                            ) : (
                                <button
                                    onClick={(e) => { 
                                        e.stopPropagation(); 
                                        if (hasMultipleVariants) {
                                            setDrawerOpen(true);
                                        } else if (variants && variants.length === 1) {
                                            const v = variants[0];
                                            handleAdd(e, v.id, v.name, Number(v.price), v.inventory);
                                        } else {
                                            handleAdd(e);
                                        }
                                    }}
                                    className="w-full h-8 rounded-xl border border-emerald-600/20 text-[#0b5c3e] hover:bg-emerald-50 text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
                                >
                                    <Plus className="w-3.5 h-3.5 stroke-[3]" /> Add
                                </button>
                            )
                        ) : (
                            <div className="w-full h-8 flex items-center justify-between bg-[#0b5c3e] text-white rounded-xl overflow-hidden px-2 shadow-sm select-none animate-in zoom-in-95 duration-200">
                                <button onClick={(e) => handleQty(e, -1)} className="h-full w-6 flex items-center justify-center text-white/80 hover:text-white hover:bg-black/10 active:scale-75">
                                    <Minus className="h-3 w-3 stroke-[3]" />
                                </button>
                                <span className="text-xs font-black tabular-nums">{activeQty}</span>
                                <button onClick={(e) => handleQty(e, 1)} className="h-full w-6 flex items-center justify-center text-white/80 hover:text-white hover:bg-black/10 active:scale-75">
                                    <Plus className="h-3 w-3 stroke-[3]" />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
                {mounted && createPortal(drawer, document.body)}
            </>
        );
    }

    return (
        <>
            <div className={cn(
                "group relative flex flex-col h-full bg-card border border-border rounded-2xl transition-all duration-500 hover:shadow-xl hover:-translate-y-0.5 overflow-hidden",
                compact ? "w-full" : "w-full"
            )}>
                {/* 1. PHOTO */}
                <div className={cn(
                    "relative overflow-hidden bg-secondary/50 flex items-center justify-center group-hover:bg-secondary/80 transition-colors flex-shrink-0 aspect-square"
                )}>
                    <Link href={`/products/${id}`} className="w-full h-full relative flex items-center justify-center">
                        <Image
                            src={images?.[0] || ""}
                            alt={name}
                            fill
                            className={cn(
                                "object-contain p-1 transition-transform duration-700 group-hover:scale-110",
                                isOutOfStock && "opacity-30 grayscale"
                            )}
                            sizes="(max-width: 768px) 160px, 240px"
                        />
                    </Link>
                    
                    {isOutOfStock && (
                        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center pointer-events-none">
                            <span className="text-[10px] font-black text-white px-4 py-2 border border-white/20 rounded-full uppercase tracking-widest bg-black/20">OUT OF STOCK</span>
                        </div>
                    )}

                    {discount && (
                        <div className="absolute top-3 left-3 z-10 px-2 py-1 bg-[#bef264] text-[#023324] text-[9px] font-black uppercase rounded-full shadow-sm">
                            {discount.pct}% OFF
                        </div>
                    )}

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
                        className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-white/80 hover:bg-white text-rose-500 shadow-sm active:scale-90 transition-all border border-slate-100/50"
                    >
                        <Heart className={cn("h-4 w-4", inWishlist ? "fill-current text-rose-500" : "text-slate-400")} />
                    </button>
                </div>

                {/* CONTENT AREA */}
                <div className={cn(
                    "flex flex-col flex-1 gap-2",
                    compact ? "p-2" : "p-4"
                )}>
                    <div className="flex-1 flex flex-col gap-1">
                        <Link href={`/products/${id}`} className={cn(
                            "flex items-start",
                            compact ? "min-h-[1.5rem]" : "min-h-[2rem]"
                        )}>
                            <h3 className={cn(
                                "font-black text-foreground uppercase tracking-tight line-clamp-2 group-hover:text-primary transition-colors leading-tight",
                                compact ? "text-[10px]" : "text-[12px]"
                            )}>
                                {name}
                            </h3>
                        </Link>
                        
                        <div className="flex items-center gap-1 w-full">
                            <span className="text-[7px] font-black text-primary uppercase tracking-widest leading-none">
                                {currentWeight || "Premium"}
                            </span>

                            {/* Rating Stars */}
                            <div className="flex items-center gap-0.5 ml-auto">
                                <svg className="w-2.5 h-2.5 fill-current text-amber-400" viewBox="0 0 20 20">
                                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                </svg>
                                <span className="text-[8px] font-black text-slate-500">4.9</span>
                            </div>
                        </div>

                        <div className="flex items-baseline gap-1 leading-none mt-auto">
                            <span className={cn("font-black text-foreground tabular-nums tracking-tighter italic", compact ? "text-base" : "text-xl")}>₹{finalPrice.toFixed(0)}</span>
                            {discount && (
                                <span className="text-[8px] text-foreground/20 line-through font-bold">₹{currentPrice.toFixed(0)}</span>
                            )}
                        </div>
                    </div>

                    <div className="w-full relative pt-1">
                        {activeQty === 0 ? (
                            <button
                                onClick={(e) => { 
                                    e.stopPropagation(); 
                                    if (hasMultipleVariants) {
                                        setDrawerOpen(true);
                                    } else if (variants && variants.length === 1) {
                                        const v = variants[0];
                                        handleAdd(e, v.id, v.name, Number(v.price), v.inventory);
                                    } else {
                                        handleAdd(e);
                                    }
                                }}
                                className={cn(
                                    "w-full h-10 flex items-center justify-center rounded-xl text-[10px] font-black transition-all border-2",
                                    isOutOfStock
                                        ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                                        : "bg-primary text-primary-foreground border-primary hover:bg-primary/90 shadow-xl shadow-primary/10 active:scale-95 duration-500"
                                )}
                            >
                                <span className="uppercase tracking-widest leading-none">
                                    {adding ? "..." : isOutOfStock ? "OUT OF STOCK" : "ADD"}
                                </span>
                            </button>
                        ) : (
                            <div className="w-full h-10 flex items-center justify-between bg-primary rounded-xl overflow-hidden">
                                <button onClick={(e) => handleQty(e, -1)} className="h-full flex-1 flex items-center justify-center text-primary-foreground hover:bg-black/10">
                                    <Minus className="h-3.5 w-3.5" strokeWidth={5} />
                                </button>
                                <span className="flex-none text-sm font-black text-primary-foreground tabular-nums px-3">{activeQty}</span>
                                <button onClick={(e) => handleQty(e, 1)} className="h-full flex-1 flex items-center justify-center text-primary-foreground hover:bg-black/10">
                                    <Plus className="h-3.5 w-3.5" strokeWidth={5} />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {mounted && createPortal(drawer, document.body)}
        </>
    );
}
