"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { 
    Search, 
    Save, 
    History, 
    Package, 
    ArrowDownToLine,
    Clock,
    Filter,
    RefreshCw,
    CheckCircle2,
    FileUp,
    FileDown,
    Download,
    QrCode
} from "lucide-react";
import QRScanner from "@/components/ui/qr-scanner";
import api from "@/services/api";
import { toast } from "sonner";
import { useUserStore } from "@/store/useUserStore";
import { cn } from "@/lib/utils";
import Papa from "papaparse";
import { useRef } from "react";

interface Variant {
    id: string;
    name: string;
    price: number;
    weightUnit: string;
    sku: string;
}

interface Product {
    id: string;
    name: string;
    sku: string;
    basePrice: number;
    weightUnit: string;
    variants: Variant[];
}

interface EntryRow {
    productId: string;
    variantId: string | null;
    name: string;
    sku: string;
    quantity: string; // Use string for input control
    costPrice: string;
    unit: string;
}

export default function MorningStockEntry() {
    const { user, activeStore } = useUserStore();
    const [products, setProducts] = useState<Product[]>([]);
    const [entries, setEntries] = useState<EntryRow[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [showHistory, setShowHistory] = useState(false);
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(true);
    const [showScanner, setShowScanner] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleDownloadTemplate = () => {
        const templateData = [{
            "Product Name": "Fresh Spinach",
            "Variant Name": "Small Pack",
            "SKU": "SP-001",
            "Quantity": "50",
            "Cost Price": "12.50"
        }];
        const csv = Papa.unparse(templateData);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `inward_import_template.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("Inward template generated.");
    };

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            transformHeader: (h) => h.trim(),
            complete: (results) => {
                const newEntries = [...entries];
                let success = 0;
                let ignored = 0;

                (results.data as any[]).forEach(row => {
                    const pName = row["Product Name"] || row["product"] || row["name"];
                    const vName = row["Variant Name"] || row["variant"] || "Standard";
                    const qty = row["Quantity"] || row["qty"] || "0";
                    const cost = row["Cost Price"] || row["cost"] || "0";

                    if (!pName) return;

                    // Match existing entry
                    const idx = newEntries.findIndex(e => 
                        e.name.toLowerCase().includes(pName.toLowerCase())
                    );

                    if (idx !== -1) {
                        newEntries[idx].quantity = qty.toString();
                        newEntries[idx].costPrice = cost.toString();
                        success++;
                    } else {
                        ignored++;
                    }
                });

                setEntries(newEntries);
                toast.success(`Imported ${success} entries. ${ignored} items not found in current catalog.`);
                if (fileInputRef.current) fileInputRef.current.value = "";
            }
        });
    };

    const fetchProducts = useCallback(async () => {
        const storeId = user?.locationId || activeStore?.id;
        if (!storeId) return;
        
        setFetching(true);
        try {
            const res = await api.get("/pos/products/store", { params: { locationId: storeId } });
            const prods = res.data as Product[];
            setProducts(prods);
            
            // Flatten products into entry rows
            const newEntries: EntryRow[] = [];
            prods.forEach(p => {
                if (p.variants.length > 0) {
                    p.variants.forEach(v => {
                        newEntries.push({
                            productId: p.id,
                            variantId: v.id,
                            name: `${p.name} (${v.name})`,
                            sku: v.sku || p.sku,
                            quantity: "",
                            costPrice: "", 
                            unit: v.weightUnit || p.weightUnit
                        });
                    });
                } else {
                    newEntries.push({
                        productId: p.id,
                        variantId: null,
                        name: p.name,
                        sku: p.sku,
                        quantity: "",
                        costPrice: "",
                        unit: p.weightUnit
                    });
                }
            });
            setEntries(newEntries);
        } catch (error) {
            toast.error("Failed to fetch product catalog");
        } finally {
            setFetching(false);
        }
    }, []);

    const fetchHistory = useCallback(async () => {
        const storeId = user?.locationId || activeStore?.id;
        if (!storeId) return;
        try {
            const res = await api.get(`/inventory/batch/${storeId}`);
            setHistory(res.data);
        } catch (error) {
            console.error("Failed to fetch history", error);
        }
    }, [user?.locationId, activeStore?.id]);

    useEffect(() => {
        fetchProducts();
        fetchHistory();
    }, [fetchProducts, fetchHistory]);

    // Handle QR Scan
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
            
            // Auto-fill cost from history if empty
            if (!newEntries[idx].costPrice) {
                const hist = history.find(h => h.productId === newEntries[idx].productId);
                if (hist) newEntries[idx].costPrice = Number(hist.costPrice).toString();
            }

            setEntries(newEntries);
            toast.success(`Identified: ${newEntries[idx].name}`);
            setShowScanner(false);
        } else {
            toast.error("Product not recognized by SKU/Batch ID");
        }
    };

    const updateEntry = (index: number, field: "quantity" | "costPrice", value: string) => {
        const newEntries = [...entries];
        newEntries[index][field] = value;
        setEntries(newEntries);
    };

    const submitInward = async () => {
        const validItems = entries
            .filter(e => parseFloat(e.quantity) > 0)
            .map(e => ({
                ...e,
                quantity: parseFloat(e.quantity),
                costPrice: parseFloat(e.costPrice) || 0
            }));

        if (validItems.length === 0) {
            toast.error("Please enter quantity for at least one item");
            return;
        }

        setLoading(true);
        try {
            const storeId = user?.locationId || activeStore?.id;
            if (!storeId) {
                toast.error("No active store context found. Please select a hub.");
                return;
            }

            // Correct relative path (api instance already has /api/v1)
            await api.post("/inventory/batch", {
                locationId: storeId,
                items: validItems
            });
            toast.success("Stock entries processed successfully!");
            
            // Reset quantities
            setEntries(entries.map(e => ({ ...e, quantity: "" })));
            fetchHistory();
        } catch (error: any) {
            console.error("Inward Submit Error:", error);
            if (error.response?.status === 404) {
                toast.error("Endpoint not found. Please wait for server sync.");
            } else {
                toast.error(error.response?.data?.message || "Failed to process inward entries");
            }
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

    const itemsToSubmit = entries.filter(e => parseFloat(e.quantity) > 0).length;

    return (
        <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-8 font-sans">
            <div className="max-w-7xl mx-auto space-y-6">
                
                {/* HEADER SECTION */}
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 md:p-6 rounded-3xl shadow-sm border border-slate-200">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 md:w-14 md:h-14 bg-indigo-600 rounded-xl md:rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-600/20">
                            <ArrowDownToLine className="w-5 h-5 md:w-7 md:h-7" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Morning Inward Console</h1>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-black uppercase tracking-widest rounded-full border border-indigo-200">Bulk Entry Mode</span>
                                <span className="text-slate-400 text-xs font-bold flex items-center gap-1">
                                    <Clock className="w-3 h-3 text-slate-300" />
                                    {new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })}
                                </span>
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-2 md:justify-end">
                        <input type="file" ref={fileInputRef} onChange={handleImport} accept=".csv" className="hidden" />
                        
                        <button 
                            onClick={handleDownloadTemplate}
                            className="w-12 h-12 bg-white border border-slate-200 rounded-2xl flex items-center justify-center text-slate-400 hover:text-emerald-600 transition-all shadow-sm"
                            title="Download Template"
                        >
                            <Download className="w-5 h-5" />
                        </button>

                        <button 
                            onClick={() => fileInputRef.current?.click()}
                            className="h-12 bg-white border border-slate-200 text-slate-600 px-6 rounded-2xl flex items-center justify-center gap-3 hover:bg-slate-50 active:scale-95 transition-all font-bold text-xs uppercase tracking-widest shadow-sm"
                        >
                            <FileUp className="w-4 h-4" />
                            <span>Bulk Import</span>
                        </button>

                        <button 
                            onClick={() => setShowHistory(!showHistory)}
                            className={cn(
                                "flex items-center gap-2 px-6 h-12 rounded-2xl font-black text-sm uppercase tracking-wider transition-all border shadow-sm",
                                showHistory 
                                    ? "bg-slate-900 text-white border-slate-900" 
                                    : "bg-white text-slate-600 border-slate-200 hover:border-indigo-500 hover:text-indigo-600"
                            )}
                        >
                            <History className="w-4 h-4" />
                            {showHistory ? "Back to Entry" : "View History"}
                        </button>

                        <button 
                            onClick={() => setShowScanner(true)}
                            className="w-12 h-12 bg-white border border-slate-200 rounded-2xl flex items-center justify-center text-slate-400 hover:text-indigo-600 transition-all shadow-sm"
                            title="Scan Product QR"
                        >
                            <QrCode className="w-5 h-5" />
                        </button>

                        {!showHistory && (
                            <button 
                                onClick={submitInward}
                                disabled={loading || itemsToSubmit === 0}
                                className="flex items-center gap-2 px-8 h-12 bg-indigo-600 text-white rounded-2xl font-black text-sm uppercase tracking-wider shadow-lg shadow-indigo-600/30 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
                            >
                                <Save className="w-4 h-4" />
                                {loading ? "Saving..." : `Save ${itemsToSubmit} Entries`}
                            </button>
                        )}
                    </div>
                </header>

                {showHistory ? (
                    /* HISTORY MODE */
                    <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="p-6 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                            <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">Recent Inward Logs</h2>
                            <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                                <Filter className="w-3 h-3" />
                                100 Most Recent
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50/50 border-b border-slate-100">
                                    <tr>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Product</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Batch ID</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Initial Qty</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Cost Price</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Staff</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Timestamp</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {history.map((h) => (
                                        <tr key={h.id} className="hover:bg-indigo-50/20 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-black text-slate-800 uppercase tabular-nums">{h.product?.name}</span>
                                                    {h.variant && <span className="text-[10px] text-indigo-600 font-bold uppercase">{h.variant.name}</span>}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-[9px] font-bold text-slate-400 tracking-tighter uppercase">{h.batchNumber}</td>
                                            <td className="px-6 py-4">
                                                <span className="px-2 py-1 bg-slate-100 rounded-lg text-xs font-black text-slate-900 tabular-nums">{Number(h.initialQty)}</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-xs font-black text-slate-900 tabular-nums">₹{Number(h.costPrice).toFixed(2)}</span>
                                            </td>
                                            <td className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase">{h.staff?.name || "System"}</td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex flex-col items-end">
                                                    <span className="text-[10px] font-black text-slate-800">{new Date(h.createdAt).toLocaleDateString()}</span>
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase">{new Date(h.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    /* ENTRY MODE - SPREADSHEET STYLE */
                    <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                        <div className="p-5 border-b border-slate-100 flex items-center justify-between gap-4">
                            <div className="relative flex-1 max-w-md group">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                                <input 
                                    type="text"
                                    placeholder="Instant Filter Products..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full h-11 pl-12 pr-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold outline-none focus:border-indigo-500 focus:bg-white transition-all shadow-inner"
                                />
                            </div>
                            <button 
                                onClick={fetchProducts}
                                className="w-11 h-11 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-center text-slate-400 hover:text-indigo-500 transition-colors"
                            >
                                <RefreshCw className={cn("w-4 h-4", fetching && "animate-spin")} />
                            </button>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50/80 border-b border-slate-100 sticky top-0 z-10">
                                    <tr>
                                        <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest w-[40%]">Product Details</th>
                                        <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Unit</th>
                                        <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Stock In (Qty)</th>
                                        <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Cost Price (₹)</th>
                                        <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right whitespace-nowrap">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {filteredEntries.map((entry, idx) => {
                                        const globalIdx = entries.findIndex(e => e.productId === entry.productId && e.variantId === entry.variantId);
                                        const isActive = parseFloat(entry.quantity) > 0;
                                        
                                        return (
                                            <tr key={`${entry.productId}-${entry.variantId}`} className={cn(
                                                "transition-colors",
                                                isActive ? "bg-indigo-50/30" : "hover:bg-slate-50/50"
                                            )}>
                                                <td className="px-8 py-4">
                                                    <div className="flex flex-col">
                                                        <span className="text-xs font-black text-slate-800 uppercase tracking-tight">{entry.name}</span>
                                                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">SKU: {entry.sku || "N/A"}</span>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-4 text-center">
                                                    <span className="px-2 py-0.5 bg-slate-100 rounded text-[10px] font-black text-slate-500 uppercase tracking-wider">{entry.unit}</span>
                                                </td>
                                                <td className="px-8 py-4">
                                                    <div className="flex justify-center">
                                                        <input 
                                                            type="number"
                                                            value={entry.quantity}
                                                            onChange={(e) => updateEntry(globalIdx, "quantity", e.target.value)}
                                                            className={cn(
                                                                "w-28 h-10 border-2 rounded-xl text-center text-sm font-black outline-none transition-all tabular-nums",
                                                                isActive 
                                                                    ? "border-indigo-500 bg-white ring-4 ring-indigo-50" 
                                                                    : "border-slate-200 bg-slate-50/50 focus:border-indigo-300 focus:bg-white"
                                                            )}
                                                            placeholder="0"
                                                        />
                                                    </div>
                                                </td>
                                                <td className="px-8 py-4">
                                                    <div className="flex justify-center">
                                                        <div className="relative w-28 group/input">
                                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-[10px]">₹</span>
                                                            <input 
                                                                type="number"
                                                                value={entry.costPrice}
                                                                onChange={(e) => updateEntry(globalIdx, "costPrice", e.target.value)}
                                                                className={cn(
                                                                    "w-full h-10 pl-6 border-2 rounded-xl text-center text-sm font-black outline-none transition-all tabular-nums",
                                                                    isActive 
                                                                        ? "border-indigo-500 bg-white shadow-sm" 
                                                                        : "border-slate-100 bg-slate-50/50 focus:border-indigo-300 focus:bg-white"
                                                                )}
                                                            />
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-4 text-right">
                                                    {isActive ? (
                                                        <div className="flex items-center justify-end gap-2 text-indigo-600 font-black text-[10px] uppercase">
                                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                                            Ready
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-300 font-bold text-[10px] uppercase">Skip</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {showScanner && (
                <QRScanner 
                    onScan={handleQRScan}
                    onClose={() => setShowScanner(false)}
                    title="Inward Product Scan"
                />
            )}

            {/* FLOATING ACTION BAR FOR MOBILE/QUICK SAVE */}
            {!showHistory && itemsToSubmit > 0 && (
                <div className="fixed bottom-6 left-4 right-4 md:left-1/2 md:-translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <div className="bg-slate-900 text-white rounded-2xl md:rounded-full p-2 pl-4 md:pl-8 pr-2 flex items-center justify-between md:gap-8 shadow-2xl border border-slate-700 backdrop-blur-md bg-opacity-90">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Items to Inward</span>
                            <span className="text-lg font-black text-indigo-400 leading-none">{itemsToSubmit} Items</span>
                        </div>
                        <button 
                            onClick={submitInward}
                            className="bg-indigo-500 text-white h-14 px-10 rounded-full font-black uppercase text-sm tracking-widest shadow-xl shadow-indigo-500/20 hover:bg-indigo-400 active:scale-95 transition-all flex items-center gap-3"
                        >
                            <Save className="w-5 h-5" />
                            Submit Morning Catalog
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
