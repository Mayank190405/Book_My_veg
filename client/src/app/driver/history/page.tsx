"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import api from "@/services/api";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type HistoryTab = "DELIVERIES" | "PAYMENTS" | "RETURNS";

function HistoryContent() {
    const [historyTab, setHistoryTab] = useState<HistoryTab>("DELIVERIES");
    const [orders, setOrders] = useState<any[]>([]);
    const [returnsList, setReturnsList] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async () => {
        try {
            const [ordersRes, returnsRes] = await Promise.all([
                api.get("/orders/driver/assigned"),
                api.get("/orders/driver/returns").catch(() => ({ data: [] }))
            ]);

            setOrders(ordersRes.data || []);
            setReturnsList(returnsRes.data || []);
        } catch (error: any) {
            toast.error("Failed to load history");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return (
        <div className="p-5 space-y-4 animate-in fade-in duration-300">
            <div className="pt-2">
                <h2 className="text-xl font-black text-slate-900 tracking-tight">Delivery History</h2>
                <p className="text-xs text-slate-400 font-semibold">Completed and past transactions</p>
            </div>

            {/* Segmented Control (Screen 13) */}
            <div className="flex bg-slate-100 p-1 rounded-2xl">
                {[
                    { id: "DELIVERIES", label: "Deliveries" },
                    { id: "PAYMENTS", label: "Payments" },
                    { id: "RETURNS", label: "Returns" },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setHistoryTab(tab.id as HistoryTab)}
                        className={cn(
                            "flex-1 py-2 text-xs font-bold rounded-xl transition-all",
                            historyTab === tab.id ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-800"
                        )}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* History Records (Screen 13) */}
            <div className="space-y-3 pt-1">
                {loading ? (
                    <div className="p-12 text-center">
                        <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
                    </div>
                ) : historyTab === "DELIVERIES" ? (
                    orders.filter(o => o.status === "DELIVERED").length === 0 ? (
                        <div className="p-12 text-center text-slate-400 text-xs font-bold">No delivered orders yet</div>
                    ) : (
                        orders.filter(o => o.status === "DELIVERED").map(order => (
                            <div key={order.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-black text-slate-900">#{order.id.slice(-6).toUpperCase()}</span>
                                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-100 text-emerald-700">Delivered</span>
                                    </div>
                                    <p className="text-xs font-bold text-slate-700">{order.user?.name || "Customer"}</p>
                                    <p className="text-[10px] text-slate-400">{new Date(order.createdAt).toLocaleDateString()}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-black text-slate-900">₹ {Number(order.totalAmount).toLocaleString()}</p>
                                </div>
                            </div>
                        ))
                    )
                ) : historyTab === "PAYMENTS" ? (
                    orders.filter(o => Number(o.cashCollected || 0) > 0 || Number(o.easebuzzCollected || 0) > 0).length === 0 ? (
                        <div className="p-12 text-center text-slate-400 text-xs font-bold">No collections recorded today</div>
                    ) : (
                        orders.filter(o => Number(o.cashCollected || 0) > 0 || Number(o.easebuzzCollected || 0) > 0).map(order => (
                            <div key={order.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
                                <div className="space-y-1">
                                    <p className="text-xs font-black text-slate-900">#{order.id.slice(-6).toUpperCase()}</p>
                                    <p className="text-[10px] font-bold text-slate-500">{order.user?.name}</p>
                                </div>
                                <div className="text-right space-y-0.5">
                                    <p className="text-xs font-black text-emerald-600">
                                        ₹ {(Number(order.cashCollected || 0) + Number(order.easebuzzCollected || 0)).toLocaleString()}
                                    </p>
                                    <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-slate-100 text-slate-600">
                                        {Number(order.cashCollected || 0) > 0 ? "Cash" : "Easebuzz"}
                                    </span>
                                </div>
                            </div>
                        ))
                    )
                ) : (
                    returnsList.length === 0 ? (
                        <div className="p-12 text-center text-slate-400 text-xs font-bold">No return tasks</div>
                    ) : (
                        returnsList.map(ret => (
                            <div key={ret.id} className="bg-white p-4 rounded-2xl border border-amber-100 shadow-sm space-y-2">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <span className="text-[9px] font-black uppercase bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                                            Return #{ret.id.slice(-6).toUpperCase()}
                                        </span>
                                        <p className="text-xs font-bold text-slate-800 mt-1">{ret.user?.name}</p>
                                    </div>
                                    <span className="text-xs font-black text-slate-900">₹ {Number(ret.totalAmount).toLocaleString()}</span>
                                </div>
                                {ret.returnReason && (
                                    <p className="text-[11px] bg-amber-50 text-amber-900 p-2 rounded-xl">
                                        Reason: {ret.returnReason}
                                    </p>
                                )}
                            </div>
                        ))
                    )
                )}
            </div>
        </div>
    );
}

export default function HistoryPage() {
    return (
        <Suspense fallback={<div className="p-12 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" /></div>}>
            <HistoryContent />
        </Suspense>
    );
}
