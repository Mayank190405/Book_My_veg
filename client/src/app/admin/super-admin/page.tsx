"use client";

import { useState } from "react";
import {
    Store, Plus, TrendingUp, ShoppingBag,
    AlertTriangle, CreditCard, Image as ImageIcon,
    Users, MapPin, Phone, Globe, DollarSign, Banknote,
    Trash2, ArrowRight, Package
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/services/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

function SuperAdminDashboardContent() {
    const searchParams = useSearchParams();
    const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "overview");
    const [isAddStoreOpen, setIsAddStoreOpen] = useState(false);
    const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);
    const queryClient = useQueryClient();

    useEffect(() => {
        const tab = searchParams.get("tab");
        if (tab) setActiveTab(tab);
    }, [searchParams]);

    // ── Queries ───────────────────────────────────────────────────────
    const { data: locations, isLoading: locLoading } = useQuery({
        queryKey: ["locations"],
        queryFn: async () => {
            const res = await api.get("/locations");
            return res.data;
        }
    });

    const { data: globalStats, isLoading: statsLoading } = useQuery({
        queryKey: ["global-stats"],
        queryFn: async () => {
            const res = await api.get("/analytics/global/sales");
            return res.data;
        }
    });

    const { data: inventoryAlerts, isLoading: invLoading } = useQuery({
        queryKey: ["global-inventory"],
        queryFn: async () => {
            const res = await api.get("/analytics/global/inventory");
            return res.data;
        }
    });

    const { data: mortalityLogs } = useQuery({
        queryKey: ["all-mortality"],
        queryFn: async () => {
            const res = await api.get("/mortality/list");
            return res.data;
        }
    });

    const { data: banners } = useQuery({
        queryKey: ["banners"],
        queryFn: async () => {
            const res = await api.get("/banners");
            return res.data;
        }
    });

    const { data: leaderboard } = useQuery({
        queryKey: ["customer-leaderboard"],
        queryFn: async () => {
            const res = await api.get("/user-analytics/leaderboard");
            return res.data;
        }
    });

    const { data: khataOversight } = useQuery({
        queryKey: ["khata-oversight"],
        queryFn: async () => {
            const res = await api.get("/analytics/global/khata");
            return res.data;
        }
    });

    const { data: globalCosts } = useQuery({
        queryKey: ["global-costs"],
        queryFn: async () => {
            const res = await api.get("/analytics/global/costs");
            return res.data;
        }
    });

    // ── Calculations ──────────────────────────────────────────────────
    const totalSales = globalStats?.reduce((acc: number, curr: any) => acc + curr.total, 0) || 0;
    const onlineSales = globalStats?.reduce((acc: number, curr: any) => acc + curr.online, 0) || 0;
    const posCashSales = globalStats?.reduce((acc: number, curr: any) => acc + curr.posCash, 0) || 0;
    const posOnlineSales = globalStats?.reduce((acc: number, curr: any) => acc + curr.posOnline, 0) || 0;

    if (locLoading || statsLoading || invLoading) {
        return <div className="p-20 text-center font-black animate-pulse text-gray-400 uppercase tracking-widest">Initialising Global Oversight...</div>;
    }

    return (
        <div className="space-y-8 pb-12">
            {/* Header */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm transition-all duration-500 hover:shadow-xl">
                <div>
                    <h1 className="text-4xl font-black text-gray-900 tracking-tight mb-2">Super Control</h1>
                    <p className="text-gray-500 font-bold flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        Infrastructure & Marketing Oversight
                    </p>
                </div>
                <div className="flex gap-2 bg-gray-50 p-1.5 rounded-2xl border border-gray-100 overflow-x-auto no-scrollbar">
                    <TabButton active={activeTab === "overview"} onClick={() => setActiveTab("overview")} label="Overview" />
                    <TabButton active={activeTab === "inventory"} onClick={() => setActiveTab("inventory")} label="Global Inventory" />
                    <TabButton active={activeTab === "crm"} onClick={() => setActiveTab("crm")} label="CRM & Users" />
                    <TabButton active={activeTab === "staff"} onClick={() => setActiveTab("staff")} label="Staff" />
                    <TabButton active={activeTab === "marketing"} onClick={() => setActiveTab("marketing")} label="Marketing" />
                    <TabButton active={activeTab === "mortality"} onClick={() => setActiveTab("mortality")} label="Mortality" />
                </div>
                <button
                    onClick={() => setIsAddStoreOpen(true)}
                    className="bg-gray-900 text-white px-8 py-3.5 rounded-2xl font-black text-sm hover:bg-black transition-all active:scale-95 shadow-xl shadow-gray-200"
                >
                    Register New Store
                </button>
            </header>

            {activeTab === "overview" && (
                <>
                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <StatCard title="Global Revenue" value={`₹${totalSales.toLocaleString()}`} subtitle="Consolidated Sales" icon={<DollarSign className="h-6 w-6 text-green-600" />} color="bg-green-50" />
                        <StatCard title="Global Costs (Today)" value={`₹${(globalCosts?.totalCost || 0).toLocaleString()}`} subtitle="Expenses Across Hubs" icon={<CreditCard className="h-6 w-6 text-orange-600" />} color="bg-orange-50" />
                        <StatCard title="Global Mortality" value={mortalityLogs?.reduce((acc: number, l: any) => acc + l.quantity, 0) || 0} subtitle="Total Wastage Qty" icon={<AlertTriangle className="h-6 w-6 text-red-600" />} color="bg-red-50" />
                        <StatCard title="Low Stock" value={inventoryAlerts?.lowStockCount || 0} subtitle="Critical Alerts" icon={<ShoppingBag className="h-6 w-6 text-red-600" />} color="bg-red-50" />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Store Table */}
                        <div className="lg:col-span-2 bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden pb-8">
                            <div className="px-8 py-8 border-b border-gray-50 flex items-center justify-between">
                                <h2 className="text-xl font-black text-gray-900 tracking-tight uppercase tracking-widest">Store Registry</h2>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-gray-50/50">
                                        <tr>
                                            <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Outlet Name</th>
                                            <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Route Slug</th>
                                            <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Performance</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {locations?.map((loc: any) => {
                                            const stats = globalStats?.find((s: any) => s.store === loc.name);
                                            return (
                                                <tr key={loc.id} className="hover:bg-gray-50 transition-colors cursor-pointer group">
                                                    <td className="px-8 py-6">
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center font-black text-gray-400 group-hover:bg-green-100 group-hover:text-green-600 transition-all shadow-inner">
                                                                {loc.name.charAt(0)}
                                                            </div>
                                                            <div>
                                                                <p className="font-black text-gray-900">{loc.name}</p>
                                                                <p className="text-[10px] text-gray-400 font-bold uppercase">{loc.contactNumber || "NO CONTACT"}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-8 py-6">
                                                        <div className="flex gap-2">
                                                            <span className="inline-flex items-center px-3 py-1.5 rounded-xl bg-gray-900 text-white text-[10px] font-mono font-black shadow-sm">
                                                                /{loc.slug}
                                                            </span>
                                                            <Link href={`/pos/${loc.slug}`} className="inline-flex items-center px-3 py-1.5 rounded-xl bg-green-50 text-green-600 text-[10px] font-black uppercase tracking-widest hover:bg-green-100 transition-colors">
                                                                Launch POS
                                                            </Link>
                                                        </div>
                                                    </td>
                                                    <td className="px-8 py-6 text-right">
                                                        <p className="font-black text-gray-900 text-lg">₹{(stats?.total || 0).toLocaleString()}</p>
                                                        <div className="flex items-center justify-end gap-3 mt-1 text-[10px] font-black uppercase tracking-tighter">
                                                            <span className="text-emerald-600">Cash: ₹{stats?.posCash.toLocaleString()}</span>
                                                            <span className="text-indigo-600">Online: ₹{(stats?.online + stats?.posOnline).toLocaleString()}</span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Sidebar */}
                        <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-8 space-y-6">
                            <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
                                <AlertTriangle className="h-5 w-5 text-orange-500" />
                                Stock Alerts
                            </h2>
                            <div className="space-y-4">
                                {inventoryAlerts?.lowStockAlerts?.slice(0, 8).map((alert: any, i: number) => (
                                    <div key={i} className="p-4 bg-orange-50/50 rounded-2xl border border-orange-100/50 flex justify-between items-center hover:bg-orange-50 transition-colors">
                                        <div>
                                            <p className="text-xs font-black text-gray-900">{alert.product}</p>
                                            <p className="text-[10px] text-orange-700 font-bold uppercase tracking-tight">{alert.store}</p>
                                        </div>
                                        <p className="px-3 py-1 bg-white rounded-lg text-xs font-black text-orange-600 shadow-sm border border-orange-100">{alert.stock} left</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </>
            )}

            {activeTab === "inventory" && (
                <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden pb-8 animate-in fade-in duration-500">
                    <div className="px-8 py-8 border-b border-gray-50 flex items-center justify-between">
                        <h2 className="text-xl font-black text-gray-900 tracking-tight uppercase tracking-widest">Global Inventory Tracker</h2>
                        <div className="flex gap-2">
                            <span className="px-3 py-1 bg-red-50 text-red-600 rounded-lg text-xs font-black uppercase tracking-widest">
                                {inventoryAlerts?.lowStockCount || 0} Critical
                            </span>
                            <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-lg text-xs font-black uppercase tracking-widest">
                                {inventoryAlerts?.totalItemsTracked || 0} Tracked
                            </span>
                            <button onClick={() => setIsAddCategoryOpen(true)} className="px-4 py-2 bg-green-600 text-white hover:bg-green-700 transition-colors rounded-xl text-xs font-black shadow-sm uppercase tracking-widest flex items-center gap-2">
                                <Plus className="h-4 w-4" /> Create Category
                            </button>
                        </div>
                    </div>
                    <div className="overflow-x-auto max-h-[600px] custom-scrollbar">
                        <table className="w-full text-left relative">
                            <thead className="bg-white sticky top-0 z-10">
                                <tr>
                                    <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-50">Store Layout</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-50">Product</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-50">SKU</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-50 text-right">Volume</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {(inventoryAlerts?.allInventory || inventoryAlerts?.lowStockAlerts || [])?.map((inv: any, idx: number) => (
                                    <tr key={idx} className="hover:bg-gray-50 transition-colors cursor-pointer">
                                        <td className="px-8 py-6 font-bold text-gray-500 text-sm uppercase">{inv.store}</td>
                                        <td className="px-8 py-6 font-black text-gray-900">
                                            <div className="flex items-center gap-2">
                                                {inv.isLowStock && <AlertTriangle className="h-4 w-4 text-red-500" />}
                                                {inv.product}
                                            </div>
                                        </td>
                                        <td className="px-8 py-6 font-mono text-[10px] font-black text-gray-400">{inv.sku || "NO-SKU"}</td>
                                        <td className="px-8 py-6 text-right">
                                            <span className={cn(
                                                "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest",
                                                inv.isLowStock ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600"
                                            )}>
                                                {inv.stock} in stock
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === "crm" && (
                <div className="space-y-8 animate-in fade-in duration-500">
                    {/* CRM Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <StatCard title="Total Customers" value={leaderboard?.length || 0} subtitle="Registered Users" icon={<Users className="h-6 w-6 text-indigo-600" />} color="bg-indigo-50" />
                        <StatCard title="Oustanding Credit" value={`₹${khataOversight?.stats?.totalOutstanding.toLocaleString() || 0}`} subtitle="Across all Khatas" icon={<Banknote className="h-6 w-6 text-amber-600" />} color="bg-amber-50" />
                        <StatCard title="High Risk" value={khataOversight?.stats?.highRiskCount || 0} subtitle="Near Credit Limit" icon={<AlertTriangle className="h-6 w-6 text-red-600" />} color="bg-red-50" />
                    </div>

                    <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden pb-8">
                        <div className="px-8 py-8 border-b border-gray-50 flex items-center justify-between">
                            <h2 className="text-xl font-black text-gray-900 tracking-tight uppercase tracking-widest">Customer Lifecycle & Sales</h2>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50/50">
                                    <tr className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                        <th className="px-8 py-4">Customer</th>
                                        <th className="px-8 py-4">Frequency</th>
                                        <th className="px-8 py-4">Top Hub</th>
                                        <th className="px-8 py-4">Online Spend</th>
                                        <th className="px-8 py-4">Offline Spend</th>
                                        <th className="px-8 py-4">Payment Yet to Come</th>
                                        <th className="px-8 py-4 text-right">Total Life Value</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {leaderboard?.map((cust: any) => (
                                        <tr key={cust.id} className="hover:bg-gray-50 transition-colors cursor-pointer group">
                                            <td className="px-8 py-6">
                                                <div>
                                                    <p className="font-black text-gray-900 leading-tight">{cust.name || "Anonymous"}</p>
                                                    <p className="text-[10px] text-gray-400 font-bold">{cust.phone}</p>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <span className="text-xs font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg uppercase italic">{cust.orderCount} Orders</span>
                                            </td>
                                            <td className="px-8 py-6 font-bold text-gray-600 text-sm uppercase">{cust.mostRepeatStore || "N/A"}</td>
                                            <td className="px-8 py-6 font-bold text-gray-600 text-sm">₹{cust.onlineSpend.toLocaleString()}</td>
                                            <td className="px-8 py-6 font-bold text-gray-600 text-sm">₹{cust.offlineSpend.toLocaleString()}</td>
                                            <td className="px-8 py-6">
                                                {khataOversight?.customers?.find((k: any) => k.userId === cust.id)?.outstanding > 0 ? (
                                                    <span className="px-3 py-1 bg-red-50 text-red-600 rounded-lg text-xs font-black">
                                                        ₹{Number(khataOversight.customers.find((k: any) => k.userId === cust.id).outstanding).toLocaleString()} Due
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] text-gray-300 font-bold uppercase">Clear</span>
                                                )}
                                            </td>
                                            <td className="px-8 py-6 text-right font-black text-gray-900 text-lg">₹{cust.totalSpent.toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === "marketing" && <BannerManagement banners={banners} />}
            {activeTab === "staff" && (
                <div className="bg-white rounded-[2.5rem] border border-gray-100 p-10 shadow-sm space-y-8 animate-in fade-in duration-500">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-2xl font-black text-gray-900 tracking-tight">Staffing & Operations</h2>
                            <p className="text-sm text-gray-400 font-bold">Manage operational users and store assignments</p>
                        </div>
                    </div>

                    <form className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-gray-50 p-8 rounded-[2rem] border border-gray-100" onSubmit={(e: any) => {
                        e.preventDefault();
                        const data = Object.fromEntries(new FormData(e.target));
                        api.post("/user-analytics/create-staff", data).then(() => {
                            toast.success("Operational User Created!");
                            e.target.reset();
                        }).catch(() => toast.error("Failed to create user. Check if phone is unique."));
                    }}>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Full Name</label>
                            <input name="name" required placeholder="John Doe" className="w-full px-6 py-4 rounded-2xl bg-white border-none focus:ring-2 focus:ring-indigo-500 font-bold" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Phone Number</label>
                            <input name="phone" required placeholder="91XXXXXXXX" className="w-full px-6 py-4 rounded-2xl bg-white border-none focus:ring-2 focus:ring-indigo-500 font-bold" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Access Role</label>
                            <select name="role" className="w-full px-6 py-4 rounded-2xl bg-white border-none focus:ring-2 focus:ring-indigo-500 font-bold">
                                <option value="ADMIN">Hub Admin</option>
                                <option value="CASHIER">POS Operator</option>
                                <option value="USER">Standard User</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Assigned Location</label>
                            <select name="locationId" className="w-full px-6 py-4 rounded-2xl bg-white border-none focus:ring-2 focus:ring-indigo-500 font-bold">
                                {locations?.map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Account Password</label>
                            <input name="password" type="password" required placeholder="••••••••" className="w-full px-6 py-4 rounded-2xl bg-white border-none focus:ring-2 focus:ring-indigo-500 font-bold" />
                        </div>
                        <div className="flex items-end pt-2">
                            <button type="submit" className="w-full h-[60px] bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 uppercase italic tracking-widest">Authorise User</button>
                        </div>
                    </form>
                </div>
            )}

            {activeTab === "marketing" && <BannerManagement banners={banners} />}

            {isAddStoreOpen && <AddStoreModal isOpen={isAddStoreOpen} onClose={() => setIsAddStoreOpen(false)} />}
            {isAddCategoryOpen && <AddCategoryModal onClose={() => setIsAddCategoryOpen(false)} />}
        </div>
    );
}

function BannerManagement({ banners }: { banners: any[] }) {
    const queryClient = useQueryClient();
    const [isAddBannerOpen, setIsAddBannerOpen] = useState(false);

    const toggleMutation = useMutation({
        mutationFn: (id: string) => api.patch(`/banners/${id}/toggle`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["banners"] });
            toast.success("Banner visibility updated");
        },
        onError: (err: any) => toast.error(err.response?.data?.message || "Action failed")
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => api.delete(`/banners/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["banners"] });
            toast.success("Banner deleted");
        }
    });

    const activeCount = banners?.filter(b => b.isActive).length || 0;

    return (
        <div className="bg-white rounded-[2.5rem] border border-gray-100 p-10 shadow-sm space-y-8 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-black text-gray-900 tracking-tight">Marketing Banners</h2>
                    <p className="text-sm text-gray-400 font-bold">
                        Configure top-level promotions ({activeCount}/3 active)
                    </p>
                </div>
                <button
                    onClick={() => setIsAddBannerOpen(true)}
                    className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-black text-sm hover:bg-indigo-700 transition-all active:scale-95 shadow-lg shadow-indigo-100 flex items-center gap-2"
                >
                    <Plus className="h-4 w-4" /> Create Banner
                </button>
            </div>

            {activeCount >= 3 && (
                <div className="p-4 bg-orange-50 border border-orange-100 rounded-2xl flex items-center gap-3 text-orange-700">
                    <AlertTriangle className="h-5 w-5 shrink-0" />
                    <p className="text-xs font-black uppercase tracking-widest">Maximum active banners reached. Toggle off an existing banner to enable another.</p>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {banners?.map((banner) => (
                    <div key={banner.id} className="group overflow-hidden rounded-[2rem] border border-gray-100 bg-gray-50/30 hover:bg-white hover:shadow-xl transition-all duration-500">
                        <div className="aspect-[21/9] bg-gray-200 relative overflow-hidden">
                            <img src={banner.imageUrl} alt="" className="w-full h-full object-cover" />
                            <div className="absolute top-4 right-4 flex gap-2">
                                <button
                                    onClick={() => deleteMutation.mutate(banner.id)}
                                    className="p-2.5 bg-white/90 backdrop-blur rounded-xl text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-sm"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Action Link</p>
                                    <p className="text-xs font-bold text-gray-900 truncate max-w-[150px]">{banner.link || "No Link"}</p>
                                </div>
                                <button
                                    onClick={() => toggleMutation.mutate(banner.id)}
                                    className={cn(
                                        "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-tight transition-all",
                                        banner.isActive ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                                    )}
                                >
                                    {banner.isActive ? "Active" : "Hidden"}
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {isAddBannerOpen && <AddBannerModal onClose={() => setIsAddBannerOpen(false)} />}
        </div>
    );
}

function AddBannerModal({ onClose }: { onClose: () => void }) {
    const queryClient = useQueryClient();
    const mutation = useMutation({
        mutationFn: (data: any) => api.post("/banners", data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["banners"] });
            toast.success("Banner Created!");
            onClose();
        },
        onError: (err: any) => toast.error(err.response?.data?.message || "Failed to create banner")
    });

    const handleSubmit = (e: any) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target));
        mutation.mutate({
            ...data,
            isActive: true,
            sortOrder: 0
        });
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-[3rem] w-full max-w-xl p-10 shadow-2xl animate-in zoom-in-95 duration-200">
                <h2 className="text-3xl font-black text-gray-900 tracking-tight mb-8">Design Promotion</h2>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Banner Image URL</label>
                        <input name="imageUrl" placeholder="https://..." required className="w-full px-6 py-4 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-indigo-500 font-bold" />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Target Link (Optional)</label>
                        <input name="link" placeholder="/collections/fresh" className="w-full px-6 py-4 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-indigo-500 font-bold" />
                    </div>
                    <div className="pt-6 grid grid-cols-2 gap-4">
                        <button type="button" onClick={onClose} className="py-4 rounded-2xl font-black text-gray-400 hover:bg-gray-50 transition-colors">Cancel</button>
                        <button type="submit" disabled={mutation.isPending} className="py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95">Flash Banner</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function TabButton({ active, onClick, label }: any) {
    return (
        <button onClick={onClick} className={cn("px-8 py-2.5 rounded-xl font-black text-sm transition-all duration-300", active ? "bg-white text-gray-900 shadow-md translate-y-[-1px]" : "text-gray-400 hover:text-gray-600")}>
            {label}
        </button>
    );
}

function StatCard({ title, value, subtitle, icon, color }: any) {
    return (
        <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm flex items-start justify-between group hover:border-green-200 transition-all hover:shadow-xl">
            <div>
                <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">{title}</p>
                <p className="text-3xl font-black text-gray-900 tracking-tight">{value}</p>
                <p className="text-[10px] text-gray-400 mt-1 font-bold">{subtitle}</p>
            </div>
            <div className={cn("p-4 rounded-2xl transition-transform group-hover:scale-110 shadow-inner", color)}>{icon}</div>
        </div>
    );
}

function AddStoreModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
    const queryClient = useQueryClient();
    const mutation = useMutation({
        mutationFn: async (data: any) => api.post("/locations", data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["locations"] });
            toast.success("Store Registered Successfully!");
            onClose();
        },
        onError: (err: any) => toast.error(err.response?.data?.error || "Registration Failed")
    });

    const handleSubmit = (e: any) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target));
        mutation.mutate(data);
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-[3rem] w-full max-w-xl p-10 shadow-2xl animate-in zoom-in-95 duration-200 border-4 border-gray-50">
                <h2 className="text-3xl font-black text-gray-900 tracking-tight mb-8">Register New Outlet</h2>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Store Name</label>
                        <input name="name" placeholder="BMV Indrapuri" required className="w-full px-6 py-4 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-green-500 font-bold" />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Route Slug</label>
                        <input name="slug" placeholder="indrapuri" required className="w-full px-6 py-4 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-green-500 font-bold" />
                    </div>
                    <div className="pt-6 grid grid-cols-2 gap-4">
                        <button type="button" onClick={onClose} className="py-4 rounded-2xl font-black text-gray-400 hover:bg-gray-50 transition-colors">Cancel</button>
                        <button type="submit" disabled={mutation.isPending} className="py-4 bg-green-600 text-white rounded-2xl font-black shadow-lg shadow-green-100 hover:bg-green-700 transition-all active:scale-95">Complete Setup</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function AddCategoryModal({ onClose }: { onClose: () => void }) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const queryClient = useQueryClient();
    const mutation = useMutation({
        mutationFn: async (data: any) => api.post("/categories", data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["categories"] });
            toast.success("Category Created Successfully!");
            onClose();
        },
        onError: (err: any) => toast.error(err.response?.data?.message || "Failed to create category")
    });

    const handleSubmit = async (e: any) => {
        e.preventDefault();
        if (isSubmitting) return;
        setIsSubmitting(true);
        const data = Object.fromEntries(new FormData(e.target));

        try {
            await mutation.mutateAsync({
                ...data,
                slug: data.name.toString().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''),
                isActive: true,
                sortOrder: 0
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-[3rem] w-full max-w-xl p-10 shadow-2xl animate-in zoom-in-95 duration-200 border-4 border-gray-50">
                <h2 className="text-3xl font-black text-gray-900 tracking-tight mb-8">Add New Category</h2>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Category Name</label>
                        <input name="name" placeholder="Fresh Vegetables" required className="w-full px-6 py-4 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-green-500 font-bold" />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Icon/Image URL (Optional)</label>
                        <input name="imageUrl" placeholder="https://..." className="w-full px-6 py-4 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-green-500 font-bold" />
                    </div>
                    <div className="pt-6 grid grid-cols-2 gap-4">
                        <button type="button" onClick={onClose} className="py-4 rounded-2xl font-black text-gray-400 hover:bg-gray-50 transition-colors">Cancel</button>
                        <button disabled={isSubmitting} type="submit" className="py-4 bg-green-600 text-white rounded-2xl font-black shadow-lg shadow-green-100 hover:bg-green-700 transition-all active:scale-95 disabled:opacity-50">
                            {isSubmitting ? "Creating..." : "Save Category"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default function SuperAdminDashboard() {
    return (
        <Suspense fallback={<div className="p-20 text-center font-black animate-pulse text-gray-400 uppercase tracking-widest">Loading Dashboard...</div>}>
            <SuperAdminDashboardContent />
        </Suspense>
    );
}
