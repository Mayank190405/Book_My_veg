"use client";

import { useWishlistStore } from "@/store/useWishlistStore";
import { useCartStore } from "@/store/useCartStore";
import { Trash2, ShoppingBag, ChevronLeft, Heart, Sparkles } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function WishlistPage() {
    const router = useRouter();
    const { items: wishlistItems, removeFromWishlist } = useWishlistStore();
    const { addItem } = useCartStore();

    const handleAddToCart = (item: any) => {
        addItem({
            productId: item.productId,
            name: item.name,
            price: item.price,
            image: item.image,
            quantity: 1
        });
        removeFromWishlist(item.productId);
        
        import("sonner").then(({ toast }) => {
            toast.success(`${item.name} moved to cart!`);
        });
    };

    if (wishlistItems.length === 0) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#f8faf9]">
                {/* Custom High-Fidelity Vector Illustration */}
                <div className="w-full max-w-[420px] mb-6 animate-in fade-in zoom-in duration-700">
                    <svg viewBox="0 0 450 280" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto select-none">
                        {/* Soft background radial glow */}
                        <circle cx="225" cy="140" r="110" fill="#e6f4ea" opacity="0.5" />
                        
                        {/* Dotted path */}
                        <path d="M 85,90 C 130,90 170,125 225,125 C 280,125 320,95 365,95" stroke="#10b981" strokeWidth="2" strokeDasharray="4 4" fill="none" opacity="0.6" />

                        {/* Clouds */}
                        <path d="M 60,35 Q 70,25 80,35 Q 90,25 100,35 T 120,35 Q 120,45 100,45" fill="#e6f4ea" opacity="0.6" />
                        <path d="M 280,45 Q 290,38 300,45 Q 310,38 320,45 T 335,45 Q 335,52 320,52" fill="#e6f4ea" opacity="0.6" />

                        {/* Birds */}
                        <path d="M 345,65 Q 349,61 353,65 Q 357,61 361,65" stroke="#88d2b2" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                        <path d="M 368,72 Q 371,68 374,72 Q 377,68 380,72" stroke="#88d2b2" strokeWidth="1.2" fill="none" strokeLinecap="round" />

                        {/* Dotted grids (aesthetic accents) */}
                        <g fill="#a7f3d0" opacity="0.4">
                            <circle cx="20" cy="20" r="1.5"/>
                            <circle cx="30" cy="20" r="1.5"/>
                            <circle cx="40" cy="20" r="1.5"/>
                            <circle cx="20" cy="30" r="1.5"/>
                            <circle cx="30" cy="30" r="1.5"/>
                            <circle cx="40" cy="30" r="1.5"/>
                            <circle cx="20" cy="40" r="1.5"/>
                            <circle cx="30" cy="40" r="1.5"/>
                            <circle cx="40" cy="40" r="1.5"/>
                        </g>
                        <g fill="#a7f3d0" opacity="0.4" transform="translate(380, 20)">
                            <circle cx="20" cy="20" r="1.5"/>
                            <circle cx="30" cy="20" r="1.5"/>
                            <circle cx="40" cy="20" r="1.5"/>
                            <circle cx="20" cy="30" r="1.5"/>
                            <circle cx="30" cy="30" r="1.5"/>
                            <circle cx="40" cy="30" r="1.5"/>
                            <circle cx="20" cy="40" r="1.5"/>
                            <circle cx="30" cy="40" r="1.5"/>
                            <circle cx="40" cy="40" r="1.5"/>
                        </g>

                        {/* Left: Fresh Mart Storefront */}
                        <g transform="translate(50, 70)">
                            <g transform="translate(35, -35)">
                                <path d="M12 0C5.37 0 0 5.37 0 12c0 8.4 12 24 12 24s12-15.6 12-24c0-6.63-5.37-12-12-12zm0 16.5c-2.49 0-4.5-2.01-4.5-4.5s2.01-4.5 4.5-4.5 4.5 2.01 4.5 4.5-2.01 4.5-4.5 4.5z" fill="#0b5c3e" />
                                <circle cx="12" cy="12" r="4" fill="white" />
                            </g>
                            <rect x="5" y="30" width="60" height="40" rx="4" fill="#ffffff" stroke="#cbd5e1" strokeWidth="2" />
                            <path d="M 0,30 L 70,30 L 60,15 L 10,15 Z" fill="#0b5c3e" />
                            <path d="M15 15l5 15M25 15l5 15M35 15l5 15M45 15l5 15 M55 15l5 15" stroke="#ffffff" strokeWidth="3" />
                            <rect x="25" y="48" width="20" height="22" rx="2" fill="#e2e8f0" />
                            <line x1="35" y1="48" x2="35" y2="70" stroke="#cbd5e1" strokeWidth="1" />
                            <circle cx="2" cy="50" r="10" fill="#81c784" />
                            <circle cx="68" cy="55" r="8" fill="#81c784" />
                            <rect x="15" y="2" width="40" height="10" rx="2" fill="#0b5c3e" />
                            <text x="35" y="9" fill="white" fontSize="5" fontWeight="900" textAnchor="middle" letterSpacing="0.5">FRESH MART</text>
                        </g>

                        {/* Right: House */}
                        <g transform="translate(330, 80)">
                            <g transform="translate(20, -35)">
                                <path d="M12 0C5.37 0 0 5.37 0 12c0 8.4 12 24 12 24s12-15.6 12-24c0-6.63-5.37-12-12-12zm0 16.5c-2.49 0-4.5-2.01-4.5-4.5s2.01-4.5 4.5-4.5 4.5 2.01 4.5 4.5-2.01 4.5-4.5 4.5z" fill="#0b5c3e" />
                                <circle cx="12" cy="12" r="4" fill="white" />
                            </g>
                            <rect x="5" y="20" width="40" height="30" rx="3" fill="#ffffff" stroke="#cbd5e1" strokeWidth="2" />
                            <polygon points="0,20 25,0 50,20" fill="#0b5c3e" />
                            <rect x="15" y="32" width="10" height="18" fill="#a7f3d0" />
                            <rect x="30" y="26" width="8" height="8" rx="1" fill="#e2e8f0" />
                            <circle cx="45" cy="45" r="7" fill="#81c784" />
                        </g>

                        {/* Middle: Heart Circle */}
                        <g transform="translate(205, 95)">
                            <circle cx="20" cy="20" r="20" fill="white" stroke="#10b981" strokeWidth="2" />
                            <circle cx="20" cy="20" r="17" fill="#e6f4ea" />
                            <path d="M20 28.35l-1.45-1.32C13.4 22.4 10 19.28 10 15.5 10 12.42 12.42 10 15.5 10c1.74 0 3.41.81 4.5 2.09C21.09 10.81 22.76 10 24.5 10 27.58 10 30 12.42 30 15.5c0 3.78-3.4 6.9-8.55 11.54L20 28.35z" fill="#0b5c3e" />
                        </g>

                        {/* Foreground: Vegetable Basket */}
                        <g transform="translate(155, 130)">
                            <path d="M30 40 C30 10, 110 10, 110 40" stroke="#1e293b" strokeWidth="4" fill="none" strokeLinecap="round" />
                            <path d="M35 40 C35 5, 105 5, 105 40" stroke="#475569" strokeWidth="5" fill="none" strokeLinecap="round" />
                            <rect x="10" y="40" width="120" height="60" rx="18" fill="#4fa883" />
                            <rect x="15" y="43" width="110" height="52" rx="15" fill="#5cb690" />
                            <rect x="5" y="36" width="130" height="10" rx="5" fill="#88d2b2" />
                            <g transform="translate(58, 55)">
                                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.9-8.55 11.54L12 21.35z" fill="white" />
                            </g>
                            <path d="M 0,55 C -10,50 -20,60 -5,65" fill="#81c784" />
                            <path d="M 140,55 C 150,50 160,60 145,65" fill="#81c784" />
                        </g>

                        {/* Leaf elements floating */}
                        <g transform="translate(30, 200) rotate(15)" opacity="0.5">
                            <path d="M0,0 Q10,-10 20,-5 Q10,10 0,0 Z" fill="#81c784" />
                        </g>
                        <g transform="translate(410, 180) rotate(-25)" opacity="0.5">
                            <path d="M0,0 Q10,-10 20,-5 Q10,10 0,0 Z" fill="#81c784" />
                        </g>
                    </svg>
                </div>

                {/* Wishlist Header Details */}
                <h1 className="text-xl font-black text-[#0b5c3e] uppercase tracking-[0.1em] text-center italic">Wishlist is Empty</h1>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-8 text-center max-w-[280px] leading-relaxed">
                    Save your favorite fresh vegetables and premium produce here.
                </p>

                {/* Action button with custom design decoration */}
                <div className="relative">
                    {/* Tiny hand-drawn swirly arrow vector decoration */}
                    <div className="absolute -left-10 -bottom-2 w-8 h-8 opacity-70 pointer-events-none select-none">
                        <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M5,10 C15,5 25,25 20,30 C18,32 10,25 10,25 M15,32 L20,30 L18,22" stroke="#0b5c3e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </div>

                    <Button 
                        onClick={() => router.push("/")} 
                        className="bg-[#0b5c3e] hover:bg-[#094d34] text-white rounded-full px-10 h-13 font-black uppercase tracking-widest text-[11px] shadow-[0_4px_16px_rgba(11,92,62,0.25)] flex items-center gap-2.5 transition-all duration-300 hover:scale-105 active:scale-95"
                    >
                        Start Exploring <span className="text-sm">→</span>
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f8faf9] pb-60 transition-colors">
            {/* Header */}
            <header className="fixed top-0 left-0 right-0 z-50 px-6 py-4 flex items-center gap-4 bg-white border-b border-slate-100 shadow-sm">
                <button
                    onClick={() => router.back()}
                    className="w-10 h-10 flex items-center justify-center bg-slate-50 rounded-full border border-slate-200 active:scale-90 transition-all"
                >
                    <ChevronLeft className="h-5 w-5 text-slate-700" strokeWidth={2.5} />
                </button>
                <div className="flex-1">
                    <span className="text-[9px] font-black text-[#0b5c3e] uppercase tracking-[0.2em] mb-0.5 block">Your Collection</span>
                    <h2 className="text-base font-black text-slate-800 leading-none tracking-tight uppercase">My Wishlist</h2>
                </div>
            </header>

            {/* Main Content */}
            <main className="pt-24 px-5 max-w-2xl mx-auto space-y-6 animate-in slide-in-from-bottom-4 duration-700">
                {/* Title & Count */}
                <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2.5">
                        <h1 className="text-xl font-black text-slate-900 uppercase tracking-wider italic">Favorites</h1>
                        <span className="bg-emerald-50 text-[#0b5c3e] text-[9px] font-black px-3.5 py-1 rounded-full uppercase tracking-wider border border-emerald-100">
                            {wishlistItems.length} {wishlistItems.length === 1 ? "Item" : "Items"}
                        </span>
                    </div>
                </div>

                {/* Items Grid */}
                <div className="space-y-4">
                    {wishlistItems.map((item, idx: number) => (
                        <div
                            key={item.productId}
                            className="bg-white rounded-[2rem] p-4.5 border border-slate-100 shadow-sm flex gap-4.5 transition-all duration-300 hover:shadow-md group overflow-hidden relative"
                            style={{ animationDelay: `${idx * 80}ms` }}
                        >
                            {/* Image container */}
                            <div className="relative w-20 h-20 rounded-2xl overflow-hidden bg-slate-50 border border-slate-100/60 flex-shrink-0 group-hover:scale-105 transition-transform duration-500">
                                <Image
                                    src={item.image || "/placeholder.png"}
                                    alt={item.name}
                                    fill
                                    className="object-contain p-2"
                                />
                            </div>

                            {/* Details */}
                            <div className="flex-1 flex flex-col justify-center gap-0.5 min-w-0">
                                <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight line-clamp-1">{item.name}</h3>
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-2.5">Premium Choice</p>
                                
                                <div className="flex items-center justify-between">
                                    <div className="flex flex-col">
                                         <span className="text-base font-black text-[#0b5c3e] tracking-tight italic">₹{item.price.toFixed(0)}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => removeFromWishlist(item.productId)}
                                            className="w-9 h-9 bg-red-50 border border-red-100 hover:bg-red-500 text-red-400 hover:text-white rounded-xl flex items-center justify-center transition-all active:scale-95 shadow-sm"
                                            title="Remove Item"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                        <button
                                            onClick={() => handleAddToCart(item)}
                                            className="h-9 px-4 bg-[#0b5c3e] hover:bg-[#094d34] text-white font-black text-[9px] uppercase tracking-widest rounded-xl flex items-center gap-2.5 transition-all active:scale-95 shadow-sm shadow-[#0b5c3e]/10"
                                        >
                                            <ShoppingBag className="h-3.5 w-3.5" /> Move to Cart
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </main>
        </div>
    );
}
