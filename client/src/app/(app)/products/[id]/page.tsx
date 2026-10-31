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
import { ArrowLeft, ShoppingCart, Minus, Plus, Package, Info, ChevronRight, Heart, Star, Leaf } from "lucide-react";
import { cn } from "@/lib/utils";
import ReviewSection from "@/components/features/ReviewSection";
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

    return (
        <div className="mx-auto min-h-screen w-full max-w-7xl bg-white pb-32 text-[#17251e]">
            <header className="flex items-center justify-between border-b border-[#e5ebe7] px-4 py-3 sm:px-6">
                <button aria-label="Go back" onClick={() => router.back()} className="flex h-11 w-11 items-center justify-center rounded-xl hover:bg-[#f4f8f3]"><ArrowLeft className="h-5 w-5" /></button>
                <div className="flex items-center gap-2">
                    <button aria-label={inWishlist ? "Remove from wishlist" : "Save to wishlist"} aria-pressed={inWishlist} onClick={() => toggleWishlist({ productId: id, name: product.name, price: finalPrice, image: images[0] })} className="flex h-11 w-11 items-center justify-center rounded-xl hover:bg-[#f4f8f3]"><Heart className={cn("h-5 w-5", inWishlist && "fill-current text-rose-600")} /></button>
                    <Link href="/cart" aria-label="View cart" className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-[#e8f7ef] text-[#087f5b]"><ShoppingCart className="h-5 w-5" />{items.length > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#c92a2a] px-1 text-[10px] font-bold text-white">{items.reduce((a, i) => a + i.quantity, 0)}</span>}</Link>
                </div>
            </header>
            <div className="grid gap-6 px-4 py-5 sm:px-6 lg:grid-cols-2 lg:gap-12 lg:py-8">
                <section aria-label="Product gallery" className="min-w-0 lg:sticky lg:top-6 lg:self-start">
                    <div className="relative mx-auto aspect-square w-full max-w-lg overflow-hidden rounded-2xl bg-[#f8faf8]">
                        <Image src={images[selectedImage]} alt={product.name} fill className="object-contain p-6" sizes="(max-width: 1024px) 100vw, 50vw" priority />
                    </div>
                    {images.length > 1 && <div className="mt-3 flex justify-center gap-2 overflow-x-auto pb-1">{images.map((img, i) => <button key={i} aria-label={`View product image ${i + 1}`} aria-pressed={selectedImage === i} onClick={() => setSelectedImage(i)} className={cn("relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border bg-white", selectedImage === i ? "border-[#087f5b] ring-1 ring-[#087f5b]" : "border-[#e5ebe7]")}><Image src={img} alt="" fill className="object-contain p-1" sizes="56px" /></button>)}</div>}
                </section>
                <section className="min-w-0 space-y-6">
                    <div>
                        {product.category && <Link href={`/category/${product.categoryId}`} className="mb-3 inline-flex min-h-8 items-center gap-1.5 rounded-full bg-[#e8f7ef] px-3 text-xs font-semibold text-[#056647]"><Leaf aria-hidden="true" className="h-3.5 w-3.5" />{product.category.name}<ChevronRight className="h-3.5 w-3.5" /></Link>}
                        <h1 className="text-2xl font-bold leading-tight tracking-tight sm:text-3xl">{product.name}</h1>
                        {currentWeight && <p className="mt-2 text-sm text-[#64736b]">{currentWeight}</p>}
                        <div className="mt-3 flex items-center gap-2 text-sm text-[#64736b]"><Star className="h-4 w-4 fill-amber-400 text-amber-500" /><span>{avgRating ? `${avgRating} (${reviewsCount} ${reviewsCount === 1 ? 'review' : 'reviews'})` : "No reviews yet"}</span></div>
                        <div className="mt-4 flex flex-wrap items-center gap-3"><span className="text-3xl font-bold tabular-nums">₹{finalPrice.toFixed(0)}</span>{discountPct > 0 && <><span className="text-base text-[#64736b] line-through">₹{originalPrice.toFixed(0)}</span><span className="rounded-lg bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700">{discountPct}% off</span></>}</div>
                    </div>
                    <div className="border-t border-[#e5ebe7] pt-5">
                        <h2 className="mb-3 text-base font-semibold">Select quantity</h2>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                            {product.variants?.length > 0 ? product.variants.map((v: any) => <button key={v.id} aria-pressed={selectedVariantId === v.id} onClick={() => setSelectedVariantId(v.id)} className={cn("flex min-h-20 flex-col items-center justify-center gap-1 rounded-xl border px-3 py-3 text-sm", selectedVariantId === v.id ? "border-[#087f5b] bg-[#e8f7ef] ring-1 ring-[#087f5b]" : "border-[#e5ebe7] bg-white hover:border-[#087f5b]")}><span>{v.name}</span><span className="font-semibold">₹{Number(v.price).toFixed(0)}</span></button>) : <div className="rounded-xl border border-[#087f5b] bg-[#e8f7ef] p-4 text-sm"><p>{currentWeight || "1 unit"}</p><p className="mt-1 font-semibold">₹{finalPrice.toFixed(0)}</p></div>}
                        </div>
                    </div>
                    {(isOutOfStock || isLow) && <p role="status" className={cn("flex items-center gap-2 rounded-xl p-3 text-sm", isOutOfStock ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-800")}><Info className="h-4 w-4 shrink-0" />{isOutOfStock ? "Currently out of stock" : `${stock} available at the selected store`}</p>}
                    {(product.name.toLowerCase().includes('banana') || product.name.toLowerCase().includes('mango') || product.name.toLowerCase().includes('avocado') || product.tags?.includes('ripeness')) && <div className="rounded-2xl border border-[#e5ebe7] p-4"><label htmlFor="ripeness" className="text-sm font-semibold">Ripeness preference</label><div className="my-3 flex justify-between text-xs text-[#64736b]"><span>Raw</span><span>Balanced</span><span>Ripe</span></div><input id="ripeness" type="range" min="1" max="5" value={ripeness} onChange={(e) => setRipeness(parseInt(e.target.value))} className="min-h-11 w-full accent-[#087f5b]" /></div>}
                    <section className="border-t border-[#e5ebe7] pt-5"><h2 className="mb-3 text-base font-semibold">About this product</h2><p className="whitespace-pre-line text-sm leading-relaxed text-[#64736b]">{product.description || "Product information is not available yet."}</p></section>
                    {product.nutritionInfo && typeof product.nutritionInfo === 'object' && <section className="rounded-2xl border border-[#e5ebe7] p-4"><h2 className="mb-3 text-base font-semibold">Nutritional information</h2><dl className="space-y-2">{Object.entries(product.nutritionInfo as Record<string, string>).map(([key, val]) => <div key={key} className="flex justify-between gap-4 text-sm"><dt className="text-[#64736b]">{key}</dt><dd className="font-medium">{String(val)}</dd></div>)}</dl></section>}
                    <div className="flex flex-wrap gap-4 border-t border-[#e5ebe7] pt-4"><Link href="/exchange-policy" className="inline-flex min-h-11 items-center text-sm font-semibold text-[#087f5b]">Delivery & exchange policy <ChevronRight className="ml-1 h-4 w-4" /></Link><Link href="/contact" className="inline-flex min-h-11 items-center text-sm font-semibold text-[#087f5b]">Need help?</Link></div>
                </section>
            </div>
            <div className="px-4 sm:px-6"><ReviewSection productId={id} /><section className="mt-8"><h2 className="mb-4 text-xl font-bold">You may also like</h2><SimilarProducts productId={id} /></section></div>
            <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#e5ebe7] bg-white px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">
                <div className="mx-auto flex max-w-7xl items-center gap-4"><div className="min-w-0 flex-1"><p className="text-xs text-[#64736b]">{currentWeight || "Selected item"}</p><p className="text-xl font-bold">₹{finalPrice.toFixed(0)}</p></div>{qty === 0 ? <button onClick={handleAdd} disabled={isOutOfStock} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#087f5b] px-6 text-sm font-semibold text-white hover:bg-[#056647] disabled:cursor-not-allowed disabled:bg-[#e5ebe7] disabled:text-[#64736b]"><Plus className="h-4 w-4" />{isOutOfStock ? "Out of stock" : "Add to cart"}</button> : <div className="flex min-h-12 items-center rounded-xl border border-[#087f5b] bg-[#e8f7ef] text-[#056647]"><button aria-label="Decrease quantity" onClick={() => updateQuantity(id, qty - 1, selectedVariantId || undefined)} className="flex h-12 w-11 items-center justify-center"><Minus className="h-4 w-4" /></button><span aria-live="polite" className="min-w-8 text-center font-semibold">{qty}</span><button aria-label="Increase quantity" onClick={() => updateQuantity(id, qty + 1, selectedVariantId || undefined)} disabled={stock > 0 && qty >= stock} className="flex h-12 w-11 items-center justify-center disabled:opacity-40"><Plus className="h-4 w-4" /></button></div>}</div>
            </div>
        </div>
    );
}

function ProductDetailSkeleton() {
    return <div aria-label="Loading product" role="status" className="mx-auto grid max-w-7xl gap-6 bg-white px-4 py-6 lg:grid-cols-2"><Skeleton className="aspect-square rounded-2xl bg-[#e5ebe7]" /><div className="space-y-5"><Skeleton className="h-8 w-3/4 bg-[#e5ebe7]" /><Skeleton className="h-5 w-1/2 bg-[#e5ebe7]" /><Skeleton className="h-28 w-full rounded-xl bg-[#e5ebe7]" /></div></div>;
}
