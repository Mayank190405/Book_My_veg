"use client";

import { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import api from "@/services/api";
import { toast } from "sonner";
import { 
    Search, 
    RefreshCw, 
    QrCode, 
    Package, 
    ChevronRight, 
    CheckCircle2, 
    Clock, 
    Loader2,
    ArrowLeft
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PackerFilter = "ALL" | "PENDING" | "PACKED" | "DELIVERED";

function PackerOrdersContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const initialTab = (searchParams.get("tab") as PackerFilter) || "ALL";

    const [filter, setFilter] = useState<PackerFilter>(initialTab);
    const [searchQuery, setSearchQuery] = useState("");
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchOrders = useCallback(async () => {
        try {
            const res = await api.get("/orders/packing/pending");
            const list = Array.isArray(res.data) ? res.data : (res.data?.data || []);
            setOrders(list);
        } catch (error: any) {
            toast.error("Failed to load packing orders");
            setOrders([]);
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
            const isPacked = Boolean(order.packedAt) || order.status === "PACKED";
            const isDelivered = order.status === "DELIVERED";

            if (filter === "PENDING" && (isPacked || isDelivered)) return false;
            if (filter === "PACKED" && (!isPacked || isDelivered)) return false;
            if (filter === "DELIVERED" && !isDelivered) return false;

            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const idMatch = order.id.toLowerCase().includes(q);
                const nameMatch = (order.user?.name || "").toLowerCase().includes(q);
                const phoneMatch = (order.user?.phone || "").includes(q);
                return idMatch || nameMatch || phoneMatch;
            }
            return true;
        });
    }, [orders, filter, searchQuery]);

    return (
        <div className="p-5 space-y-4 animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2">
                    <button onClick={() => router.push("/packer")} className="p-1.5 -ml-1 rounded-full hover:bg-slate-100 text-slate-600">
                        <ArrowLeft className="h-5 w-5" />
                    </button>
                    <div>
                        <h2 className="text-xl font-black text-slate-900 tracking-tight">Packing Orders</h2>
                        <p className="text-xs text-slate-400 font-semibold">Active warehouse packing queue</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => { setRefreshing(true); fetchOrders(); }} 
                        className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-700 flex items-center justify-center active:scale-95 transition-all"
                    >
                        <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
                    </button>
                    <button 
                        onClick={() => router.push("/packer/scan")} 
                        className="w-10 h-10 rounded-2xl bg-purple-700 text-white flex items-center justify-center shadow-md shadow-purple-200 active:scale-95 transition-all"
                    >
                        <QrCode className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {/* Search Input */}
            <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input 
                    placeholder="Search by customer name, phone, or order ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-12 pl-10 rounded-2xl bg-slate-100 border-none text-xs font-bold focus:bg-white transition-all shadow-inner"
                />
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-1">
                {[
                    { id: "ALL", label: "All Orders" },
                    { id: "PENDING", label: "To Pack" },
                    { id: "PACKED", label: "Packed" },
                    { id: "DELIVERED", label: "Delivered" },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setFilter(tab.id as PackerFilter)}
                        className={cn(
                            "px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0",
                            filter === tab.id 
                                ? "bg-purple-700 text-white shadow-md shadow-purple-200" 
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        )}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Orders List */}
            <div className="space-y-3 pt-1 pb-16">
                {loading ? (
                    <div className="p-12 text-center">
                        <Loader2 className="h-8 w-8 animate-spin mx-auto text-purple-700 mb-2" />
                        <p className="text-xs font-bold text-slate-400">Loading packing queue...</p>
                    </div>
                ) : filteredOrders.length === 0 ? (
                    <div className="p-12 text-center bg-white rounded-3xl border border-dashed border-slate-200 space-y-3">
                        <div className="w-12 h-12 bg-purple-50 rounded-2xl flex items-center justify-center mx-auto text-purple-600 shadow-sm">
                            <Package className="h-6 w-6" />
                        </div>
                        <p className="text-xs font-bold text-slate-500">No orders in this status</p>
                        <Button 
                            onClick={() => router.push("/packer/create-order")}
                            size="sm" 
                            className="rounded-xl bg-purple-700 text-white text-xs font-bold hover:bg-purple-800"
                        >
                            Create New Order
                        </Button>
                    </div>
                ) : (
                    filteredOrders.map(order => {
                        const custName = order.user?.name || "Customer";
                        const dateFormatted = new Date(order.createdAt).toLocaleDateString("en-IN", {
                            day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
                        });
                        const itemsCount = order.items?.length || 0;
                        const isPacked = Boolean(order.packedAt);

                        return (
                            <div
                                key={order.id}
                                onClick={() => router.push(`/packer/scan`)}
                                className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all active:scale-98 cursor-pointer flex items-center justify-between gap-3"
                            >
                                <div className="space-y-1 min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-black text-slate-900">
                                            #{order.id.slice(-6).toUpperCase()}
                                        </span>
                                        <span className={cn(
                                            "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider",
                                            isPacked ? "bg-emerald-100 text-emerald-700" : "bg-purple-100 text-purple-700"
                                        )}>
                                            {isPacked ? "Packed" : "Pending Pack"}
                                        </span>
                                    </div>
                                    <p className="text-sm font-bold text-slate-800 truncate">{custName}</p>
                                    <p className="text-[10px] font-semibold text-slate-400">
                                        {itemsCount} items • {dateFormatted}
                                    </p>
                                </div>

                                <div className="text-right shrink-0 flex items-center gap-2">
                                    <div>
                                        <p className="text-sm font-black text-slate-900">₹ {Number(order.totalAmount || 0).toLocaleString()}</p>
                                        <p className="text-[10px] font-bold text-slate-400">
                                            {order.paymentMode || "COD"}
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

export default function PackerOrdersPage() {
    return (
        <Suspense fallback={<div className="p-12 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-purple-700" /></div>}>
            <PackerOrdersContent />
        </Suspense>
    );
}
