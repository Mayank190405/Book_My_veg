"use client";

import { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import api from "@/services/api";
import { toast } from "sonner";
import { Search, Filter, RefreshCw, QrCode, Package, ChevronRight, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type OrdersFilter = "ALL" | "PENDING" | "OUT_FOR_DELIVERY" | "DELIVERED";

function OrdersListContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const initialTab = (searchParams.get("tab") as OrdersFilter) || "ALL";

    const [ordersFilter, setOrdersFilter] = useState<OrdersFilter>(initialTab);
    const [searchQuery, setSearchQuery] = useState("");
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchOrders = useCallback(async () => {
        try {
            const res = await api.get("/orders/driver/assigned");
            setOrders(res.data || []);
        } catch (error: any) {
            toast.error("Failed to sync deliveries");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchOrders();
    }, [fetchOrders]);

    const filteredOrders = useMemo(() => {
        return orders.filter(order => {
            if (ordersFilter === "PENDING" && (order.status === "DELIVERED" || order.status === "SHIPPED")) return false;
            if (ordersFilter === "OUT_FOR_DELIVERY" && order.status !== "SHIPPED" && order.status !== "OUT_FOR_DELIVERY") return false;
            if (ordersFilter === "DELIVERED" && order.status !== "DELIVERED") return false;

            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const idMatch = order.id.toLowerCase().includes(q);
                const nameMatch = (order.user?.name || "").toLowerCase().includes(q);
                const phoneMatch = (order.user?.phone || "").includes(q);
                return idMatch || nameMatch || phoneMatch;
            }
            return true;
        });
    }, [orders, ordersFilter, searchQuery]);

    return (
        <div className="p-5 space-y-4 animate-in fade-in duration-300">
            {/* Header with Search & Scan (Screen 5) */}
            <div className="flex items-center justify-between pt-2">
                <h2 className="text-xl font-black text-slate-900 tracking-tight">My Orders</h2>
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => { setRefreshing(true); fetchOrders(); }} 
                        className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-600 active:scale-95"
                    >
                        <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
                    </button>
                    <button 
                        onClick={() => router.push("/driver/scan")}
                        className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-200 active:scale-95"
                    >
                        <QrCode className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {/* Search Input */}
            <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input 
                    placeholder="Search by customer name, phone, or #id..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-12 pl-10 rounded-2xl bg-slate-100 border-none text-xs font-bold focus:bg-white transition-all shadow-inner"
                />
            </div>

            {/* Segmented Filter Pills (Screen 5) */}
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-1">
                {[
                    { id: "ALL", label: "All" },
                    { id: "PENDING", label: "Pending" },
                    { id: "OUT_FOR_DELIVERY", label: "Out for Delivery" },
                    { id: "DELIVERED", label: "Delivered" },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setOrdersFilter(tab.id as OrdersFilter)}
                        className={cn(
                            "px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0",
                            ordersFilter === tab.id 
                                ? "bg-blue-600 text-white shadow-md shadow-blue-200" 
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        )}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Orders List (Screen 5) */}
            <div className="space-y-3 pt-1">
                {loading ? (
                    <div className="p-12 text-center">
                        <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600 mb-2" />
                        <p className="text-xs font-bold text-slate-400">Loading deliveries...</p>
                    </div>
                ) : filteredOrders.length === 0 ? (
                    <div className="p-12 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200 space-y-3">
                        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center mx-auto text-slate-400 shadow-sm">
                            <Package className="h-6 w-6" />
                        </div>
                        <p className="text-xs font-bold text-slate-500">No orders found in this status</p>
                        <Button 
                            onClick={() => router.push("/driver/scan")}
                            size="sm" 
                            className="rounded-xl bg-blue-600 text-white text-xs font-bold"
                        >
                            Scan Bill QR to Add
                        </Button>
                    </div>
                ) : (
                    filteredOrders.map(order => {
                        const custName = order.user?.name || "Customer";
                        const dateFormatted = new Date(order.createdAt).toLocaleDateString("en-IN", {
                            day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
                        });
                        const amount = Number(order.totalAmount || 0);

                        return (
                            <div
                                key={order.id}
                                onClick={() => router.push(`/driver/orders/${order.id}`)}
                                className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all active:scale-98 cursor-pointer flex items-center justify-between gap-3"
                            >
                                <div className="space-y-1 min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-black text-slate-900">
                                            #{order.id.slice(-6).toUpperCase()}
                                        </span>
                                        <span className={cn(
                                            "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider",
                                            order.status === "DELIVERED" ? "bg-emerald-100 text-emerald-700" :
                                            order.status === "OUT_FOR_DELIVERY" || order.status === "SHIPPED" ? "bg-blue-100 text-blue-700" :
                                            "bg-orange-100 text-orange-700"
                                        )}>
                                            {order.status === "SHIPPED" ? "Out for Delivery" : order.status}
                                        </span>
                                    </div>
                                    <p className="text-sm font-bold text-slate-800 truncate">{custName}</p>
                                    <p className="text-[10px] font-semibold text-slate-400">{dateFormatted}</p>
                                </div>

                                <div className="text-right shrink-0 flex items-center gap-2">
                                    <div>
                                        <p className="text-sm font-black text-slate-900">₹ {amount.toLocaleString()}</p>
                                        <p className="text-[10px] font-bold text-slate-400">
                                            {order.isPaid ? "Paid" : "Due"}
                                        </p>
                                    </div>
                                    <ChevronRight className="h-4 w-4 text-slate-300" />
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}

export default function DriverOrdersPage() {
    return (
        <Suspense fallback={<div className="p-12 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" /></div>}>
            <OrdersListContent />
        </Suspense>
    );
}
