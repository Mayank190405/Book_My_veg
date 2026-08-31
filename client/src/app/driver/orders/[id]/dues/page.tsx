"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import api from "@/services/api";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CustomerDuesPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();

    const [order, setOrder] = useState<any | null>(null);
    const [duesData, setDuesData] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDues = async () => {
            try {
                const orderRes = await api.get(`/orders/${id}`);
                setOrder(orderRes.data);

                const custId = orderRes.data.userId || orderRes.data.user?.id;
                if (custId) {
                    const duesRes = await api.get(`/orders/customer/${custId}/dues`);
                    setDuesData(duesRes.data);
                }
            } catch (error: any) {
                toast.error("Failed to load customer dues breakdown");
            } finally {
                setLoading(false);
            }
        };
        fetchDues();
    }, [id]);

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center p-12">
                <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
            </div>
        );
    }

    const totalDue = Number(duesData?.totalOutstandingDue || 0);

    return (
        <div className="flex-1 flex flex-col justify-between animate-in fade-in duration-300">
            {/* Top Bar (Screen 7) */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
                <div className="flex items-center gap-2">
                    <button onClick={() => router.back()} className="p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-full">
                        <ArrowLeft className="h-5 w-5" />
                    </button>
                    <h3 className="text-base font-black text-slate-900">All Due Details</h3>
                </div>
            </div>

            <div className="p-5 space-y-5 flex-1 overflow-y-auto pb-28">
                {/* Total Customer Due Banner (Screen 7) */}
                <div className="bg-purple-50 border border-purple-100 p-5 rounded-3xl space-y-1 shadow-sm">
                    <p className="text-xs font-bold text-purple-700">Total Customer Due</p>
                    <p className="text-3xl font-black text-purple-950">
                        ₹ {totalDue.toLocaleString()}
                    </p>
                </div>

                {/* Itemized Unpaid Invoices (Screen 7) */}
                <div className="space-y-3">
                    {duesData?.dueOrders?.map((b: any) => {
                        const isCurrent = b.id === id;
                        const billAmt = Number(b.totalAmount || 0);
                        const dueAmt = Number(b.remainingDue || 0);
                        const paidAmt = Math.max(0, billAmt - dueAmt);

                        return (
                            <div key={b.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-2">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-xs font-black text-slate-900">
                                                #{b.id.slice(-6).toUpperCase()}
                                            </span>
                                            {isCurrent && (
                                                <span className="text-[9px] font-black text-blue-600">(Current)</span>
                                            )}
                                        </div>
                                        <p className="text-[10px] text-slate-400 font-medium">{new Date(b.createdAt).toLocaleDateString()}</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-2 text-xs pt-1.5 border-t border-slate-50 text-slate-500 font-semibold">
                                    <div>
                                        <span className="block text-[10px] text-slate-400 font-normal">Bill Amount</span>
                                        <span className="font-bold text-slate-800">₹ {billAmt.toLocaleString()}</span>
                                    </div>
                                    <div>
                                        <span className="block text-[10px] text-slate-400 font-normal">Paid</span>
                                        <span className="font-bold text-slate-800">₹ {paidAmt.toLocaleString()}</span>
                                    </div>
                                    <div className="text-right">
                                        <span className="block text-[10px] text-rose-400 font-normal">Due</span>
                                        <span className="font-black text-rose-600">₹ {dueAmt.toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Sticky Bottom Bar (Screen 7) */}
            <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white p-4 border-t border-slate-100 flex items-center justify-between z-30 shadow-2xl">
                <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Total Due</p>
                    <p className="text-xl font-black text-purple-950">
                        ₹ {totalDue.toLocaleString()}
                    </p>
                </div>
                <Button 
                    onClick={() => router.push(`/driver/orders/${id}/collect`)}
                    className="h-12 px-6 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs"
                >
                    Collect Payment
                </Button>
            </div>
        </div>
    );
}
