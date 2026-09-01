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
    Loader2 
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
            <div className="bg-[#0B1E48] px-6 pt-7 pb-12 text-white relative">
                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-1.5">
                            Hi, {driverFirstName} <span>👏</span>
                        </h2>
                        <p className="text-xs sm:text-sm font-medium text-slate-300">
                            {greeting}
                        </p>
                    </div>

                    <button 
                        onClick={() => toast.info("No new notifications")}
                        className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 transition-all flex items-center justify-center text-white relative active:scale-95"
                        aria-label="Notifications"
                    >
                        <Bell className="h-5 w-5" />
                        <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-orange-500 rounded-full ring-2 ring-[#0B1E48]" />
                    </button>
                </div>
            </div>

            {/* 2. Floating 2x2 Metrics Cards */}
            <div className="px-5 -mt-7 space-y-5 flex-1 pb-6">
                <div className="grid grid-cols-2 gap-3.5">
                    {/* Card 1: My Orders */}
                    <div 
                        onClick={() => router.push("/driver/orders?tab=ALL")}
                        className="bg-white rounded-2xl p-4 border border-slate-100/80 shadow-md shadow-slate-200/50 flex flex-col justify-between space-y-3 cursor-pointer hover:shadow-lg transition-all active:scale-[0.98]"
                    >
                        <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                                <ShoppingBag className="h-4 w-4" />
                            </div>
                            <span className="text-xs font-bold text-slate-600">My Orders</span>
                        </div>
                        <p className="text-2xl font-black text-slate-900 tracking-tight pl-1">
                            {loading ? "08" : String(metrics.totalOrders).padStart(2, "0")}
                        </p>
                    </div>

                    {/* Card 2: Delivered */}
                    <div 
                        onClick={() => router.push("/driver/orders?tab=DELIVERED")}
                        className="bg-white rounded-2xl p-4 border border-slate-100/80 shadow-md shadow-slate-200/50 flex flex-col justify-between space-y-3 cursor-pointer hover:shadow-lg transition-all active:scale-[0.98]"
                    >
                        <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                <CheckCircle2 className="h-4 w-4" />
                            </div>
                            <span className="text-xs font-bold text-slate-600">Delivered</span>
                        </div>
                        <p className="text-2xl font-black text-slate-900 tracking-tight pl-1">
                            {loading ? "05" : String(metrics.delivered).padStart(2, "0")}
                        </p>
                    </div>

                    {/* Card 3: Pending */}
                    <div 
                        onClick={() => router.push("/driver/orders?tab=PENDING")}
                        className="bg-white rounded-2xl p-4 border border-slate-100/80 shadow-md shadow-slate-200/50 flex flex-col justify-between space-y-3 cursor-pointer hover:shadow-lg transition-all active:scale-[0.98]"
                    >
                        <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-orange-50 text-orange-500 flex items-center justify-center">
                                <Clock className="h-4 w-4" />
                            </div>
                            <span className="text-xs font-bold text-slate-600">Pending</span>
                        </div>
                        <p className="text-2xl font-black text-slate-900 tracking-tight pl-1">
                            {loading ? "03" : String(metrics.pending).padStart(2, "0")}
                        </p>
                    </div>

                    {/* Card 4: Total Due */}
                    <div 
                        onClick={() => router.push("/driver/orders")}
                        className="bg-white rounded-2xl p-4 border border-slate-100/80 shadow-md shadow-slate-200/50 flex flex-col justify-between space-y-3 cursor-pointer hover:shadow-lg transition-all active:scale-[0.98]"
                    >
                        <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center">
                                <IndianRupee className="h-4 w-4" />
                            </div>
                            <span className="text-xs font-bold text-slate-600">Total Due</span>
                        </div>
                        <p className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight pl-1 truncate">
                            ₹ {loading ? "12,350" : (metrics.totalDue ? metrics.totalDue.toLocaleString() : "0")}
                        </p>
                    </div>
                </div>

                {/* 3. Today's Summary Card */}
                <div className="bg-white rounded-3xl p-5 border border-slate-100/80 shadow-md shadow-slate-200/40 space-y-4">
                    <div className="flex items-center justify-between pb-1">
                        <h3 className="text-base font-black text-slate-900 tracking-tight">Today&apos;s Summary</h3>
                        <button 
                            onClick={() => router.push("/driver/history")}
                            className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline transition-colors"
                        >
                            View All
                        </button>
                    </div>

                    <div className="space-y-3.5 pt-1 text-sm font-semibold">
                        <div className="flex items-center justify-between">
                            <span className="text-slate-600">Cash Collected</span>
                            <span className="font-black text-[#849B00]">
                                ₹ {loading ? "8,500" : metrics.cashCollected.toLocaleString()}
                            </span>
                        </div>

                        <div className="flex items-center justify-between">
                            <span className="text-slate-600">Cash Submitted</span>
                            <span className="font-black text-blue-600">
                                ₹ {loading ? "8,000" : metrics.cashSubmitted.toLocaleString()}
                            </span>
                        </div>

                        <div className="flex items-center justify-between">
                            <span className="text-slate-600">Pending Submission</span>
                            <span className="font-black text-red-500">
                                ₹ {loading ? "500" : metrics.pendingSubmission.toLocaleString()}
                            </span>
                        </div>

                        <div className="flex items-center justify-between">
                            <span className="text-slate-600">Total Customer Due</span>
                            <span className="font-black text-[#7C3AED]">
                                ₹ {loading ? "12,350" : (metrics.totalCustomerDue ? metrics.totalCustomerDue.toLocaleString() : "0")}
                            </span>
                        </div>
                    </div>
                </div>

                {/* 4. Vivid Blue Scan QR Code Button */}
                <div className="pt-1">
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
    );
}
