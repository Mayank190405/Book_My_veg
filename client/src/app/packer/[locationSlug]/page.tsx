"use client";

import { use, useState } from "react";
import {
    Package, CheckCircle2, AlertCircle, Camera,
    ChevronRight, ShoppingBag, Loader2, ArrowLeft
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/services/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function PackerPage({ params }: any) {
    const { locationSlug } = use(params) as any;
    const queryClient = useQueryClient();
    const [selectedOrder, setSelectedOrder] = useState<any>(null);
    const [packedItems, setPackedItems] = useState<Record<string, boolean>>({});
    const [missingReasons, setMissingReasons] = useState<Record<string, string>>({});

    // ── Queries ───────────────────────────────────────────────────────
    const { data: orders, isLoading } = useQuery({
        queryKey: ["packer-orders", locationSlug],
        queryFn: async () => {
            const res = await api.get(`/orders/packer/assigned?slug=${locationSlug}`);
            return res.data;
        }
    });

    const { data: leaderboard } = useQuery({
        queryKey: ["staff-leaderboard"],
        queryFn: async () => {
            const res = await api.get('/analytics/leaderboard');
            return res.data;
        }
    });

    const toggleItem = (itemId: string) => {
        setPackedItems(prev => {
            const next = !prev[itemId];
            if (next) {
                // If checking it, remove any missing reason
                setMissingReasons(r => {
                    const newR = { ...r };
                    delete newR[itemId];
                    return newR;
                });
            }
            return { ...prev, [itemId]: next };
        });
    };

    const submitMutation = useMutation({
        mutationFn: async () => {
            const res = await api.post(`/orders/packer/${selectedOrder.id}/pack`, {
                packedItems,
                missingReasons,
                bagPhotoUrl: "DUMMY_PHOTO_URL_FOR_NOW"
            });

            // Log packing performance (dummy staffId for prototype if auth context missing)
            // Ideally we get staffId from UserContext
            try {
                await api.post('/analytics/staff/log-packing', {
                    staffId: "PACKER_SESSION",
                    packTimeMin: 1.5,
                    hasError: Object.keys(missingReasons).length > 0
                });
            } catch (e) { }

            return res.data;
        },
        onSuccess: () => {
            toast.success("Order completely verified & packed!");
            queryClient.invalidateQueries({ queryKey: ["packer-orders"] });
            setSelectedOrder(null);
            setPackedItems({});
            setMissingReasons({});
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message || err.message);
        }
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[80vh]">
                <Loader2 className="h-8 w-8 animate-spin text-green-500" />
            </div>
        );
    }

    if (selectedOrder) {
        return (
            <div className="space-y-6 max-w-2xl mx-auto pb-20">
                <button
                    onClick={() => setSelectedOrder(null)}
                    className="flex items-center gap-2 text-gray-500 font-bold text-sm mb-4"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Orders
                </button>

                <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-xl font-black text-gray-900 leading-none mb-1">Order #{selectedOrder.id.slice(0, 8)}</h2>
                            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Customer: {selectedOrder.user?.name || "Guest"}</p>
                        </div>
                        <div className="bg-blue-50 text-blue-600 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider">
                            Packing Now
                        </div>
                    </div>

                    <div className="space-y-4">
                        {selectedOrder.items.map((item: any) => (
                            <div
                                key={item.id}
                                onClick={() => toggleItem(item.id)}
                                className={cn(
                                    "flex items-center gap-4 p-4 rounded-2xl border transition-all cursor-pointer select-none",
                                    packedItems[item.id] ? "bg-green-50 border-green-100" : "bg-gray-50/50 border-gray-100"
                                )}
                            >
                                <div className={cn(
                                    "w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-colors",
                                    packedItems[item.id] ? "bg-green-500 border-green-500" : "bg-white border-gray-200"
                                )}>
                                    {packedItems[item.id] && <CheckCircle2 className="h-4 w-4 text-white" />}
                                </div>
                                <div className="flex-1">
                                    <p className={cn("text-sm font-bold", packedItems[item.id] ? "text-green-800 line-through" : "text-gray-900")}>
                                        {item.product.name}
                                    </p>
                                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Qty: {item.quantity}</p>
                                </div>
                                {!packedItems[item.id] && (
                                    <div className="flex flex-col items-end gap-2 shrink-0">
                                        <span className="text-[10px] font-black text-red-500 flex items-center gap-1 bg-red-50 px-2 py-1 rounded">
                                            <AlertCircle className="h-3 w-3" /> MISSING
                                        </span>
                                        <input
                                            type="text"
                                            placeholder="Reason?"
                                            onClick={(e) => e.stopPropagation()}
                                            value={missingReasons[item.id] || ""}
                                            onChange={(e) => setMissingReasons(prev => ({ ...prev, [item.id]: e.target.value }))}
                                            className="text-xs px-2 py-1 w-24 border border-red-200 rounded focus:ring-1 focus:ring-red-500 font-medium"
                                        />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Submission Actions */}
                <div className="space-y-4">
                    <button className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-4 rounded-2xl font-black flex items-center justify-center gap-2 transition-all active:scale-95">
                        <Camera className="h-5 w-5" />
                        Take Photo of Bag
                    </button>
                    <button
                        onClick={() => submitMutation.mutate()}
                        disabled={submitMutation.isPending}
                        className="w-full bg-green-600 hover:bg-green-700 text-white py-4 rounded-2xl font-black flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-green-100 disabled:opacity-50"
                    >
                        {submitMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : "Complete & Verify"}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-12">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 tracking-tight tracking-tight">Assigned Packets</h1>
                    <p className="text-sm text-gray-500 font-medium">Verify items and prepare for dispatch</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="bg-orange-50 px-4 py-2 rounded-2xl border border-orange-100 shadow-sm flex items-center gap-2">
                        <span className="text-xs font-black text-orange-600">Total Packed Today: {leaderboard?.[0]?.ordersPacked || 0}</span>
                    </div>
                    <div className="bg-white px-4 py-2 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-xs font-black text-gray-700">{orders?.length || 0} Pending</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {orders?.map((order: any) => (
                    <div
                        key={order.id}
                        onClick={() => setSelectedOrder(order)}
                        className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm hover:border-green-300 transition-all cursor-pointer group active:scale-[0.98]"
                    >
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Order ID: {order.id.slice(0, 8)}</span>
                            <span className="bg-orange-50 text-orange-600 px-2.5 py-1 rounded-full text-[10px] font-black">PENDING PACK</span>
                        </div>
                        <h3 className="font-black text-gray-900 text-lg mb-4">{order.items.length} Items to Pack</h3>

                        <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                            <div className="flex -space-x-2">
                                {order.items.slice(0, 3).map((item: any, i: number) => (
                                    <div key={i} className="w-8 h-8 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center text-[10px] font-black">
                                        {item.product.name.charAt(0)}
                                    </div>
                                ))}
                                {order.items.length > 3 && (
                                    <div className="w-8 h-8 rounded-full bg-gray-900 border-2 border-white flex items-center justify-center text-[10px] font-black text-white">
                                        +{order.items.length - 3}
                                    </div>
                                )}
                            </div>
                            <button className="text-green-600 font-black text-xs flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                                PACK NOW
                                <ChevronRight className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                ))}

                {orders?.length === 0 && (
                    <div className="col-span-full py-20 bg-white rounded-[3rem] border border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400 gap-4">
                        <ShoppingBag className="h-12 w-12 opacity-20" />
                        <p className="font-bold text-gray-400 italic">No orders currently assigned to you</p>
                    </div>
                )}
            </div>
        </div>
    );
}
