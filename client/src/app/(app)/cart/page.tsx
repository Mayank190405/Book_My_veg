"use client";

import { useCartStore } from "@/store/useCartStore";
import { useUserStore } from "@/store/useUserStore";
import { ArrowLeft, ArrowRight, Minus, Plus, ShoppingBasket, Tag, Trash2, MapPin, RotateCcw } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { getTrendingProducts, getBuyAgainProducts } from "@/services/productService";

const subscribeToHydration = () => () => {};

interface RecoProduct {
    id: string;
    name: string;
    basePrice: number;
    images: string[];
    pricing?: { price: number; isActive?: boolean }[];
    variants?: { price: number }[];
}

const getRecoPrice = (product: RecoProduct): number => {
    const active = product.pricing?.find(price => price.isActive);
    if (active) return Number(active.price) || Number(product.basePrice) || 0;
    return Number(product.basePrice) || Number(product.variants?.[0]?.price) || 0;
};

export default function CartPage() {
    const router = useRouter();
    const { items, updateQuantity, removeItem, totalItems, totalPrice, couponCode, discount, applyCoupon, removeCoupon, clearCart, addItem } = useCartStore();
    const { location } = useUserStore();
    const [localCode, setLocalCode] = useState("");
    const [trending, setTrending] = useState<RecoProduct[]>([]);
    const [buyAgain, setBuyAgain] = useState<RecoProduct[]>([]);
    const mounted = useSyncExternalStore(subscribeToHydration, () => true, () => false);

    useEffect(() => {
        let active = true;
        Promise.allSettled([
            getTrendingProducts(location?.pincode, location?.coords?.lat, location?.coords?.lng),
            getBuyAgainProducts(),
        ]).then(([popular, previous]) => {
            if (!active) return;
            if (popular.status === "fulfilled") setTrending((popular.value?.products || popular.value || []).slice(0, 8));
            if (previous.status === "fulfilled") setBuyAgain((previous.value?.products || previous.value || []).slice(0, 8));
        });
        return () => { active = false; };
    }, [location]);

    // Retain the existing cart calculation; checkout remains the existing flow.
    const deliveryFee = totalPrice >= 249 ? 0 : 40;
    const grandTotal = totalPrice + deliveryFee - discount;

    const handleAddReco = (product: RecoProduct) => addItem({
        productId: product.id, name: product.name, price: getRecoPrice(product),
        image: product.images?.[0] || "", quantity: 1,
    });

    const recommendations = (title: string, products: RecoProduct[]) => products.length > 0 && (
        <section className="mt-8" aria-label={title}>
            <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-[#17251e]">{title}</h2>
                <Link href="/categories" className="flex min-h-11 items-center text-sm font-semibold text-[#087f5b]">See all <ArrowRight className="ml-1 h-4 w-4" /></Link>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-3">
                {products.map(product => (
                    <article key={product.id} className="w-36 shrink-0 rounded-2xl border border-[#e5ebe7] bg-white p-3">
                        <Link href={`/products/${product.id}`} className="relative mb-3 block aspect-square">
                            {product.images?.[0] ? <Image src={product.images[0]} alt={product.name} fill sizes="144px" className="object-contain" /> : <ShoppingBasket className="m-auto h-full w-10 text-[#64736b]" />}
                        </Link>
                        <h3 className="min-h-10 text-sm font-medium leading-5 text-[#17251e] line-clamp-2">{product.name}</h3>
                        <div className="mt-3 flex items-center justify-between gap-2">
                            <span className="text-sm font-semibold">₹{getRecoPrice(product)}</span>
                            <button onClick={() => handleAddReco(product)} aria-label={`Add ${product.name} to cart`} className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#e8f7ef] text-[#087f5b] hover:bg-emerald-100"><Plus className="h-4 w-4" /></button>
                        </div>
                    </article>
                ))}
            </div>
        </section>
    );

    return (
        <div className="min-h-screen bg-[#f8faf8] pb-36 text-[#17251e]">
            <header className="border-b border-[#e5ebe7] bg-white">
                <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-4 sm:px-6">
                    <button onClick={() => router.back()} aria-label="Go back" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-[#f8faf8]"><ArrowLeft className="h-5 w-5" /></button>
                    <div className="min-w-0 flex-1"><h1 className="text-xl font-semibold sm:text-2xl">My cart <span className="text-sm font-normal text-[#64736b]">({totalItems} {totalItems === 1 ? "item" : "items"})</span></h1></div>
                    {items.length > 0 && <button onClick={() => clearCart()} className="flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm text-[#64736b] hover:text-red-700"><Trash2 className="h-4 w-4" /><span>Clear</span></button>}
                </div>
            </header>
            <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
                {items.length === 0 ? (
                    <section className="mx-auto flex max-w-md flex-col items-center py-12 text-center">
                        <Image src="/empty-cart.png" alt="" width={200} height={200} className="mb-6 object-contain" />
                        <h2 className="text-2xl font-semibold">Your next meal starts here</h2>
                        <p className="mt-3 text-sm leading-6 text-[#64736b]">Your cart is empty. Browse the shop and add your everyday essentials.</p>
                        <Link href="/categories" className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#087f5b] px-6 font-semibold text-white hover:bg-[#056647]">Explore categories <ArrowRight className="h-4 w-4" /></Link>
                    </section>
                ) : (
                    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
                        <div className="min-w-0">
                            <div className="mb-4 flex items-start gap-3 rounded-2xl border border-[#e5ebe7] bg-white p-4">
                                <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-[#087f5b]" />
                                <div><h2 className="text-sm font-semibold">Delivery location</h2><p className="mt-1 text-sm text-[#64736b]">{location?.address || "Choose your delivery address at checkout"}</p></div>
                            </div>
                            <section aria-label="Cart items" className="divide-y divide-[#e5ebe7] rounded-2xl border border-[#e5ebe7] bg-white px-4">
                                {items.map(item => (
                                    <article key={`${item.productId}-${item.variantId}`} className="flex gap-3 py-5 sm:gap-4">
                                        <Link href={`/products/${item.productId}`} className="relative h-[72px] w-[72px] shrink-0 rounded-xl bg-[#f8faf8]">
                                            {item.image ? <Image src={item.image} alt={item.name} fill sizes="72px" className="object-contain p-1" /> : <ShoppingBasket className="m-auto h-full w-7 text-[#64736b]" />}
                                        </Link>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-start justify-between gap-2">
                                                <h3 className="pt-1 text-sm font-semibold leading-5">{item.name}</h3>
                                                <button onClick={() => removeItem(item.productId, item.variantId)} aria-label={`Remove ${item.name}`} className="-mr-2 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-[#64736b] hover:bg-red-50 hover:text-red-700"><Trash2 className="h-4 w-4" /></button>
                                            </div>
                                            <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                                                <div className="inline-flex items-center overflow-hidden rounded-lg border border-[#e5ebe7]">
                                                    <button onClick={() => updateQuantity(item.productId, item.quantity - 1, item.variantId)} aria-label={`Decrease ${item.name} quantity`} className="flex h-11 w-11 items-center justify-center text-[#087f5b] hover:bg-[#e8f7ef]"><Minus className="h-4 w-4" /></button>
                                                    <span className="min-w-5 text-center text-sm font-semibold tabular-nums" aria-label={`${item.quantity} in cart`}>{item.quantity}</span>
                                                    <button onClick={() => updateQuantity(item.productId, item.quantity + 1, item.variantId)} aria-label={`Increase ${item.name} quantity`} className="flex h-11 w-11 items-center justify-center text-[#087f5b] hover:bg-[#e8f7ef]"><Plus className="h-4 w-4" /></button>
                                                </div>
                                                <span className="text-base font-semibold tabular-nums">₹{item.price}</span>
                                            </div>
                                        </div>
                                    </article>
                                ))}
                            </section>
                            {recommendations("You may also like", trending)}
                            {recommendations("Buy again", buyAgain)}
                        </div>
                        <aside className="space-y-4 lg:sticky lg:top-6">
                            <section className="rounded-2xl border border-[#e5ebe7] bg-white p-5">
                                <h2 className="mb-4 flex items-center gap-2 text-base font-semibold"><Tag className="h-5 w-5 text-[#087f5b]" />Apply a coupon</h2>
                                {couponCode ? <div className="flex items-center justify-between gap-3 rounded-xl bg-[#e8f7ef] p-3"><div><p className="text-sm font-semibold">{couponCode}</p><p className="text-sm text-[#087f5b]">Coupon discount ₹{discount}</p></div><button onClick={() => { removeCoupon(); setLocalCode(""); }} className="min-h-11 text-sm font-medium text-red-700">Remove</button></div> : <div className="flex gap-2"><input aria-label="Coupon code" placeholder="Enter coupon code" value={localCode} onChange={event => setLocalCode(event.target.value.toUpperCase())} className="h-12 min-w-0 flex-1 rounded-xl border border-[#e5ebe7] bg-[#f8faf8] px-3 text-sm" /><button onClick={() => localCode && applyCoupon(localCode)} disabled={!localCode} className="min-h-12 rounded-xl bg-[#087f5b] px-4 text-sm font-semibold text-white disabled:bg-slate-200 disabled:text-slate-500">Apply</button></div>}
                            </section>
                            <section className="rounded-2xl border border-[#e5ebe7] bg-white p-5">
                                <h2 className="mb-5 text-lg font-semibold">Bill details</h2>
                                <dl className="space-y-4 text-sm"><div className="flex justify-between gap-4"><dt className="text-[#64736b]">Item total</dt><dd className="font-medium">₹{totalPrice.toFixed(0)}</dd></div><div className="flex justify-between gap-4"><dt className="text-[#64736b]">Delivery fee</dt><dd className="font-medium">{deliveryFee === 0 ? "Free" : `₹${deliveryFee}`}</dd></div>{discount > 0 && <div className="flex justify-between gap-4 text-[#087f5b]"><dt>Coupon discount</dt><dd>−₹{discount}</dd></div>}<div className="flex justify-between gap-4 border-t border-[#e5ebe7] pt-4 text-base font-semibold"><dt>Estimated total</dt><dd>₹{grandTotal.toFixed(0)}</dd></div></dl>
                                <p className="mt-4 text-xs leading-5 text-[#64736b]">Review the final amount and delivery options at checkout.</p>
                            </section>
                            <Link href="/categories" className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#e5ebe7] bg-white text-sm font-medium text-[#087f5b]"><RotateCcw className="h-4 w-4" />Continue shopping</Link>
                        </aside>
                    </div>
                )}
                {items.length === 0 && recommendations("Explore the shop", trending)}
            </main>
            {items.length > 0 && mounted && createPortal(
                <div className="fixed inset-x-0 bottom-0 z-50 border-t border-[#e5ebe7] bg-white px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
                    <div className="mx-auto flex max-w-6xl items-center justify-between gap-3"><div><p className="text-xs text-[#64736b]">Estimated total</p><p className="text-xl font-semibold tabular-nums">₹{grandTotal.toFixed(0)}</p></div><Link href="/checkout" className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#087f5b] px-4 text-sm font-semibold text-white hover:bg-[#056647] sm:px-6">Proceed to checkout<ArrowRight className="h-4 w-4 shrink-0" /></Link></div>
                </div>, document.body
            )}
        </div>
    );
}
