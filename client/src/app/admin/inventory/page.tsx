"use client";
import { 
    Warehouse, 
    Plus, 
    Search, 
    Filter, 
    MoreVertical,
    MoreHorizontal,
    Edit2,
    Trash2,
    ChevronLeft,
    ChevronRight,
    ArrowUpDown,
    CheckCircle2,
    XCircle,
    Boxes,
    Package,
    Store,
    AlertCircle,
    RefreshCw,
    PlusCircle,
    MinusCircle,
    Save,
    X,
    Activity,
    Layers,
    ArrowUpRight,
    TrendingUp,
    Skull
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import api from "@/services/api";
import { toast } from "sonner";
import Papa from "papaparse";
import { useRef } from "react";
import { Label } from "@/components/ui/label";

import { useUserStore } from "@/store/useUserStore";

export default function AdminInventory() {
    const { user } = useUserStore();
    const [stores, setStores] = useState<any[]>([]);
    const [selectedStore, setSelectedStore] = useState<string>("");
    const [inventory, setInventory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const isStoreAdmin = user?.role === "STORE_ADMIN";
    const [isAdjustOpen, setIsAdjustOpen] = useState(false);
    const [isMortalityOpen, setIsMortalityOpen] = useState(false);
    const [search, setSearch] = useState("");

    const [adjustData, setAdjustData] = useState({
        productId: "",
        variantId: "",
        quantity: "0",
        type: "ADJUSTMENT" as "ADJUSTMENT" | "SALE" | "PURCHASE" | "TRANSFER" | "SPOILAGE",
        reason: ""
    });
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleExport = () => {
        try {
            const exportData = inventory.map(item => ({
                "Product Name": item.product?.name || "N/A",
                "Variant Name": item.variant?.name || "Standard",
                "SKU": item.product?.sku || item.product?.barcode || "N/A",
                "Current Stock": item.currentStock,
                "Restock Qty": 0,
                "Threshold": item.thresholdStock,
                "Unit": item.product?.weightUnit || "kg"
            }));
            const csv = Papa.unparse(exportData);
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", `inventory_sync_${selectedStore}_${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            toast.success("Inventory registry exported successfully");
        } catch (error) {
            toast.error("Failed to generate inventory registry");
        }
    };

    const handleDownloadTemplate = () => {
        try {
            const templateData = [{
                "Product Name": "Fresh Spinach",
                "Variant Name": "Small Pack",
                "SKU": "SP-001",
                "Restock Qty": "50",
                "Threshold": "10"
            }];
            const csv = Papa.unparse(templateData);
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", `inventory_restock_template.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            toast.success("Inventory protocol template generated.");
        } catch (error) {
            toast.error("Template generation failed");
        }
    };

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Helper to get row value case-insensitively and ignore non-alphanumeric layout symbols (spaces, BOM, underscores, hyphens)
        const getRowVal = (row: any, targetKeys: string[]) => {
            const keys = Object.keys(row);
            for (const key of keys) {
                const cleanKey = key.replace(/^\ufeff/, "").toLowerCase().replace(/[^a-z0-9]/g, "");
                for (const targetKey of targetKeys) {
                    const cleanTarget = targetKey.toLowerCase().replace(/[^a-z0-9]/g, "");
                    if (cleanKey === cleanTarget) {
                        return row[key];
                    }
                }
            }
            return undefined;
        };

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            transformHeader: (h) => h.replace(/^\ufeff/, "").replace(/^\uFEFF/, "").trim(),
            complete: async (results) => {
                setLoading(true);
                
                try {
                    // Trigger institutional sync first to ensure all registry nodes exist at this location
                    toast.info("Unifying merchandise registry with active location...");
                    await api.post("/inventory/sync", { locationId: selectedStore });
                    
                    // Re-fetch current location inventory to include newly unified nodes
                    const refreshRes = await api.get(`/inventory/store/${selectedStore}`);
                    const latestInventory = refreshRes.data;
                    
                    let successCount = 0;
                    let failureCount = 0;
                    const unmappedProducts = [];
                    const failedUpdates = [];
                    
                    for (const row of results.data as any[]) {
                        try {
                            const rawPName = getRowVal(row, ["Product Name", "product", "name"]);
                            const rawVName = getRowVal(row, ["Variant Name", "variant"]);
                            const rawRestock = getRowVal(row, ["Restock Qty", "quantity", "RestockQty", "qty"]);

                            if (!rawPName) continue;

                            const pName = rawPName.toString().trim();
                            const vNameTrimmed = (rawVName || "").toString().trim();
                            const vName = vNameTrimmed === "" ? "standard" : vNameTrimmed;
                            const restockVal = parseInt(rawRestock?.toString() || "0");
                            
                            if (restockVal === 0) continue;

                            // Identify the inventory record in the refreshed list
                            const existing = latestInventory.find((inv: any) => 
                                inv.product?.name?.toLowerCase() === pName.toLowerCase() && 
                                (inv.variant?.name?.toLowerCase() === vName.toLowerCase() || (!inv.variant && vName.toLowerCase() === "standard"))
                            );

                            if (existing) {
                                try {
                                    await api.post(`/inventory/adjust`, {
                                        productId: existing.productId,
                                        variantId: existing.variantId,
                                        quantity: restockVal,
                                        locationId: selectedStore,
                                        type: "PURCHASE",
                                        reason: "Bulk restock via protocol synchronization"
                                    });
                                    successCount++;
                                } catch (err) {
                                    failedUpdates.push(`${pName} (${vName})`);
                                    failureCount++;
                                }
                            } else {
                                unmappedProducts.push(`${pName} (${vName})`);
                                failureCount++;
                            }
                        } catch (error) {
                            failureCount++;
                        }
                    }

                    if (successCount > 0) {
                        toast.success(`Inventory synchronization summary: ${successCount} successful restocks.`);
                    }
                    if (unmappedProducts.length > 0) {
                        toast.error(`Ingestion warning: ${unmappedProducts.length} items failed because they do not exist in the database catalog (e.g. "${unmappedProducts[0]}"). Register them first!`);
                    }
                    if (failedUpdates.length > 0) {
                        toast.error(`System update failed for ${failedUpdates.length} items.`);
                    }

                    fetchInventory();
                } catch (error) {
                    toast.error("Institutional synchronization failure. Registry unification aborted.");
                } finally {
                    setLoading(false);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                }
            }
        });
    };

    const fetchBaseData = async () => {
        setLoading(true);
        try {
            const res = await api.get("/locations");
            
            const adminUser = user as any;
            if (isStoreAdmin && adminUser?.locationId) {
                // Pin institutional fulfillment to the authorized hub only
                const myStore = res.data.find((s: any) => s.id === adminUser.locationId);
                setStores(myStore ? [myStore] : []);
                setSelectedStore(adminUser.locationId);
            } else {
                setStores(res.data);
                if (res.data.length > 0 && !selectedStore) {
                    setSelectedStore(res.data[0].id);
                }
            }
        } catch (error) {
            toast.error("Failed to fetch store locations");
        }
    };

    useEffect(() => {
        fetchBaseData();
    }, []);

    useEffect(() => {
        if (selectedStore) {
            fetchInventory();
        }
    }, [selectedStore]);

    const fetchInventory = async () => {
        setLoading(true);
        try {
            // Updated to use the correct store-wise endpoint
            const res = await api.get(`/inventory/store/${selectedStore}`);
            setInventory(res.data);
        } catch (error) {
            toast.error("Failed to load inventory data");
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateStock = async () => {
        try {
            await api.post(`/inventory/adjust`, {
                ...adjustData,
                locationId: selectedStore,
                quantity: parseFloat(adjustData.quantity)
            });
            toast.success("Stock levels updated successfully");
            setIsAdjustOpen(false);
            setIsMortalityOpen(false);
            fetchInventory();
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Failed to adjust inventory levels");
        }
    };

    const handleSyncRegistry = async () => {
        setLoading(true);
        try {
            await api.post("/inventory/sync", { locationId: selectedStore });
            toast.success("Store registry unified successfully");
            fetchInventory();
        } catch (error) {
            toast.error("Failed to synchronize store registry");
        } finally {
            setLoading(false);
        }
    };

    const filteredInventory = useMemo(() => {
        if (!Array.isArray(inventory)) return [];
        return inventory.filter(item => 
            item.product?.name?.toLowerCase().includes(search.toLowerCase()) ||
            item.product?.sku?.toLowerCase().includes(search.toLowerCase()) ||
            item.product?.barcode?.toLowerCase().includes(search.toLowerCase())
        );
    }, [inventory, search]);

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-200">
                <div className="px-1 md:px-0">
                    <h2 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Inventory Management</h2>
                    <p className="text-sm text-slate-500 mt-1">Monitor and adjust stock levels across all operational nodes.</p>
                </div>
                
                <div className="flex flex-wrap md:flex-nowrap items-center gap-4 w-full md:w-auto">
                    <div className="bg-white border border-slate-200 p-2 pl-4 pr-2 rounded-xl flex items-center gap-4 shadow-sm group hover:border-emerald-200 transition-all w-full md:w-auto">
                        <div className="flex flex-col flex-1 md:flex-none pr-4 border-r border-slate-100">
                            <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest leading-none mb-1.5">Active Location</p>
                            <select 
                                value={selectedStore}
                                onChange={(e) => setSelectedStore(e.target.value)}
                                disabled={isStoreAdmin}
                                className={cn(
                                    "bg-transparent border-none outline-none text-sm font-bold text-slate-900 cursor-pointer appearance-none pr-8",
                                    isStoreAdmin && "cursor-not-allowed opacity-70"
                                )}
                                style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%2364748b\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'org.lucide.chevron.down\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right center', backgroundSize: '16px' }}
                            >
                                {stores.map(s => (
                                    <option key={s.id} value={s.id} className="bg-white text-slate-900">{s.name}</option>
                                ))}
                            </select>
                        </div>
                        <button 
                            onClick={fetchInventory}
                            className="w-10 h-10 rounded-lg bg-slate-50 hover:bg-emerald-50 flex items-center justify-center text-slate-400 hover:text-emerald-600 transition-colors"
                        >
                            <RefreshCw className="h-4 w-4" />
                        </button>
                    </div>

                    <div className="flex items-center gap-2 overflow-x-auto pb-4 md:pb-0 no-scrollbar w-full md:w-auto">
                        <input type="file" ref={fileInputRef} onChange={handleImport} accept=".csv" className="hidden" />
                        <button 
                            onClick={handleExport}
                            className="h-12 bg-white border border-slate-200 text-slate-600 px-6 rounded-xl flex items-center justify-center gap-3 hover:bg-slate-50 active:scale-95 transition-all font-bold text-xs uppercase tracking-widest whitespace-nowrap"
                        >
                            <ArrowUpRight className="h-4 w-4" />
                            <span>Export Registry</span>
                        </button>
                        <button 
                            onClick={handleDownloadTemplate}
                            className="h-12 bg-white border border-slate-200 text-slate-600 px-6 rounded-xl flex items-center justify-center gap-3 hover:bg-slate-50 active:scale-95 transition-all font-bold text-xs uppercase tracking-widest whitespace-nowrap"
                        >
                            <Save className="h-4 w-4" />
                            <span>Download Template</span>
                        </button>
                        <button 
                            onClick={handleSyncRegistry}
                            disabled={loading}
                            className="h-12 bg-emerald-600 text-white px-6 rounded-xl flex items-center justify-center gap-3 hover:bg-emerald-700 active:scale-95 transition-all font-bold text-xs uppercase tracking-widest shadow-lg shadow-emerald-200 whitespace-nowrap"
                        >
                            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                            <span>Sync Hub Registry</span>
                        </button>
                        <button 
                            onClick={() => fileInputRef.current?.click()}
                            className="h-12 bg-white border border-slate-200 text-slate-600 px-6 rounded-xl flex items-center justify-center gap-3 hover:bg-slate-50 active:scale-95 transition-all font-bold text-xs uppercase tracking-widest whitespace-nowrap"
                        >
                            <Plus className="h-4 w-4" />
                            <span>Bulk Sync</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Search and Quick Filters */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="md:col-span-2 relative group flex items-center">
                    <Search className="absolute left-4 h-5 w-5 text-slate-400 group-focus-within/input:text-emerald-600 transition-colors" />
                    <input 
                        className="w-full h-12 bg-white border border-slate-200 rounded-xl pl-12 pr-4 text-sm font-medium text-slate-900 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 transition-all outline-none placeholder:text-slate-400"
                        placeholder="Search by SKU or Product Name..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                
                <div className="flex gap-4 lg:col-span-2">
                    <button className="flex-1 h-12 bg-white border border-slate-200 rounded-xl flex items-center justify-center gap-3 text-slate-500 hover:text-emerald-600 hover:border-emerald-200 transition-all group active:scale-95 shadow-sm">
                        <AlertCircle className="h-4 w-4 group-hover:scale-110 transition-transform" />
                        <span className="text-xs font-bold uppercase tracking-wider">Low Stock Only</span>
                    </button>
                    <button className="flex-1 h-12 bg-white border border-slate-200 rounded-xl flex items-center justify-center gap-3 text-slate-500 hover:text-blue-600 hover:border-blue-200 transition-all group active:scale-95 shadow-sm">
                        <Layers className="h-4 w-4" />
                        <span className="text-xs font-bold uppercase tracking-wider">Categories</span>
                    </button>
                </div>
            </div>

            {/* Inventory List */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-h-[500px]">
                <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Activity className="h-4 w-4 text-emerald-600" />
                        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest">Active Stock Levels</h3>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-100">
                                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Product Details</th>
                                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] text-center">Current Stock</th>
                                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] text-center">Safety Threshold</th>
                                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Status</th>
                                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                [1, 2, 3, 4, 5].map(i => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={5} className="px-10 py-12">
                                            <div className="h-10 w-full bg-foreground/5 rounded-2xl" />
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                filteredInventory.map((item, idx: number) => (
                                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-6 transition-all duration-300">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center p-1 border border-slate-100 shadow-sm overflow-hidden flex-shrink-0">
                                                    {(item.product?.images?.[0] || item.product?.imageUrl) ? (
                                                        <img src={item.product?.images?.[0] || item.product?.imageUrl} alt="" className="w-full h-full object-cover rounded-lg" />
                                                    ) : (
                                                        <Package className="h-6 w-6 text-slate-200" />
                                                    )}
                                                </div>
                                                <div className="min-w-0">
                                                    <h4 className="text-sm font-bold text-slate-900 truncate">{item.product?.name}</h4>
                                                    <div className="flex items-center gap-3 mt-1">
                                                        {(item.product?.sku || item.product?.barcode) && (
                                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ID: {item.product?.sku?.toUpperCase() || item.product?.barcode}</span>
                                                        )}
                                                        {item.variant && (
                                                            <span className="text-[9px] font-bold bg-blue-50 text-blue-600 px-2 py-0.5 rounded uppercase tracking-wider border border-blue-100">{item.variant.name}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-6 text-center">
                                            <div className="flex flex-col items-center">
                                                <span className={cn(
                                                    "text-lg font-bold tabular-nums",
                                                    Number(item.currentStock) <= Number(item.thresholdStock) ? "text-red-600" : "text-slate-900"
                                                )}>
                                                    {item.currentStock}
                                                </span>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                    {item.variant?.weightUnit || item.product?.weightUnit || "kg"}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-6 text-center">
                                            <div className="flex flex-col items-center">
                                                <span className="text-sm font-bold text-slate-400 tabular-nums">{item.thresholdStock}</span>
                                                <span className="text-[9px] font-bold text-slate-300 uppercase tracking-[0.2em]">
                                                    {item.variant?.weightUnit || item.product?.weightUnit || "kg"}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-6">
                                            <div className="flex items-center gap-2">
                                                {Number(item.currentStock) <= Number(item.thresholdStock) ? (
                                                    <div className="flex items-center gap-2 px-3 py-1 bg-red-50 rounded-lg text-red-600 border border-red-100">
                                                        <AlertCircle className="h-3 w-3" />
                                                        <span className="text-[10px] font-bold uppercase tracking-wider">Low Stock</span>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 rounded-lg text-emerald-600 border border-emerald-100">
                                                        <CheckCircle2 className="h-3 w-3" />
                                                        <span className="text-[10px] font-bold uppercase tracking-wider">In Stock</span>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                         <td className="px-6 py-6 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button 
                                                    onClick={() => {
                                                        setAdjustData({
                                                            productId: item.productId,
                                                            variantId: item.variantId || "",
                                                            quantity: "0",
                                                            type: "PURCHASE",
                                                            reason: "Manual stock replenishment"
                                                        });
                                                        setIsAdjustOpen(true);
                                                    }}
                                                    className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 flex items-center justify-center transition-all border border-slate-100 shadow-sm" title="Add Stock">
                                                    <PlusCircle className="h-5 w-5" />
                                                </button>
                                                <button 
                                                    onClick={() => {
                                                        setAdjustData({
                                                            productId: item.productId,
                                                            variantId: item.variantId || "",
                                                            quantity: "0",
                                                            type: "SPOILAGE",
                                                            reason: "Mortality / Spoilage recording"
                                                        });
                                                        setIsMortalityOpen(true);
                                                    }}
                                                    className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center transition-all border border-slate-100 shadow-sm" title="Record Mortality">
                                                    <Skull className="h-5 w-5" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                            {!loading && filteredInventory.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="py-24 text-center">
                                        <div className="flex flex-col items-center gap-4">
                                            <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-200">
                                                <Boxes className="h-8 w-8" />
                                            </div>
                                            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">No stock records found</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-2.5 h-2.5 bg-emerald-500/20 rounded-full flex items-center justify-center">
                            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">System Synchronized: Just Now</span>
                    </div>
                </div>
            </div>

            {/* Adjustment Modal (Add Stock) */}
            {isAdjustOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="absolute inset-0" onClick={() => setIsAdjustOpen(false)} />
                    <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-200">
                        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 border border-emerald-100">
                                    <PlusCircle className="h-6 w-6" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-slate-900 uppercase tracking-tight">Replenish Stock</h3>
                                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-0.5 text-balance">Add fresh inventory to primary registry</p>
                                </div>
                            </div>
                            <button onClick={() => setIsAdjustOpen(false)} className="w-10 h-10 rounded-xl hover:bg-white flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all border border-transparent hover:border-slate-200">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        
                        <div className="p-8 space-y-6">
                            <div className="space-y-3">
                                <Label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-1">Replenishment Quantity</Label>
                                <div className="relative group">
                                    <TrendingUp className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300 group-focus-within:text-emerald-500 transition-colors" />
                                    <input 
                                        type="number"
                                        step="0.001"
                                        className="w-full h-14 bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-4 text-xl font-black text-slate-900 focus:border-emerald-500 focus:bg-white outline-none transition-all shadow-inner"
                                        placeholder="0.00"
                                        value={adjustData.quantity}
                                        onChange={e => setAdjustData({...adjustData, quantity: e.target.value})}
                                    />
                                </div>
                            </div>

                            <div className="space-y-3">
                                <Label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-1">Protocol Remark (Reason)</Label>
                                <textarea 
                                    className="w-full h-24 bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-bold text-slate-900 focus:border-emerald-500 focus:bg-white outline-none transition-all resize-none shadow-inner"
                                    placeholder="Source details or batch reference..."
                                    value={adjustData.reason}
                                    onChange={e => setAdjustData({...adjustData, reason: e.target.value})}
                                />
                            </div>

                            <button 
                                onClick={handleUpdateStock}
                                className="w-full h-14 bg-emerald-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-emerald-100 hover:bg-emerald-700 active:scale-95 transition-all flex items-center justify-center gap-3">
                                <Save className="h-5 w-5" />
                                Commit Inventory Entry
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Mortality Modal (Record Loss) */}
            {isMortalityOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="absolute inset-0" onClick={() => setIsMortalityOpen(false)} />
                    <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl relative z-10 overflow-hidden animate-in slide-in-from-bottom-4 duration-300 border border-red-200">
                        <div className="px-8 py-6 border-b border-red-50 flex items-center justify-between bg-red-50/30">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center text-red-600 border border-red-200 shadow-sm animate-pulse-slow">
                                    <Skull className="h-6 w-6" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-slate-900 uppercase tracking-tight">Record Mortality</h3>
                                    <p className="text-[10px] text-red-500 font-black uppercase tracking-widest mt-0.5">Inventory Shrinkage Reporting</p>
                                </div>
                            </div>
                            <button onClick={() => setIsMortalityOpen(false)} className="w-10 h-10 rounded-xl hover:bg-white flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all border border-transparent hover:border-slate-200">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        
                        <div className="p-8 space-y-6">
                            <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-start gap-4">
                                <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
                                <p className="text-[10px] font-bold text-red-700 leading-relaxed uppercase tracking-tight">Warning: Mortality recording will permanently subtract stock and create a high-severity audit event.</p>
                            </div>

                            <div className="space-y-3">
                                <Label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-1">Wastage / Spoiled Quantity</Label>
                                <div className="relative group">
                                    <XCircle className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-red-300 group-focus-within:text-red-500 transition-colors" />
                                    <input 
                                        type="number"
                                        step="0.001"
                                        autoFocus
                                        className="w-full h-14 bg-red-50/30 border border-red-100 rounded-2xl pl-12 pr-4 text-xl font-black text-red-600 focus:border-red-500 focus:bg-white outline-none transition-all shadow-inner"
                                        placeholder="0.00"
                                        value={adjustData.quantity}
                                        onChange={e => setAdjustData({...adjustData, quantity: e.target.value})}
                                    />
                                </div>
                            </div>

                            <div className="space-y-3">
                                <Label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-1">Mortality Condition / Reason</Label>
                                <textarea 
                                    className="w-full h-24 bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-bold text-slate-900 focus:border-red-500 focus:bg-white outline-none transition-all resize-none shadow-inner"
                                    placeholder="Explain spoilage factor (Expired, Damaged during transit, etc)..."
                                    value={adjustData.reason}
                                    onChange={e => setAdjustData({...adjustData, reason: e.target.value})}
                                />
                            </div>

                            <button 
                                onClick={handleUpdateStock}
                                className="w-full h-14 bg-red-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-red-100 hover:bg-red-700 active:scale-95 transition-all flex items-center justify-center gap-3">
                                <Activity className="h-5 w-5" />
                                Authorize Spoilage Log
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
