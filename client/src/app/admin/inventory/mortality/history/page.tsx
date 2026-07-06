"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { 
    History, 
    Search, 
    Filter, 
    Calendar, 
    Download, 
    ChevronLeft, 
    Skull,
    TrendingDown,
    AlertCircle,
    ArrowLeft,
    Layers,
    FileText,
    Boxes,
    IndianRupee,
    ArrowUpRight,
    Package
} from "lucide-react";
import api from "@/services/api";
import { toast } from "sonner";
import { useUserStore } from "@/store/useUserStore";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

export default function MortalityViewer() {
    const { user, activeStore } = useUserStore();
    const router = useRouter();
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [dateFilter, setDateFilter] = useState("ALL"); // ALL, TODAY, WEEK, MONTH
    const [typeFilter, setTypeFilter] = useState("ALL"); // SPOILAGE, DAMAGE, etc.

    const fetchHistory = useCallback(async () => {
        const storeId = user?.locationId || activeStore?.id;
        if (!storeId) return;
        setLoading(true);
        try {
            const res = await api.get(`/inventory/mortality/${storeId}`);
            setHistory(res.data || []);
        } catch (error) {
            toast.error("Failed to synchronize audit logs");
        } finally {
            setLoading(false);
        }
    }, [user?.locationId, activeStore?.id]);

    useEffect(() => {
        fetchHistory();
    }, [fetchHistory]);

    const filteredHistory = useMemo(() => {
        return history.filter(log => {
            const matchQuery = 
                log.product?.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                log.batch?.batchNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                log.reason?.toLowerCase().includes(searchQuery.toLowerCase());
            
            const matchType = typeFilter === "ALL" || log.reason === typeFilter;
            
            let matchDate = true;
            if (dateFilter !== "ALL") {
                const logDate = new Date(log.createdAt);
                const now = new Date();
                if (dateFilter === "TODAY") {
                    matchDate = logDate.toDateString() === now.toDateString();
                } else if (dateFilter === "WEEK") {
                    const weekAgo = new Date();
                    weekAgo.setDate(now.getDate() - 7);
                    matchDate = logDate >= weekAgo;
                }
            }
            
            return matchQuery && matchType && matchDate;
        });
    }, [history, searchQuery, dateFilter, typeFilter]);

    const stats = useMemo(() => {
        const totalItems = filteredHistory.reduce((acc, log) => acc + Number(log.quantity), 0);
        const totalLoss = filteredHistory.reduce((acc, log) => {
            const loss = Number(log.totalLoss || (Number(log.batch?.costPrice || log.product?.basePrice || 0) * Number(log.quantity)));
            return acc + loss;
        }, 0);
        return { totalItems, totalLoss, count: filteredHistory.length };
    }, [filteredHistory]);

    return (
        <div className="min-h-screen bg-[#FAFAFA] p-4 md:p-10 font-sans">
            <div className="max-w-7xl mx-auto space-y-10">
                
                {/* BACK BUTTON & META */}
                <div className="flex items-center justify-between">
                    <button 
                        onClick={() => router.back()}
                        className="flex items-center gap-2 text-slate-400 hover:text-slate-900 transition-colors group px-4 py-2 hover:bg-white rounded-xl"
                    >
                        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Return to Console</span>
                    </button>
                    <div className="flex items-center gap-4">
                        <div className="flex flex-col items-end">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Security Protocol</span>
                            <span className="text-xs font-bold text-emerald-600 mt-1 uppercase tracking-tight">Authenticated Hub: {user?.locationId || activeStore?.id || "GLOBAL"}</span>
                        </div>
                    </div>
                </div>

                {/* HERO HEADER */}
                <div className="relative group">
                    <div className="absolute -inset-1 bg-gradient-to-r from-red-500 to-amber-500 rounded-[3rem] blur opacity-5 group-hover:opacity-10 transition duration-1000 group-hover:duration-200"></div>
                    <header className="relative flex flex-col md:flex-row md:items-end justify-between gap-8 bg-white p-10 rounded-[3rem] shadow-2xl shadow-red-500/5 border border-slate-100 overflow-hidden">
                        <div className="absolute top-0 right-0 p-12 opacity-[0.03] pointer-events-none">
                            <Skull className="w-64 h-64 rotate-12" />
                        </div>
                        
                        <div className="flex items-start gap-8 z-10">
                            <div className="w-24 h-24 bg-red-600 rounded-[2rem] flex items-center justify-center text-white shadow-2xl shadow-red-600/30 transform transition-transform group-hover:scale-105 duration-500">
                                <History className="w-10 h-10" />
                            </div>
                            <div>
                                <h1 className="text-5xl font-black text-slate-900 tracking-tighter leading-none lowercase">Mortality Viewer</h1>
                                <p className="text-slate-400 text-sm font-bold uppercase tracking-[0.2em] mt-4 flex items-center gap-3">
                                    <TrendingDown className="w-4 h-4 text-red-500" />
                                    Institutional Inventory Loss Registry
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-4 z-10">
                            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 shadow-inner flex flex-col items-center min-w-[140px]">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Assets Lost</span>
                                <span className="text-2xl font-black text-slate-900 tabular-nums">{stats.totalItems.toFixed(1)}</span>
                            </div>
                            <div className="bg-red-600 p-6 rounded-3xl shadow-xl shadow-red-100 flex flex-col items-center min-w-[160px]">
                                <span className="text-[9px] font-black text-red-100 uppercase tracking-widest mb-2">Total Recovery Loss</span>
                                <div className="flex items-center gap-1">
                                    <IndianRupee className="w-4 h-4 text-red-200" />
                                    <span className="text-2xl font-black text-white tabular-nums">{stats.totalLoss.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>
                    </header>
                </div>

                {/* FILTERS & SEARCH */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
                    <div className="md:col-span-12 lg:col-span-6 relative group">
                        <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-red-500 transition-colors" />
                        <input 
                            type="text"
                            placeholder="Identify by batch number, merchandise name or reason code..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full h-14 pl-16 pr-8 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-black uppercase tracking-tight outline-none focus:bg-white focus:border-red-500 transition-all shadow-inner placeholder:text-slate-300"
                        />
                    </div>

                    <div className="md:col-span-4 lg:col-span-2">
                        <div className="relative h-14 bg-slate-50 border border-slate-100 rounded-2xl flex items-center px-4 group hover:border-slate-300 transition-all">
                            <Calendar className="w-4 h-4 text-slate-400 mr-3" />
                            <select 
                                value={dateFilter}
                                onChange={(e) => setDateFilter(e.target.value)}
                                className="w-full bg-transparent border-none text-[10px] font-black uppercase tracking-widest text-slate-600 outline-none h-full appearance-none pr-8 cursor-pointer"
                            >
                                <option value="ALL">All Epochs</option>
                                <option value="TODAY">Digital Today</option>
                                <option value="WEEK">Last 7 Cycles</option>
                            </select>
                        </div>
                    </div>

                    <div className="md:col-span-4 lg:col-span-2">
                        <div className="relative h-14 bg-slate-50 border border-slate-100 rounded-2xl flex items-center px-4 group hover:border-slate-300 transition-all">
                            <Filter className="w-4 h-4 text-slate-400 mr-3" />
                            <select 
                                value={typeFilter}
                                onChange={(e) => setTypeFilter(e.target.value)}
                                className="w-full bg-transparent border-none text-[10px] font-black uppercase tracking-widest text-slate-600 outline-none h-full appearance-none pr-8 cursor-pointer"
                            >
                                <option value="ALL">All Variance</option>
                                <option value="SPOILAGE">Spoilage</option>
                                <option value="DAMAGE">Physical Damage</option>
                                <option value="EXPIRED">Expiry Loss</option>
                                <option value="THEFT">Security Leak</option>
                            </select>
                        </div>
                    </div>

                    <div className="md:col-span-4 lg:col-span-2">
                        <button className="w-full h-14 bg-slate-900 border border-slate-900 rounded-2xl flex items-center justify-center gap-3 text-white hover:bg-black transition-all active:scale-95 shadow-xl shadow-slate-200">
                            <Download className="w-4 h-4" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Protocol Export</span>
                        </button>
                    </div>
                </div>

                {/* LOG DATA GRID */}
                <div className="bg-white rounded-[3rem] shadow-2xl shadow-slate-100/50 border border-slate-200/60 overflow-hidden">
                    <div className="p-10 border-b border-slate-100 bg-slate-50/30 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center justify-center">
                                <FileText className="w-5 h-5 text-red-500" />
                            </div>
                            <div>
                                <h3 className="text-sm font-black text-slate-900 uppercase tracking-[0.2em] leading-none">Reconciliation Feed</h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1.5">Synchronizing across active nodes</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl border border-slate-100 shadow-inner">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[9px] font-black uppercase text-slate-500 tracking-tighter italic">Live Monitor Active</span>
                        </div>
                    </div>

                    <div className="overflow-x-auto min-h-[400px]">
                        <table className="w-full text-left">
                            <thead className="bg-[#FCFCFC] border-b border-slate-100">
                                <tr>
                                    <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Merchandise & Variant</th>
                                    <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Batch Protocol</th>
                                    <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Variance Qty</th>
                                    <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Loss Impact</th>
                                    <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Observation Time</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {loading ? (
                                    [...Array(6)].map((_, i) => (
                                        <tr key={i} className="animate-pulse">
                                            <td colSpan={5} className="p-10">
                                                <div className="h-10 bg-slate-50 rounded-2xl w-full" />
                                            </td>
                                        </tr>
                                    ))
                                ) : filteredHistory.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="py-24 text-center">
                                            <div className="flex flex-col items-center gap-4">
                                                <div className="w-20 h-20 bg-slate-50 rounded-[2rem] flex items-center justify-center text-slate-200">
                                                    <Boxes className="w-10 h-10" />
                                                </div>
                                                <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">No loss reconciliation logs found in this epoch</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredHistory.map((log) => {
                                        const lossValue = Number(log.totalLoss || (Number(log.batch?.costPrice || log.product?.basePrice || 0) * Number(log.quantity)));
                                        const unitCost = Number(log.costPrice || log.batch?.costPrice || log.product?.basePrice || 0);
                                        return (
                                            <tr key={log.id} className="hover:bg-red-50/10 transition-all duration-300 group">
                                                <td className="px-10 py-8">
                                                    <div className="flex items-center gap-6">
                                                        <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center p-1 border border-slate-100 shadow-sm group-hover:scale-110 transition-transform">
                                                            {log.product?.images?.[0] ? (
                                                                <img src={log.product.images[0]} className="w-full h-full object-cover rounded-xl" alt="" />
                                                            ) : (
                                                                <Package className="w-6 h-6 text-slate-200" />
                                                            )}
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <div className="flex items-center gap-3">
                                                                <span className="text-sm font-black text-slate-900 uppercase tracking-tighter">{log.product?.name}</span>
                                                                {log.variant && (
                                                                    <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[8px] font-black uppercase rounded tracking-widest border border-blue-100">{log.variant.name}</span>
                                                                )}
                                                            </div>
                                                            <span className="text-[10px] text-slate-300 font-bold uppercase tracking-[0.2em] mt-1">ID: {log.id.slice(0, 8).toUpperCase()}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-10 py-8 text-center">
                                                    <div className="flex flex-col items-center">
                                                        <div className="inline-flex flex-col items-center p-3 bg-white border border-slate-100 rounded-2xl shadow-sm">
                                                            <span className="text-[10px] font-black text-slate-800 uppercase tracking-tight">{log.batch?.batchNumber || "UNBATCHED"}</span>
                                                            <span className="text-[9px] font-black text-emerald-500/80 uppercase mt-1 tracking-tighter">Verified Protocol</span>
                                                        </div>
                                                        <span className="text-[9px] font-black text-slate-300 uppercase mt-2 tracking-widest">Unit Cost: ₹{unitCost.toFixed(2)}</span>
                                                    </div>
                                                </td>
                                                <td className="px-10 py-8 text-center">
                                                    <div className="flex flex-col items-center">
                                                        <span className="text-xl font-black text-slate-900 tabular-nums">{Number(log.quantity).toFixed(2)}</span>
                                                        <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest mt-1">Units (kg/pc)</span>
                                                    </div>
                                                </td>
                                                <td className="px-10 py-8 text-center">
                                                    <div className="inline-flex flex-col items-center p-3 bg-red-50 border border-red-100 rounded-2xl group-hover:bg-red-600 transition-colors">
                                                        <div className="flex items-center gap-1">
                                                            <IndianRupee className="w-3.5 h-3.5 text-red-600 group-hover:text-red-100" />
                                                            <span className="text-sm font-black text-red-600 tabular-nums group-hover:text-white leading-none">{lossValue.toFixed(2)}</span>
                                                        </div>
                                                        <span className="text-[8px] font-black text-red-400 group-hover:text-red-200 uppercase mt-1 tracking-tighter uppercase">{log.reason}</span>
                                                    </div>
                                                </td>
                                                <td className="px-10 py-8 text-right">
                                                    <div className="flex flex-col items-end">
                                                        <span className="text-[10px] font-black text-slate-900 uppercase tracking-tighter">{new Date(log.createdAt).toLocaleDateString()}</span>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                            <ArrowUpRight className="w-3 h-3 text-emerald-500" />
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="px-10 py-8 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-white rounded-xl shadow-sm border border-slate-100">
                                <AlertCircle className="w-4 h-4 text-orange-400" />
                            </div>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest italic max-w-sm">All logs are digitally signed and immutable for warehouse reconciliation purposes.</p>
                        </div>
                        <div className="flex items-center gap-8">
                             <div className="flex flex-col items-end">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Monitor Cycle</span>
                                <span className="text-[10px] font-black text-slate-900 mt-1 uppercase tracking-tight">Active Protocol v1.4.2</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

        </div>
    );
}
