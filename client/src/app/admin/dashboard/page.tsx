"use client";

import { 
    TrendingUp, 
    ShoppingCart, 
    Users, 
    CreditCard, 
    ArrowUpRight,
    ArrowDownRight,
    Search,
    Filter,
    MoreVertical,
    Zap,
    Store,
    Monitor,
    PackagePlus,
    LayoutDashboard,
    ArrowLeft,
    ChevronRight,
    Star,
    AlertCircle,
    UserCheck,
    History,
    IndianRupee,
    BarChart3,
    Package,
    Receipt,
    Wallet
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import api from "@/services/api";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function AdminDashboard() {
    const router = useRouter();
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const fetchDashboardData = async () => {
        setLoading(true);
        try {
            const res = await api.get("/dashboard/stats");
            setData(res.data);
        } catch (error) {
            console.error("Dashboard data fetch failure:", error);
            toast.error("Failed to synchronize performance metrics");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const metrics = data?.metrics || { revenue: 0, orders: 0, customers: 0, stores: 0 };
    const stores = data?.stores || [];
    const trending = data?.trending || [];
    const topCustomers = data?.customers || [];
    const activeShift = data?.activeShift;

    const STAT_BLOCKS = [
        { 
            label: "Gross Revenue", 
            value: `₹${metrics.revenue.toLocaleString()}`, 
            change: "+12.4%", 
            trend: "up", 
            icon: IndianRupee, 
            color: "text-emerald-500",
            sub: "Synced Real-time"
        },
        { 
            label: "Total Expenses", 
            value: `₹${(metrics.expenses || 0).toLocaleString()}`, 
            change: "OUTFLOW", 
            trend: "down", 
            icon: Receipt, 
            color: "text-rose-500",
            sub: "Operational Spend"
        },
        { 
            label: "Net Profit (P&L)", 
            value: `₹${(metrics.revenue - (metrics.expenses || 0)).toLocaleString()}`, 
            change: "NET SURPLUS", 
            trend: (metrics.revenue - (metrics.expenses || 0)) >= 0 ? "up" : "down", 
            icon: Wallet, 
            color: (metrics.revenue - (metrics.expenses || 0)) >= 0 ? "text-amber-500" : "text-rose-600",
            sub: "Revenue - Expenses"
        },
        { 
            label: "Transaction Count", 
            value: `${metrics.orders} Orders`, 
            change: "STABLE", 
            trend: "up", 
            icon: ShoppingCart, 
            color: "text-blue-500",
            sub: "Order Volume Index"
        },
    ];

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
                <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Synchronizing Operational Intelligence...</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Business Overview Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-8 border-b border-slate-100">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-emerald-500 rounded-lg shadow-lg shadow-emerald-500/20">
                            <LayoutDashboard className="h-5 w-5 text-white" />
                        </div>
                        <h2 className="text-3xl font-black text-slate-900 tracking-tight tracking-[-0.04em] uppercase">Intelligence Hub</h2>
                    </div>
                    <p className="text-sm font-medium text-slate-400">High-fidelity performance metrics across the multi-store distribution network.</p>
                </div>
                
                {activeShift && (
                    <div className={cn(
                        "flex items-center gap-4 p-4 rounded-2xl shadow-xl border animate-in slide-in-from-right duration-500",
                        activeShift.isHistorical ? "bg-slate-100 border-slate-200" : "bg-slate-900 border-slate-800"
                    )}>
                        <div className={cn(
                            "w-10 h-10 rounded-full flex items-center justify-center shadow-lg",
                            activeShift.isHistorical ? "bg-slate-400 text-white" : "bg-emerald-500 text-white shadow-emerald-500/20"
                        )}>
                            <Monitor className="h-5 w-5" />
                        </div>
                        <div>
                            <p className={cn(
                                "text-[10px] font-black uppercase tracking-widest",
                                activeShift.isHistorical ? "text-slate-500" : "text-emerald-400"
                            )}>{activeShift.isHistorical ? "Last Closed Session" : "Active POS Session"}</p>
                            <p className={cn("text-xs font-bold mt-0.5", activeShift.isHistorical ? "text-slate-900" : "text-white")}>
                                ₹{(activeShift.currentEstimatedCash || activeShift.closingCash || 0).toLocaleString()} {activeShift.isHistorical ? "Final Balance" : "Opening Balance"}
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                {STAT_BLOCKS.map((stat) => {
                    const Icon = stat.icon;
                    return (
                        <div key={stat.label} className="bg-white rounded-[2rem] p-8 border border-slate-200 shadow-sm hover:border-emerald-200 hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-500 group relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
                                <Icon className="h-24 w-24 -mr-8 -mt-8 rotate-12" />
                            </div>
                            <div className="flex items-center justify-between mb-6 relative z-10">
                                <div className={cn("p-3 rounded-2xl bg-slate-50 group-hover:bg-emerald-50 transition-colors shadow-inner", stat.color)}>
                                    <Icon className="h-6 w-6" />
                                </div>
                                <div className={cn(
                                    "px-3 py-1.5 rounded-full text-[10px] font-black tracking-widest flex items-center gap-1.5 border shadow-sm",
                                    stat.trend === "up" ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-red-50 text-red-600 border-red-100"
                                )}>
                                    {stat.trend === "up" ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                                    {stat.change}
                                </div>
                            </div>
                            
                            <div className="relative z-10">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">{stat.label}</p>
                                <h3 className="text-4xl font-black text-slate-900 tracking-tight leading-none">{stat.value}</h3>
                                <p className="text-[10px] font-bold text-slate-300 mt-4 uppercase tracking-widest">{stat.sub}</p>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
                {/* Store Performance Leaderboard */}
                <div className="xl:col-span-2 bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden min-h-[500px] flex flex-col">
                    <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="p-2 bg-blue-500 rounded-xl">
                                <BarChart3 className="h-5 w-5 text-white" />
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Node Performance</h2>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Multi-Store Revenue Index</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto">
                        {stores.length === 0 ? (
                            <div className="flex flex-col items-center justify-center p-20 text-center space-y-4">
                                <Store className="h-12 w-12 text-slate-200" />
                                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">No transaction data logged yet.</p>
                            </div>
                        ) : (
                            <div className="p-4 space-y-2">
                                {stores.map((store: any, idx: number) => (
                                    <div key={store.id} className="p-6 rounded-[2rem] border border-transparent hover:border-slate-100 hover:bg-slate-50 transition-all flex items-center justify-between group">
                                        <div className="flex items-center gap-6">
                                            <div className={cn(
                                                "w-12 h-12 rounded-[1.25rem] flex items-center justify-center text-lg font-black shadow-lg",
                                                idx === 0 ? "bg-amber-400 text-white shadow-amber-400/20" : 
                                                idx === 1 ? "bg-slate-400 text-white shadow-slate-400/20" :
                                                idx === 2 ? "bg-orange-400 text-white shadow-orange-400/20" :
                                                "bg-slate-100 text-slate-400 shadow-inner"
                                            )}>
                                                {idx + 1}
                                            </div>
                                            <div>
                                                <h4 className="text-lg font-black text-slate-900 tracking-tight">{store.name}</h4>
                                                <div className="flex items-center gap-3 mt-1">
                                                    <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">{store.orderCount} Closed Orders</span>
                                                    <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">/ {store.slug}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xl font-black text-slate-900 tracking-tighter">₹{(store.profit || store.revenue).toLocaleString()}</p>
                                            <div className="flex items-center justify-end gap-1.5 mt-1 text-emerald-500">
                                                <TrendingUp className="h-3 w-3" />
                                                <span className="text-[10px] font-black uppercase tracking-widest">
                                                    {store.profit ? "Net Profit" : "Total Revenue"}
                                                </span>
                                            </div>
                                            {store.expenses > 0 && (
                                                <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest mt-1">₹{store.expenses.toLocaleString()} Spent</p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Trending Merchandise Feed */}
                <div className="xl:col-span-2 bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                    <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="p-2 bg-amber-500 rounded-xl">
                                <TrendingUp className="h-5 w-5 text-white" />
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Trending Items</h2>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">High-Velocity Catalog Registry</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto">
                        <div className="p-6 space-y-4">
                            {trending.map((item: any) => (
                                <div key={item.sku} className="flex items-center gap-6 p-4 rounded-3xl hover:bg-slate-50 transition-colors group">
                                    <div className="w-16 h-16 bg-slate-100 rounded-2xl overflow-hidden border border-slate-100 group-hover:border-emerald-200 transition-all">
                                        {item.images?.[0] ? (
                                            <img src={item.images[0]} alt={item.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-slate-300">
                                                <Package className="h-6 w-6" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="font-bold text-slate-900 tracking-tight text-lg">{item.name}</h4>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">{item.sku}</p>
                                    </div>
                                    <div className="text-right">
                                        <div className="px-3 py-1 bg-emerald-500 text-white rounded-full text-[10px] font-black tracking-widest shadow-lg shadow-emerald-500/20">
                                            {item.sales} SOLD
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Top Customer Spotlight */}
                <div className="xl:col-span-3 bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="p-2 bg-indigo-500 rounded-xl">
                                <Star className="h-5 w-5 text-white" />
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">VIP Customer Index</h2>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Highest Conversion Profiles</p>
                            </div>
                        </div>
                    </div>
                    <div className="p-8 pb-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {topCustomers.map((cust: any) => (
                                <div key={cust.phone} className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 group hover:bg-white hover:border-emerald-200 hover:shadow-xl transition-all duration-300">
                                    <div className="flex items-center gap-4 mb-6">
                                        <div className="w-12 h-12 rounded-2xl bg-white border border-slate-100 flex items-center justify-center text-indigo-500 font-black shadow-inner">
                                            {cust.name?.[0] || "C"}
                                        </div>
                                        <div>
                                            <h4 className="font-black text-slate-900 leading-none">{cust.name || "Unified Ledger Client"}</h4>
                                            <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">{cust.phone}</p>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-3 bg-white rounded-2xl border border-slate-100 shadow-sm">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Spends</p>
                                            <p className="font-black text-slate-900">₹{Number(cust.totalSpend).toLocaleString()}</p>
                                        </div>
                                        <div className="p-3 bg-white rounded-2xl border border-slate-100 shadow-sm">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Retentions</p>
                                            <p className="font-black text-slate-900">{cust.orderCount} Orders</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Tactical Actions */}
                <div className="xl:col-span-1 space-y-6">
                    <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl shadow-slate-200 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                        <div className="relative z-10">
                            <TrendingUp className="h-12 w-12 mb-8 text-emerald-400" />
                            <h3 className="text-2xl font-black mb-4 uppercase tracking-tight">Growth Protocol</h3>
                            <p className="text-xs text-slate-400 mb-8 leading-relaxed font-bold uppercase tracking-wider">
                                Strategic distribution optimization identified. 12.4% velocity acceleration projected for next sequence.
                            </p>
                            <button 
                                onClick={() => router.push("/pos")}
                                className="w-full h-14 bg-emerald-500 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl hover:bg-white hover:text-slate-900 transition-all transform active:scale-95 shadow-xl shadow-emerald-500/20"
                            >
                                Initiate Sales Mode
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
