"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import api from "@/services/api";
import { toast } from "sonner";
import { 
    Package, 
    CheckCircle2, 
    QrCode, 
    Bell, 
    Plus, 
    ShieldCheck, 
    Layers, 
    Loader2, 
    ArrowUpRight,
    Warehouse,
    Sparkles,
    Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUserStore } from "@/store/useUserStore";

export default function PackerDashboardPage() {
    const router = useRouter();
    const { user } = useUserStore();

    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchOrders = useCallback(async () => {
        try {
            const res = await api.get("/orders/packing/pending");
            const list = Array.isArray(res.data) ? res.data : (res.data?.data || []);
            setOrders(list);
        } catch (error: any) {
            toast.error("Failed to sync packing queue");
            setOrders([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchOrders();
    }, [fetchOrders]);

    // Live Metrics calculated from real orders
    const metrics = useMemo(() => {
        const total = orders.length;
        const newOrders = orders.filter(o => !o.packedAt && o.status !== "PACKED" && o.status !== "DELIVERED").length;
        const packedToday = orders.filter(o => Boolean(o.packedAt) || o.status === "PACKED").length;
        const verifiedToday = orders.filter(o => Boolean(o.packerValidatedAt)).length;
        const totalPacked = packedToday;

        let createdAmount = 0;
        orders.forEach(o => {
            createdAmount += Number(o.totalAmount || 0);
        });

        return {
            total,
            newOrders,
            packedToday,
            verifiedToday,
            totalPacked,
            ordersCreatedAmount: createdAmount,
            ordersPackedCount: packedToday,
            ordersVerifiedCount: verifiedToday
        };
    }, [orders]);

    const greeting = useMemo(() => {
        const hour = new Date().getHours();
        if (hour < 12) return "Good Morning";
        if (hour < 17) return "Good Afternoon";
        return "Good Evening";
    }, []);

    const packerFirstName = user?.name ? user.name.split(" ")[0] : "Packer";
    const terminalId = user?.id ? `PKR-${user.id.slice(-4).toUpperCase()}` : "PKR-1024";

    return (
        <div className="min-h-full flex flex-col bg-slate-50 antialiased animate-in fade-in duration-300">
            {/* 1. Deep Royal Purple Header */}
            <div className="bg-[#1E1139] px-6 sm:px-8 pt-7 sm:pt-9 pb-16 sm:pb-20 text-white relative z-0 sm:rounded-t-3xl transition-all">
                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-white tracking-tight flex items-center gap-2">
                                Hi, {packerFirstName} <span className="inline-block animate-wave">👑</span>
                            </h2>
                        </div>
                        <p className="text-xs sm:text-sm font-semibold text-purple-300/90 flex items-center gap-2">
                            <span>{greeting}</span>
                            <span>•</span>
                            <span className="font-mono text-purple-200">{terminalId}</span>
                        </p>
                    </div>

                    <div className="flex items-center gap-2.5">
                        <button 
                            onClick={() => toast.info("No new notifications")}
                            className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white/10 hover:bg-white/20 transition-all flex items-center justify-center text-white relative active:scale-95"
                            aria-label="Notifications"
                        >
                            <Bell className="h-5 w-5" />
                            <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-purple-400 rounded-full ring-2 ring-[#1E1139]" />
                        </button>
                    </div>
                </div>
            </div>

            {/* 2. Floating Responsive Metrics Cards (Positioned over Purple Header with z-10) */}
            <div className="px-5 sm:px-8 -mt-10 sm:-mt-12 space-y-6 flex-1 pb-6 relative z-10">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 sm:gap-4.5">
                    {/* Card 1: New Orders */}
                    <div 
                        onClick={() => router.push("/packer/orders?tab=ALL")}
                        className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-slate-100/80 shadow-md shadow-slate-200/50 flex flex-col justify-between space-y-3 cursor-pointer hover:shadow-lg transition-all active:scale-[0.98] group"
                    >
                        <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <Package className="h-4 w-4" />
                            </div>
                            <span className="text-xs sm:text-sm font-bold text-slate-600">New Orders</span>
                        </div>
                        <p className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight pl-1">
                            {loading ? "08" : String(metrics.newOrders).padStart(2, "0")}
                        </p>
                    </div>

                    {/* Card 2: Packed Today */}
                    <div 
                        onClick={() => router.push("/packer/orders?tab=PACKED")}
                        className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-slate-100/80 shadow-md shadow-slate-200/50 flex flex-col justify-between space-y-3 cursor-pointer hover:shadow-lg transition-all active:scale-[0.98] group"
                    >
                        <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <Check className="h-4 w-4 stroke-[3]" />
                            </div>
                            <span className="text-xs sm:text-sm font-bold text-slate-600">Packed Today</span>
                        </div>
                        <p className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight pl-1">
                            {loading ? "05" : String(metrics.packedToday).padStart(2, "0")}
                        </p>
                    </div>

                    {/* Card 3: Verified Today */}
                    <div 
                        onClick={() => router.push("/packer/orders?tab=PACKED")}
                        className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-slate-100/80 shadow-md shadow-slate-200/50 flex flex-col justify-between space-y-3 cursor-pointer hover:shadow-lg transition-all active:scale-[0.98] group"
                    >
                        <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-teal-50 text-teal-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <ShieldCheck className="h-4 w-4" />
                            </div>
                            <span className="text-xs sm:text-sm font-bold text-slate-600">Verified</span>
                        </div>
                        <p className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight pl-1">
                            {loading ? "03" : String(metrics.verifiedToday).padStart(2, "0")}
                        </p>
                    </div>

                    {/* Card 4: Total Queue */}
                    <div 
                        onClick={() => router.push("/packer/history")}
                        className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-slate-100/80 shadow-md shadow-slate-200/50 flex flex-col justify-between space-y-3 cursor-pointer hover:shadow-lg transition-all active:scale-[0.98] group"
                    >
                        <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <Layers className="h-4 w-4" />
                            </div>
                            <span className="text-xs sm:text-sm font-bold text-slate-600">Total Queue</span>
                        </div>
                        <p className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight pl-1">
                            {loading ? "12" : String(metrics.total).padStart(2, "0")}
                        </p>
                    </div>
                </div>

                {/* 3. Responsive 2-Column Section on Tablet/Desktop */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
                    {/* Today's Summary Card */}
                    <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-100/80 shadow-md shadow-slate-200/40 space-y-4 flex flex-col justify-between">
                        <div>
                            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                                <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">Today&apos;s Summary</h3>
                                <button 
                                    onClick={() => router.push("/packer/history")}
                                    className="text-xs sm:text-sm font-bold text-purple-700 hover:text-purple-800 hover:underline transition-colors flex items-center gap-0.5"
                                >
                                    View All
                                    <ArrowUpRight className="h-3.5 w-3.5" />
                                </button>
                            </div>

                            <div className="space-y-3.5 pt-4 text-sm font-semibold">
                                <div className="flex items-center justify-between">
                                    <span className="text-slate-600">Orders Created</span>
                                    <span className="font-black text-slate-900 text-sm sm:text-base">
                                        ₹ {loading ? "24,500" : metrics.ordersCreatedAmount.toLocaleString()}
                                    </span>
                                </div>

                                <div className="flex items-center justify-between">
                                    <span className="text-slate-600">Orders Packed</span>
                                    <span className="font-black text-emerald-600 text-sm sm:text-base">
                                        {loading ? "18" : metrics.ordersPackedCount} batches
                                    </span>
                                </div>

                                <div className="flex items-center justify-between">
                                    <span className="text-slate-600">Orders Verified</span>
                                    <span className="font-black text-teal-600 text-sm sm:text-base">
                                        {loading ? "14" : metrics.ordersVerifiedCount} items
                                    </span>
                                </div>

                                <div className="h-px bg-slate-100 my-1" />

                                <div className="flex items-center justify-between">
                                    <span className="text-slate-700 font-bold">Fulfillment Rate</span>
                                    <span className="font-black text-purple-700 text-sm sm:text-base">
                                        {metrics.total > 0 ? `${Math.round((metrics.packedToday / metrics.total) * 100)}%` : "100%"}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Mobile Stacked Buttons */}
                        <div className="space-y-2.5 pt-3 md:hidden">
                            <Button 
                                onClick={() => router.push("/packer/create-order")}
                                className="w-full h-13 sm:h-14 rounded-2xl bg-purple-700 hover:bg-purple-800 text-white font-black text-sm uppercase tracking-wider shadow-lg shadow-purple-600/25 flex items-center justify-center gap-2.5 transition-all active:scale-[0.98]"
                            >
                                <Plus className="h-5 w-5 stroke-[3]" />
                                Create New Order
                            </Button>

                            <Button 
                                variant="outline"
                                onClick={() => router.push("/packer/scan")}
                                className="w-full h-13 sm:h-14 rounded-2xl border-2 border-purple-700 text-purple-700 font-black text-sm uppercase tracking-wider hover:bg-purple-50 flex items-center justify-center gap-2.5 transition-all active:scale-[0.98]"
                            >
                                <QrCode className="h-5 w-5" />
                                Scan QR to Verify
                            </Button>
                        </div>
                    </div>

                    {/* Warehouse Station Operations Card */}
                    <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-100/80 shadow-md shadow-slate-200/40 space-y-4 flex flex-col justify-between">
                        <div className="space-y-4">
                            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                                <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">Station Operations</h3>
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                                    Station Ready
                                </span>
                            </div>

                            <p className="text-xs sm:text-sm text-slate-500 font-medium leading-relaxed">
                                Process customer walk-in orders, configure custom packing weights, and scan QR receipts for distribution handoffs.
                            </p>

                            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-800 flex items-center justify-center">
                                        <Warehouse className="h-4.5 w-4.5" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-slate-800">Assigned Hub Node</p>
                                        <p className="text-[11px] text-slate-400 font-semibold">{user?.location?.name || "BookMyVeg Distribution Center"}</p>
                                    </div>
                                </div>
                                <ShieldCheck className="h-5 w-5 text-purple-700" />
                            </div>
                        </div>

                        {/* Tablet & Desktop Actions */}
                        <div className="space-y-2.5 pt-3">
                            <Button 
                                onClick={() => router.push("/packer/create-order")}
                                className="w-full h-13 sm:h-14 rounded-2xl bg-purple-700 hover:bg-purple-800 text-white font-black text-sm uppercase tracking-wider shadow-lg shadow-purple-600/25 flex items-center justify-center gap-2.5 transition-all active:scale-[0.98]"
                            >
                                <Plus className="h-5 w-5 stroke-[3]" />
                                Create New Order
                            </Button>

                            <Button 
                                variant="outline"
                                onClick={() => router.push("/packer/scan")}
                                className="w-full h-13 sm:h-14 rounded-2xl border-2 border-purple-700 text-purple-700 font-black text-sm uppercase tracking-wider hover:bg-purple-50 flex items-center justify-center gap-2.5 transition-all active:scale-[0.98]"
                            >
                                <QrCode className="h-5 w-5" />
                                Scan QR to Verify
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
