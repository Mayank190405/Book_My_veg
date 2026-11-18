"use client";

import { useCartStore } from "@/store/useCartStore";
import { useUserStore } from "@/store/useUserStore";
import { 
    ArrowLeft, 
    ArrowRight, 
    Minus, 
    Plus, 
    ShoppingBasket, 
    Tag, 
    Trash2, 
    MapPin, 
    ShieldCheck, 
    RotateCcw,
    Sparkles,
    BadgePercent
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getTrendingProducts } from "@/services/productService";
import { getAvailableCoupons, Coupon } from "@/services/couponService";
import ProductCard from "@/components/ui/ProductCard";

const subscribeToHydration = () => () => {};

export default function CartPage() {
    const router = useRouter();
    const { 
        items, 
        updateQuantity, 
        removeItem, 
        totalItems, 
        totalPrice, 
        couponCode, 
        discount, 
        applyCoupon, 
        removeCoupon, 
        clearCart 
    } = useCartStore();
    
    const { location } = useUserStore();
    const [localCode, setLocalCode] = useState("");
    const [trending, setTrending] = useState<any[]>([]);
    const mounted = useSyncExternalStore(subscribeToHydration, () => true, () => false);

    const freeDeliveryThreshold = 249;
    const isFreeDelivery = totalPrice >= freeDeliveryThreshold;
    const amountNeeded = Math.max(0, freeDeliveryThreshold - totalPrice);
    const progressPercent = Math.min(100, Math.round((totalPrice / freeDeliveryThreshold) * 100));

    // Fetch actual coupons from backend database
    const { data: realCouponsData } = useQuery({
        queryKey: ["available-coupons"],
        queryFn: getAvailableCoupons,
        staleTime: 5 * 60 * 1000,
    });
    const realCoupons: Coupon[] = Array.isArray(realCouponsData) ? realCouponsData : [];

    useEffect(() => {
        let active = true;
        getTrendingProducts(location?.pincode, location?.coords?.lat, location?.coords?.lng)
            .then((res: any) => {
                if (!active) return;
                const list = res?.products || res?.data || res || [];
                setTrending((Array.isArray(list) ? list : []).slice(0, 9));
            })
            .catch(() => {});
        return () => { active = false; };
    }, [location]);

    const deliveryFee = isFreeDelivery ? 0 : 40;
    const grandTotal = Math.max(0, totalPrice + deliveryFee - discount);
    const totalSavings = discount + (isFreeDelivery ? 40 : 0);

    const handleApplyCoupon = async (code: string) => {
        const cleanCode = code.trim().toUpperCase();
        if (cleanCode) {
            await applyCoupon(cleanCode);
        }
    };

    const handleRemoveCoupon = () => {
        removeCoupon();
        setLocalCode("");
    };

    return (
        <div className="min-h-screen bg-[#f6f8f7] pb-40 text-slate-900 select-none">
            {/* Header */}
            <header className="border-b border-slate-200/80 bg-white sticky top-0 z-30 shadow-2xs">
                <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-3 py-3.5 sm:px-6">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => router.back()}
                            aria-label="Go back"
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 transition-all text-slate-700"
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </button>
                        <div>
                            <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight leading-tight">
                                Review Cart
                            </h1>
                            <p className="text-[11px] font-semibold text-slate-500">
                                {totalItems} {totalItems === 1 ? "item" : "items"} in your basket
                            </p>
                        </div>
                    </div>

                    {items.length > 0 && (
                        <button
                            onClick={() => clearCart()}
                            className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold text-rose-600 hover:bg-rose-50 transition-colors"
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>Empty</span>
                        </button>
                    )}
                </div>
            </header>

            <main className="mx-auto max-w-5xl px-3 py-4 sm:px-6 space-y-4">
                {items.length === 0 ? (
                    <section className="mx-auto flex max-w-md flex-col items-center py-20 text-center">
                        <div className="w-20 h-20 bg-[#DCF4E9] rounded-full flex items-center justify-center text-[#017649] mb-4 shadow-xs">
                            <ShoppingBasket className="h-10 w-10" />
                        </div>
                        <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Your basket is empty</h2>
                        <p className="mt-2 text-xs sm:text-sm text-slate-500 leading-relaxed max-w-xs">
                            Add fresh vegetables, fruits, dairy, and wholesome farm groceries.
                        </p>
                        <Link
                            href="/categories"
                            className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full bg-[#017649] hover:bg-[#015f3b] px-6 text-xs sm:text-sm font-black text-white shadow-md active:scale-95 transition-all"
                        >
                            <span>Browse Categories</span>
                            <ArrowRight className="h-4 w-4 stroke-[2.5]" />
                        </Link>
                    </section>
                ) : (
                    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
                        {/* Left Column: Delivery pill + Items + Recommendations */}
                        <div className="min-w-0 space-y-4">
                            {/* Free Delivery Milestone Progress */}
                            <div className="rounded-2xl border border-[#017649]/20 bg-[#DCF4E9] p-3.5 sm:p-4 shadow-2xs">
                                <div className="flex items-center justify-between text-xs font-bold text-[#015f3b] mb-1.5">
                                    <span className="flex items-center gap-1.5">
                                        <Sparkles className="h-3.5 w-3.5 text-[#017649]" />
                                        {isFreeDelivery ? "FREE delivery unlocked on this order!" : `Add ₹${amountNeeded.toFixed(0)} more for FREE delivery`}
                                    </span>
                                    <span>₹{totalPrice.toFixed(0)} / ₹{freeDeliveryThreshold}</span>
                                </div>
                                <div className="w-full h-2 bg-white/80 rounded-full overflow-hidden">
                                    <div
                                        style={{ width: `${progressPercent}%` }}
                                        className="h-full bg-[#017649] rounded-full transition-all duration-300"
                                    />
                                </div>
                            </div>

                            {/* Delivery Location Card */}
                            <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white p-3.5 sm:p-4 shadow-2xs">
                                <div className="flex items-start gap-3 min-w-0">
                                    <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center text-[#017649] shrink-0 mt-0.5">
                                        <MapPin className="h-4.5 w-4.5" />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-black text-slate-900 uppercase tracking-wider">Delivering to</span>
                                            <span className="text-[10px] font-bold bg-[#DCF4E9] text-[#017649] px-2 py-0.5 rounded-full">HOME</span>
                                        </div>
                                        <p className="mt-0.5 text-xs text-slate-600 font-medium truncate">
                                            {location?.address || "Govind Nagar, Nashik"}
                                        </p>
                                    </div>
                                </div>
                                <Link
                                    href="/account/addresses"
                                    className="text-xs font-bold text-[#017649] hover:underline shrink-0 pl-2"
                                >
                                    Change
                                </Link>
                            </div>

                            {/* Cart Items Container */}
                            <section aria-label="Basket items" className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs overflow-hidden">
                                <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
                                    <span className="text-xs font-black uppercase tracking-wider text-slate-700">
                                        Farm Fresh Items ({totalItems})
                                    </span>
                                    <Link
                                        href="/categories"
                                        className="text-xs font-bold text-[#017649] hover:underline flex items-center gap-1"
                                    >
                                        <span>+ Add More</span>
                                    </Link>
                                </div>

                                <div className="divide-y divide-slate-100 px-3 sm:px-4">
                                    {items.map((item) => (
                                        <article
                                            key={`${item.productId}-${item.variantId || "default"}`}
                                            className="flex items-center gap-3 py-3.5 sm:gap-4"
                                        >
                                            {/* Item Image */}
                                            <Link
                                                href={`/products/${item.productId}`}
                                                className="relative h-16 w-16 shrink-0 rounded-xl bg-slate-50 overflow-hidden p-1 border border-slate-100"
                                            >
                                                {item.image ? (
                                                    <Image
                                                        src={item.image}
                                                        alt={item.name}
                                                        fill
                                                        sizes="64px"
                                                        className="object-contain p-1"
                                                    />
                                                ) : (
                                                    <ShoppingBasket className="m-auto h-full w-6 text-slate-400" />
                                                )}
                                            </Link>

                                            {/* Item Details */}
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-start justify-between gap-2">
                                                    <Link
                                                        href={`/products/${item.productId}`}
                                                        className="text-xs sm:text-sm font-bold text-slate-900 leading-tight line-clamp-1 hover:text-[#017649] transition-colors"
                                                    >
                                                        {item.name}
                                                    </Link>
                                                    <button
                                                        onClick={() => removeItem(item.productId, item.variantId)}
                                                        aria-label={`Remove ${item.name}`}
                                                        className="text-slate-400 hover:text-rose-600 p-1 transition-colors"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>

                                                <p className="text-[10px] sm:text-[11px] font-semibold text-slate-400 mt-0.5">
                                                    {item.weight ? `${item.weight} ${item.weightUnit || "g"}` : "Standard Pack"}
                                                </p>

                                                <div className="mt-2 flex items-center justify-between gap-3">
                                                    {/* Price */}
                                                    <div className="flex items-baseline gap-1.5">
                                                        <span className="text-xs sm:text-sm font-black tabular-nums text-slate-900">
                                                            ₹{(Number(item.price) * item.quantity).toFixed(0)}
                                                        </span>
                                                        <span className="text-[10px] text-slate-400 font-medium">
                                                            (₹{Number(item.price).toFixed(0)} / unit)
                                                        </span>
                                                    </div>

                                                    {/* Stepper */}
                                                    <div className="flex items-center rounded-lg bg-[#017649] text-white shadow-2xs h-7 overflow-hidden">
                                                        <button
                                                            onClick={() => updateQuantity(item.productId, item.quantity - 1, item.variantId)}
                                                            aria-label={`Decrease ${item.name} quantity`}
                                                            className="flex h-7 w-6 items-center justify-center hover:bg-[#015f3b] active:scale-95 transition-colors"
                                                        >
                                                            <Minus className="h-2.5 w-2.5 stroke-[3]" />
                                                        </button>
                                                        <span className="min-w-4 text-center text-xs font-black tabular-nums">
                                                            {item.quantity}
                                                        </span>
                                                        <button
                                                            onClick={() => updateQuantity(item.productId, item.quantity + 1, item.variantId)}
                                                            aria-label={`Increase ${item.name} quantity`}
                                                            className="flex h-7 w-6 items-center justify-center hover:bg-[#015f3b] active:scale-95 transition-colors"
                                                        >
                                                            <Plus className="h-2.5 w-2.5 stroke-[3]" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </article>
                                    ))}
                                </div>
                            </section>

                            {/* Doorstep Quality Assurance */}
                            <div className="flex items-center gap-3 rounded-2xl bg-white border border-slate-200/80 p-3.5 shadow-2xs">
                                <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center text-[#017649] shrink-0">
                                    <ShieldCheck className="h-5 w-5" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs font-bold text-slate-900">100% Quality & Freshness Guarantee</p>
                                    <p className="text-[11px] text-slate-500 font-medium">Instant refund or replacement at your doorstep with no questions asked.</p>
                                </div>
                            </div>

                            {/* Recommendations Grid in 3x3 */}
                            {trending.length > 0 && (
                                <section className="space-y-3 pt-2">
                                    <div className="flex items-center justify-between px-1">
                                        <h2 className="text-sm sm:text-base font-black text-slate-900 tracking-tight">
                                            Before you checkout
                                        </h2>
                                        <Link href="/categories" className="text-xs font-bold text-[#017649] hover:underline">
                                            Explore more →
                                        </Link>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 sm:gap-3.5">
                                        {trending.slice(0, 6).map((product: any) => (
                                            <ProductCard
                                                key={product.id}
                                                id={product.id}
                                                name={product.name}
                                                images={product.images || []}
                                                basePrice={Number(product.basePrice || 0)}
                                                weight={product.weight}
                                                weightUnit={product.weightUnit}
                                                inventory={product.inventory || []}
                                                pricing={product.pricing || []}
                                                variants={product.variants || []}
                                                compact
                                            />
                                        ))}
                                    </div>
                                </section>
                            )}
                        </div>

                        {/* Right Column: Actual Coupons & Bill Details */}
                        <aside className="space-y-4 lg:sticky lg:top-20">
                            {/* Actual Coupon Section */}
                            <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
                                <h2 className="mb-3 flex items-center gap-1.5 text-xs font-black text-slate-900 uppercase tracking-wider">
                                    <Tag className="h-4 w-4 text-[#017649]" />
                                    <span>Coupon Code</span>
                                </h2>

                                {couponCode ? (
                                    <div className="flex items-center justify-between gap-3 rounded-xl bg-[#DCF4E9] p-3 border border-[#017649]/20">
                                        <div>
                                            <div className="flex items-center gap-1.5">
                                                <BadgePercent className="h-4 w-4 text-[#017649]" />
                                                <span className="text-xs font-black text-[#015f3b]">{couponCode}</span>
                                            </div>
                                            <p className="text-[11px] font-semibold text-[#017649] mt-0.5">
                                                Applied • Savings ₹{discount.toFixed(0)}
                                            </p>
                                        </div>
                                        <button
                                            onClick={handleRemoveCoupon}
                                            className="text-xs font-bold text-rose-600 hover:underline"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-2.5">
                                        <div className="flex gap-2">
                                            <input
                                                aria-label="Coupon code"
                                                placeholder="Enter coupon code"
                                                value={localCode}
                                                onChange={(e) => setLocalCode(e.target.value.toUpperCase())}
                                                className="h-10 min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold uppercase focus:border-[#017649] focus:outline-none"
                                            />
                                            <button
                                                onClick={() => localCode && handleApplyCoupon(localCode)}
                                                disabled={!localCode}
                                                className="h-10 rounded-xl bg-[#017649] px-4 text-xs font-black text-white hover:bg-[#015f3b] disabled:bg-slate-200 disabled:text-slate-400 transition-colors shadow-2xs"
                                            >
                                                Apply
                                            </button>
                                        </div>

                                        {/* Display ONLY actual coupon codes if returned by the backend API */}
                                        {realCoupons.length > 0 && (
                                            <div className="space-y-1.5 pt-1">
                                                {realCoupons.map((cp) => (
                                                    <div
                                                        key={cp.id || cp.code}
                                                        className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100"
                                                    >
                                                        <div>
                                                            <span className="text-xs font-black text-slate-800">{cp.code}</span>
                                                            {cp.description && (
                                                                <p className="text-[10px] text-slate-500 font-medium">{cp.description}</p>
                                                            )}
                                                        </div>
                                                        <button
                                                            onClick={() => handleApplyCoupon(cp.code)}
                                                            className="text-xs font-bold text-[#017649] hover:underline uppercase"
                                                        >
                                                            Apply
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </section>

                            {/* Bill Details */}
                            <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
                                <div className="flex items-center justify-between mb-3">
                                    <h2 className="text-sm font-black text-slate-900 tracking-tight">Bill Details</h2>
                                    {totalSavings > 0 && (
                                        <span className="text-[10px] font-bold bg-[#DCF4E9] text-[#017649] px-2 py-0.5 rounded-full">
                                            Saving ₹{totalSavings.toFixed(0)}
                                        </span>
                                    )}
                                </div>

                                <dl className="space-y-2 text-xs">
                                    <div className="flex justify-between gap-4">
                                        <dt className="text-slate-500 font-medium">Items Total</dt>
                                        <dd className="font-bold text-slate-800 tabular-nums">₹{totalPrice.toFixed(0)}</dd>
                                    </div>
                                    <div className="flex justify-between gap-4">
                                        <dt className="text-slate-500 font-medium">Delivery Partner Fee</dt>
                                        <dd className="font-bold text-slate-800">
                                            {deliveryFee === 0 ? (
                                                <span className="flex items-center gap-1 text-[#017649] font-black">
                                                    <span className="line-through text-slate-400 font-normal">₹40</span> FREE
                                                </span>
                                            ) : (
                                                `₹${deliveryFee}`
                                            )}
                                        </dd>
                                    </div>
                                    <div className="flex justify-between gap-4">
                                        <dt className="text-slate-500 font-medium">Handling & Packaging</dt>
                                        <dd className="font-bold text-[#017649]">FREE</dd>
                                    </div>
                                    {discount > 0 && (
                                        <div className="flex justify-between gap-4 text-[#017649]">
                                            <dt className="font-bold">Coupon Savings</dt>
                                            <dd className="font-black tabular-nums">−₹{discount.toFixed(0)}</dd>
                                        </div>
                                    )}
                                    <div className="flex justify-between gap-4 border-t border-slate-100 pt-3 text-sm font-black">
                                        <dt className="text-slate-900">To Pay</dt>
                                        <dd className="text-slate-900 tabular-nums">₹{grandTotal.toFixed(0)}</dd>
                                    </div>
                                </dl>
                            </section>

                            <Link
                                href="/categories"
                                className="flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-[#017649] hover:bg-emerald-50 transition-colors shadow-2xs"
                            >
                                <RotateCcw className="h-3.5 w-3.5" />
                                <span>Continue Shopping</span>
                            </Link>
                        </aside>
                    </div>
                )}
            </main>

            {/* Bottom Sticky Checkout Action Bar */}
            {items.length > 0 && mounted && createPortal(
                <div className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200/80 bg-white px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-xl">
                    <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
                        <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block leading-tight">Total Bill</span>
                            <div className="flex items-baseline gap-1.5">
                                <span className="text-xl font-black text-slate-900 tabular-nums">₹{grandTotal.toFixed(0)}</span>
                                {totalSavings > 0 && (
                                    <span className="text-[10px] font-bold text-[#017649]">Save ₹{totalSavings.toFixed(0)}</span>
                                )}
                            </div>
                        </div>

                        <Link
                            href="/checkout"
                            className="flex h-12 items-center justify-center gap-2 rounded-full bg-[#017649] hover:bg-[#015f3b] px-7 text-xs sm:text-sm font-black text-white shadow-md active:scale-95 transition-all"
                        >
                            <span>Proceed to Pay</span>
                            <ArrowRight className="h-4 w-4 stroke-[2.5]" />
                        </Link>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
