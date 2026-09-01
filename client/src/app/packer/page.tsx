"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import api from "@/services/api";
import { toast } from "sonner";
import { 
    Package, Check, QrCode, Bell, Plus, ShieldCheck, CheckCircle2, 
    Layers, Loader2, Sparkles
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
        const packedToday = orders.filter(o => Boolean(o.packedAt)).length;
        const verifiedToday = orders.filter(o => Boolean(o.packerValidatedAt)).length;
        const totalPacked = packedToday;

        let createdAmount = 0;
        orders.forEach(o => {
            createdAmount += Number(o.totalAmount || 0);
        });

        return {
            newOrders,
            packedToday,
            verifiedToday,
            totalPacked,
            ordersCreatedAmount: createdAmount,
            ordersPackedCount: packedToday,
            ordersVerifiedCount: verifiedToday
        };
    }, [orders]);

    return (
        <div className="p-5 space-y-6 animate-in fade-in duration-300">
            {/* Header: Greeting & Packer ID (Screen 2) */}
            <div className="flex items-center justify-between pt-2">
                <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                        <h2 className="text-xl font-black text-slate-900">
                            Hi, {user?.name?.split(" ")[0] || "Packer"} 👑
                        </h2>
                    </div>
                    <p className="text-xs font-bold text-purple-600">
                        Packer ID: {user?.id ? `PKR${user.id.slice(-4).toUpperCase()}` : "PKR1024"}
                    </p>
                </div>
                <button 
                    onClick={() => toast.info("No new notifications")}
                    className="w-11 h-11 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-600 hover:bg-purple-100 transition-colors relative"
                >
                    <Bell className="h-5 w-5" />
                    <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-purple-600 rounded-full" />
                </button>
            </div>

            {/* 4 Stat Badges (Screen 2) */}
            <div className="grid grid-cols-2 gap-3.5">
                {/* New Orders */}
                <div 
                    onClick={() => router.push("/packer/orders?tab=ALL")}
                    className="bg-blue-50/70 border border-blue-100 p-4 rounded-2xl flex items-center gap-3.5 cursor-pointer hover:bg-blue-50 transition-all active:scale-98"
                >
                    <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black shadow-md shadow-blue-200">
                        <Package className="h-5 w-5" />
                    </div>
                    <div>
                        <p className="text-[11px] font-bold text-slate-500">New Orders</p>
                        <p className="text-xl font-black text-blue-900 leading-tight">
                            {loading ? ".." : String(metrics.newOrders).padStart(2, "0")}
                        </p>
                    </div>
                </div>

                {/* Packed Today */}
                <div 
                    onClick={() => router.push("/packer/orders?tab=PACKED")}
                    className="bg-emerald-50/70 border border-emerald-100 p-4 rounded-2xl flex items-center gap-3.5 cursor-pointer hover:bg-emerald-50 transition-all active:scale-98"
                >
                    <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black shadow-md shadow-emerald-200">
                        <Check className="h-5 w-5" />
                    </div>
                    <div>
                        <p className="text-[11px] font-bold text-slate-500">Packed Today</p>
                        <p className="text-xl font-black text-emerald-900 leading-tight">
                            {loading ? ".." : String(metrics.packedToday).padStart(2, "0")}
                        </p>
                    </div>
                </div>

                {/* Verified Today */}
                <div 
                    onClick={() => router.push("/packer/orders?tab=VERIFIED")}
                    className="bg-teal-50/70 border border-teal-100 p-4 rounded-2xl flex items-center gap-3.5 cursor-pointer hover:bg-teal-50 transition-all active:scale-98"
                >
                    <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center font-black shadow-md shadow-teal-200">
                        <ShieldCheck className="h-5 w-5" />
                    </div>
                    <div>
                        <p className="text-[11px] font-bold text-slate-500">Verified Today</p>
                        <p className="text-xl font-black text-teal-950 leading-tight">
                            {loading ? ".." : String(metrics.verifiedToday).padStart(2, "0")}
                        </p>
                    </div>
                </div>

                {/* Total Packed */}
                <div 
                    onClick={() => router.push("/packer/history")}
                    className="bg-rose-50/70 border border-rose-100 p-4 rounded-2xl flex items-center gap-3.5 cursor-pointer hover:bg-rose-50 transition-all active:scale-98"
                >
                    <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center font-black shadow-md shadow-rose-200">
                        <Layers className="h-5 w-5" />
                    </div>
                    <div>
                        <p className="text-[11px] font-bold text-slate-500">Total Packed</p>
                        <p className="text-xl font-black text-rose-950 leading-tight">
                            {loading ? ".." : String(metrics.totalPacked).padStart(2, "0")}
                        </p>
                    </div>
                </div>
            </div>

            {/* Today's Summary Card (Screen 2) */}
            <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-lg shadow-slate-100 space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black text-slate-900 tracking-tight">Today&apos;s Summary</h3>
                </div>

                <div className="space-y-3 pt-1">
                    <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-500">Orders Created</span>
                        <span className="font-black text-slate-900">₹ {metrics.ordersCreatedAmount.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-500">Orders Packed</span>
                        <span className="font-black text-emerald-600">{metrics.ordersPackedCount}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-500">Orders Verified</span>
                        <span className="font-black text-teal-600">{metrics.ordersVerifiedCount}</span>
                    </div>
                </div>
            </div>

            {/* Primary Action Buttons (Screen 2) */}
            <div className="space-y-3 pt-1">
                <Button 
                    onClick={() => router.push("/packer/create-order")}
                    className="w-full h-14 rounded-2xl bg-purple-700 hover:bg-purple-800 text-white font-black text-sm uppercase tracking-wider shadow-xl shadow-purple-200 flex items-center justify-center gap-2.5 transition-all active:scale-98"
                >
                    <Plus className="h-5 w-5 stroke-[3]" />
                    Create New Order
                </Button>

                <Button 
                    variant="outline"
                    onClick={() => router.push("/packer/scan")}
                    className="w-full h-14 rounded-2xl border-2 border-purple-700 text-purple-700 font-black text-sm uppercase tracking-wider hover:bg-purple-50 flex items-center justify-center gap-2.5 transition-all active:scale-98"
                >
                    <QrCode className="h-5 w-5" />
                    Scan QR to Verify
                </Button>
            </div>
        </div>
    );
}
