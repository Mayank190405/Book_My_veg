"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { getProductById } from "@/services/productService";
import { useCartStore } from "@/store/useCartStore";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, ShoppingCart, Minus, Plus, Package, Info, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import ReviewSection from "@/components/features/ReviewSection";
import DeliveryCheck from "@/components/features/DeliveryCheck";
import SimilarProducts from "@/components/features/SimilarProducts";

function getActivePrice(product: any): { finalPrice: number; originalPrice: number; discountPct: number } {
    const basePrice = Number(product.basePrice);
    const active = product.pricing?.find((p: any) => p.isActive && p.discountValue > 0);
    if (!active) return { finalPrice: basePrice, originalPrice: basePrice, discountPct: 0 };

    if (active.discountType === "PERCENTAGE") {
        const finalPrice = basePrice - (basePrice * active.discountValue) / 100;
        return { finalPrice, originalPrice: basePrice, discountPct: Math.round(active.discountValue) };
    }
    if (active.discountType === "FLAT") {
        const finalPrice = basePrice - active.discountValue;
        return { finalPrice, originalPrice: basePrice, discountPct: Math.round((active.discountValue / basePrice) * 100) };
    }
    return { finalPrice: basePrice, originalPrice: basePrice, discountPct: 0 };
}

function getStock(product: any): { total: number; isLow: boolean } {
    if (!product.inventory?.length) return { total: 0, isLow: false };
    const total = product.inventory.reduce((acc: number, inv: any) => acc + inv.currentStock, 0);
    const isLow = product.inventory.some((inv: any) => inv.currentStock <= inv.thresholdStock && inv.currentStock > 0);
    return { total, isLow };
}

export default function ProductDetailPage() {
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;

    const { data: product, isLoading, isError } = useQuery({
        queryKey: ["product", id],
        queryFn: () => getProductById(id),
        enabled: !!id,
    });

    const { items, addItem, updateQuantity } = useCartStore();
    const [selectedImage, setSelectedImage] = useState(0);
    const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
    const [ripeness, setRipeness] = useState(3);

    // Set initial variant if available
    if (product?.variants?.length > 0 && !selectedVariantId) {
        setSelectedVariantId(product.variants[0].id);
    }

    if (isLoading) return <ProductDetailSkeleton />;
    if (isError || !product) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen gap-4 text-gray-400">
                <Package className="h-16 w-16 opacity-30" />
                <p className="text-xl font-medium">Product not found</p>
                <Link href="/products" className="text-green-600 text-sm underline">Browse all products</Link>
            </div>
        );
    }

    const selectedVariant = product.variants?.find((v: any) => v.id === selectedVariantId);

    // Dynamic data based on selection
    const currentPrice = selectedVariant ? Number(selectedVariant.price) : Number(product.basePrice);
    const currentPricing = selectedVariant?.pricing || product.pricing;
    const currentWeight = selectedVariant ? selectedVariant.name : product.weightUnit;
    const currentInventory = selectedVariant?.inventory || product.inventory;

    const cartItem = items.find((i) => i.productId === id && i.variantId === (selectedVariantId || undefined));
    const qty = cartItem?.quantity ?? 0;

    const { finalPrice, originalPrice, discountPct } = getActivePrice({ ...product, basePrice: currentPrice, pricing: currentPricing });
    const { total: stock, isLow } = getStock({ ...product, inventory: currentInventory });
    const isOutOfStock = stock === 0;

    const images: string[] = product.images?.length ? product.images : ["https://placehold.co/400x400/f3f4f6/9ca3af?text=Product"];

    const handleAdd = () => {
        if (isOutOfStock) return;
        addItem({
            productId: id,
            variantId: selectedVariantId || undefined,
            name: selectedVariant ? `${product.name} (${selectedVariant.name})` : product.name,
            price: finalPrice,
            image: images[0],
            quantity: 1,
            metadata: { ripeness: ripeness === 1 ? 'Raw' : ripeness === 5 ? 'Ripe' : 'Balanced', level: ripeness }
        });
    };

    return (
        <div className="pb-32">
            {/* Top nav */}
            <div className="sticky top-0 z-20 bg-white/60 backdrop-blur-xl border-b border-black/5 flex items-center justify-between px-4 py-3">
                <button onClick={() => router.back()} className="p-2 rounded-xl bg-white border border-black/5 shadow-sm hover:bg-gray-50 transition-colors">
                    <ArrowLeft className="h-5 w-5 text-emerald-900" />
                </button>
                <h2 className="text-xs font-black text-emerald-950 uppercase tracking-tight max-w-[200px] truncate">{product.name}</h2>
                <Link href="/checkout" className="relative p-2 rounded-xl bg-white border border-black/5 shadow-sm hover:bg-gray-50 transition-colors">
                    <ShoppingCart className="h-5 w-5 text-emerald-900" />
                    {items.length > 0 && (
                        <span className="absolute -top-1 -right-1 bg-emerald-600 text-white text-[9px] font-black rounded-full w-4 h-4 flex items-center justify-center shadow-lg shadow-emerald-200">
                            {items.reduce((a, i) => a + i.quantity, 0)}
                        </span>
                    )}
                </Link>
            </div>

            {/* Image Gallery */}
            <div className="relative bg-gray-50 overflow-hidden group">
                <div className="relative w-full aspect-square max-h-80 overflow-hidden">
                    <Image
                        src={images[selectedImage]}
                        alt={product.name}
                        fill
                        className="object-contain transition-transform duration-500 hover:scale-105"
                        sizes="100vw"
                        priority
                        onError={(e) => { (e.target as HTMLImageElement).src = "https://placehold.co/400x400/f3f4f6/9ca3af?text=Product"; }}
                    />

                    {/* Image Counter */}
                    {images.length > 1 && (
                        <div className="absolute bottom-4 right-4 bg-black/60 backdrop-blur-md text-white text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest z-10 transition-opacity group-hover:opacity-100">
                            {selectedImage + 1} / {images.length}
                        </div>
                    )}

                    {/* Discount badge */}
                    {discountPct > 0 && (
                        <div className="absolute top-3 right-3 bg-red-500 text-white text-[10px] font-black px-3 py-1.5 rounded-xl shadow-lg animate-bounce-subtle">
                            {discountPct}% OFF
                        </div>
                    )}
                </div>

                {/* Thumbnail rail (Horizontal Scroll) */}
                {images.length > 1 && (
                    <div className="flex gap-2 px-4 py-3 overflow-x-auto scrollbar-hide bg-white/40 backdrop-blur-sm border-t border-black/5">
                        {images.map((img, i) => (
                            <button
                                key={i}
                                onClick={() => setSelectedImage(i)}
                                className={cn(
                                    "relative w-14 h-14 rounded-xl overflow-hidden shrink-0 border-2 transition-all",
                                    selectedImage === i ? "border-emerald-500 shadow-lg scale-105" : "border-transparent opacity-60 hover:opacity-100"
                                )}
                            >
                                <Image src={img} alt={`View ${i + 1}`} fill className="object-cover" sizes="64px" />
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Product Info */}
            <div className="px-4 py-4 space-y-6">
                {/* Name & weight */}
                <div className="animate-fade-in">
                    <h1 className="text-2xl font-black text-emerald-950 uppercase tracking-tight leading-tight">{product.name}</h1>
                    <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[10px] font-black text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 uppercase tracking-widest">{currentWeight || "1 unit"}</span>
                        {product.countryOfOrigin && (
                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Origin: {product.countryOfOrigin}</span>
                        )}
                    </div>
                </div>

                {/* Variant Selector */}
                {product.variants?.length > 0 && (
                    <div className="space-y-3">
                        <h3 className="text-[10px] font-black text-emerald-900 uppercase tracking-widest">Select Variant</h3>
                        <div className="flex flex-wrap gap-2">
                            {product.variants.map((v: any) => (
                                <button
                                    key={v.id}
                                    onClick={() => setSelectedVariantId(v.id)}
                                    className={cn(
                                        "px-4 py-2.5 rounded-2xl text-xs font-black transition-all border-2",
                                        selectedVariantId === v.id
                                            ? "bg-emerald-600 text-white border-emerald-600 shadow-lg shadow-emerald-200"
                                            : "bg-white text-emerald-900 border-emerald-50 hover:border-emerald-200"
                                    )}
                                >
                                    {v.name}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Stock status */}
                {isOutOfStock ? (
                    <div className="inline-flex items-center gap-1.5 bg-red-500/10 text-red-600 text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl border border-red-100">
                        <Package className="h-4 w-4" /> Out of Stock
                    </div>
                ) : isLow ? (
                    <div className="inline-flex items-center gap-1.5 bg-orange-500/10 text-orange-600 text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl border border-orange-100">
                        <Info className="h-4 w-4" /> Only {stock} left
                    </div>
                ) : null}

                {/* Price */}
                <div className="flex items-baseline gap-4 py-2">
                    <span className="text-4xl font-black text-emerald-900 tracking-tighter tabular-nums">₹{finalPrice.toFixed(0)}</span>
                    {originalPrice > finalPrice && (
                        <span className="text-lg text-emerald-900/30 line-through font-bold tabular-nums">₹{originalPrice.toFixed(0)}</span>
                    )}
                    {discountPct > 0 && (
                        <span className="text-[10px] font-black text-emerald-600 bg-emerald-500/10 px-3 py-1.5 rounded-xl uppercase tracking-widest">
                            Save {discountPct}%
                        </span>
                    )}
                </div>

                {/* Picky Buyer Preference Slider */}
                {(product.category?.name?.toLowerCase().includes("fruit") || product.category?.name?.toLowerCase().includes("vegetable")) && (
                    <div className="space-y-4 bg-emerald-50/30 rounded-[2rem] p-6 border border-emerald-100/50">
                        <div className="flex items-center justify-between">
                            <h3 className="text-[10px] font-black text-emerald-900 uppercase tracking-widest">Buyer Preference</h3>
                            <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded uppercase tracking-widest">Picky Buyer</span>
                        </div>

                        <div className="space-y-6 pt-2">
                            {/* Ripeness Slider */}
                            <div className="space-y-3">
                                <div className="flex justify-between text-[9px] font-black text-emerald-900/40 uppercase tracking-widest">
                                    <span>Green / Raw</span>
                                    <span>Yellow / Ripe</span>
                                </div>
                                <input
                                    type="range"
                                    min="1"
                                    max="5"
                                    value={ripeness}
                                    onChange={(e) => setRipeness(parseInt(e.target.value))}
                                    className="w-full h-1.5 bg-emerald-100 rounded-full appearance-none cursor-pointer accent-emerald-600"
                                />
                                <p className="text-[9px] text-center text-emerald-900/60 font-bold italic">
                                    {ripeness === 3 ? `"I prefer my ${product.name} perfectly balanced"` :
                                        ripeness < 3 ? `"I want them fresh & raw (stays longer)"` :
                                            `"I want them ripe & ready to eat"`}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Delivery Check */}
                <div className="bg-white/40 backdrop-blur-md rounded-2xl p-4 border border-white/60 shadow-sm">
                    <DeliveryCheck />
                </div>

                {/* Details Sections */}
                <div className="space-y-3">
                    {product.description && (
                        <div className="bg-white/40 backdrop-blur-md rounded-[2rem] p-6 space-y-3 border border-white/60 shadow-sm">
                            <h3 className="text-[10px] font-black text-emerald-900 uppercase tracking-[0.2em] flex items-center gap-2">
                                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" /> About Product
                            </h3>
                            <p className="text-sm font-medium text-emerald-950/70 leading-relaxed font-sans">{product.description}</p>
                        </div>
                    )}

                    {/* Specifications Grid */}
                    {(product.shelfLife || product.fssaiLicense || product.packagedDate) && (
                        <div className="bg-white/40 backdrop-blur-md rounded-[2rem] p-6 border border-white/60 shadow-sm grid grid-cols-2 gap-4">
                            {product.shelfLife && (
                                <div>
                                    <p className="text-[9px] font-black text-emerald-900/30 uppercase tracking-widest">Shelf Life</p>
                                    <p className="text-xs font-black text-emerald-950 uppercase mt-1">{product.shelfLife}</p>
                                </div>
                            )}
                            {product.fssaiLicense && (
                                <div>
                                    <p className="text-[9px] font-black text-emerald-900/30 uppercase tracking-widest">FSSAI License</p>
                                    <p className="text-xs font-black text-emerald-950 uppercase mt-1">{product.fssaiLicense}</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Nutrition Info */}
                    {product.nutritionInfo && typeof product.nutritionInfo === 'object' && (
                        <div className="bg-white/40 backdrop-blur-md rounded-[2rem] p-6 border border-white/60 shadow-sm">
                            <h3 className="text-[10px] font-black text-emerald-900 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" /> Nutrition (per 100g)
                            </h3>
                            <div className="space-y-2">
                                {Object.entries(product.nutritionInfo as Record<string, string>).map(([key, val]) => (
                                    <div key={key} className="flex justify-between items-center border-b border-black/5 pb-2">
                                        <span className="text-[10px] font-bold text-emerald-950/40 uppercase tracking-widest">{key}</span>
                                        <span className="text-xs font-black text-emerald-950 uppercase">{val}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Category breadcrumb */}
                {product.category && (
                    <Link
                        href={`/category/${product.categoryId}`}
                        className="flex items-center justify-between bg-white/40 backdrop-blur-md rounded-2xl px-5 py-4 border border-white/60 shadow-sm group hover:bg-white/60 transition-colors"
                    >
                        <div className="flex items-center gap-3">
                            <span className="text-[10px] font-black text-emerald-950/40 uppercase tracking-widest">Category</span>
                            <span className="text-[10px] font-black text-emerald-900 uppercase tracking-widest">{product.category.name}</span>
                        </div>
                        <ChevronRight className="h-4 w-4 text-emerald-400 group-hover:translate-x-1 transition-transform" />
                    </Link>
                )}

                {/* Reviews */}
                <div className="bg-white/40 backdrop-blur-md rounded-[2rem] border border-white/60 overflow-hidden shadow-sm">
                    <ReviewSection productId={id} />
                </div>

                {/* Similar Products */}
                <div className="pt-4">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="h-px flex-1 bg-emerald-900/10" />
                        <h3 className="text-[10px] font-black text-emerald-950/40 uppercase tracking-[0.3em]">Similar Suggestions</h3>
                        <div className="h-px flex-1 bg-emerald-900/10" />
                    </div>
                    <SimilarProducts productId={id} />
                </div>
            </div>

            {/* Sticky bottom bar: Add / Stepper */}
            <div className="fixed bottom-20 left-4 right-4 bg-white/60 backdrop-blur-2xl border border-white rounded-[2.5rem] px-6 py-4 shadow-[0_20px_50px_rgba(0,40,20,0.15)] z-30 flex items-center gap-4 animate-slide-up">
                <div className="flex-1">
                    <p className="text-[10px] text-emerald-900/40 font-black uppercase tracking-widest">Total Price</p>
                    <p className="text-2xl font-black text-emerald-900 tracking-tighter tabular-nums">
                        ₹{(finalPrice * (qty || 1)).toFixed(0)}
                    </p>
                </div>

                {qty === 0 ? (
                    <button
                        onClick={handleAdd}
                        disabled={isOutOfStock}
                        className={cn(
                            "flex-[1.5] py-4 rounded-2xl text-[13px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 shadow-xl",
                            isOutOfStock
                                ? "bg-white/50 text-emerald-950/20 border border-black/5 cursor-not-allowed"
                                : "bg-emerald-600 text-white shadow-emerald-200/50 hover:bg-emerald-700"
                        )}
                    >
                        <Plus className="h-4 w-4" strokeWidth={4} />
                        {isOutOfStock ? "Sold Out" : "Add to Cart"}
                    </button>
                ) : (
                    <div className="flex-[1.5] flex items-center gap-2">
                        <div className="flex-1 flex items-center justify-between bg-emerald-600 rounded-2xl overflow-hidden shadow-xl shadow-emerald-200/50 p-1">
                            <button
                                onClick={() => updateQuantity(id, qty - 1, selectedVariantId || undefined)}
                                className="w-10 h-10 flex items-center justify-center text-white hover:bg-white/10 transition-colors"
                            >
                                <Minus className="h-4 w-4" strokeWidth={4} />
                            </button>
                            <span className="flex-none text-base font-black text-white tabular-nums">{qty}</span>
                            <button
                                onClick={() => updateQuantity(id, qty + 1, selectedVariantId || undefined)}
                                disabled={stock > 0 && qty >= stock}
                                className="w-10 h-10 flex items-center justify-center text-white hover:bg-white/10 transition-colors disabled:opacity-40"
                            >
                                <Plus className="h-4 w-4" strokeWidth={4} />
                            </button>
                        </div>
                        <Link
                            href="/checkout"
                            className="bg-emerald-950 text-white p-4 rounded-2xl hover:bg-black transition-colors shadow-xl shadow-black/10"
                        >
                            <ChevronRight className="h-5 w-5" strokeWidth={3} />
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
}

function ProductDetailSkeleton() {
    return (
        <div className="min-h-screen bg-white pb-24">
            <div className="flex items-center justify-between px-4 py-3 border-b">
                <Skeleton className="w-8 h-8 rounded-full" />
                <Skeleton className="w-40 h-5" />
                <Skeleton className="w-8 h-8 rounded-full" />
            </div>
            <Skeleton className="w-full aspect-square max-h-80" />
            <div className="px-4 py-4 space-y-4">
                <Skeleton className="w-3/4 h-7" />
                <Skeleton className="w-24 h-4" />
                <Skeleton className="w-32 h-10" />
                <Skeleton className="w-full h-24 rounded-2xl" />
            </div>
        </div>
    );
}
