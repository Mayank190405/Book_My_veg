"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import api from "@/services/api";
import { toast } from "sonner";
import { 
    Package, Check, Clock, IndianRupee, QrCode, Bell, Loader2
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
            setOrders(res.data || []);
        } catch (error: any) {
            toast.error("Failed to sync deliveries");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchOrders();
    }, [fetchOrders]);

    // Calculate actual metrics from real live orders
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

    return (
        <div className="p-5 space-y-6 animate-in fade-in duration-300">
            {/* Header: Greeting & Notification Bell (Screen 2) */}
            <div className="flex items-center justify-between pt-2">
                <div className="space-y-0.5">
                    <h2 className="text-xl font-black text-slate-900">
                        Hi, {user?.name?.split(" ")[0] || "Delivery Partner"} 👋
                    </h2>
                    <p className="text-xs font-semibold text-slate-400">{greeting}</p>
                </div>
                <button 
                    onClick={() => toast.info("No new notifications")}
                    className="w-11 h-11 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors relative"
                >
                    <Bell className="h-5 w-5" />
                    <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-blue-600 rounded-full" />
                </button>
            </div>

            {/* 4 Metric Badges (Screen 2) */}
            <div className="grid grid-cols-2 gap-3.5">
                {/* My Orders */}
                <div 
                    onClick={() => router.push("/driver/orders?tab=ALL")}
                    className="bg-blue-50/70 border border-blue-100 p-4 rounded-2xl flex items-center gap-3.5 cursor-pointer hover:bg-blue-50 transition-all active:scale-98"
                >
                    <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black shadow-md shadow-blue-200">
                        <Package className="h-5 w-5" />
                    </div>
                    <div>
                        <p className="text-[11px] font-bold text-slate-500">My Orders</p>
                        <p className="text-xl font-black text-blue-900 leading-tight">
                            {loading ? ".." : String(metrics.totalOrders).padStart(2, "0")}
                        </p>
                    </div>
                </div>

                {/* Delivered */}
                <div 
                    onClick={() => router.push("/driver/orders?tab=DELIVERED")}
                    className="bg-emerald-50/70 border border-emerald-100 p-4 rounded-2xl flex items-center gap-3.5 cursor-pointer hover:bg-emerald-50 transition-all active:scale-98"
                >
                    <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black shadow-md shadow-emerald-200">
                        <Check className="h-5 w-5" />
                    </div>
                    <div>
                        <p className="text-[11px] font-bold text-slate-500">Delivered</p>
                        <p className="text-xl font-black text-emerald-900 leading-tight">
                            {loading ? ".." : String(metrics.delivered).padStart(2, "0")}
                        </p>
                    </div>
                </div>

                {/* Pending */}
                <div 
                    onClick={() => router.push("/driver/orders?tab=PENDING")}
                    className="bg-orange-50/70 border border-orange-100 p-4 rounded-2xl flex items-center gap-3.5 cursor-pointer hover:bg-orange-50 transition-all active:scale-98"
                >
                    <div className="w-10 h-10 rounded-xl bg-orange-500 text-white flex items-center justify-center font-black shadow-md shadow-orange-200">
                        <Clock className="h-5 w-5" />
                    </div>
                    <div>
                        <p className="text-[11px] font-bold text-slate-500">Pending</p>
                        <p className="text-xl font-black text-orange-950 leading-tight">
                            {loading ? ".." : String(metrics.pending).padStart(2, "0")}
                        </p>
                    </div>
                </div>

                {/* Total Due */}
                <div 
                    onClick={() => router.push("/driver/orders")}
                    className="bg-purple-50/70 border border-purple-100 p-4 rounded-2xl flex items-center gap-3.5 cursor-pointer hover:bg-purple-50 transition-all active:scale-98"
                >
                    <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center font-black shadow-md shadow-purple-200">
                        <IndianRupee className="h-5 w-5" />
                    </div>
                    <div>
                        <p className="text-[11px] font-bold text-slate-500">Total Due</p>
                        <p className="text-lg font-black text-purple-950 leading-tight">
                            ₹ {loading ? ".." : metrics.totalDue.toLocaleString()}
                        </p>
                    </div>
                </div>
            </div>

            {/* Today's Summary Card (Screen 2) */}
            <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-lg shadow-slate-100 space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black text-slate-900 tracking-tight">Today&apos;s Summary</h3>
                    <button 
                        onClick={() => router.push("/driver/history")}
                        className="text-xs font-bold text-blue-600 hover:underline"
                    >
                        View All
                    </button>
                </div>

                <div className="space-y-3 pt-1">
                    <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-500">Cash Collected</span>
                        <span className="font-black text-emerald-600">₹ {metrics.cashCollected.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-500">Cash Submitted</span>
                        <span className="font-black text-blue-600">₹ {metrics.cashSubmitted.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-500">Pending Submission</span>
                        <span className="font-black text-rose-500">₹ {metrics.pendingSubmission.toLocaleString()}</span>
                    </div>
                    <div className="h-px bg-slate-100 my-1" />
                    <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-800">Total Customer Due</span>
                        <span className="font-black text-blue-950">₹ {metrics.totalCustomerDue.toLocaleString()}</span>
                    </div>
                </div>
            </div>

            {/* Scan QR Code Blue Action Button (Screen 2) */}
            <Button 
                onClick={() => router.push("/driver/scan")}
                className="w-full h-14 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-sm uppercase tracking-wider shadow-xl shadow-blue-200 flex items-center justify-center gap-2.5 transition-all active:scale-98"
            >
                <QrCode className="h-5 w-5" />
                Scan QR Code
            </Button>
        </div>
    );
}
