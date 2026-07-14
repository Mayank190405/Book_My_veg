"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { getProductById } from "@/services/productService";
import { useCartStore } from "@/store/useCartStore";
import { useUserStore } from "@/store/useUserStore";
import { useWishlistStore } from "@/store/useWishlistStore";
import { Skeleton } from "@/components/ui/skeleton";
import {
    ArrowLeft, ShoppingCart, Minus, Plus, Package, Info, ChevronRight,
    Sparkles, Hourglass, Shield, Globe, Calendar, Flame, Activity, Heart,
    Check, Star, ChevronDown, ChevronUp, MapPin, Leaf
} from "lucide-react";
import { cn } from "@/lib/utils";
import ReviewSection from "@/components/features/ReviewSection";
import DeliveryCheck from "@/components/features/DeliveryCheck";
import SimilarProducts from "@/components/features/SimilarProducts";
import api from "@/services/api";

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

function getStock(product: any, activeStoreId?: string): { total: number; isLow: boolean } {
    const allInventory = [...(product.inventory ?? [])];
    if (product.variants) {
        product.variants.forEach((v: any) => {
            if (v.inventory) allInventory.push(...v.inventory);
        });
    }

    if (!allInventory.length) return { total: 0, isLow: false };

    let relevantInventory = allInventory;
    if (activeStoreId) {
        relevantInventory = allInventory.filter((inv: any) => inv.locationId === activeStoreId);
    }

    if (relevantInventory.length === 0) return { total: 0, isLow: false };

    const total = relevantInventory.reduce((acc: number, inv: any) => acc + Number(inv.currentStock), 0);
    const isLow = relevantInventory.some((inv: any) =>
        Number(inv.currentStock) <= Number(inv.thresholdStock) && Number(inv.currentStock) > 0
    );

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

    const { data: reviewsData } = useQuery({
        queryKey: ["reviews", id],
        queryFn: async () => {
            const res = await api.get(`/reviews/product/${id}`);
            return res.data;
        },
        enabled: !!id,
    });

    const { items, addItem, updateQuantity } = useCartStore();
    const { activeStore } = useUserStore();
    const [selectedImage, setSelectedImage] = useState(0);
    const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
    const [ripeness, setRipeness] = useState(3);
    const [accordionOpen, setAccordionOpen] = useState({
        details: true,
        nutrition: false,
        delivery: false
    });

    const toggleWishlist = useWishlistStore((state) => state.toggleWishlist);
    const inWishlist = useWishlistStore((state) => state.items.some((i) => i.productId === id));

    // Set initial variant if available
    useEffect(() => {
        if (product?.variants?.length > 0 && !selectedVariantId) {
            setSelectedVariantId(product.variants[0].id);
        }
    }, [product, selectedVariantId]);

    if (isLoading) return <ProductDetailSkeleton />;
    if (isError || !product) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen gap-4 text-slate-455">
                <Package className="h-16 w-16 opacity-35" />
                <p className="text-xl font-black uppercase tracking-wider text-slate-800">Product not found</p>
                <Link href="/" className="text-[#0B7A53] text-xs font-black uppercase tracking-widest underline">Browse Store</Link>
            </div>
        );
    }

    const selectedVariant = product.variants?.find((v: any) => v.id === selectedVariantId);

    const currentPrice = selectedVariant ? Number(selectedVariant.price) : Number(product.basePrice);
    const currentPricing = selectedVariant?.pricing || product.pricing;
    const currentWeight = selectedVariant
        ? selectedVariant.name
        : (product.weight ? `${product.weight} ${product.weightUnit || ''}` : product.weightUnit);

    const cartItem = items.find((i) => i.productId === id && i.variantId === (selectedVariantId || undefined));
    const qty = cartItem?.quantity ?? 0;

    const { finalPrice, originalPrice, discountPct } = getActivePrice({ ...product, basePrice: currentPrice, pricing: currentPricing });
    const { total: stock, isLow } = getStock(product, activeStore?.id);
    const isOutOfStock = stock === 0;

    const images: string[] = product.images?.length ? product.images : ["https://placehold.co/400x400/f3f4f6/9ca3af?text=Product"];

    const reviewsList = reviewsData?.reviews || [];
    const reviewsCount = reviewsList.length;
    const avgRating = reviewsCount > 0
        ? (reviewsList.reduce((acc: number, r: any) => acc + r.rating, 0) / reviewsCount).toFixed(1)
        : null;

    const handleAdd = () => {
        if (isOutOfStock) return;
        addItem({
            productId: id,
            variantId: selectedVariantId || undefined,
            name: selectedVariant
                ? `${product.name} (${selectedVariant.name})`
                : (product.weight ? `${product.name} (${product.weight} ${product.weightUnit || ''})` : product.name),
            price: finalPrice,
            image: images[0],
            quantity: 1,
            metadata: { ripeness: ripeness === 1 ? 'Raw' : ripeness === 5 ? 'Ripe' : 'Balanced', level: ripeness }
        });

        import("sonner").then(({ toast }) => {
            toast.success(`${product.name} added to cart`, {
                description: "Freshly added to your basket",
                duration: 2000
            });
        });
    };

    const toggleAccordion = (section: 'details' | 'nutrition' | 'delivery') => {
        setAccordionOpen(prev => ({
            ...prev,
            [section]: !prev[section]
        }));
    };

    return (
        <div className="min-h-screen bg-white pb-48 selection:bg-emerald-500/20">

            {/* Top rounded green dome wrapper container matching exact mockup Screen 1 */}
            <div className="w-full bg-gradient-to-b from-[#e8f6f0] to-[#f4faf7] rounded-b-[3.5rem] pb-8 pt-12 relative overflow-hidden shadow-sm max-w-xl mx-auto">

                {/* Top buttons inside dome container */}
                <div className="px-6 flex items-center justify-between relative z-40 mb-2">
                    <button
                        onClick={() => router.back()}
                        className="w-12 h-12 rounded-full bg-white border border-slate-100 flex items-center justify-center text-slate-500 hover:text-[#0B7A53] shadow-sm active:scale-95 shrink-0"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </button>
                    <div className="relative shrink-0">
                        <button
                            onClick={() => router.push('/cart')}
                            className="w-12 h-12 rounded-full bg-white border border-slate-100 flex items-center justify-center text-slate-500 hover:text-[#0B7A53] shadow-sm active:scale-95"
                        >
                            <ShoppingCart className="h-5 w-5" />
                            {items.length > 0 && (
                                <span className="absolute -top-1 -right-1 bg-[#0B7A53] text-white text-[9px] font-black rounded-full h-5 min-w-[1.25rem] px-1.5 flex items-center justify-center border-2 border-white shadow-md">
                                    {items.reduce((a, i) => a + i.quantity, 0)}
                                </span>
                            )}
                        </button>
                    </div>
                </div>

                {/* Wishlist Heart & Share triggers floating inside dome */}
                <div className="absolute right-6 top-28 flex flex-col gap-3.5 z-30">
                    <button
                        onClick={() => toggleWishlist({
                            productId: id,
                            name: product.name,
                            price: finalPrice,
                            image: images[0]
                        })}
                        className="w-10 h-10 rounded-full bg-white border border-slate-100 flex items-center justify-center text-slate-500 hover:text-rose-500 shadow-sm active:scale-90 transition-all"
                    >
                        <Heart className={cn("h-4.5 w-4.5", inWishlist ? "fill-current text-rose-500" : "text-slate-400")} />
                    </button>
                    <button
                        onClick={() => {
                            if (navigator.share) {
                                navigator.share({ title: product.name, url: window.location.href });
                            }
                        }}
                        className="w-10 h-10 rounded-full bg-white border border-slate-100 flex items-center justify-center text-slate-400 hover:text-[#0B7A53] shadow-sm active:scale-90 transition-all"
                    >
                        <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                            <polyline points="16 6 12 2 8 6" />
                            <line x1="12" y1="2" x2="12" y2="15" />
                        </svg>
                    </button>
                </div>

                {/* Main Centered Product Image */}
                <div className="relative w-full aspect-square max-h-[380px] p-0 max-w-md mx-auto transition-transform duration-500 group-hover:scale-103 mt-4">
                    <Image
                        src={images[selectedImage]}
                        alt={product.name}
                        fill
                        className="object-contain"
                        sizes="(max-width: 768px) 100vw, 440px"
                        priority
                    />
                </div>

                {/* Multi-images switcher */}
                {images.length > 1 && (
                    <div className="flex gap-2 mt-4 justify-center relative z-10">
                        {images.map((img, i) => (
                            <button
                                key={i}
                                onClick={() => setSelectedImage(i)}
                                className={cn(
                                    "w-11 h-11 rounded-xl bg-white border p-1 relative overflow-hidden transition-all duration-300 active:scale-95 shadow-sm",
                                    selectedImage === i ? "border-[#0B7A53] scale-105" : "border-slate-200"
                                )}
                            >
                                <Image
                                    src={img}
                                    alt="thumbnail"
                                    fill
                                    className="object-contain p-0.5"
                                />
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Scrollable details on white background matching Screen 1 & 2 */}
            <div className="max-w-xl mx-auto px-6 pt-6 space-y-6">

                {/* 1. Category Badge */}
                <div className="text-left">
                    <span className="text-[10px] font-black text-[#0B7A53] bg-[#edfcf6] border border-[#c8f7e3] rounded-full px-4.5 py-1.5 inline-flex items-center gap-1.5 uppercase tracking-wider">
                        <Leaf className="h-3.5 w-3.5 fill-current" />
                        {product.category?.name || "Vegetable"}
                    </span>
                </div>

                {/* 2. Product Name Title */}
                <h1 className="text-4xl font-extrabold text-[#0c2018] tracking-tight leading-none text-left">
                    {product.name}
                </h1>

                {/* 3. Harvest Status & Ratings row (stacked vertically) */}
                <div className="space-y-1.5 text-left">
                    <div className="flex items-center gap-1.5 text-[11px] font-black text-[#0B7A53] uppercase tracking-wider">
                        <span>PREMIUM HARVEST</span>
                        <div className="w-4.5 h-4.5 bg-[#0B7A53] text-white rounded-full flex items-center justify-center p-0.5">
                            <Check className="h-3 w-3 stroke-[3.5]" />
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11.5px] font-black text-slate-500 uppercase tracking-wider">
                        <Star className="h-4.5 w-4.5 fill-amber-400 text-amber-400" />
                        <span>
                            {avgRating
                                ? `${avgRating} (${reviewsCount} ${reviewsCount === 1 ? 'REVIEW' : 'REVIEWS'})`
                                : "No reviews yet"}
                        </span>
                    </div>
                </div>

                {/* 4. Variant Selector Card */}
                <div className="space-y-3 text-left">
                    <h3 className="text-[11.5px] font-black text-slate-800 uppercase tracking-widest">
                        Select Package Size
                    </h3>
                    <div className="flex flex-col gap-3">
                        {product.variants?.length > 0 ? (
                            product.variants.map((v: any) => {
                                const active = selectedVariantId === v.id;
                                return (
                                    <button
                                        key={v.id}
                                        onClick={() => setSelectedVariantId(v.id)}
                                        className={cn(
                                            "w-full flex items-center justify-between px-6 h-14 rounded-2xl border-2 transition-all duration-300 active:scale-[0.99] bg-white",
                                            active
                                                ? "border-[#0B7A53] bg-emerald-50/5 shadow-sm"
                                                : "border-slate-200 hover:border-slate-350"
                                        )}
                                    >
                                        <span className={cn("text-xs font-black uppercase tracking-wide", active ? "text-[#0B7A53]" : "text-slate-800")}>
                                            {v.name}
                                        </span>
                                        <span className="text-xs font-black text-slate-900">₹{Number(v.price).toFixed(0)}</span>
                                    </button>
                                );
                            })
                        ) : (
                            <div className="w-full flex items-center justify-between px-6 h-14 rounded-2xl border-2 border-[#0B7A53] bg-[#edfcf6]/20 shadow-sm">
                                <span className="text-xs font-black text-[#0B7A53] uppercase tracking-wide">
                                    {currentWeight || "1 Unit"}
                                </span>
                                <span className="text-xs font-black text-slate-900">
                                    ₹{finalPrice.toFixed(0)}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* 5. Low Stock Warning Box */}
                {isOutOfStock ? (
                    <div className="flex items-center gap-2.5 bg-rose-50 border border-rose-100 text-rose-600 text-[10px] font-black uppercase tracking-wider px-5 py-3.5 rounded-2xl shadow-sm">
                        <Info className="h-4.5 w-4.5 shrink-0" />
                        Out of Stock - Reserving next harvest slot
                    </div>
                ) : isLow || (stock > 0 && stock <= 10) ? (
                    <div className="flex items-center gap-2.5 bg-[#fff8eb] border border-[#ffe8cc] text-[#e65c00] text-[10px] font-black uppercase tracking-wider px-5 py-3.5 rounded-2xl shadow-sm">
                        <Info className="h-4.5 w-4.5 shrink-0" />
                        Only {stock || 5} left – High demand item!
                    </div>
                ) : null}

                {/* 6. Selling Price Card */}
                <div className="bg-white border border-slate-150/40 rounded-[2rem] p-5 flex items-center justify-between shadow-sm">
                    <div className="flex flex-col text-left">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Selling Price</span>
                        <span className="text-3.5xl font-black text-slate-900">
                            ₹{finalPrice.toFixed(0)}
                        </span>
                    </div>
                    <span className="text-[9.5px] font-bold text-[#0B7A53] bg-[#edfcf6] px-3.5 py-1.5 rounded-full uppercase tracking-wider">
                        Inclusive of all taxes
                    </span>
                </div>

                {/* Inline Add to Cart / Quantity controls */}
                <div className="w-full">
                    {qty === 0 ? (
                        <button
                            onClick={handleAdd}
                            disabled={isOutOfStock}
                            className={cn(
                                "w-full py-5 rounded-[2rem] text-sm font-black uppercase tracking-wider flex items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-md border-2",
                                isOutOfStock
                                    ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                                    : "bg-[#0B7A53] text-white border-[#0B7A53] hover:bg-[#096645] hover:border-[#096645]"
                            )}
                        >
                            <Plus className="h-4.5 w-4.5" strokeWidth={4} />
                            {isOutOfStock ? "Out of Stock" : "Add to Cart"}
                        </button>
                    ) : (
                        <div className="w-full flex items-center justify-between bg-[#edfcf6] border border-[#c8f7e3] rounded-[2rem] p-2.5 shadow-sm">
                            <button
                                onClick={() => updateQuantity(id, qty - 1, selectedVariantId || undefined)}
                                className="w-12 h-12 flex items-center justify-center bg-white text-[#0B7A53] hover:bg-emerald-50 active:scale-95 transition-all rounded-full shadow-sm"
                            >
                                <Minus className="h-4.5 w-4.5" strokeWidth={4} />
                            </button>
                            <div className="flex flex-col items-center">
                                <span className="text-lg font-black text-[#0B7A53] leading-none">{qty}</span>
                                <span className="text-[8px] font-bold text-[#0B7A53]/70 uppercase tracking-wider mt-0.5">In Cart</span>
                            </div>
                            <button
                                onClick={() => updateQuantity(id, qty + 1, selectedVariantId || undefined)}
                                disabled={stock > 0 && qty >= stock}
                                className="w-12 h-12 flex items-center justify-center bg-white text-[#0B7A53] hover:bg-emerald-50 active:scale-95 transition-all rounded-full shadow-sm disabled:opacity-40"
                            >
                                <Plus className="h-4.5 w-4.5" strokeWidth={4} />
                            </button>
                        </div>
                    )}
                </div>

                {/* 7. Buyer Preference Slider */}
                {(product.category?.name?.toLowerCase().includes("fruit") || product.category?.name?.toLowerCase().includes("vegetable")) && (
                    <div className="space-y-4 bg-emerald-50/40 rounded-[2rem] p-6 border border-emerald-500/5 shadow-inner">
                        <div className="flex items-center justify-between">
                            <h3 className="text-[10px] font-black text-[#0B7A53] uppercase tracking-widest">
                                Buyer Preference
                            </h3>
                            <span className="text-[9px] font-black text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full uppercase tracking-wider shadow-sm">
                                Picky Buyer Option
                            </span>
                        </div>

                        <div className="space-y-5 pt-2">
                            <div className="flex justify-between text-[9px] font-black text-[#0B7A53] uppercase tracking-widest">
                                <span>Green / Raw</span>
                                <span>Yellow / Ripe</span>
                            </div>
                            <input
                                type="range"
                                min="1"
                                max="5"
                                value={ripeness}
                                onChange={(e) => setRipeness(parseInt(e.target.value))}
                                className="w-full h-1.5 bg-emerald-200/60 rounded-full appearance-none cursor-pointer accent-[#0B7A53]"
                            />
                            <p className="text-[10px] text-center text-[#0B7A53]/80 font-bold italic tracking-tight">
                                {ripeness === 3 ? `Perfectly balanced & ready for general recipes` :
                                    ripeness < 3 ? `Fresh & raw (lasts longer in refrigerator storage)` :
                                        `Sweet, ripe & ready for immediate consumption`}
                            </p>
                        </div>
                    </div>
                )}

                {/* 8. Pincode Availability Checker */}
                <div className="bg-white border border-slate-150/40 rounded-[2rem] p-6 shadow-sm">
                    <DeliveryCheck />
                </div>

                {/* 9. Category Selection Row */}
                {product.category && (
                    <Link
                        href={`/category/${product.categoryId}`}
                        className="flex items-center justify-between bg-white border border-slate-100 rounded-2xl px-6 py-5 shadow-sm group hover:border-[#0B7A53]/25 transition-all"
                    >
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Category</span>
                        <span className="text-[11px] font-black text-[#0B7A53] uppercase tracking-widest italic flex items-center gap-1">
                            {product.category.name}
                            <ChevronRight className="h-4 w-4 text-slate-450 group-hover:translate-x-0.5 transition-all" />
                        </span>
                    </Link>
                )}

                {/* 10. Specifications Accordions (Details, Nutrition, Delivery & Returns) */}
                <div className="space-y-3 bg-white border border-slate-100 rounded-[2.25rem] p-5 shadow-sm">

                    {/* Accordion 1: Product Details */}
                    <div className="border-b border-slate-100/70 pb-3">
                        <button
                            onClick={() => toggleAccordion('details')}
                            className="w-full flex items-center justify-between py-3 px-1 text-left outline-none"
                        >
                            <span className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                                <Package className="h-4.5 w-4.5 text-[#0B7A53]" />
                                Product Details
                            </span>
                            {accordionOpen.details ? <ChevronUp className="h-4.5 w-4.5 text-slate-455" /> : <ChevronDown className="h-4.5 w-4.5 text-slate-455" />}
                        </button>
                        {accordionOpen.details && (
                            <div className="pt-2 pb-4 px-2 space-y-4 text-left text-xs font-medium text-slate-500 leading-relaxed animate-in fade-in duration-300">
                                {product.description && (
                                    <p className="italic text-slate-600">
                                        {product.description}
                                    </p>
                                )}
                                <ul className="space-y-2.5">
                                    <li className="flex items-center gap-2.5">
                                        <span className="w-5 h-5 rounded-full bg-emerald-50 text-[#0B7A53] flex items-center justify-center text-[10px] font-bold">✓</span>
                                        <span>100% Natural & Fresh from Farms</span>
                                    </li>
                                    <li className="flex items-center gap-2.5">
                                        <span className="w-5 h-5 rounded-full bg-emerald-50 text-[#0B7A53] flex items-center justify-center text-[10px] font-bold">✓</span>
                                        <span>Strict Quality check & handpicked sorting</span>
                                    </li>
                                    <li className="flex items-center gap-2.5">
                                        <span className="w-5 h-5 rounded-full bg-emerald-50 text-[#0B7A53] flex items-center justify-center text-[10px] font-bold">✓</span>
                                        <span>Good Source of Fiber & essential nutrients</span>
                                    </li>
                                    <li className="flex items-center gap-2.5">
                                        <span className="w-5 h-5 rounded-full bg-emerald-50 text-[#0B7A53] flex items-center justify-center text-[10px] font-bold">✓</span>
                                        <span>Store in a cool, dry place</span>
                                    </li>
                                </ul>
                            </div>
                        )}
                    </div>

                    {/* Accordion 2: Nutritional Info */}
                    <div className="border-b border-slate-100/70 pb-3">
                        <button
                            onClick={() => toggleAccordion('nutrition')}
                            className="w-full flex items-center justify-between py-3 px-1 text-left outline-none"
                        >
                            <span className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                                <Activity className="h-4.5 w-4.5 text-[#0B7A53]" />
                                Nutritional Info
                            </span>
                            {accordionOpen.nutrition ? <ChevronUp className="h-4.5 w-4.5 text-slate-455" /> : <ChevronDown className="h-4.5 w-4.5 text-slate-455" />}
                        </button>
                        {accordionOpen.nutrition && (
                            <div className="pt-2 pb-4 px-2 space-y-4 text-left animate-in fade-in duration-300">
                                {product.nutritionInfo && typeof product.nutritionInfo === 'object' ? (
                                    <div className="space-y-4">
                                        {Object.entries(product.nutritionInfo as Record<string, string>).map(([key, val]) => {
                                            const numMatch = val.match(/[\d.]+/);
                                            const num = numMatch ? parseFloat(numMatch[0]) : 0;
                                            const limit = key.toLowerCase().includes("energy") || key.toLowerCase().includes("calorie") ? 350 : 50;
                                            const pct = Math.min((num / limit) * 100, 100);

                                            return (
                                                <div key={key} className="space-y-1">
                                                    <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider">
                                                        <span className="text-slate-455">{key}</span>
                                                        <span className="text-[#0B7A53]">{val}</span>
                                                    </div>
                                                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden shadow-inner">
                                                        <div
                                                            className="bg-[#0B7A53] h-full rounded-full transition-all duration-500"
                                                            style={{ width: `${pct}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider text-center">
                                        Standard dietary values apply
                                    </p>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Accordion 3: Delivery & Returns */}
                    <div>
                        <button
                            onClick={() => toggleAccordion('delivery')}
                            className="w-full flex items-center justify-between py-3 px-1 text-left outline-none"
                        >
                            <span className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                                <Globe className="h-4.5 w-4.5 text-[#0B7A53]" />
                                Delivery & Returns
                            </span>
                            {accordionOpen.delivery ? <ChevronUp className="h-4.5 w-4.5 text-slate-455" /> : <ChevronDown className="h-4.5 w-4.5 text-slate-455" />}
                        </button>
                        {accordionOpen.delivery && (
                            <div className="pt-2 pb-2 px-2 space-y-4 text-left text-xs font-medium text-slate-500 animate-in fade-in duration-300">
                                <div className="space-y-3.5">
                                    <div className="flex items-start gap-3">
                                        <span className="text-lg">🎁</span>
                                        <div className="space-y-0.5">
                                            <p className="font-extrabold text-slate-800 uppercase tracking-wide text-[10px]">Free Shipping</p>
                                            <p className="leading-relaxed">Enjoy zero delivery fees on all orders placed above ₹249.</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <span className="text-lg">🔄</span>
                                        <div className="space-y-0.5">
                                            <p className="font-extrabold text-slate-800 uppercase tracking-wide text-[10px]">EXCHANGE ONLY POLICY (WITHIN 12 HRS)</p>
                                            <p className="leading-relaxed">Due to the perishable nature of fresh vegetables and fruits, all items are non-refundable. However, we offer a 12-hour exchange policy, no questions asked, if you receive any damaged or unsatisfactory produce.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* 11. Verified Stories & Reviews list */}
                <div className="bg-white border border-slate-150/40 rounded-[2rem] overflow-hidden shadow-sm">
                    <ReviewSection productId={id} />
                </div>

                {/* 12. "You may also like" Banner */}
                <div className="bg-[#edfcf6] rounded-[2.25rem] p-6 border border-emerald-500/5 flex items-center justify-between overflow-hidden shadow-sm relative">
                    <div className="space-y-1 text-left relative z-10">
                        <h4 className="text-xs font-black text-[#0B7A53] uppercase tracking-[0.2em]">
                            You may also like
                        </h4>
                        <p className="text-[10px] font-bold text-slate-500 leading-tight">
                            Explore more fresh items handpicked for you
                        </p>
                    </div>
                    <div className="text-3xl filter drop-shadow-md select-none shrink-0 relative z-10 pr-2">
                        🧺
                    </div>
                    <div className="absolute right-0 bottom-0 top-0 w-24 bg-gradient-to-l from-emerald-200/25 to-transparent pointer-events-none" />
                </div>

                {/* 13. Similar suggestions products list grid */}
                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="h-px flex-1 bg-slate-150/50" />
                        <h3 className="text-[10.5px] font-black text-slate-400 uppercase tracking-[0.25em] shrink-0">
                            Similar Products
                        </h3>
                        <div className="h-px flex-1 bg-slate-150/50" />
                    </div>
                    <SimilarProducts productId={id} />
                </div>
            </div>

            {/* Sticky bottom Add/Cart controls bar */}
            <div className="fixed bottom-[7.5rem] left-6 right-6 bg-white/90 backdrop-blur-md border border-slate-150/30 rounded-[2.25rem] p-3.5 shadow-xl z-40 flex items-center gap-3 animate-slide-up max-w-xl mx-auto">
                {qty === 0 ? (
                    <button
                        onClick={handleAdd}
                        disabled={isOutOfStock}
                        className={cn(
                            "flex-1 py-5 rounded-3xl text-sm font-black uppercase tracking-wider flex items-center justify-center gap-3 transition-all active:scale-95 shadow-lg",
                            isOutOfStock
                                ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                                : "bg-[#0B7A53] text-white shadow-emerald-950/20 hover:bg-[#096645]"
                        )}
                    >
                        <Plus className="h-4.5 w-4.5" strokeWidth={4} />
                        {isOutOfStock ? "Out of Stock" : "Add to Cart"}
                    </button>
                ) : (
                    <div className="flex-1 flex items-center gap-2">
                        <div className="flex-1 flex items-center justify-between bg-[#0B7A53] rounded-3xl overflow-hidden shadow-md p-2 border border-emerald-600">
                            <button
                                onClick={() => updateQuantity(id, qty - 1, selectedVariantId || undefined)}
                                className="w-12 h-12 flex items-center justify-center text-white hover:bg-black/10 active:bg-black/20 transition-all rounded-full"
                            >
                                <Minus className="h-4.5 w-4.5" strokeWidth={4} />
                            </button>
                            <div className="flex flex-col items-center">
                                <span className="text-lg font-black text-white leading-none">{qty}</span>
                                <span className="text-[8px] font-bold text-white/70 uppercase tracking-wider">In Cart</span>
                            </div>
                            <button
                                onClick={() => updateQuantity(id, qty + 1, selectedVariantId || undefined)}
                                disabled={stock > 0 && qty >= stock}
                                className="w-12 h-12 flex items-center justify-center text-white hover:bg-black/10 active:bg-black/20 transition-all rounded-full disabled:opacity-40"
                            >
                                <Plus className="h-4.5 w-4.5" strokeWidth={4} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function ProductDetailSkeleton() {
    return (
        <div className="min-h-screen bg-[#fafcfb] pb-24">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 max-w-xl mx-auto">
                <Skeleton className="w-10 h-10 rounded-full" />
                <Skeleton className="w-10 h-10 rounded-full" />
            </div>
            <div className="max-w-xl mx-auto px-6 space-y-6">
                <Skeleton className="w-full aspect-square max-h-[340px] rounded-[2.5rem]" />
                <Skeleton className="w-3/4 h-8" />
                <Skeleton className="w-1/2 h-5" />
                <Skeleton className="w-full h-24 rounded-2xl" />
            </div>
        </div>
    );
}
