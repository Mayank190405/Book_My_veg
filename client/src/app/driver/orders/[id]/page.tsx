"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import api from "@/services/api";
import { toast } from "sonner";
import { ArrowLeft, User, Phone, MapPin, ChevronRight, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function OrderDetailsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();

    const [order, setOrder] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [showItemsModal, setShowItemsModal] = useState(false);

    useEffect(() => {
        const fetchOrder = async () => {
            try {
                const res = await api.get(`/orders/${id}`);
                setOrder(res.data);
            } catch (error: any) {
                toast.error("Failed to load order details");
            } finally {
                setLoading(false);
            }
        };
        fetchOrder();
    }, [id]);

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center p-12">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
        );
    }

    if (!order) {
        return (
            <div className="p-8 text-center space-y-3">
                <p className="text-xs font-bold text-slate-500">Order not found</p>
                <Button onClick={() => router.push("/driver/orders")} className="bg-blue-600 text-white rounded-xl">
                    Back to Orders
                </Button>
            </div>
        );
    }

    const billAmt = Number(order.totalAmount || 0);
    const paidAmt = Number(order.cashCollected || 0) + Number(order.easebuzzCollected || 0);
    const billDue = Math.max(0, billAmt - paidAmt);
    const custTotalDue = Number(order.user?.totalDue || billDue);

    const fullAddress = typeof order.shippingAddress === 'string'
        ? order.shippingAddress
        : (order.shippingAddress?.fullAddress || order.shippingAddress?.address || "Store counter address");

    return (
        <div className="flex-1 flex flex-col justify-between animate-in fade-in duration-300">
            {/* Top Bar Header (Screen 6) */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
                <div className="flex items-center gap-2">
                    <button onClick={() => router.push("/driver/orders")} className="p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-full">
                        <ArrowLeft className="h-5 w-5" />
                    </button>
                    <h3 className="text-base font-black text-slate-900">
                        Order #{order.id.slice(-6).toUpperCase()}
                    </h3>
                </div>
                <span className={cn(
                    "px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider",
                    order.status === "DELIVERED" ? "bg-emerald-100 text-emerald-700" :
                    order.status === "SHIPPED" || order.status === "OUT_FOR_DELIVERY" ? "bg-blue-100 text-blue-700" :
                    "bg-orange-100 text-orange-700"
                )}>
                    {order.status}
                </span>
            </div>

            <div className="p-5 space-y-4 flex-1 overflow-y-auto pb-28">
                {/* Customer Details Card (Screen 6) */}
                <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-blue-600" />
                            <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">Customer Details</h4>
                        </div>
                        {order.user?.phone && (
                            <a 
                                href={`tel:${order.user.phone}`}
                                className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-sm active:scale-95"
                            >
                                <Phone className="h-4 w-4" />
                            </a>
                        )}
                    </div>

                    <div className="space-y-2 text-xs">
                        <p className="font-bold text-slate-900 text-sm">{order.user?.name || "Customer"}</p>
                        <p className="font-semibold text-slate-500">{order.user?.phone || "No phone"}</p>
                        <div className="flex items-start gap-2 pt-1 text-slate-600 font-medium">
                            <MapPin className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                            <p className="leading-snug">{fullAddress}</p>
                        </div>
                    </div>
                </div>

                {/* Order Details Card (Screen 6) */}
                <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm space-y-3">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">Order Details</h4>
                    <div className="space-y-2 text-xs">
                        <div className="flex justify-between">
                            <span className="text-slate-500">Store</span>
                            <span className="font-bold text-slate-800">{order.location?.name || "Goyal Super Store"}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-500">Packer</span>
                            <span className="font-bold text-slate-800">{order.packer?.name || "Store Packer"}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-500">Order Date</span>
                            <span className="font-bold text-slate-800">
                                {new Date(order.createdAt).toLocaleDateString("en-IN", {
                                    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
                                })}
                            </span>
                        </div>
                        <div className="flex justify-between items-center pt-1 border-t border-slate-100">
                            <span className="text-slate-500">Items</span>
                            <button 
                                onClick={() => setShowItemsModal(true)}
                                className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
                            >
                                {order.items?.length || 0} Items <ChevronRight className="h-3 w-3" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Payment Summary Card (Screen 6) */}
                <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm space-y-3">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">Payment Summary</h4>
                    <div className="space-y-2 text-xs">
                        <div className="flex justify-between">
                            <span className="text-slate-500">Bill Amount</span>
                            <span className="font-bold text-slate-800">₹ {billAmt.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-500">Paid Amount</span>
                            <span className="font-bold text-slate-800">₹ {paidAmt.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-500">Bill Due</span>
                            <span className="font-black text-rose-500">₹ {billDue.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between pt-2 border-t border-slate-100">
                            <span className="font-bold text-slate-900">Customer Total Due</span>
                            <span className="font-black text-purple-900 text-sm">₹ {custTotalDue.toLocaleString()}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Action Bar (Screen 6) */}
            <div className="fixed sm:absolute bottom-0 left-0 right-0 max-w-md sm:max-w-xl md:max-w-2xl lg:max-w-4xl mx-auto bg-white/95 backdrop-blur-md p-4 sm:p-5 border-t border-slate-100 grid grid-cols-2 gap-3 z-50 shadow-2xl sm:rounded-b-3xl">
                <Button
                    variant="outline"
                    onClick={() => router.push(`/driver/orders/${order.id}/dues`)}
                    className="h-13 rounded-2xl border-2 border-slate-200 hover:border-blue-600 text-slate-700 hover:text-blue-600 font-black text-xs hover:bg-blue-50 active:scale-95 transition-all"
                >
                    View All Due
                </Button>
                
                {order.status === "DELIVERED" ? (
                    <Button
                        onClick={() => router.push("/driver/orders")}
                        className="h-13 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-lg shadow-emerald-200 active:scale-95 transition-all"
                    >
                        Delivered ✓
                    </Button>
                ) : (order.isPaid || billDue === 0) ? (
                    <Button
                        onClick={() => router.push(`/driver/orders/${order.id}/deliver`)}
                        className="h-13 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-lg shadow-emerald-200 active:scale-95 transition-all"
                    >
                        Deliver Order
                    </Button>
                ) : (
                    <Button
                        onClick={() => router.push(`/driver/orders/${order.id}/collect`)}
                        className="h-13 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs shadow-lg shadow-blue-500/25 active:scale-95 transition-all"
                    >
                        Collect Payment
                    </Button>
                )}
            </div>

            {/* Items Modal */}
            {showItemsModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-sm rounded-3xl p-5 space-y-4 shadow-2xl animate-in zoom-in-95">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <h4 className="text-sm font-black text-slate-900">Order Items ({order.items?.length || 0})</h4>
                            <button onClick={() => setShowItemsModal(false)} className="p-1 rounded-full text-slate-400 hover:text-slate-600">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="max-h-64 overflow-y-auto space-y-2.5 divide-y divide-slate-50">
                            {order.items?.map((item: any) => (
                                <div key={item.id} className="pt-2 flex items-center justify-between text-xs">
                                    <div className="space-y-0.5">
                                        <p className="font-bold text-slate-800">{item.product?.name || "Product"}</p>
                                        <p className="text-[10px] text-slate-400">Qty: {Number(item.quantity)}</p>
                                    </div>
                                    <span className="font-bold text-slate-900">₹{Number(item.sellingPrice || item.price || 0) * Number(item.quantity)}</span>
                                </div>
                            ))}
                        </div>
                        <Button onClick={() => setShowItemsModal(false)} className="w-full h-11 rounded-xl bg-slate-900 text-white text-xs font-bold">
                            Close
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
