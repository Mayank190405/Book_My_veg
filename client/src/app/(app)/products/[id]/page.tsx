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
    ArrowLeft,
    Search,
    ShoppingCart,
    UserRound,
    Heart,
    Share2,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    ChevronUp,
    Star,
    Leaf,
    Sparkles,
    Package,
    Plus,
    Minus,
    Info
} from "lucide-react";
import SimilarProducts from "@/components/features/SimilarProducts";
import api from "@/services/api";
import { toast } from "sonner";

function getActivePrice(product: any): { finalPrice: number; originalPrice: number; discountPct: number } {
    const basePrice = Number(product.basePrice || 0);
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

    const { items, addItem, updateQuantity, totalItems } = useCartStore();
    const { user, _hasHydrated, activeStore } = useUserStore();
    const toggleWishlist = useWishlistStore((state) => state.toggleWishlist);
    const inWishlist = useWishlistStore((state) => state.items.some((i) => i.productId === id));

    const [selectedImage, setSelectedImage] = useState(0);
    const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
    const [infoOpen, setInfoOpen] = useState(true);
        const [nutritionOpen, setNutritionOpen] = useState(false);

    useEffect(() => {
        if (product?.variants?.length > 0 && !selectedVariantId) {
            setSelectedVariantId(product.variants[0].id);
        }
    }, [product, selectedVariantId]);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-white pb-24">
                <div className="h-14 bg-[#006c45] animate-pulse" />
                <div className="p-4 space-y-4 max-w-3xl mx-auto">
                    <Skeleton className="w-full aspect-square rounded-3xl bg-slate-200" />
                    <Skeleton className="w-3/4 h-8 bg-slate-200" />
                    <Skeleton className="w-1/2 h-5 bg-slate-200" />
                </div>
            </div>
        );
    }

    if (isError || !product) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen gap-4 bg-white text-slate-800">
                <Package className="h-16 w-16 text-slate-400" />
                <p className="text-xl font-bold">Product not found</p>
                <Link href="/" className="px-5 py-2.5 bg-[#087f5b] text-white rounded-full font-bold text-sm">
                    Back to Store
                </Link>
            </div>
        );
    }

    const selectedVariant = product.variants?.find((v: any) => v.id === selectedVariantId);
    const currentPrice = selectedVariant ? Number(selectedVariant.price) : Number(product.basePrice);
    const currentPricing = selectedVariant?.pricing || product.pricing;
    const currentWeight = selectedVariant
        ? selectedVariant.name
        : (product.weight ? `${product.weight} ${product.weightUnit || ''}` : product.weightUnit || "1 unit");

    const cartItem = items.find((i) => i.productId === id && i.variantId === (selectedVariantId || undefined));
    const qty = cartItem?.quantity ?? 0;

    const { finalPrice, originalPrice, discountPct } = getActivePrice({
        ...product,
        basePrice: currentPrice,
        pricing: currentPricing,
    });

    const images: string[] = product.images?.length
        ? product.images
        : ["https://placehold.co/500x500/f3f4f6/9ca3af?text=Product"];

    const reviews = reviewsData?.reviews || [];
    const reviewsCount = reviews.length;
    const avgRating = reviewsCount ? (reviews.reduce((sum: number, review: { rating: number }) => sum + Number(review.rating), 0) / reviewsCount).toFixed(1) : null;
    const inventory = [...(selectedVariant?.inventory || product.inventory || [])];
    const stock = activeStore?.id ? inventory.filter((entry: { locationId: string }) => entry.locationId === activeStore.id).reduce((sum: number, entry: { currentStock: number }) => sum + Number(entry.currentStock), 0) : 0;
    const isOutOfStock = stock <= 0;

    const handleAdd = () => {
        if (isOutOfStock) return;
        addItem({
            productId: id,
            variantId: selectedVariantId || undefined,
            name: selectedVariant
                ? `${product.name} (${selectedVariant.name})`
                : product.name,
            price: finalPrice,
            image: images[0],
            quantity: 1,
        });

        toast.success(`${product.name} added to cart`);
    };

    const handleShare = async () => {
        if (typeof navigator !== "undefined" && navigator.share) {
            try {
                await navigator.share({
                    title: product.name,
                    text: `Order fresh ${product.name} on Book My Veg!`,
                    url: window.location.href,
                });
            } catch {
                // user cancelled
            }
        } else {
            toast.info("Link copied to clipboard");
            navigator.clipboard?.writeText(window.location.href);
        }
    };

    return (
        <div className="min-h-screen w-full bg-white pb-32 text-[#163c2c]">
            <header className="bg-[#006c45] px-4 py-3 text-white sm:px-6"><div className="mx-auto flex max-w-6xl items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-2"><button onClick={() => router.back()} aria-label="Go back" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-white/10"><ArrowLeft className="h-5 w-5" /></button><h1 className="truncate text-lg font-bold text-white sm:text-xl">Product details</h1></div><div className="flex gap-2"><Link href="/search" aria-label="Search" className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10"><Search className="h-5 w-5" /></Link><Link href="/cart" aria-label={`Cart, ${totalItems} items`} className="relative flex h-11 w-11 items-center justify-center rounded-full bg-white/10"><ShoppingCart className="h-5 w-5" />{totalItems > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-[#c5ef75] px-1.5 text-xs font-bold text-[#05452d]">{totalItems}</span>}</Link><Link href={_hasHydrated && user && user.name !== "Guest" ? "/account" : "/login"} aria-label="My account" className="hidden h-11 w-11 items-center justify-center rounded-full bg-white/10 sm:flex"><UserRound className="h-5 w-5" /></Link></div></div></header>
            <main className="mx-auto max-w-6xl px-4 py-5 sm:px-6">
                <div className="grid items-start gap-6 lg:grid-cols-2 lg:gap-10">
                    <section aria-label="Product gallery" className="relative aspect-square w-full overflow-hidden rounded-3xl border border-[#e4ece4] bg-white">
                        <Image src={images[selectedImage]} alt={product.name} fill priority sizes="(max-width: 1024px) 90vw, 540px" className="object-contain p-8 sm:p-12" />
                        <div className="absolute right-3 top-3 z-10 flex gap-2"><button aria-label={inWishlist ? "Remove from wishlist" : "Save to wishlist"} aria-pressed={inWishlist} onClick={() => toggleWishlist({ productId: id, name: product.name, price: finalPrice, image: images[0] })} className="flex h-11 w-11 items-center justify-center rounded-full border border-[#e4ece4] bg-white"><Heart className={`h-5 w-5 ${inWishlist ? "fill-rose-500 text-rose-500" : "text-[#63786b]"}`} /></button><button aria-label="Share product" onClick={handleShare} className="flex h-11 w-11 items-center justify-center rounded-full border border-[#e4ece4] bg-white"><Share2 className="h-5 w-5" /></button></div>
                        {images.length > 1 && <><button aria-label="Previous image" onClick={() => setSelectedImage(previous => previous > 0 ? previous - 1 : images.length - 1)} className="absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-[#e4ece4] bg-white"><ChevronLeft className="h-5 w-5" /></button><button aria-label="Next image" onClick={() => setSelectedImage(previous => previous < images.length - 1 ? previous + 1 : 0)} className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-[#e4ece4] bg-white"><ChevronRight className="h-5 w-5" /></button><div className="absolute bottom-2 left-1/2 flex -translate-x-1/2">{images.map((_, index) => <button key={index} onClick={() => setSelectedImage(index)} aria-label={`View image ${index + 1}`} aria-pressed={selectedImage === index} className="flex h-11 w-8 items-center justify-center"><span className={`h-1.5 rounded-full ${selectedImage === index ? "w-5 bg-[#006c45]" : "w-1.5 bg-[#d9e4da]"}`} /></button>)}</div></>}
                    </section>
                    <section className="min-w-0 space-y-5">
                        <div>{product.category && <Link href={`/category/${product.categoryId}`} className="mb-3 inline-flex min-h-8 items-center gap-1 rounded-full bg-[#edf7e3] px-3 text-xs font-semibold text-[#006c45]"><Leaf className="h-3.5 w-3.5" />{product.category.name}</Link>}<h2 className="text-2xl font-bold leading-tight sm:text-3xl">{product.name}</h2><p className="mt-2 text-sm text-[#63786b]">{currentWeight}</p>{avgRating && <p className="mt-3 flex items-center gap-1.5 text-sm text-[#63786b]"><Star className="h-4 w-4 fill-amber-400 text-amber-400" /><strong className="font-semibold text-[#163c2c]">{avgRating}</strong><span>({reviewsCount} {reviewsCount === 1 ? "review" : "reviews"})</span></p>}</div>
                        <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-[#eff7e8] p-4"><span className="text-3xl font-bold text-[#006c45]">₹{Math.round(finalPrice)}</span>{discountPct > 0 && <><span className="text-sm text-[#63786b] line-through">₹{Math.round(originalPrice)}</span><span className="rounded-full bg-[#c5ef75] px-3 py-1 text-xs font-bold text-[#05452d]">{discountPct}% off</span></>}</div>
                        {product.variants?.length > 0 && <div><h3 className="mb-3 text-sm font-semibold">Choose your pack</h3><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{product.variants.map((variant: any) => <button key={variant.id} onClick={() => setSelectedVariantId(variant.id)} aria-pressed={selectedVariantId === variant.id} className={`flex min-h-20 flex-col items-center justify-center gap-1 rounded-2xl border p-3 text-sm ${selectedVariantId === variant.id ? "border-[#006c45] bg-[#edf7e3] text-[#006c45] ring-1 ring-[#006c45]" : "border-[#e4ece4] bg-white"}`}><span>{variant.name}</span><span className="font-semibold">₹{variant.price}</span></button>)}</div></div>}
                        {isOutOfStock && <p role="status" className="flex items-center gap-2 rounded-xl bg-[#fff4df] p-3 text-sm text-[#80520d]"><Info className="h-4 w-4 shrink-0" />{activeStore ? "Currently out of stock at your selected store" : "Choose a delivery location to check availability"}</p>}
                        <div className="divide-y divide-[#e4ece4] rounded-2xl border border-[#e4ece4] bg-white">
                            {product.description && <section className="px-4"><button onClick={() => setInfoOpen(!infoOpen)} aria-expanded={infoOpen} aria-controls="product-information" className="flex min-h-14 w-full items-center justify-between gap-3 text-left text-sm font-semibold">Product information{infoOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</button>{infoOpen && <p id="product-information" className="whitespace-pre-line pb-5 text-sm leading-relaxed text-[#63786b]">{product.description}</p>}</section>}
                            {product.nutritionInfo && typeof product.nutritionInfo === "object" && <section className="px-4"><button onClick={() => setNutritionOpen(!nutritionOpen)} aria-expanded={nutritionOpen} aria-controls="product-nutrition" className="flex min-h-14 w-full items-center justify-between gap-3 text-left text-sm font-semibold"><span className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-[#006c45]" />Nutritional information</span>{nutritionOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</button>{nutritionOpen && <dl id="product-nutrition" className="space-y-2 pb-4">{Object.entries(product.nutritionInfo).map(([key, value]) => <div key={key} className="flex justify-between gap-3 text-sm"><dt className="text-[#63786b]">{key}</dt><dd>{String(value)}</dd></div>)}</dl>}</section>}
                            <Link href="/exchange-policy" className="flex min-h-14 items-center justify-between gap-3 px-4 text-sm font-semibold">Delivery & exchange policy<ChevronRight className="h-4 w-4" /></Link>
                        </div>
                    </section>
                </div>
                <section className="mt-9"><div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-lg font-bold">You may also like</h2><Link href="/products" className="flex min-h-11 items-center gap-1 text-xs font-semibold text-[#006c45]">See all<ChevronRight className="h-4 w-4" /></Link></div><SimilarProducts productId={id} /></section>
            </main>
            <div className="fixed inset-x-0 bottom-0 z-50 border-t border-[#e4ece4] bg-white px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))]"><div className="mx-auto flex max-w-6xl items-center gap-3"><div className="flex h-12 shrink-0 items-center rounded-full border border-[#dce7d9] bg-[#f4f8ef]"><button onClick={() => qty > 0 && updateQuantity(id, qty - 1, selectedVariantId || undefined)} disabled={qty === 0} aria-label="Decrease quantity" className="flex h-11 w-11 items-center justify-center rounded-full disabled:opacity-30"><Minus className="h-4 w-4" /></button><span className="min-w-6 text-center text-sm font-bold" aria-live="polite">{qty || 1}</span><button onClick={() => qty === 0 ? handleAdd() : updateQuantity(id, qty + 1, selectedVariantId || undefined)} disabled={isOutOfStock || qty >= stock} aria-label="Increase quantity" className="flex h-11 w-11 items-center justify-center rounded-full disabled:opacity-30"><Plus className="h-4 w-4" /></button></div><button onClick={handleAdd} disabled={isOutOfStock} className="flex min-h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-full bg-[#006c45] px-3 text-sm font-semibold text-white disabled:bg-[#e4ece4] disabled:text-[#63786b]"><ShoppingCart className="h-4 w-4 shrink-0" /><span>{isOutOfStock ? "Unavailable" : `Add to cart · ₹${Math.round(finalPrice)}`}</span></button></div></div>
        </div>
    );
}
