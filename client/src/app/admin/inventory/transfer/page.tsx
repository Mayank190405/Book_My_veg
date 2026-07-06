"use client";

import { useState, useEffect } from "react";
import { 
    ArrowLeftRight, 
    Search, 
    Plus, 
    Trash2, 
    Store, 
    Package, 
    ChevronRight, 
    AlertCircle,
    CheckCircle2,
    Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
import api from "@/services/api";
import { toast } from "sonner";
import { useUserStore } from "@/store/useUserStore";

interface Product {
    id: string;
    name: string;
    variants: any[];
}

interface TransferItem {
    productId: string;
    productName: string;
    variantId: string | null;
    variantName: string;
    quantity: number;
    currentStock: number;
}

export default function StockTransferPage() {
    const { user } = useUserStore();
    const [locations, setLocations] = useState<any[]>([]);
    const [sourceId, setSourceId] = useState("");
    const [destId, setDestId] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [transferItems, setTransferItems] = useState<TransferItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [searching, setSearching] = useState(false);

    // Initial Hub Discovery
    useEffect(() => {
        const fetchLocations = async () => {
            try {
                const { data } = await api.get("/locations");
                setLocations(data);
                // Default source for STORE_ADMIN
                if (user?.role === "STORE_ADMIN" && user.locationId) {
                    setSourceId(user.locationId);
                }
            } catch (error) {
                toast.error("Failed to fetch locations");
            }
        };
        fetchLocations();
    }, [user]);

    // Adaptive Product Discovery
    useEffect(() => {
        const searchProducts = async () => {
            if (searchTerm.length < 2) {
                setSearchResults([]);
                return;
            }
            setSearching(true);
            try {
                // Use the unrestricted administrative registry for full synchronization
                const { data } = await api.get(`/products/admin?search=${searchTerm}`);
                // Admin endpoint returns a flat array of products
                setSearchResults(Array.isArray(data) ? data : (data.data || []));
            } catch (error) {
                console.error("Search failed");
            } finally {
                setSearching(false);
            }
        };

        const timeout = setTimeout(searchProducts, 300);
        return () => clearTimeout(timeout);
    }, [searchTerm, sourceId]);

    const addItem = async (product: any, variant: any = null) => {
        if (!sourceId) {
            toast.warning("Please select source location first");
            return;
        }

        // Check if already in basket
        if (transferItems.find(i => i.productId === product.id && i.variantId === (variant?.id || null))) {
            toast.info("Item already added to transfer list");
            return;
        }

        try {
            // Get current stock for this specific node
            const { data } = await api.get(`/inventory/store/${sourceId}`);
            const node = data.find((inv: any) => 
                inv.productId === product.id && 
                inv.variantId === (variant?.id || null)
            );

            const sourceStock = node ? Number(node.currentStock) : 0;

            if (sourceStock <= 0) {
                toast.error(`Out of stock at source: ${product.name}`);
                return;
            }

            const newItem: TransferItem = {
                productId: product.id,
                productName: product.name,
                variantId: variant?.id || null,
                variantName: variant?.name || "Standard",
                quantity: 1,
                currentStock: sourceStock
            };

            setTransferItems([...transferItems, newItem]);
            setSearchTerm("");
            setSearchResults([]);
        } catch (error) {
            toast.error("Stock verification failed");
        }
    };

    const removeItem = (index: number) => {
        setTransferItems(transferItems.filter((_, i) => i !== index));
    };

    const updateQty = (index: number, val: string) => {
        const qty = parseFloat(val) || 0;
        const items = [...transferItems];
        if (qty > items[index].currentStock) {
            toast.warning(`Cannot transfer more than available stock (${items[index].currentStock})`);
            items[index].quantity = items[index].currentStock;
        } else {
            items[index].quantity = qty;
        }
        setTransferItems(items);
    };

    const handleTransfer = async () => {
        if (!sourceId || !destId || transferItems.length === 0) {
            toast.error("Please complete all transfer details");
            return;
        }

        if (sourceId === destId) {
            toast.error("Source and Destination cannot be the same");
            return;
        }

        setLoading(true);
        try {
            await api.post("/inventory/transfer", {
                sourceLocationId: sourceId,
                destLocationId: destId,
                items: transferItems.map(i => ({
                    productId: i.productId,
                    variantId: i.variantId,
                    quantity: i.quantity
                }))
            });

            toast.success("Inter-store transfer completed successfully");
            setTransferItems([]);
            setDestId("");
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Transfer failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-10">
            {/* Header Section */}
            <div className="flex flex-col gap-2">
                <div className="flex items-center gap-4 text-emerald-600">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center shadow-inner">
                        <ArrowLeftRight className="h-6 w-6" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black tracking-tight text-slate-900 lowercase">Inter-Store Transfer</h1>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">Movement Isolation & Reconciliation Portal</p>
                    </div>
                </div>
            </div>

            <div className="grid lg:grid-cols-12 gap-10">
                {/* Configuration Panel */}
                <div className="lg:col-span-4 space-y-6">
                    <div className="bg-white rounded-3xl border border-slate-100 shadow-xl p-8 space-y-8">
                        <div className="space-y-6">
                            <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                                <Store className="h-4 w-4 text-emerald-500" />
                                Hub Routing
                            </h3>
                            
                            {/* From Location */}
                            <div className="space-y-3">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Departure Hub (From)</label>
                                <select 
                                    value={sourceId}
                                    onChange={(e) => {
                                        setSourceId(e.target.value);
                                        setTransferItems([]);
                                    }}
                                    disabled={user?.role === "STORE_ADMIN"}
                                    className="w-full h-14 bg-slate-50 border-2 border-transparent focus:border-emerald-500/30 rounded-2xl px-6 text-sm font-bold text-slate-900 transition-all outline-none"
                                >
                                    <option value="">Select Origin Store</option>
                                    {locations.map(loc => (
                                        <option key={loc.id} value={loc.id}>{loc.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Destination */}
                            <div className="space-y-3">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Arrival Hub (To)</label>
                                <select 
                                    value={destId}
                                    onChange={(e) => setDestId(e.target.value)}
                                    className="w-full h-14 bg-slate-50 border-2 border-transparent focus:border-blue-500/30 rounded-2xl px-6 text-sm font-bold text-slate-900 transition-all outline-none"
                                >
                                    <option value="">Select Destination Store</option>
                                    {locations.filter(l => l.id !== sourceId).map(loc => (
                                        <option key={loc.id} value={loc.id}>{loc.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {destId && sourceId && (
                            <div className="p-5 bg-blue-50 rounded-2xl border border-blue-100 flex gap-4">
                                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-blue-600 shadow-sm">
                                    <CheckCircle2 className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-blue-700 uppercase tracking-tight">Route Confirmed</p>
                                    <p className="text-[9px] font-bold text-blue-500 opacity-80 mt-0.5">Ready for item allocation</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Allocation Panel */}
                <div className="lg:col-span-8 space-y-6">
                    <div className="bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden min-h-[600px] flex flex-col">
                        <div className="p-8 border-b border-slate-100 bg-white sticky top-0 z-10 space-y-6">
                            <div className="flex items-center justify-between">
                                <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                                    <Package className="h-4 w-4 text-emerald-500" />
                                    Manifest Items
                                </h3>
                                <span className="bg-slate-50 text-[10px] font-black text-slate-400 px-3 py-1 rounded-full border border-slate-100 uppercase tracking-tight">
                                    {transferItems.length} Products Selected
                                </span>
                            </div>

                            {/* Search bar */}
                            <div className="relative group">
                                <div className={cn(
                                    "absolute inset-y-0 left-0 pl-6 flex items-center transition-colors",
                                    searching ? "text-emerald-500" : "text-slate-400 group-focus-within:text-emerald-500"
                                )}>
                                    {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                                </div>
                                <input 
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="Search products to transfer..."
                                    className="w-full h-16 bg-slate-50 border-2 border-transparent focus:border-emerald-500/40 rounded-2xl pl-16 pr-6 text-sm font-bold text-slate-900 placeholder:text-slate-400 transition-all outline-none"
                                />
                                
                                {/* Search Results Overlay */}
                                {searchResults.length > 0 && (
                                    <div className="absolute top-20 left-0 w-full bg-white border border-slate-100 rounded-2xl shadow-2xl z-50 p-3 max-h-80 overflow-y-auto animate-in fade-in slide-in-from-top-4 duration-300">
                                        {searchResults.map(prod => (
                                            <div key={prod.id} className="p-3 space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs font-black text-slate-800 uppercase tracking-tight">{prod.name}</span>
                                                    {prod.variants.length === 0 && (
                                                        <button 
                                                            onClick={() => addItem(prod)}
                                                            className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
                                                        >
                                                            <Plus className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                </div>
                                                {prod.variants.map((v: any) => (
                                                    <div key={v.id} className="ml-4 flex items-center justify-between p-2 hover:bg-slate-50 rounded-xl transition-all group/v">
                                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{v.name} ({v.weight}{v.weightUnit})</span>
                                                        <button 
                                                            onClick={() => addItem(prod, v)}
                                                            className="w-8 h-8 flex items-center justify-center bg-slate-100 text-slate-400 rounded-lg group-hover/v:bg-emerald-500 group-hover/v:text-white transition-all"
                                                        >
                                                            <Plus className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Items Table */}
                        <div className="flex-1 overflow-y-auto p-4">
                            {transferItems.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-center p-10 opacity-40">
                                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100 shadow-inner">
                                        <Package className="h-8 w-8" />
                                    </div>
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em]">Manifest is empty</p>
                                    <p className="text-[9px] font-bold mt-1">Allocate products using the search console</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {transferItems.map((item, index) => (
                                        <div key={`${item.productId}-${item.variantId}`} className="group relative bg-slate-50 rounded-2xl border border-transparent hover:border-emerald-500/20 hover:bg-white hover:shadow-xl hover:shadow-emerald-900/5 transition-all duration-300 p-5 flex items-center gap-6 animate-in slide-in-from-bottom-5 fade-in duration-500">
                                            <div className="flex-1">
                                                <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-tight">{item.productName}</h4>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 rounded-full uppercase tracking-widest border border-emerald-100">{item.variantName}</span>
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase">Avail: {item.currentStock}</span>
                                                </div>
                                            </div>
                                            
                                            <div className="flex items-center bg-white rounded-xl border border-slate-200 p-1 shadow-sm group-hover:border-emerald-500/30 transition-all">
                                                <input 
                                                    type="number"
                                                    value={item.quantity}
                                                    onChange={(e) => updateQty(index, e.target.value)}
                                                    className="w-24 h-10 bg-transparent text-center text-sm font-black text-slate-900 outline-none"
                                                />
                                            </div>

                                            <button 
                                                onClick={() => removeItem(index)}
                                                className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 hover:border-red-200 transition-all active:scale-95"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Footer Action */}
                        <div className="p-8 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-6">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
                                    <AlertCircle className="h-5 w-5 text-amber-500" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-slate-900 uppercase tracking-tight">Atomic Reconciliation</p>
                                    <p className="text-[9px] font-bold text-slate-400 mt-0.5 uppercase tracking-tighter">Stock levels will be matched instantly across nodes</p>
                                </div>
                            </div>

                            <button 
                                onClick={handleTransfer}
                                disabled={loading || transferItems.length === 0 || !destId}
                                className={cn(
                                    "h-16 px-10 rounded-2xl flex items-center gap-3 transition-all font-black text-xs uppercase tracking-widest shadow-lg active:scale-95 disabled:scale-100",
                                    loading || transferItems.length === 0 || !destId
                                        ? "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
                                        : "bg-emerald-600 text-white shadow-emerald-200/50 hover:bg-emerald-700 hover:-translate-y-1"
                                )}
                            >
                                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ChevronRight className="h-5 w-5" />}
                                {loading ? "Authorizing Transfer..." : "Execute Transfer"}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
