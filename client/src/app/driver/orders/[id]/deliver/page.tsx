"use client";

import { useState, useEffect, use, Suspense } from "react";
import { useRouter } from "next/navigation";
import api from "@/services/api";
import { toast } from "sonner";
import { Check, Package, Camera, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function DeliverFlowContent({ id }: { id: string }) {
    const router = useRouter();

    const [order, setOrder] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [deliveryPhoto, setDeliveryPhoto] = useState<string>("");
    const [notes, setNotes] = useState<string>("");
    const [isDelivering, setIsDelivering] = useState(false);
    const [isDelivered, setIsDelivered] = useState(false); // Screen 12
    const [deliveredData, setDeliveredData] = useState<any | null>(null);

    useEffect(() => {
        const fetchOrder = async () => {
            try {
                const res = await api.get(`/orders/${id}`);
                setOrder(res.data);
            } catch (error: any) {
                toast.error("Failed to load order");
            } finally {
                setLoading(false);
            }
        };
        fetchOrder();
    }, [id]);

    const handleConfirmDelivery = async () => {
        setIsDelivering(true);
        try {
            await api.patch(`/orders/driver/${id}/deliver`, {
                deliveryPhoto: deliveryPhoto || "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?q=80&w=2070&auto=format&fit=crop",
                notes: notes || "Delivered at doorstep"
            });

            toast.success("Order Delivered Successfully!");
            setDeliveredData({
                orderId: id,
                deliveredAt: new Date().toLocaleString(),
                paymentCollected: Number(order?.cashCollected || order?.easebuzzCollected || order?.totalAmount || 0),
                paymentMode: Number(order?.cashCollected || 0) > 0 ? "Cash" : "Easebuzz"
            });
            setIsDelivered(true);
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Failed to mark order as delivered");
        } finally {
            setIsDelivering(false);
        }
    };

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center p-12">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            </div>
        );
    }

    // ═══════════════════════════════════════════════════════════════════
    // SCREEN 12: DELIVERED SUCCESS
    // ═══════════════════════════════════════════════════════════════════
    if (isDelivered && deliveredData) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-6 animate-in zoom-in-95 duration-300 my-auto text-center">
                <div className="w-24 h-24 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 animate-bounce">
                    <Check className="h-12 w-12 stroke-[3]" />
                </div>
                <div className="space-y-1">
                    <h3 className="text-xl font-black text-slate-900">Order Delivered!</h3>
                    <p className="text-xs text-slate-400 font-medium">Successfully</p>
                </div>

                {/* Statement Table (Screen 12) */}
                <div className="w-full bg-slate-50 p-5 rounded-3xl border border-slate-100 space-y-3 text-xs shadow-sm">
                    <div className="flex justify-between">
                        <span className="text-slate-400">Order ID</span>
                        <span className="font-black text-slate-900 text-sm">#{deliveredData.orderId.slice(-6).toUpperCase()}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-400">Delivered At</span>
                        <span className="font-bold text-slate-700">{deliveredData.deliveredAt}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-400">Payment Collected</span>
                        <span className="font-bold text-slate-900">₹ {deliveredData.paymentCollected.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-400">Payment Mode</span>
                        <span className="font-bold text-emerald-600">{deliveredData.paymentMode}</span>
                    </div>
                </div>

                <div className="w-full pt-4">
                    <Button 
                        onClick={() => router.push("/driver/orders")}
                        className="w-full h-13 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-lg shadow-blue-200"
                    >
                        Back to My Orders
                    </Button>
                </div>
            </div>
        );
    }

    // ═══════════════════════════════════════════════════════════════════
    // SCREEN 11: CONFIRM DELIVERY
    // ═══════════════════════════════════════════════════════════════════
    return (
        <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-6 my-auto animate-in zoom-in-95 duration-300">
            {/* Delivery Box Graphic (Screen 11) */}
            <div className="w-24 h-24 rounded-3xl bg-amber-50 flex items-center justify-center text-amber-600 relative shadow-sm">
                <Package className="h-12 w-12" />
                <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center border-2 border-white">
                    <Check className="h-4 w-4 stroke-[3]" />
                </div>
            </div>

            <div className="text-center space-y-1">
                <h3 className="text-xl font-black text-slate-900">Confirm Delivery</h3>
                <p className="text-xs text-slate-400 font-medium">
                    Have you delivered the order to the customer?
                </p>
            </div>

            {/* Handover photo preview / capture */}
            <div className="w-full space-y-3">
                <div 
                    onClick={() => setDeliveryPhoto("https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?q=80&w=2070&auto=format&fit=crop")}
                    className="w-full h-32 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center gap-1.5 cursor-pointer hover:bg-slate-100 transition-all overflow-hidden"
                >
                    {deliveryPhoto ? (
                        <img src={deliveryPhoto} alt="Handover Proof" className="w-full h-full object-cover" />
                    ) : (
                        <>
                            <Camera className="h-6 w-6 text-slate-400" />
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Optional Handover Photo</span>
                        </>
                    )}
                </div>

                <Input 
                    placeholder="Delivery notes (e.g. handed to customer)..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="h-12 rounded-xl bg-slate-50 text-xs font-bold"
                />
            </div>

            <div className="w-full space-y-2 pt-2">
                <Button 
                    onClick={handleConfirmDelivery}
                    disabled={isDelivering}
                    className="w-full h-13 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-lg shadow-emerald-200"
                >
                    {isDelivering ? <Loader2 className="h-5 w-5 animate-spin" /> : "Yes, Mark Delivered"}
                </Button>
                <button 
                    onClick={() => router.back()}
                    className="w-full py-3 text-xs font-bold text-slate-400 hover:text-slate-600"
                >
                    Not Delivered
                </button>
            </div>
        </div>
    );
}

export default function DeliverPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    return (
        <Suspense fallback={<div className="p-12 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-emerald-600" /></div>}>
            <DeliverFlowContent id={id} />
        </Suspense>
    );
}
