"use client";

import { useWishlistStore } from "@/store/useWishlistStore";
import { useCartStore } from "@/store/useCartStore";
import { ArrowLeft, ArrowRight, Heart, Plus, Trash2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function WishlistPage() {
    const router = useRouter();
    const { items, removeFromWishlist } = useWishlistStore();
    const { addItem } = useCartStore();
    const handleAddToCart = (item: (typeof items)[number]) => {
        addItem({ productId: item.productId, name: item.name, price: item.price, image: item.image, quantity: 1 });
        removeFromWishlist(item.productId);
        import("sonner").then(({ toast }) => toast.success(`${item.name} moved to cart`));
    };
    return (
        <div className="min-h-screen bg-[#f8faf8] px-4 pb-32 text-[#17251e] sm:px-6">
            <header className="mx-auto flex max-w-6xl items-center gap-3 border-b border-[#e5ebe7] py-4"><button onClick={() => router.back()} aria-label="Go back" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white"><ArrowLeft className="h-5 w-5" /></button><h1 className="text-xl font-semibold">Saved items <span className="text-sm font-normal text-[#64736b]">({items.length})</span></h1></header>
            <main className="mx-auto max-w-6xl py-6">
                {items.length === 0 ? <section className="mx-auto flex max-w-md flex-col items-center py-16 text-center"><div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[#e8f7ef]"><Heart className="h-9 w-9 text-[#087f5b]" /></div><h2 className="text-2xl font-semibold">Keep your favourites close</h2><p className="mt-3 text-sm leading-6 text-[#64736b]">Save products while you browse and find them here whenever you need them.</p><Link href="/categories" className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#087f5b] px-6 font-semibold text-white">Explore the shop <ArrowRight className="h-4 w-4" /></Link></section> : <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{items.map(item => <article key={item.productId} className="relative rounded-2xl border border-[#e5ebe7] bg-white p-3 sm:p-4"><button onClick={() => removeFromWishlist(item.productId)} aria-label={`Remove ${item.name} from saved items`} className="absolute right-2 top-2 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#64736b] hover:bg-red-50 hover:text-red-700"><Trash2 className="h-4 w-4" /></button><Link href={`/products/${item.productId}`} className="relative mb-3 block aspect-square">{item.image ? <Image src={item.image} alt={item.name} fill sizes="(max-width: 640px) 45vw, 240px" className="object-contain p-2" /> : <Heart className="m-auto h-full w-8 text-[#64736b]" />}</Link><h2 className="min-h-10 text-sm font-semibold leading-5 line-clamp-2">{item.name}</h2><div className="mt-4 flex flex-wrap items-center justify-between gap-2"><span className="text-base font-semibold">₹{item.price.toFixed(0)}</span><button onClick={() => handleAddToCart(item)} className="flex min-h-11 items-center gap-1 rounded-lg bg-[#e8f7ef] px-3 text-sm font-semibold text-[#087f5b]" aria-label={`Move ${item.name} to cart`}><Plus className="h-4 w-4" />Add</button></div></article>)}</div>}
            </main>
        </div>
    );
}
