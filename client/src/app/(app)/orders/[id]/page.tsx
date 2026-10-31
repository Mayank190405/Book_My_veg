"use client";

import { useEffect, Suspense, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getOrderById, cancelOrder } from "@/services/orderService";
import { Skeleton } from "@/components/ui/skeleton";
import { useParams } from "next/navigation";
import { ArrowLeft, MapPin, Package, CheckCircle2, Clock, Loader2, Truck, PhoneCall, Headphones } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";
import { getSocket } from "@/services/socketService";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

const panel = "rounded-2xl border border-[#e5ebe7] bg-white p-4 sm:p-6 dark:bg-card dark:border-border";
const statusLabel = (status?: string) => status ? status.replace(/_/g, " ").toLowerCase().replace(/^./, c => c.toUpperCase()) : "Awaiting update";
const money = (value: string | number) => Number(value).toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0, maximumFractionDigits: 2 });
const dateLabel = (date: string) => new Date(date).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

function OrderDetailsContent() {
    const { id } = useParams();
    const queryClient = useQueryClient();
    const [cancelling, setCancelling] = useState(false);
    const { data: order, isLoading, isError, refetch } = useQuery({ queryKey: ["order", id], queryFn: () => getOrderById(id as string), enabled: !!id });

    useEffect(() => {
        const socket = getSocket();
        if (!socket) return;
        const update = (updatedOrder: { id: string; status: string }) => {
            if (updatedOrder.id === id) {
                queryClient.invalidateQueries({ queryKey: ["order", id] });
                toast.success(`Order status updated to ${statusLabel(updatedOrder.status)}`);
            }
        };
        socket.on("order_status_updated", update);
        return () => { socket.off("order_status_updated", update); };
    }, [id, queryClient]);

    const handleCancelOrder = async () => {
        if (!order) return;
        setCancelling(true);
        try {
            await cancelOrder(order.id);
            toast.success("Order cancelled successfully");
            queryClient.invalidateQueries({ queryKey: ["order", id] });
        } catch { toast.error("Failed to cancel order"); }
        finally { setCancelling(false); }
    };

    if (isLoading) return <OrderDetailSkeleton />;
    if (!order) return <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center"><Package className="h-12 w-12 text-[#087f5b]" /><h1 className="text-2xl font-semibold">{isError ? "We couldn’t load your order" : "Order not found"}</h1><p className="text-sm text-[#64736b]">{isError ? "Please try again in a moment." : "Check the order reference or return to your orders."}</p>{isError && <Button onClick={() => refetch()}>Try again</Button>}<Link className="inline-flex min-h-11 items-center text-sm font-medium text-[#087f5b]" href="/orders">Back to orders</Link></div>;

    const canCancel = ["PENDING", "CONFIRMED", "PAYMENT_PENDING"].includes(order.status);
    const address = typeof order.shippingAddress === "object" && order.shippingAddress ? order.shippingAddress : null;
    const events = Array.isArray(order.statusHistory) ? order.statusHistory : [];
    const supportHref = `/chat?topic=order&orderId=${encodeURIComponent(order.id)}`;

    return (
        <div className="min-h-screen bg-[#f8faf8] pb-32 text-[#17251e] dark:bg-background dark:text-foreground">
            <header className="border-b border-[#e5ebe7] bg-white dark:bg-card dark:border-border">
                <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
                    <Link href="/orders" aria-label="Back to orders" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#e5ebe7]"><ArrowLeft className="h-5 w-5" /></Link>
                    <div className="min-w-0 flex-1"><p className="text-xs text-[#64736b]">Order details</p><h1 className="truncate text-base font-semibold">#{order.id.slice(-8).toUpperCase()}</h1></div>
                    <Link href={supportHref} className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-[#e5ebe7] px-3 text-sm"><Headphones className="h-4 w-4" />Help</Link>
                </div>
            </header>
            <main className="mx-auto grid max-w-5xl gap-5 px-4 py-6 sm:px-6 lg:grid-cols-[1.2fr_1fr]">
                <div className="space-y-5">
                    <section className={panel} aria-labelledby="order-status-heading">
                        <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#e8f7ef] text-[#087f5b]"><Package className="h-6 w-6" /></span>
                        <h2 id="order-status-heading" className="text-2xl font-semibold text-[#087f5b] dark:text-primary">{statusLabel(order.status)}</h2>
                        <p className="mt-2 text-sm text-[#64736b]">Placed {dateLabel(order.createdAt)}</p>
                        {order.deliveryDate && !["DELIVERED", "CANCELLED", "FAILED", "REFUNDED"].includes(order.status) && <p className="mt-3 flex items-center gap-2 text-sm"><Clock className="h-4 w-4 text-[#087f5b]" />Scheduled delivery: {dateLabel(order.deliveryDate)}{order.deliverySlot ? ` · ${order.deliverySlot}` : ""}</p>}
                        <div className="mt-6 border-t border-[#e5ebe7] pt-5">
                            <h3 className="mb-5 text-base font-semibold">Order timeline</h3>
                            <ol className="space-y-0">
                                {(events.length ? events : [{ id: "placed", status: "PENDING", createdAt: order.createdAt }]).map((event: { id: string; status: string; createdAt: string }, index: number, list: unknown[]) => <li key={event.id} className="relative flex gap-3 pb-6 last:pb-0">
                                    {index < list.length - 1 && <span className="absolute bottom-0 left-[10px] top-5 w-px bg-[#d7e9df]" aria-hidden="true" />}
                                    <CheckCircle2 className="relative z-10 h-5 w-5 shrink-0 fill-[#087f5b] text-white" aria-hidden="true" />
                                    <div><p className="text-sm font-medium">{statusLabel(event.status)}</p><p className="mt-1 text-xs text-[#64736b]">{dateLabel(event.createdAt)}</p></div>
                                </li>)}
                            </ol>
                            {!events.length && <p className="mt-4 text-xs text-[#64736b]">Detailed milestone times are not available yet.</p>}
                        </div>
                    </section>
                    {order.deliveryPartner && <section className={panel}>
                        <h2 className="mb-4 flex items-center gap-2 text-base font-semibold"><Truck className="h-5 w-5 text-[#087f5b]" />Delivery partner</h2>
                        <div className="flex items-center gap-3"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#e8f7ef] font-semibold text-[#087f5b]">{order.deliveryPartner.name?.[0]?.toUpperCase() || "D"}</span><div className="min-w-0 flex-1"><p className="break-words text-sm font-semibold">{order.deliveryPartner.name || "Delivery partner"}</p><p className="mt-1 text-xs text-[#64736b]">Assigned to your order</p></div>{order.deliveryPartner.phone && <a href={`tel:${order.deliveryPartner.phone}`} aria-label="Call delivery partner" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#d7e9df] text-[#087f5b]"><PhoneCall className="h-5 w-5" /></a>}</div>
                        {order.deliveryOtp && ["SHIPPED", "OUT_FOR_DELIVERY"].includes(order.status) && <p className="mt-4 rounded-lg bg-[#e8f7ef] p-3 text-sm text-[#056647]">Delivery OTP: <strong>{order.deliveryOtp}</strong></p>}
                    </section>}
                    {address && <section className={panel}><h2 className="mb-3 flex items-center gap-2 text-base font-semibold"><MapPin className="h-5 w-5 text-[#087f5b]" />Delivery address</h2>{address.name && <p className="text-sm font-medium">{address.name}</p>}<p className="mt-1 break-words text-sm leading-relaxed text-[#64736b]">{[address.fullAddress, address.landmark, address.city, address.state, address.pincode].filter(Boolean).join(", ")}</p></section>}
                </div>
                <div className="space-y-5">
                    <section className={panel}><h2 className="mb-3 text-base font-semibold">Your items ({order.items.length})</h2><div className="divide-y divide-[#e5ebe7]">{order.items.map((item: { id: string; quantity: string | number; sellingPrice: string | number; product?: { name?: string; images?: string[] } }) => <div key={item.id} className="flex items-center gap-3 py-4"><div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#f8faf8]">{item.product?.images?.[0] ? <Image src={item.product.images[0]} alt={item.product.name || "Product"} fill sizes="56px" className="object-contain p-1" /> : <Package className="h-6 w-6 text-[#64736b]" />}</div><div className="min-w-0 flex-1"><p className="break-words text-sm font-medium">{item.product?.name || "Product"}</p><p className="mt-1 text-xs text-[#64736b]">{Number(item.quantity)} × {money(item.sellingPrice)}</p></div><p className="shrink-0 text-sm font-semibold">{money(Number(item.quantity) * Number(item.sellingPrice))}</p></div>)}</div></section>
                    <section className={panel}><h2 className="mb-4 text-base font-semibold">Payment summary</h2><dl className="space-y-4 text-sm"><div className="flex justify-between gap-4"><dt className="text-[#64736b]">Payment status</dt><dd className="font-medium">{statusLabel(order.paymentStatus)}</dd></div>{order.deliveryCharge !== undefined && order.deliveryCharge !== null && <div className="flex justify-between gap-4"><dt className="text-[#64736b]">Delivery charge</dt><dd>{money(order.deliveryCharge)}</dd></div>}{Number(order.discountAmount) > 0 && <div className="flex justify-between gap-4"><dt className="text-[#64736b]">Discount</dt><dd className="text-[#087f5b]">{money(order.discountAmount)}</dd></div>}<div className="flex justify-between gap-4 border-t border-[#e5ebe7] pt-4 text-base font-semibold"><dt>Order total</dt><dd>{money(order.totalAmount)}</dd></div></dl></section>
                    {canCancel && <AlertDialog><AlertDialogTrigger asChild><Button variant="outline" className="h-12 w-full rounded-xl border-red-200 bg-white text-red-700 hover:bg-red-50">Cancel order</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Cancel this order?</AlertDialogTitle><AlertDialogDescription>This cancellation cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Keep order</AlertDialogCancel><AlertDialogAction onClick={handleCancelOrder} disabled={cancelling} className="bg-red-700 text-white hover:bg-red-800">{cancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cancel order"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>}
                    <Link href={supportHref} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#087f5b] px-4 text-sm font-semibold text-white hover:bg-[#056647]"><Headphones className="h-4 w-4" />Get help with this order</Link>
                </div>
            </main>
        </div>
    );
}

export default function OrderDetailsPage() { return <Suspense fallback={<OrderDetailSkeleton />}><OrderDetailsContent /></Suspense>; }
function OrderDetailSkeleton() { return <div className="mx-auto max-w-5xl space-y-5 p-4 py-8" aria-label="Loading order"><Skeleton className="h-12 w-48" /><Skeleton className="h-72 rounded-2xl" /><Skeleton className="h-40 rounded-2xl" /></div>; }
