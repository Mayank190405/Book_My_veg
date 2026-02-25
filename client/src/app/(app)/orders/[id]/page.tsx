"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getOrderById, cancelOrder } from "@/services/orderService";
import { getSocket } from "@/services/socketService";
import { Skeleton } from "@/components/ui/skeleton";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, MapPin, Package, CheckCircle2, Circle, Clock, AlertTriangle, Loader2 } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const STATUS_STYLES: Record<string, string> = {
    PENDING: "bg-yellow-100 text-yellow-800",
    CONFIRMED: "bg-blue-100 text-blue-700",
    PROCESSING: "bg-indigo-100 text-indigo-700",
    SHIPPED: "bg-purple-100 text-purple-700",
    OUT_FOR_DELIVERY: "bg-orange-100 text-orange-700",
    DELIVERED: "bg-green-100 text-green-700",
    CANCELLED: "bg-red-100 text-red-700",
    REFUNDED: "bg-gray-100 text-gray-600",
};

// Status pipeline for the progress timeline
const STATUS_PIPELINE = [
    { key: "PENDING", label: "Order Placed" },
    { key: "CONFIRMED", label: "Confirmed" },
    { key: "PROCESSING", label: "Processing" },
    { key: "SHIPPED", label: "Shipped" },
    { key: "OUT_FOR_DELIVERY", label: "Out for Delivery" },
    { key: "DELIVERED", label: "Delivered" },
];

function StatusTimeline({ currentStatus }: { currentStatus: string }) {
    const currentIdx = STATUS_PIPELINE.findIndex((s) => s.key === currentStatus);
    const isCancelled = currentStatus === "CANCELLED" || currentStatus === "REFUNDED";

    if (isCancelled) {
        return (
            <div className="flex items-center gap-2 text-red-500 text-sm font-medium py-2">
                <Circle className="h-4 w-4 fill-red-500 text-red-500" />
                Order {currentStatus === "REFUNDED" ? "Refunded" : "Cancelled"}
            </div>
        );
    }

    return (
        <div className="relative">
            {STATUS_PIPELINE.map((step, idx) => {
                const isDone = idx <= currentIdx;
                const isActive = idx === currentIdx;

                return (
                    <div key={step.key} className="flex items-start gap-3 mb-0">
                        {/* Icon + connector */}
                        <div className="flex flex-col items-center">
                            <div className={cn(
                                "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0",
                                isDone
                                    ? "border-green-500 bg-green-500"
                                    : "border-gray-200 bg-white"
                            )}>
                                {isDone && <CheckCircle2 className="h-3 w-3 text-white fill-white" strokeWidth={3} />}
                            </div>
                            {idx < STATUS_PIPELINE.length - 1 && (
                                <div className={cn(
                                    "w-0.5 h-6 mt-0.5",
                                    idx < currentIdx ? "bg-green-400" : "bg-gray-200"
                                )} />
                            )}
                        </div>

                        {/* Label */}
                        <div className={cn(
                            "text-sm pb-4",
                            isActive ? "font-bold text-gray-900" : isDone ? "font-medium text-gray-600" : "text-gray-300"
                        )}>
                            {step.label}
                            {isActive && (
                                <span className="ml-2 text-[10px] bg-green-100 text-green-700 font-bold px-1.5 py-0.5 rounded-full">Now</span>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

export default function OrderDetailsPage() {
    const { id } = useParams();
    const router = useRouter();
    const queryClient = useQueryClient();
    const [cancelling, setCancelling] = useState(false);

    const { data: order, isLoading } = useQuery({
        queryKey: ["order", id],
        queryFn: () => getOrderById(id as string),
        enabled: !!id,
    });

    useEffect(() => {
        const socket = getSocket();
        if (!socket) return;

        socket.on("order_status_updated", (updatedOrder: any) => {
            if (updatedOrder.id === id) {
                queryClient.invalidateQueries({ queryKey: ["order", id] });
                toast.success(`Order status updated to ${updatedOrder.status.replace(/_/g, " ")}`);
            }
        });

        return () => { socket.off("order_status_updated"); };
    }, [id, queryClient]);

    const handleCancelOrder = async () => {
        if (!order) return;
        setCancelling(true);
        try {
            await cancelOrder(order.id);
            toast.success("Order cancelled successfully");
            queryClient.invalidateQueries({ queryKey: ["order", id] });
        } catch (error) {
            console.error(error);
            toast.error("Failed to cancel order");
        } finally {
            setCancelling(false);
        }
    };

    if (isLoading) return <OrderDetailSkeleton />;
    if (!order) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen gap-4 text-gray-400">
                <Package className="h-16 w-16 opacity-20" />
                <p className="text-xl font-medium">Order not found</p>
                <Link href="/orders" className="text-green-600 text-sm underline">Back to Orders</Link>
            </div>
        );
    }

    const statusStyle = STATUS_STYLES[order.status] ?? "bg-gray-100 text-gray-600";
    const canCancel = ["PENDING", "CONFIRMED", "PAYMENT_PENDING"].includes(order.status);

    return (
        <div className="space-y-4 pb-24">
            {/* Header */}
            <div className="flex items-center gap-3 sticky top-0 bg-gray-50/90 backdrop-blur-sm py-3 -mx-4 px-4 z-10">
                <Link href="/orders" className="p-1.5 rounded-full hover:bg-gray-200 transition-colors">
                    <ArrowLeft className="h-5 w-5 text-gray-700" />
                </Link>
                <h1 className="text-xl font-bold text-gray-900">Order Details</h1>
                <span className={cn("ml-auto px-3 py-1 text-xs font-bold rounded-full uppercase", statusStyle)}>
                    {order.status.replace(/_/g, " ")}
                </span>
            </div>

            {/* Order summary card */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-2">
                <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400">Order ID</span>
                    <span className="font-mono text-xs bg-gray-50 px-2 py-0.5 rounded">#{order.id.slice(0, 12).toUpperCase()}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400">Date</span>
                    <span className="font-medium">{new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400">Payment</span>
                    <span className={cn("font-semibold", order.paymentStatus === "PAID" ? "text-green-600" : "text-orange-500")}>
                        {order.paymentStatus}
                    </span>
                </div>
            </div>

            {/* Status Timeline */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                    <Clock className="h-4 w-4 text-green-500" /> Order Status
                </h3>
                <StatusTimeline currentStatus={order.status} />
            </div>

            {/* Delivery Address & Slot */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">
                <div className="flex items-start gap-3">
                    <div className="p-2 bg-green-50 rounded-xl">
                        <MapPin className="h-4 w-4 text-green-600" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-gray-700">Delivery Address</h3>
                        <p className="text-sm text-gray-500 mt-1 leading-relaxed">
                            {order.shippingAddress?.fullAddress || "Address not available"}
                        </p>
                        {order.shippingAddress?.landmark && (
                            <p className="text-xs text-gray-400 mt-0.5">🏢 {order.shippingAddress.landmark}</p>
                        )}
                    </div>
                </div>

                {order.shippingAddress?.deliverySlot && (
                    <div className="flex items-start gap-3 pt-3 border-t border-gray-50">
                        <div className="p-2 bg-blue-50 rounded-xl">
                            <Clock className="h-4 w-4 text-blue-600" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-gray-700">Scheduled Delivery</h3>
                            <p className="text-sm text-gray-500 mt-1">
                                {order.shippingAddress.deliverySlot.date} • <span className="text-gray-700 font-medium">{order.shippingAddress.deliverySlot.time}</span>
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Order Items */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                    <Package className="h-4 w-4 text-green-500" /> Items ({order.items.length})
                </h3>
                <div className="space-y-3">
                    {order.items.map((item: any) => (
                        <div key={item.id} className="flex gap-3 pb-3 border-b border-gray-50 last:border-0 last:pb-0">
                            <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-gray-100 shrink-0">
                                <Image
                                    src={item.product?.images?.[0] || "https://placehold.co/56x56/f3f4f6/9ca3af?text=P"}
                                    alt={item.product?.name || "Product"}
                                    fill
                                    sizes="56px"
                                    className="object-cover"
                                    onError={(e) => { (e.target as HTMLImageElement).src = "https://placehold.co/56x56/f3f4f6/9ca3af?text=P"; }}
                                />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-gray-800 line-clamp-1">{item.product?.name}</p>
                                <p className="text-xs text-gray-400 mt-0.5">Qty: {item.quantity} × ₹{Number(item.price).toFixed(0)}</p>
                            </div>
                            <p className="text-sm font-bold text-gray-900 shrink-0">₹{(item.quantity * Number(item.price)).toFixed(0)}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Price Summary */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-2">
                <div className="flex justify-between text-sm text-gray-500">
                    <span>Subtotal</span>
                    <span>₹{Number(order.totalAmount).toFixed(0)}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-500">
                    <span>Delivery</span>
                    <span className="text-green-600 font-medium">FREE</span>
                </div>
                <div className="flex justify-between text-base font-bold pt-2 border-t border-gray-100">
                    <span>Total</span>
                    <span>₹{Number(order.totalAmount).toFixed(0)}</span>
                </div>
            </div>

            {/* Action Buttons */}
            {canCancel && (
                <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100 z-20">
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="outline" className="w-full border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 h-11 font-medium">
                                Cancel Order
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="w-[90%] rounded-2xl">
                            <AlertDialogHeader>
                                <AlertDialogTitle>Cancel Order?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Are you sure you want to cancel this order? This action cannot be undone.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>No, Keep Order</AlertDialogCancel>
                                <AlertDialogAction onClick={handleCancelOrder} className="bg-red-600 text-white hover:bg-red-700" disabled={cancelling}>
                                    {cancelling ? <Loader2 className="animate-spin h-4 w-4" /> : "Yes, Cancel Order"}
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            )}
        </div>
    );
}

function OrderDetailSkeleton() {
    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3">
                <Skeleton className="w-8 h-8 rounded-full" />
                <Skeleton className="w-40 h-6" />
            </div>
            <Skeleton className="w-full h-28 rounded-2xl" />
            <Skeleton className="w-full h-48 rounded-2xl" />
            <Skeleton className="w-full h-20 rounded-2xl" />
            <Skeleton className="w-full h-40 rounded-2xl" />
        </div>
    );
}
