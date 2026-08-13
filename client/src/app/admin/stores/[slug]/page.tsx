"use client";

import { 
    LayoutDashboard, 
    ShoppingCart, 
    Package, 
    TrendingUp, 
    ArrowUpRight, 
    AlertTriangle,
    Clock,
    User,
    ArrowLeft,
    Box,
    Truck,
    CreditCard
} from "lucide-react";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUserStore } from "@/store/useUserStore";
import api from "@/services/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function StoreHubDashboard() {
    const { slug } = useParams();
    const router = useRouter();
    const { user } = useUserStore();
    const [store, setStore] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        orders: 0,
        revenue: 0,
        lowStock: 0,
        activeStaff: 0
    });

    useEffect(() => {
        const fetchHubData = async () => {
            try {
                // Verify store existence and user access
                const storeRes = await api.get(`/locations/slug/${slug}`);
                setStore(storeRes.data);

                // Fetch hub-specific metrics
                const [invRes, statsRes] = await Promise.all([
                    api.get(`/inventory/store/${storeRes.data.id}`),
                    api.get(`/dashboard/stats?locationId=${storeRes.data.id}`)
                ]);

                const lowStockCount = invRes.data.filter((i: any) => i.currentStock <= i.thresholdStock).length;
                const metrics = statsRes.data.metrics || {};

                setStats({
                    orders: metrics.todayOrders ?? metrics.orders ?? 0,
                    revenue: metrics.todayRevenue ?? metrics.revenue ?? 0,
                    lowStock: lowStockCount,
                    activeStaff: 1 // For now
                });
            } catch (error) {
                toast.error("Failed to establish Hub connection");
                router.push("/admin/dashboard");
            } finally {
                setLoading(false);
            }
        };

        if (slug) fetchHubData();
    }, [slug, router]);

    if (loading) return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest animate-pulse">Establishing Hub Logic...</p>
            </div>
        </div>
    );

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-700">
            {/* Hub Identity Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2">
                <div className="space-y-1">
                    <div className="flex items-center gap-2 text-[10px] font-black text-emerald-600 bg-emerald-50 px-3 py-1 rounded-md uppercase tracking-wider border border-emerald-100 w-fit mb-3">
                        <Box className="h-3 w-3" /> Operational Hub
                    </div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight uppercase">{store?.name}</h1>
                    <p className="text-sm text-slate-500 font-medium tracking-tight">Regional Fulfillment & Stock Control Dashboard • {store?.slug}</p>
                </div>

                <div className="flex items-center gap-4">
                    <button 
                         onClick={() => router.push(`/admin/inventory?location=${store?.id}`)}
                        className="h-11 px-5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 flex items-center gap-2 hover:bg-slate-50 transition-all shadow-sm">
                        <Package className="h-4 w-4" /> Manage Inventory
                    </button>
                    <button className="h-11 px-6 bg-slate-900 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-lg shadow-slate-200 flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" /> Reports
                    </button>
                </div>
            </div>

            {/* Performance Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: "Today's Orders", value: stats.orders, icon: ShoppingCart, color: "text-blue-600", bg: "bg-blue-50" },
                    { label: "Hub Revenue", value: `₹${stats.revenue.toLocaleString()}`, icon: CreditCard, color: "text-emerald-600", bg: "bg-emerald-50" },
                    { label: "Low Stock Items", value: stats.lowStock, icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-50" },
                    { label: "On-Duty Staff", value: stats.activeStaff, icon: User, color: "text-indigo-600", bg: "bg-indigo-50" }
                ].map((stat, i) => (
                    <div key={i} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-500 group">
                        <div className="flex justify-between items-start mb-4">
                            <div className={cn("p-4 rounded-2xl transition-all duration-500", stat.bg, stat.color)}>
                                <stat.icon className="h-6 w-6" />
                            </div>
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{stat.label}</p>
                        <h3 className="text-3xl font-black text-slate-900 mt-1">{stat.value}</h3>
                    </div>
                ))}
            </div>

            {/* Hub Catalog & Requests Matrix */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    {/* Hub Specific Inventory / Products */}
                    <div className="bg-white rounded-[2.5rem] border border-slate-100 p-10 shadow-sm">
                        <div className="flex items-center justify-between mb-10">
                            <div>
                                <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Localized Hub Catalog</h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Institutional Stock Allocation</p>
                            </div>
                            <button 
                                onClick={() => router.push(`/admin/products`)}
                                className="px-6 py-2.5 bg-slate-50 text-slate-600 rounded-xl text-xs font-bold border border-slate-100 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-100 transition-all">
                                Global Catalog Access
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {[1, 2, 3, 4].map((_, i) => (
                                <div key={i} className="p-5 bg-slate-50/50 rounded-2xl border border-slate-100 hover:bg-white hover:shadow-lg transition-all group flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center text-slate-300 border border-slate-100 group-hover:border-emerald-100 transition-all overflow-hidden p-1">
                                            <Package className="h-6 w-6" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-900 uppercase tracking-tight">Hub Merch #{i+1}</p>
                                            <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">In Stock: {85 - i * 5} Units</p>
                                        </div>
                                    </div>
                                    <button className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-400 hover:text-emerald-600 border border-slate-100 shadow-sm transition-all">
                                        <TrendingUp className="h-4 w-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white rounded-[2.5rem] border border-slate-100 p-10 shadow-sm">
                        <div className="flex items-center justify-between mb-8">
                            <div>
                                <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Hub Fulfillment Stream</h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Live Order Synchronization</p>
                            </div>
                            <button className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest hover:underline px-4 py-2 bg-emerald-50 rounded-lg">Master Log</button>
                        </div>
                        
                        <div className="space-y-4">
                            {[1, 2, 3].map((_, i) => (
                                <div key={i} className="flex items-center justify-between p-6 rounded-3xl border border-slate-50 hover:bg-slate-50 transition-all group">
                                    <div className="flex items-center gap-6">
                                        <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white font-mono text-xs font-bold shadow-lg shadow-slate-200">#{1000 + i}</div>
                                        <div>
                                            <p className="text-base font-bold text-slate-900 uppercase tracking-tight">Hub Request Priority</p>
                                            <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">Fulfillment Status: PREPARING</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-lg font-black text-slate-900 tracking-tight">₹450.00</p>
                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">2:30 PM Today</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="space-y-8">

                    <div className="bg-white rounded-[3rem] border border-slate-100 p-10 relative overflow-hidden group">
                        <Package className="h-10 w-10 text-slate-400 mb-8" />
                        <h3 className="text-3xl font-black text-slate-900 uppercase tracking-tight leading-[0.9] mb-4">Stock<br/>Handshake</h3>
                        <p className="text-xs text-slate-400 font-medium leading-relaxed mb-10 text-balance uppercase tracking-widest">Refresh regional inventory levels to maintain high-fidelity fulfillment.</p>
                        <button 
                            onClick={() => router.push(`/admin/inventory?location=${store?.id}`)}
                            className="w-full py-5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-[1.5rem] font-black text-[11px] uppercase tracking-[0.25em] transition-all flex items-center justify-center gap-2 group border border-slate-100 shadow-sm">
                            Inventory Registry
                            <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                        </button>
                    </div>

                    <div className="bg-white rounded-[2.5rem] border border-slate-100 p-10">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-8">Service Metrics</h4>
                        <div className="space-y-6">
                            {[1, 2].map((_, i) => (
                                <div key={i} className="flex items-center gap-5">
                                    <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-900 font-black text-sm border border-slate-100 shadow-inner">0{i+1}</div>
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between mb-2">
                                            <p className="text-[11px] font-black text-slate-900 uppercase">Hub Operator {i+1}</p>
                                            <span className="text-[9px] font-black text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded-md">98% SCR</span>
                                        </div>
                                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                            <div className="h-full bg-emerald-500 w-[98%] rounded-full shadow-[0_0_8px_rgba(16,185,129,0.4)]"></div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function ArrowRight(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
        </svg>
    )
}
