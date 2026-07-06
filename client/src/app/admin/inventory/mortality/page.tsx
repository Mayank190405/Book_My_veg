"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { 
    Search, 
    Save, 
    History, 
    QrCode,
    Package,
    Clock,
    Skull,
    ChevronRight
} from "lucide-react";
import api from "@/services/api";
import { toast } from "sonner";
import { useUserStore } from "@/store/useUserStore";
import { cn } from "@/lib/utils";
import QRScanner from "@/components/ui/qr-scanner";
import { useRouter } from "next/navigation";

interface MortalityEntry {
    productId: string;
    variantId: string | null;
    name: string;
    sku: string;
    quantity: string;
    reason: string;
    price: number;
}

export default function MortalityConsole() {
    const { user, activeStore } = useUserStore();
    const router = useRouter();
    const [products, setProducts] = useState<any[]>([]);
    const [entries, setEntries] = useState<MortalityEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(true);
    const [showScanner, setShowScanner] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    const reasons = [
        { id: "SPOILAGE", label: "Spoilage / Decay" },
        { id: "DAMAGE", label: "Physical Damage" },
        { id: "EXPIRED", label: "Expired" },
        { id: "THEFT", label: "Theft / Loss" }
    ];

    const fetchProducts = useCallback(async () => {
        const storeId = user?.locationId || activeStore?.id;
        setFetching(true);
        try {
            // Fetch Products
            const res = await api.get("/products/admin");
            const prods = (Array.isArray(res.data) ? res.data : (res.data.data || [])) as any[];
            setProducts(prods);
            
            // Fetch Latest Inward Rates for Defaults
            let costMap: Record<string, number> = {};
            if (storeId) {
                try {
                    const batchRes = await api.get(`/inventory/batch/${storeId}`);
                    const batches = batchRes.data as any[];
                    // Process from oldest to newest so newest overwrites in the map
                    [...batches].reverse().forEach(b => {
                        const key = b.variantId || b.productId;
                        if (key) costMap[key] = Number(b.costPrice);
                    });
                } catch (e) { console.error("Failed to fetch inward rates", e); }
            }

            // Flatten into entry rows
            const newEntries: MortalityEntry[] = [];
            prods.forEach(p => {
                if (p.variants?.length > 0) {
                    p.variants.forEach((v: any) => {
                        newEntries.push({
                            productId: p.id,
                            variantId: v.id,
                            name: `${p.name} (${v.name})`,
                            sku: v.sku || p.sku,
                            quantity: "",
                            reason: "SPOILAGE",
                            price: costMap[v.id] || Number(v.price || p.basePrice || 0)
                        });
                    });
                } else {
                    newEntries.push({
                        productId: p.id,
                        variantId: null,
                        name: p.name,
                        sku: p.sku,
                        quantity: "",
                        reason: "SPOILAGE",
                        price: costMap[p.id] || Number(p.basePrice || 0)
                    });
                }
            });
            setEntries(newEntries);
        } catch (error) {
            toast.error("Failed to fetch product catalog");
        } finally {
            setFetching(false);
        }
    }, [user?.locationId, activeStore?.id]);

    useEffect(() => {
        fetchProducts();
    }, [fetchProducts]);

    const handleQRScan = (decodedText: string) => {
        const query = decodedText.toLowerCase();
        const idx = entries.findIndex(e => 
            e.sku?.toLowerCase() === query || 
            (products.find(p => p.id === e.productId)?.sku?.toLowerCase() === query)
        );

        if (idx !== -1) {
            const newEntries = [...entries];
            const currentQty = parseFloat(newEntries[idx].quantity) || 0;
            newEntries[idx].quantity = (currentQty + 1).toString();
            setEntries(newEntries);
            toast.success(`Allocated: ${newEntries[idx].name}`);
            setShowScanner(false);
        } else {
            toast.error("Unrecognized optical ID");
        }
    };

    const submitMortality = async () => {
        const activeEntries = entries.filter(e => parseFloat(e.quantity) > 0);
        if (activeEntries.length === 0) {
            toast.error("Please allocate wastage for at least one item");
            return;
        }

        setLoading(true);
        try {
            const storeId = user?.locationId || activeStore?.id;
            if (!storeId) {
                toast.error("No active store context found. Please select a hub.");
                return;
            }

            for (const item of activeEntries) {
                await api.post("/inventory/mortality", {
                    productId: item.productId,
                    variantId: item.variantId,
                    locationId: storeId,
                    quantity: parseFloat(item.quantity),
                    reason: item.reason,
                    price: item.price // Send the manually set or defaulted price
                });
            }
            toast.success("Mortality reconciliation completed correctly");
            setEntries(entries.map(e => ({ ...e, quantity: "" })));
        } catch (error: any) {
            console.error("Mortality Submit Error:", error);
            const errorMsg = error.response?.data?.message || error.message || "Reconciliation failed";
            toast.error(errorMsg, {
                duration: 5000,
                description: "Ensure you are using the correct hub context."
            });
        } finally {
            setLoading(false);
        }
    };

    const filteredEntries = useMemo(() => {
        return entries.filter(e => 
            e.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
            e.sku?.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [entries, searchQuery]);

    return (
        <div className="min-h-screen bg-[#FDF8F8] p-4 md:p-8 font-sans">
            <div className="max-w-7xl mx-auto space-y-8">
                
                {/* HEADER */}
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-6 md:p-8 rounded-[2rem] md:rounded-[2.5rem] shadow-sm border border-red-100">
                    <div className="flex items-center gap-6">
                        <div className="w-12 h-12 md:w-16 md:h-16 bg-red-600 rounded-2xl md:rounded-3xl flex items-center justify-center text-white shadow-xl shadow-red-600/20">
                            <Skull className="w-6 h-6 md:w-8 md:h-8" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black text-slate-900 tracking-tighter lowercase">Mortality Console</h1>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="px-3 py-1 bg-red-50 text-red-600 text-[10px] font-black uppercase tracking-widest rounded-full border border-red-100 italic">Loss Reconciliation Active</span>
                                <span className="text-slate-400 text-xs font-bold flex items-center gap-1 ml-2">
                                    <Clock className="w-3.5 h-3.5" />
                                    {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} Reconciliation
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 md:justify-end">
                        <button 
                            onClick={() => router.push("/admin/inventory/mortality/history")}
                            className="h-14 px-8 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center gap-3 shadow-sm border bg-white text-slate-600 border-slate-200 hover:border-red-500 hover:text-red-500"
                        >
                            <History className="w-4 h-4" />
                            Loss History
                        </button>

                        <button 
                            onClick={() => setShowScanner(true)}
                            className="w-14 h-14 bg-white border border-slate-200 rounded-2xl flex items-center justify-center text-slate-400 hover:text-red-600 transition-all hover:bg-red-50 shadow-sm"
                        >
                            <QrCode className="w-6 h-6" />
                        </button>

                        <button 
                            onClick={submitMortality}
                            disabled={loading || entries.filter(e => parseFloat(e.quantity) > 0).length === 0}
                            className="h-14 bg-red-600 text-white px-10 rounded-2xl flex items-center gap-3 font-black text-xs uppercase tracking-widest shadow-xl shadow-red-600/30 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
                        >
                            <Save className="w-4 h-4" />
                            {loading ? "Reconciling..." : "Record Spoilage"}
                        </button>
                    </div>
                </header>

                {/* ENTRY GRID */}
                <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden min-h-[600px] flex flex-col">
                    <div className="p-6 border-b border-slate-100 flex items-center justify-between gap-6 bg-slate-50/30">
                        <div className="relative flex-1 max-w-md group">
                            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-red-500 transition-colors" />
                            <input 
                                type="text"
                                placeholder="Search wastage items..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full h-12 pl-14 pr-6 bg-white border border-slate-200 rounded-2xl text-xs font-bold outline-none focus:border-red-500 transition-all shadow-sm"
                            />
                        </div>
                        <div className="flex items-center gap-4 text-[10px] font-black text-slate-400 uppercase tracking-widest px-4">
                            <Package className="w-4 h-4 text-red-300" />
                            {entries.filter(e => parseFloat(e.quantity) > 0).length} Allocation active
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-[#FCFAFA] border-b border-slate-100">
                                <tr>
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest w-[30%]">Merchandise Asset</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Unit Cost</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Wastage Qty</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Total Loss</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Reason</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {fetching ? (
                                    [...Array(6)].map((_, i) => (
                                        <tr key={i} className="animate-pulse">
                                            <td colSpan={4} className="p-8">
                                                <div className="h-8 bg-slate-50 rounded-xl w-full" />
                                            </td>
                                        </tr>
                                    ))
                                ) : filteredEntries.map((entry) => {
                                    const globalIdx = entries.findIndex(e => e.productId === entry.productId && e.variantId === entry.variantId);
                                    const isActive = parseFloat(entry.quantity) > 0;

                                    return (
                                        <tr key={`${entry.productId}-${entry.variantId}`} className={cn(
                                            "transition-all duration-300",
                                            isActive ? "bg-red-50/30" : "hover:bg-slate-50"
                                        )}>
                                            <td className="px-8 py-6">
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-black text-slate-900 uppercase tracking-tight">{entry.name}</span>
                                                    <span className="text-[10px] text-slate-300 font-bold uppercase tracking-[0.2em] mt-1">SKU: {entry.sku || "GLOBAL_NODE"}</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="flex flex-col items-center gap-2">
                                                    <div className="relative group/price w-24">
                                                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[8px] font-bold text-slate-400">₹</span>
                                                        <input 
                                                            type="number"
                                                            value={entry.price}
                                                            onChange={(e) => {
                                                                const newEntries = [...entries];
                                                                newEntries[globalIdx].price = parseFloat(e.target.value) || 0;
                                                                setEntries(newEntries);
                                                            }}
                                                            className="w-full h-8 pl-5 pr-2 bg-slate-50 border border-slate-100 rounded-lg text-center text-[10px] font-black focus:border-red-500 focus:bg-white outline-none transition-all tabular-nums"
                                                        />
                                                    </div>
                                                    <span className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">Rate (Override)</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="flex justify-center">
                                                    <input 
                                                        type="number"
                                                        value={entry.quantity}
                                                        onChange={(e) => {
                                                            const newEntries = [...entries];
                                                            newEntries[globalIdx].quantity = e.target.value;
                                                            setEntries(newEntries);
                                                        }}
                                                        className={cn(
                                                            "w-24 h-11 rounded-xl border-2 text-center text-sm font-black transition-all outline-none tabular-nums shadow-sm",
                                                            isActive ? "border-red-500 bg-white ring-4 ring-red-50" : "border-slate-100 bg-slate-50/50"
                                                        )}
                                                        placeholder="0.000"
                                                    />
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="flex flex-col items-center">
                                                    <span className={cn(
                                                        "text-xs font-black transition-colors",
                                                        isActive ? "text-red-600" : "text-slate-200"
                                                    )}>₹{(Number(entry.quantity) * entry.price).toFixed(2)}</span>
                                                    {isActive && <span className="text-[8px] text-red-500/50 font-black uppercase tracking-widest animate-pulse mt-0.5">Financial Hit</span>}
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="flex justify-end">
                                                    <select 
                                                        value={entry.reason}
                                                        onChange={(e) => {
                                                            const newEntries = [...entries];
                                                            newEntries[globalIdx].reason = e.target.value;
                                                            setEntries(newEntries);
                                                        }}
                                                        className="w-32 h-10 bg-white border border-slate-200 rounded-xl px-2 text-[9px] font-black text-slate-600 uppercase tracking-tight focus:border-red-300 outline-none transition-all"
                                                    >
                                                        {reasons.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                                                    </select>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {showScanner && (
                <QRScanner 
                    onScan={handleQRScan}
                    onClose={() => setShowScanner(false)}
                    title="Mortality Reconnaissance"
                />
            )}
        </div>
    );
}
