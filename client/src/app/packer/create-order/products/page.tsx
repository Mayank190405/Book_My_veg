"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import api from "@/services/api";
import { toast } from "sonner";
import { ArrowLeft, Search, Plus, Minus, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function AddProductsContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const customerId = searchParams.get("customerId") || "walkin";
    const customerName = searchParams.get("name") || "Walk-in Customer";
    const customerPhone = searchParams.get("phone") || "";

    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [cart, setCart] = useState<{ [productId: string]: number }>({});

    useEffect(() => {
        const fetchProducts = async () => {
            try {
                const res = await api.get("/products");
                const list = Array.isArray(res.data) ? res.data : (res.data?.products || res.data?.data || []);
                setProducts(list);
            } catch (error: any) {
                toast.error("Failed to load products master");
                setProducts([]);
            } finally {
                setLoading(false);
            }
        };
        fetchProducts();
    }, []);

    // Load any existing draft cart
    useEffect(() => {
        try {
            const saved = sessionStorage.getItem("bmv_packer_cart");
            if (saved) setCart(JSON.parse(saved));
        } catch (e) {
            // ignore
        }
    }, []);

    const updateQty = (productId: string, delta: number) => {
        setCart(prev => {
            const current = prev[productId] || 0;
            const updated = Math.max(0, current + delta);
            const copy = { ...prev };
            if (updated <= 0) {
                delete copy[productId];
            } else {
                copy[productId] = updated;
            }
            try {
                sessionStorage.setItem("bmv_packer_cart", JSON.stringify(copy));
            } catch (e) {}
            return copy;
        });
    };

    const filteredProducts = products.filter(p => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        const nameMatch = (p.name || "").toLowerCase().includes(q);
        const skuMatch = (p.sku || p.barcode || "").toLowerCase().includes(q);
        return nameMatch || skuMatch;
    });

    const totalCount = Object.values(cart).reduce((sum, q) => sum + (q > 0 ? 1 : 0), 0);
    const totalAmount = Object.entries(cart).reduce((sum, [pId, qty]) => {
        const p = products.find(prod => prod.id === pId);
        const price = Number(p?.basePrice || p?.pricing?.[0]?.price || p?.price || 0);
        return sum + (price * qty);
    }, 0);

    const handleContinue = () => {
        if (totalCount === 0) {
            toast.error("Please add at least one product to the order");
            return;
        }

        const selectedItems = Object.entries(cart).map(([pId, qty]) => {
            const p = products.find(prod => prod.id === pId);
            return {
                productId: pId,
                productName: p?.name || "Item",
                sku: p?.sku || `VEG${pId.slice(-3).toUpperCase()}`,
                price: Number(p?.basePrice || p?.pricing?.[0]?.price || p?.price || 0),
                quantity: qty,
                unit: p?.weightUnit || "kg"
            };
        });

        sessionStorage.setItem("bmv_packer_order_payload", JSON.stringify({
            customerId,
            customerName: decodeURIComponent(customerName),
            customerPhone,
            items: selectedItems,
            totalAmount
        }));

        router.push("/packer/create-order/review");
    };

    return (
        <div className="flex-1 flex flex-col justify-between animate-in fade-in duration-300">
            {/* Top Bar (Screen 4) */}
            <div className="p-4 border-b border-slate-100 flex items-center gap-2 sticky top-0 bg-white z-10">
                <button onClick={() => router.push("/packer/create-order")} className="p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-full">
                    <ArrowLeft className="h-5 w-5" />
                </button>
                <h3 className="text-base font-black text-slate-900">Add Products</h3>
            </div>

            <div className="p-5 space-y-4 flex-1 overflow-y-auto pb-28">
                {/* Selected Customer Header Badge (Screen 4) */}
                <div className="bg-purple-50/70 border border-purple-100 p-3.5 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                            {customerName.charAt(0)}
                        </div>
                        <div>
                            <h5 className="text-xs font-bold text-slate-900">{decodeURIComponent(customerName)}</h5>
                            <p className="text-[11px] font-semibold text-slate-500">{customerPhone || "Walk-in Customer"}</p>
                        </div>
                    </div>
                    <button 
                        onClick={() => router.push("/packer/create-order")}
                        className="text-xs font-bold text-purple-700 hover:underline"
                    >
                        Change
                    </button>
                </div>

                {/* Product Search Bar (Screen 4) */}
                <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input 
                        placeholder="Search by product name or code..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-12 pl-10 rounded-2xl bg-slate-100 border-none text-xs font-bold focus:bg-white transition-all shadow-inner"
                    />
                </div>

                {/* Product List with Steppers (Screen 4) */}
                <div className="space-y-3 pt-1">
                    {loading ? (
                        <div className="p-12 text-center">
                            <Loader2 className="h-7 w-7 animate-spin mx-auto text-purple-600" />
                        </div>
                    ) : filteredProducts.length === 0 ? (
                        <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                            <p className="text-xs font-bold text-slate-400">No products match search</p>
                        </div>
                    ) : (
                        filteredProducts.map(product => {
                            const qty = cart[product.id] || 0;
                            const price = Number(product.basePrice || product.pricing?.[0]?.price || product.price || 0);
                            const sku = product.sku || `VEG${product.id.slice(-3).toUpperCase()}`;

                            return (
                                <div 
                                    key={product.id}
                                    className="bg-white p-3.5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between gap-3"
                                >
                                    <div className="flex items-center gap-3 min-w-0 flex-1">
                                        <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 overflow-hidden">
                                            {product.images?.[0] ? (
                                                <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <span className="text-xl">🥬</span>
                                            )}
                                        </div>
                                        <div className="min-w-0">
                                            <span className="text-[10px] font-black text-slate-400 uppercase">{sku}</span>
                                            <h5 className="text-xs font-bold text-slate-900 truncate">{product.name}</h5>
                                            <p className="text-xs font-black text-slate-700">
                                                ₹ {price} <span className="text-[10px] font-normal text-slate-400">/ {product.weightUnit || "kg"}</span>
                                            </p>
                                        </div>
                                    </div>

                                    {/* Stepper (Screen 4) */}
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        {qty > 0 && (
                                            <button 
                                                onClick={() => updateQty(product.id, -1)}
                                                className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold hover:bg-slate-200 active:scale-95"
                                            >
                                                <Minus className="h-3.5 w-3.5" />
                                            </button>
                                        )}
                                        <span className="w-7 text-center text-xs font-black text-slate-900">
                                            {qty}
                                        </span>
                                        <button 
                                            onClick={() => updateQty(product.id, 1)}
                                            className="w-8 h-8 rounded-xl bg-purple-700 text-white flex items-center justify-center font-bold hover:bg-purple-800 active:scale-95 shadow-sm shadow-purple-200"
                                        >
                                            <Plus className="h-3.5 w-3.5 stroke-[3]" />
                                        </button>
                                        <span className="text-[10px] text-slate-400 font-semibold w-5 text-right">
                                            {product.weightUnit || "kg"}
                                        </span>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Sticky Bottom Order Bar (Screen 4) */}
            <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white p-4 border-t border-slate-100 flex items-center justify-between z-20 shadow-2xl">
                <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">View Order ({totalCount})</p>
                    <p className="text-xl font-black text-slate-900">₹ {totalAmount.toFixed(2)}</p>
                </div>
                <Button 
                    onClick={handleContinue}
                    disabled={totalCount === 0}
                    className="h-12 px-8 rounded-2xl bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs shadow-lg shadow-purple-200"
                >
                    Continue
                </Button>
            </div>
        </div>
    );
}

export default function AddProductsPage() {
    return (
        <Suspense fallback={<div className="p-12 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-purple-600" /></div>}>
            <AddProductsContent />
        </Suspense>
    );
}
