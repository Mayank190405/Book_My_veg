"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import api from "@/services/api";
import { toast } from "sonner";
import { 
    ShoppingBag, 
    CheckCircle2, 
    Clock, 
    IndianRupee, 
    QrCode, 
    Bell, 
    Loader2,
    Truck,
    ArrowUpRight,
    Sparkles,
    ShieldCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUserStore } from "@/store/useUserStore";

export default function DriverDashboardPage() {
    const router = useRouter();
    const { user } = useUserStore();

    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchOrders = useCallback(async () => {
        try {
            const res = await api.get("/orders/driver/assigned");
            const orderList = Array.isArray(res.data) ? res.data : (res.data?.data || []);
            setOrders(orderList);
        } catch (error: any) {
            toast.error("Failed to sync deliveries");
            setOrders([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchOrders();
    }, [fetchOrders]);

    // Calculate live actual metrics
    const metrics = useMemo(() => {
        const total = orders.length;
        const delivered = orders.filter(o => o.status === "DELIVERED").length;
        const pending = orders.filter(o => o.status !== "DELIVERED").length;
        
        let cashCollected = 0;
        let totalCustomerDue = 0;
        
        orders.forEach(o => {
            cashCollected += Number(o.cashCollected || 0);
            const totalBill = Number(o.totalAmount || 0);
            const paid = Number(o.cashCollected || 0) + Number(o.easebuzzCollected || 0);
            if (!o.isPaid && o.paymentStatus !== "COMPLETED" && o.paymentStatus !== "PAID") {
                totalCustomerDue += Math.max(0, totalBill - paid);
            }
        });

        const cashSubmitted = 0;
        const pendingSubmission = cashCollected;

        return {
            totalOrders: total,
            delivered,
            pending,
            totalDue: totalCustomerDue,
            cashCollected,
            cashSubmitted,
            pendingSubmission,
            totalCustomerDue
        };
    }, [orders]);

    const greeting = useMemo(() => {
        const hour = new Date().getHours();
        if (hour < 12) return "Good Morning";
        if (hour < 17) return "Good Afternoon";
        return "Good Evening";
    }, []);

    const driverFirstName = user?.name ? user.name.split(" ")[0] : "Rohit";

    return (
        <div className="min-h-full flex flex-col bg-slate-50 antialiased animate-in fade-in duration-300">
            {/* 1. Deep Navy Blue Header */}
            <div className="bg-[#0B1E48] px-6 sm:px-8 pt-7 sm:pt-9 pb-16 sm:pb-20 text-white relative z-0 sm:rounded-t-3xl transition-all">
                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-white tracking-tight flex items-center gap-2">
                            Hi, {driverFirstName} <span className="inline-block animate-wave">👏</span>
                        </h2>
                        <p className="text-xs sm:text-sm font-medium text-slate-300">
                            {greeting}
                        </p>
                    </div>

                    <div className="flex items-center gap-2.5">
                        <button 
                            onClick={() => toast.info("No new notifications")}
                            className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white/10 hover:bg-white/20 transition-all flex items-center justify-center text-white relative active:scale-95"
                            aria-label="Notifications"
                        >
                            <Bell className="h-5 w-5" />
                            <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-orange-500 rounded-full ring-2 ring-[#0B1E48]" />
                        </button>
                    </div>
                </div>
            </div>

            {/* 2. Floating Responsive Metrics Cards (Positioned over Navy Header with z-10) */}
            <div className="px-5 sm:px-8 -mt-10 sm:-mt-12 space-y-6 flex-1 pb-6 relative z-10">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 sm:gap-4.5">
                    {/* Card 1: My Orders */}
                    <div 
                        onClick={() => router.push("/driver/orders?tab=ALL")}
                        className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-slate-100/80 shadow-md shadow-slate-200/50 flex flex-col justify-between space-y-3 cursor-pointer hover:shadow-lg transition-all active:scale-[0.98] group"
                    >
                        <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <ShoppingBag className="h-4 w-4" />
                            </div>
                            <span className="text-xs sm:text-sm font-bold text-slate-600">My Orders</span>
                        </div>
                        <p className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight pl-1">
                            {loading ? "08" : String(metrics.totalOrders).padStart(2, "0")}
                        </p>
                    </div>

                    {/* Card 2: Delivered */}
                    <div 
                        onClick={() => router.push("/driver/orders?tab=DELIVERED")}
                        className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-slate-100/80 shadow-md shadow-slate-200/50 flex flex-col justify-between space-y-3 cursor-pointer hover:shadow-lg transition-all active:scale-[0.98] group"
                    >
                        <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <CheckCircle2 className="h-4 w-4" />
                            </div>
                            <span className="text-xs sm:text-sm font-bold text-slate-600">Delivered</span>
                        </div>
                        <p className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight pl-1">
                            {loading ? "05" : String(metrics.delivered).padStart(2, "0")}
                        </p>
                    </div>

                    {/* Card 3: Pending */}
                    <div 
                        onClick={() => router.push("/driver/orders?tab=PENDING")}
                        className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-slate-100/80 shadow-md shadow-slate-200/50 flex flex-col justify-between space-y-3 cursor-pointer hover:shadow-lg transition-all active:scale-[0.98] group"
                    >
                        <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-orange-50 text-orange-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <Clock className="h-4 w-4" />
                            </div>
                            <span className="text-xs sm:text-sm font-bold text-slate-600">Pending</span>
                        </div>
                        <p className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight pl-1">
                            {loading ? "03" : String(metrics.pending).padStart(2, "0")}
                        </p>
                    </div>

                    {/* Card 4: Total Due */}
                    <div 
                        onClick={() => router.push("/driver/orders")}
                        className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-slate-100/80 shadow-md shadow-slate-200/50 flex flex-col justify-between space-y-3 cursor-pointer hover:shadow-lg transition-all active:scale-[0.98] group"
                    >
                        <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <IndianRupee className="h-4 w-4" />
                            </div>
                            <span className="text-xs sm:text-sm font-bold text-slate-600">Total Due</span>
                        </div>
                        <p className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 tracking-tight pl-1 truncate">
                            ₹ {loading ? "12,350" : (metrics.totalDue ? metrics.totalDue.toLocaleString() : "0")}
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
                                    onClick={() => router.push("/driver/history")}
                                    className="text-xs sm:text-sm font-bold text-blue-600 hover:text-blue-700 hover:underline transition-colors flex items-center gap-0.5"
                                >
                                    View All
                                    <ArrowUpRight className="h-3.5 w-3.5" />
                                </button>
                            </div>

                            <div className="space-y-3.5 pt-4 text-sm font-semibold">
                                <div className="flex items-center justify-between">
                                    <span className="text-slate-600">Cash Collected</span>
                                    <span className="font-black text-[#849B00] text-sm sm:text-base">
                                        ₹ {loading ? "8,500" : metrics.cashCollected.toLocaleString()}
                                    </span>
                                </div>

                                <div className="flex items-center justify-between">
                                    <span className="text-slate-600">Cash Submitted</span>
                                    <span className="font-black text-blue-600 text-sm sm:text-base">
                                        ₹ {loading ? "8,000" : metrics.cashSubmitted.toLocaleString()}
                                    </span>
                                </div>

                                <div className="flex items-center justify-between">
                                    <span className="text-slate-600">Pending Submission</span>
                                    <span className="font-black text-red-500 text-sm sm:text-base">
                                        ₹ {loading ? "500" : metrics.pendingSubmission.toLocaleString()}
                                    </span>
                                </div>

                                <div className="h-px bg-slate-100 my-1" />

                                <div className="flex items-center justify-between">
                                    <span className="text-slate-700 font-bold">Total Customer Due</span>
                                    <span className="font-black text-[#7C3AED] text-sm sm:text-base">
                                        ₹ {loading ? "12,350" : (metrics.totalCustomerDue ? metrics.totalCustomerDue.toLocaleString() : "0")}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Mobile Scan Button inside stacked view */}
                        <div className="pt-2 md:hidden">
                            <Button 
                                onClick={() => router.push("/driver/scan")}
                                className="w-full h-13 sm:h-14 rounded-2xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-black text-sm uppercase tracking-wider shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2.5 transition-all active:scale-[0.98]"
                            >
                                <QrCode className="h-5 w-5 stroke-[2.5]" />
                                Scan QR Code
                            </Button>
                        </div>
                    </div>

                    {/* Quick Operations & Desktop Action Card */}
                    <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-100/80 shadow-md shadow-slate-200/40 space-y-4 flex flex-col justify-between">
                        <div className="space-y-4">
                            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                                <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">Quick Actions</h3>
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                                    Active Fleet
                                </span>
                            </div>

                            <p className="text-xs sm:text-sm text-slate-500 font-medium leading-relaxed">
                                Scan the printed bill QR code on deliveries to claim orders, manage customer dues, and verify drop-offs.
                            </p>

                            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                                        <Truck className="h-4.5 w-4.5" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-slate-800">Dispatch Hub</p>
                                        <p className="text-[11px] text-slate-400 font-semibold">BookMyVeg Main Distribution Center</p>
                                    </div>
                                </div>
                                <ShieldCheck className="h-5 w-5 text-emerald-600" />
                            </div>
                        </div>

                        {/* Tablet & Desktop Scan Button */}
                        <div className="pt-2">
                            <Button 
                                onClick={() => router.push("/driver/scan")}
                                className="w-full h-13 sm:h-14 rounded-2xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-black text-sm uppercase tracking-wider shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2.5 transition-all active:scale-[0.98]"
                            >
                                <QrCode className="h-5 w-5 stroke-[2.5]" />
                                Scan QR Code
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
