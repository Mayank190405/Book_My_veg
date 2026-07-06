"use client";

import { useState, useEffect } from "react";
import { ChevronLeft, RotateCcw, AlertCircle, CheckCircle, Package, ArrowRight, ShieldCheck, HelpCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getOrders } from "@/services/orderService";

export default function ReturnsPage() {
    const router = useRouter();
    const [orderId, setOrderId] = useState("");
    const [reason, setReason] = useState("");
    const [details, setDetails] = useState("");
    const [submitted, setSubmitted] = useState(false);
    
    // Order fetching state
    const [orders, setOrders] = useState<any[]>([]);
    const [isLoadingOrders, setIsLoadingOrders] = useState(true);

    useEffect(() => {
        setIsLoadingOrders(true);
        getOrders()
            .then(res => {
                const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);
                const recent = (res?.data || []).filter((order: any) => {
                    // Check order creation date and check if it's not already cancelled/refunded
                    const isEligibleStatus = !["CANCELLED", "REFUNDED"].includes(order.status);
                    return new Date(order.createdAt) >= twelveHoursAgo && isEligibleStatus;
                });
                setOrders(recent);
            })
            .catch(err => console.error("Error fetching orders for return:", err))
            .finally(() => setIsLoadingOrders(false));
    }, []);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!orderId || !reason) return;
        setSubmitted(true);
        import("sonner").then(({ toast }) => {
            toast.success("Exchange Request Initiated!", {
                description: "Our concierge team will verify and arrange the exchange shortly."
            });
        });
    };

    return (
        <div>
            <div className="min-h-screen bg-[#fafafc] pb-32 transition-colors">
                <header className="fixed top-0 left-0 right-0 z-50 px-6 py-4 flex items-center gap-4 bg-white/80 backdrop-blur-md border-b border-slate-100">
                    <button
                        onClick={() => router.back()}
                        className="w-12 h-12 flex items-center justify-center bg-white rounded-2xl border border-slate-200 shadow-sm active:scale-90 transition-all text-slate-800 hover:bg-slate-50"
                    >
                        <ChevronLeft className="h-6 w-6" strokeWidth={2.5} />
                    </button>
                    <div className="flex-1">
                        <span className="text-[10px] font-black text-emerald-700 uppercase tracking-[0.2em] mb-1">CONCIERGE PROTOCOL</span>
                        <h2 className="text-xl font-black text-slate-855 leading-none tracking-tighter uppercase">Returns & Exchanges</h2>
                    </div>
                </header>

                <main className="pt-32 px-6 max-w-2xl mx-auto space-y-8 animate-in slide-in-from-bottom-4 duration-700">
                    <div className="flex items-center gap-3 px-1">
                        <RotateCcw className="h-6 w-6 text-emerald-700" />
                        <h1 className="text-3xl font-black text-slate-900 uppercase tracking-widest italic">Returns & Exchanges</h1>
                    </div>

                    {submitted ? (
                        <div className="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm text-center space-y-6">
                            <div className="w-20 h-20 bg-emerald-50 rounded-[2.5rem] border border-emerald-100 flex items-center justify-center mx-auto text-emerald-600">
                                <CheckCircle className="h-10 w-10" />
                            </div>
                            <div className="space-y-2">
                                <h2 className="text-xl font-black text-slate-900 uppercase tracking-wider">Exchange Request Submitted!</h2>
                                <p className="text-slate-500 text-xs font-bold uppercase tracking-widest max-w-sm mx-auto leading-relaxed">
                                    Our support executives are verifying your order details. An exchange will be arranged shortly.
                                </p>
                            </div>
                            <Button onClick={() => router.push("/orders")} className="bg-[#0b5c3e] hover:bg-[#08452e] text-white rounded-2xl px-12 h-14 font-black uppercase tracking-widest shadow-lg">
                                View Order History
                            </Button>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Return Policy Card */}
                            <div className="p-6 bg-red-50/70 rounded-[2rem] border border-red-100 flex gap-4">
                                <AlertCircle className="h-5 w-5 text-red-650 shrink-0 mt-0.5" />
                                <p className="text-[10px] font-bold text-red-800 uppercase tracking-widest leading-relaxed">
                                    BookMyVeg has a <span className="text-red-700 font-extrabold">100% no-questions-asked exchange policy</span> on fresh vegetables. Exchange requests must be initiated within 12 hours of delivery.
                                </p>
                            </div>

                            <div className="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-450 uppercase tracking-[0.2em] px-1">Select Order (Delivered within 12 Hrs)</label>
                                    {isLoadingOrders ? (
                                        <div className="w-full h-16 px-6 bg-slate-50 border border-slate-200 rounded-2xl flex items-center text-slate-400 font-bold uppercase tracking-widest text-xs animate-pulse">
                                            Loading recent orders...
                                        </div>
                                    ) : orders.length > 0 ? (
                                        <select
                                            value={orderId}
                                            onChange={(e) => setOrderId(e.target.value)}
                                            required
                                            className="w-full h-16 px-6 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:border-emerald-600 focus:bg-white font-black text-slate-800 transition-all uppercase tracking-widest text-xs"
                                        >
                                            <option value="" disabled>SELECT ELIGIBLE ORDER</option>
                                            {orders.map((order: any) => {
                                                const dateObj = new Date(order.createdAt);
                                                const timeStr = dateObj.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
                                                const firstItem = order.items?.[0]?.product?.name || "Premium Produce";
                                                const itemCount = order.items?.length || 1;
                                                const label = `Order #${order.id.slice(-8)} - ${firstItem} (${itemCount} items, ${timeStr})`;
                                                return (
                                                    <option key={order.id} value={order.id} className="bg-white text-slate-800">
                                                        {label}
                                                    </option>
                                                );
                                            })}
                                        </select>
                                    ) : (
                                        <div className="space-y-4">
                                            <div className="w-full h-16 px-6 bg-slate-50 border border-slate-200 rounded-2xl flex items-center text-rose-600 font-black uppercase tracking-widest text-xs">
                                                No eligible orders in the last 12 hours
                                            </div>
                                            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex gap-3 text-amber-800">
                                                <HelpCircle className="h-4 w-4 shrink-0 mt-0.5" />
                                                <p className="text-[9px] font-bold uppercase tracking-widest leading-relaxed">
                                                    Need to exchange an older order or get special assistance? Go directly to <a href="/chat" className="text-[#0b5c3e] underline font-extrabold">Chat Support</a>.
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-450 uppercase tracking-[0.2em] px-1">Reason for Exchange</label>
                                    <select
                                        value={reason}
                                        onChange={(e) => setReason(e.target.value)}
                                        required
                                        className="w-full h-16 px-6 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:border-emerald-600 focus:bg-white font-black text-slate-800 transition-all uppercase tracking-widest text-xs"
                                    >
                                        <option value="" disabled className="bg-white text-slate-800">SELECT REASON</option>
                                        <option value="quality" className="bg-white text-slate-800">VEGETABLE QUALITY ISSUE</option>
                                        <option value="damaged" className="bg-white text-slate-800">DAMAGED ON ARRIVAL</option>
                                        <option value="missing" className="bg-white text-slate-800">MISSING ITEM</option>
                                        <option value="wrong" className="bg-white text-slate-800">INCORRECT PRODUCE DELIVERED</option>
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-450 uppercase tracking-[0.2em] px-1">Additional Details (Optional)</label>
                                    <textarea
                                        placeholder="Describe the issue to help us improve..."
                                        rows={4}
                                        value={details}
                                        onChange={(e) => setDetails(e.target.value)}
                                        className="w-full p-6 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:border-emerald-600 focus:bg-white font-bold placeholder:text-slate-450 text-slate-800 transition-all uppercase tracking-widest text-xs"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={!orderId}
                                    className="w-full group bg-red-650 hover:bg-red-600 disabled:bg-slate-200 disabled:text-slate-450 text-white h-20 rounded-[2rem] flex items-center justify-between px-10 shadow-md transition-all active:scale-[0.98]"
                                >
                                    <span className="text-xs font-black uppercase tracking-[0.2em] italic">Initialize Exchange</span>
                                    <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center group-hover:translate-x-1 transition-transform group-disabled:translate-x-0">
                                        <ArrowRight className="h-5 w-5" strokeWidth={3} />
                                    </div>
                                </button>
                            </div>
                        </form>
                    )}

                    <div className="mt-8 p-4 bg-emerald-50 rounded-2xl flex items-center gap-3 border border-emerald-100">
                        <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0" />
                        <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-widest leading-relaxed">
                            Exchanged items will be dispatched with your next order or delivered by our logistics team within 24 hours.
                        </p>
                    </div>
                </main>
            </div>
        </div>
    );
}
