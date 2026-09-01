"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter } from "next/navigation";
import api from "@/services/api";
import { toast } from "sonner";
import { 
    CheckCircle2, 
    ArrowLeft, 
    Calendar, 
    Package, 
    Loader2,
    RefreshCw
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function PackerHistoryPage() {
    const router = useRouter();
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchData = useCallback(async () => {
        try {
            const res = await api.get("/orders/packing/pending");
            const list = Array.isArray(res.data) ? res.data : (res.data?.data || []);
            setOrders(list);
        } catch (error: any) {
            toast.error("Failed to load packing history");
            setOrders([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const packedOrders = orders.filter(o => Boolean(o.packedAt) || o.status === "PACKED" || o.status === "DELIVERED");

    return (
        <div className="p-5 space-y-4 animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2">
                    <button onClick={() => router.push("/packer")} className="p-1.5 -ml-1 rounded-full hover:bg-slate-100 text-slate-600">
                        <ArrowLeft className="h-5 w-5" />
                    </button>
                    <div>
                        <h2 className="text-xl font-black text-slate-900 tracking-tight">Packing History</h2>
                        <p className="text-xs text-slate-400 font-semibold">Verified and fulfilled batches</p>
                    </div>
                </div>

                <button 
                    onClick={() => { setRefreshing(true); fetchData(); }} 
                    className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-700 flex items-center justify-center active:scale-95 transition-all"
                >
                    <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
                </button>
            </div>

            {/* List */}
            <div className="space-y-3 pt-2 pb-16">
                {loading ? (
                    <div className="p-12 text-center">
                        <Loader2 className="h-8 w-8 animate-spin mx-auto text-purple-700 mb-2" />
                        <p className="text-xs font-bold text-slate-400">Loading history...</p>
                    </div>
                ) : packedOrders.length === 0 ? (
                    <div className="p-12 text-center bg-white rounded-3xl border border-dashed border-slate-200 space-y-2">
                        <div className="w-12 h-12 bg-purple-50 rounded-2xl flex items-center justify-center mx-auto text-purple-600">
                            <CheckCircle2 className="h-6 w-6" />
                        </div>
                        <p className="text-xs font-bold text-slate-600">No completed packings yet today</p>
                        <p className="text-[11px] text-slate-400">Orders packed or scanned will appear here.</p>
                    </div>
                ) : (
                    packedOrders.map(order => (
                        <div key={order.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-black text-slate-900">
                                        #{order.id.slice(-6).toUpperCase()}
                                    </span>
                                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-100 text-emerald-700">
                                        Packed
                                    </span>
                                </div>
                                <p className="text-xs font-bold text-slate-700">{order.user?.name || "Customer"}</p>
                                <p className="text-[10px] text-slate-400">
                                    {order.packedAt ? new Date(order.packedAt).toLocaleTimeString() : new Date(order.createdAt).toLocaleTimeString()}
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-black text-slate-900">₹ {Number(order.totalAmount || 0).toLocaleString()}</p>
                                <p className="text-[10px] font-semibold text-purple-700">{order.items?.length || 0} items</p>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
