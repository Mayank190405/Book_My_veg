"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getOrders } from "@/services/orderService";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Package, ShoppingBag, Clock, CheckCircle2, Truck, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type OrderItem = { id: string; quantity: string | number; product?: { name?: string; images?: string[] } };
type CustomerOrder = { id: string; createdAt: string; status: string; paymentStatus?: string; totalAmount: string | number; deliveryDate?: string; deliveredAt?: string; items: OrderItem[] };
const tabs = ["All", "Active", "Delivered", "Cancelled"] as const;
type Tab = typeof tabs[number];
const activeStatuses = ["PENDING", "PAYMENT_PENDING", "CONFIRMED", "PROCESSING", "PACKED", "SHIPPED", "OUT_FOR_DELIVERY"];
const statusLabel = (value: string) => value.replace(/_/g, " ").toLowerCase().replace(/^./, c => c.toUpperCase());
const money = (value: string | number) => Number(value).toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0, maximumFractionDigits: 2 });
const dateLabel = (value: string) => new Date(value).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

export default function OrdersPage() {
    const [activeTab, setActiveTab] = useState<Tab>("All");
    const { data: response, isLoading, isError, refetch } = useQuery({ queryKey: ["orders"], queryFn: getOrders });
    const orders: CustomerOrder[] = useMemo(() => response?.data ?? [], [response?.data]);
    const filtered = useMemo(() => orders.filter(order => activeTab === "All" || (activeTab === "Active" && activeStatuses.includes(order.status)) || (activeTab === "Delivered" && order.status === "DELIVERED") || (activeTab === "Cancelled" && ["CANCELLED", "FAILED"].includes(order.status))), [orders, activeTab]);

    return (
        <div className="min-h-screen bg-[#f8faf8] pb-28 text-[#17251e] dark:bg-background dark:text-foreground">
            <div className="mx-auto max-w-5xl px-4 pt-6 sm:px-6">
                <p className="mb-2 text-sm font-medium text-[#087f5b] dark:text-primary">Your shopping, all in one place</p>
                <h1 className="text-2xl font-semibold sm:text-3xl">My orders</h1>
                <p className="mt-2 text-sm text-[#64736b]">Track your orders and view their details.</p>
                <div className="my-6 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filter orders">
                    {tabs.map(tab => <button key={tab} onClick={() => setActiveTab(tab)} aria-pressed={activeTab === tab} className={cn("min-h-11 shrink-0 rounded-full border px-4 text-sm font-medium transition-colors", activeTab === tab ? "border-[#087f5b] bg-[#087f5b] text-white" : "border-[#e5ebe7] bg-white text-[#64736b] hover:border-[#087f5b] dark:bg-card dark:border-border")}>{tab}</button>)}
                </div>
            </div>
            <main className="mx-auto max-w-5xl px-4 sm:px-6">
                {isLoading ? <div className="grid gap-4 md:grid-cols-2" role="status" aria-label="Loading orders">{[0,1,2].map(key => <div key={key} className="h-48 animate-pulse rounded-2xl border border-[#e5ebe7] bg-white p-5 dark:bg-card"><div className="h-4 w-32 rounded bg-[#e5ebe7]" /><div className="mt-5 h-16 rounded bg-[#f8faf8]" /></div>)}</div> : isError ? <div className="rounded-2xl border border-[#e5ebe7] bg-white px-6 py-12 text-center dark:bg-card"><h2 className="text-xl font-semibold">We couldn’t load your orders</h2><p className="mt-2 text-sm text-[#64736b]">Please try again in a moment.</p><button onClick={() => refetch()} className="mt-5 min-h-11 rounded-lg bg-[#087f5b] px-5 text-sm font-semibold text-white">Try again</button></div> : filtered.length === 0 ? <div className="flex flex-col items-center rounded-2xl border border-[#e5ebe7] bg-white px-6 py-14 text-center dark:bg-card"><span className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[#e8f7ef] text-[#087f5b]"><ShoppingBag className="h-7 w-7" /></span><h2 className="text-xl font-semibold">{orders.length ? `No ${activeTab.toLowerCase()} orders` : "Your first order starts here"}</h2><p className="mt-2 max-w-sm text-sm leading-relaxed text-[#64736b]">{orders.length ? "Try another filter to find an order." : "Browse your favourites and add something to your basket."}</p><Link href="/" className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#087f5b] px-5 text-sm font-semibold text-white">Browse groceries<ArrowRight className="h-4 w-4" /></Link></div> : <div className="grid items-start gap-4 md:grid-cols-2">
                    {filtered.map(order => {
                        const cancelled = ["CANCELLED", "FAILED"].includes(order.status);
                        const Icon = cancelled ? XCircle : order.status === "DELIVERED" ? CheckCircle2 : ["SHIPPED", "OUT_FOR_DELIVERY"].includes(order.status) ? Truck : Clock;
                        const firstItem = order.items[0];
                        return <article key={order.id} className="overflow-hidden rounded-2xl border border-[#e5ebe7] bg-white p-4 sm:p-5 dark:bg-card dark:border-border">
                            <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-semibold">Order #{order.id.slice(-8).toUpperCase()}</p><p className="mt-1 text-xs text-[#64736b]">{dateLabel(order.createdAt)}</p></div><span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium", cancelled ? "bg-red-50 text-red-700" : "bg-[#e8f7ef] text-[#056647]")}><Icon className="h-3.5 w-3.5" />{statusLabel(order.status)}</span></div>
                            <div className="my-4 flex items-center gap-3 border-y border-[#e5ebe7] py-4"><div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#f8faf8]">{firstItem?.product?.images?.[0] ? <Image src={firstItem.product.images[0]} alt={firstItem.product.name || "Product"} fill sizes="56px" className="object-contain p-1" /> : <Package className="h-6 w-6 text-[#64736b]" />}</div><div className="min-w-0 flex-1"><p className="break-words text-sm font-medium">{firstItem?.product?.name || "Order items"}{order.items.length > 1 ? ` + ${order.items.length - 1} more` : ""}</p><p className="mt-1 text-xs text-[#64736b]">{order.items.length} {order.items.length === 1 ? "item" : "items"}</p></div><div className="shrink-0 text-right"><p className="text-base font-semibold">{money(order.totalAmount)}</p><p className="mt-1 text-xs text-[#64736b]">{order.paymentStatus ? statusLabel(order.paymentStatus) : "Payment pending"}</p></div></div>
                            {order.status === "DELIVERED" && order.deliveredAt ? <p className="mb-4 text-xs text-[#64736b]">Delivered {dateLabel(order.deliveredAt)}</p> : activeStatuses.includes(order.status) && order.deliveryDate ? <p className="mb-4 text-xs text-[#64736b]">Scheduled delivery: {dateLabel(order.deliveryDate)}</p> : null}
                            <Link href={`/orders/${order.id}`} className="flex min-h-11 items-center justify-between gap-3 rounded-xl bg-[#e8f7ef] px-4 text-sm font-semibold text-[#056647] hover:bg-[#d9efe4]">{["SHIPPED", "OUT_FOR_DELIVERY"].includes(order.status) ? "Track order" : "View order"}<ArrowRight className="h-4 w-4" /></Link>
                        </article>;
                    })}
                </div>}
                {response?.nextCursor && <p className="mt-5 text-center text-xs text-[#64736b]">Showing your recent orders.</p>}
            </main>
        </div>
    );
}
