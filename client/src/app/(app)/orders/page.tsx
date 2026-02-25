"use client";

import { useEffect, Suspense, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getOrders } from "@/services/orderService";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import Image from "next/image";
import { Package, ChevronRight, ShoppingBag, CheckCircle2, RotateCcw } from "lucide-react";
import { useSearchParams } from "next/navigation";
import confetti from "canvas-confetti";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const STATUS_STYLES: Record<string, string> = {
    PENDING: "bg-yellow-100 text-yellow-800",
    CONFIRMED: "bg-blue-100 text-blue-700",
    PROCESSING: "bg-indigo-100 text-indigo-700",
    SHIPPED: "bg-purple-100 text-purple-700",
    OUT_FOR_DELIVERY: "bg-orange-100 text-orange-700",
    DELIVERED: "bg-green-100 text-green-700",
    CANCELLED: "bg-red-100 text-red-700",
    REFUNDED: "bg-gray-100 text-gray-600",
    RETURNED: "bg-gray-100 text-gray-600",
    PAYMENT_PENDING: "bg-yellow-50 text-yellow-600",
    FAILED: "bg-red-50 text-red-600",
};

const ACTIVE_STATUSES = ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "OUT_FOR_DELIVERY", "PAYMENT_PENDING"];

function formatDate(date: string) {
    return new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function OrdersContent() {
    const searchParams = useSearchParams();
    const isSuccess = searchParams.get("success");
    const [activeTab, setActiveTab] = useState<"ACTIVE" | "PAST">("ACTIVE");

    const { data: orders, isLoading } = useQuery({
        queryKey: ["orders"],
        queryFn: getOrders,
    });

    useEffect(() => {
        if (isSuccess) {
            confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
        }
    }, [isSuccess]);

    const filteredOrders = useMemo(() => {
        const orderList = orders?.data ?? [];
        return orderList.filter((order: any) => {
            const isActive = ACTIVE_STATUSES.includes(order.status);
            return activeTab === "ACTIVE" ? isActive : !isActive;
        });
    }, [orders?.data, activeTab]);

    if (isLoading) {
        return (
            <div className="space-y-3 p-4">
                {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="w-full h-28 rounded-2xl" />
                ))}
            </div>
        );
    }

    const allOrders = orders?.data || [];

    return (
        <div className="space-y-4 pb-24">
            {/* Page header */}
            <div className="flex items-center gap-2 mb-4">
                <ShoppingBag className="h-6 w-6 text-green-600" />
                <h1 className="text-2xl font-bold text-gray-900">My Orders</h1>
            </div>

            {/* Success banner */}
            {isSuccess && (
                <div className="flex items-center gap-3 bg-green-50 border border-green-200 text-green-800 p-4 rounded-2xl mb-6">
                    <CheckCircle2 className="h-6 w-6 text-green-500 shrink-0" />
                    <div>
                        <p className="font-bold">Order Placed Successfully! 🎉</p>
                        <p className="text-sm text-green-600">We'll notify you when it's confirmed.</p>
                    </div>
                </div>
            )}

            {/* Tabs */}
            {allOrders.length > 0 && (
                <div className="flex p-1 bg-gray-100 rounded-xl mb-6">
                    <button
                        className={cn(
                            "flex-1 py-2 text-sm font-medium rounded-lg transition-all",
                            activeTab === "ACTIVE" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"
                        )}
                        onClick={() => setActiveTab("ACTIVE")}
                    >
                        Active Orders
                    </button>
                    <button
                        className={cn(
                            "flex-1 py-2 text-sm font-medium rounded-lg transition-all",
                            activeTab === "PAST" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"
                        )}
                        onClick={() => setActiveTab("PAST")}
                    >
                        Past Orders
                    </button>
                </div>
            )}

            {/* Empty state (Global or Tab-specific) */}
            {allOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 gap-4 text-gray-400">
                    <Package className="h-16 w-16 opacity-20" />
                    <p className="text-lg font-medium">No orders yet</p>
                    <Link href="/products" className="text-green-600 font-semibold text-sm underline">
                        Start Shopping
                    </Link>
                </div>
            ) : filteredOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2 text-gray-400">
                    <Package className="h-12 w-12 opacity-20" />
                    <p className="text-sm font-medium">No {activeTab.toLowerCase()} orders found</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filteredOrders.map((order: any) => {
                        const statusStyle = STATUS_STYLES[order.status] ?? "bg-gray-100 text-gray-600";
                        const thumbs = order.items.slice(0, 3).map((i: any) => i.product?.images?.[0]).filter(Boolean);

                        return (
                            <Link
                                key={order.id}
                                href={`/orders/${order.id}`}
                                className="block bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-green-200 transition-all p-4"
                            >
                                {/* Top row */}
                                <div className="flex items-start justify-between mb-3">
                                    <div>
                                        <p className="text-xs text-gray-400 font-mono">#{order.id.slice(0, 8).toUpperCase()}</p>
                                        <p className="text-xs text-gray-400 mt-0.5">{formatDate(order.createdAt)}</p>
                                    </div>
                                    <span className={cn("px-2.5 py-1 text-xs font-bold rounded-full uppercase tracking-wide", statusStyle)}>
                                        {order.status.replace(/_/g, " ")}
                                    </span>
                                </div>

                                {/* Product thumbnails + item count */}
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="flex -space-x-2">
                                        {thumbs.map((src: string, i: number) => (
                                            <div key={i} className="relative w-10 h-10 rounded-lg overflow-hidden border-2 border-white bg-gray-100">
                                                <Image
                                                    src={src}
                                                    alt="product"
                                                    fill
                                                    sizes="40px"
                                                    className="object-cover"
                                                    onError={(e) => { (e.target as HTMLImageElement).src = "https://placehold.co/40x40/f3f4f6/9ca3af?text=P"; }}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                    <span className="text-xs text-gray-500">{order.items.length} item{order.items.length !== 1 ? "s" : ""}</span>
                                </div>

                                {/* Bottom row */}
                                <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                                    <div>
                                        <p className="text-xs text-gray-400">Total</p>
                                        <p className="font-bold text-gray-900">₹{Number(order.totalAmount).toFixed(0)}</p>
                                    </div>
                                    <div className="flex items-center text-sm text-green-600 font-medium gap-1">
                                        {activeTab === 'PAST' && order.status === 'DELIVERED' ? (
                                            <><RotateCcw className="h-3 w-3" /> Reorder</>
                                        ) : (
                                            <>View Details <ChevronRight className="h-4 w-4" /></>
                                        )}
                                    </div>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default function OrdersPage() {
    return (
        <Suspense fallback={<div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="w-full h-28 rounded-2xl" />)}</div>}>
            <OrdersContent />
        </Suspense>
    );
}
