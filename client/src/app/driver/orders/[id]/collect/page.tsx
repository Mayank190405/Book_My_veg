"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import api from "@/services/api";
import { toast } from "sonner";
import { ArrowLeft, Banknote, CreditCard, Percent, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CollectPaymentPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();

    const [order, setOrder] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);

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

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center p-12">
                <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
            </div>
        );
    }

    const billDue = Math.max(0, Number(order.totalAmount || 0) - Number(order.cashCollected || 0) - Number(order.easebuzzCollected || 0));
    const totalDue = Number(order.user?.totalDue || billDue);

    return (
        <div className="flex-1 flex flex-col justify-between animate-in fade-in duration-300">
            {/* Top Bar (Screen 8) */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
                <div className="flex items-center gap-2">
                    <button onClick={() => router.back()} className="p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-full">
                        <ArrowLeft className="h-5 w-5" />
                    </button>
                    <h3 className="text-base font-black text-slate-900">Collect Payment</h3>
                </div>
            </div>

            <div className="p-5 space-y-6 flex-1">
                {/* Total Customer Due Banner (Screen 8) */}
                <div className="bg-purple-50 border border-purple-100 p-5 rounded-3xl space-y-1 shadow-sm">
                    <p className="text-xs font-bold text-purple-700">Total Customer Due</p>
                    <p className="text-3xl font-black text-purple-950">
                        ₹ {totalDue.toLocaleString()}
                    </p>
                </div>

                {/* 3 Payment Options (Screen 8) */}
                <div className="space-y-3.5">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Select Payment Mode</p>

                    {/* 1. Cash */}
                    <div 
                        onClick={() => router.push(`/driver/orders/${id}/cash?amount=${totalDue}`)}
                        className="bg-white p-4 rounded-2xl border-2 border-emerald-100 hover:border-emerald-500 flex items-center justify-between cursor-pointer transition-all active:scale-98 shadow-sm"
                    >
                        <div className="flex items-center gap-3.5">
                            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-black">
                                <Banknote className="h-6 w-6" />
                            </div>
                            <div>
                                <h4 className="text-sm font-black text-slate-900">Cash</h4>
                                <p className="text-xs font-medium text-slate-400">Collect in Cash</p>
                            </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-slate-300" />
                    </div>

                    {/* 2. Pay via Easebuzz */}
                    <div 
                        onClick={() => router.push(`/driver/orders/${id}/easebuzz?amount=${totalDue}`)}
                        className="bg-white p-4 rounded-2xl border-2 border-blue-100 hover:border-blue-500 flex items-center justify-between cursor-pointer transition-all active:scale-98 shadow-sm"
                    >
                        <div className="flex items-center gap-3.5">
                            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-black">
                                <CreditCard className="h-6 w-6" />
                            </div>
                            <div>
                                <h4 className="text-sm font-black text-slate-900">Pay via Easebuzz</h4>
                                <p className="text-xs font-medium text-slate-400">Accept Online Payment</p>
                            </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-slate-300" />
                    </div>

                    {/* 3. Partial Payment */}
                    <div 
                        onClick={() => router.push(`/driver/orders/${id}/easebuzz?amount=${totalDue}&partial=true`)}
                        className="bg-white p-4 rounded-2xl border-2 border-purple-100 hover:border-purple-500 flex items-center justify-between cursor-pointer transition-all active:scale-98 shadow-sm"
                    >
                        <div className="flex items-center gap-3.5">
                            <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-black">
                                <Percent className="h-6 w-6" />
                            </div>
                            <div>
                                <h4 className="text-sm font-black text-slate-900">Partial Payment</h4>
                                <p className="text-xs font-medium text-slate-400">Pay Partial Amount [Easebuzz Only]</p>
                            </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-slate-300" />
                    </div>
                </div>
            </div>

            <div className="p-4 border-t border-slate-100">
                <Button 
                    variant="outline"
                    onClick={() => router.back()}
                    className="w-full h-13 rounded-2xl border-slate-200 text-xs font-bold text-slate-600"
                >
                    Back to Order
                </Button>
            </div>
        </div>
    );
}
