"use client";

import { useState, useEffect, use, useCallback } from "react";
import { useRouter } from "next/navigation";
import api from "@/services/api";
import { toast } from "sonner";
import { 
    ArrowLeft, 
    Loader2, 
    Banknote, 
    QrCode, 
    CheckCircle2, 
    Clock, 
    Store, 
    ShoppingBag,
    Receipt,
    Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CustomerDuesPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();

    const [order, setOrder] = useState<any | null>(null);
    const [duesData, setDuesData] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [clearingBillId, setClearingBillId] = useState<string | null>(null);
    const [isClearingAll, setIsClearingAll] = useState(false);

    const fetchDues = useCallback(async () => {
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
    }, [id]);

    useEffect(() => {
        fetchDues();
    }, [fetchDues]);

    // Handle clearing single bill due via Cash
    const handleClearSingleDueCash = async (billId: string, dueAmount: number) => {
        if (clearingBillId) return;
        setClearingBillId(billId);
        try {
            toast.info(`Recording Cash payment of ₹${dueAmount.toLocaleString()}...`);
            const res = await api.post("/orders/driver/collect-cash", {
                orderId: billId,
                amount: dueAmount
            });
            toast.success(res.data.message || `Bill #${billId.slice(-6).toUpperCase()} cleared successfully!`);
            await fetchDues();
        } catch (err: any) {
            toast.error(err.response?.data?.message || "Failed to record cash payment");
        } finally {
            setClearingBillId(null);
        }
    };

    // Handle clearing all dues in Cash
    const handleClearAllCash = async () => {
        const custId = order?.userId || order?.user?.id;
        const totalDue = Number(duesData?.totalOutstandingDue || 0);
        if (!custId || totalDue <= 0 || isClearingAll) return;

        setIsClearingAll(true);
        try {
            toast.info(`Clearing all customer dues (₹${totalDue.toLocaleString()})...`);
            const res = await api.post("/orders/driver/collect-cash", {
                customerId: custId,
                amount: totalDue,
                clearAllDues: true
            });
            toast.success(res.data.message || "All customer dues cleared successfully!");
            await fetchDues();
        } catch (err: any) {
            toast.error(err.response?.data?.message || "Failed to clear all dues");
        } finally {
            setIsClearingAll(false);
        }
    };

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center p-12">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
        );
    }

    const totalDue = Number(duesData?.totalOutstandingDue || 0);
    const customer = duesData?.customer || order?.user;
    const bills = duesData?.bills || [];

    return (
        <div className="flex-1 flex flex-col justify-between animate-in fade-in duration-300 min-h-screen bg-slate-50">
            {/* Top Navigation Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-md z-20">
                <div className="flex items-center gap-2">
                    <button onClick={() => router.back()} className="p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
                        <ArrowLeft className="h-5 w-5" />
                    </button>
                    <div>
                        <h3 className="text-base font-black text-slate-900">Customer Dues Breakdown</h3>
                        <p className="text-[10px] font-semibold text-slate-400">
                            {customer?.name || "Customer"} • {customer?.phone || ""}
                        </p>
                    </div>
                </div>
            </div>

            <div className="p-4 sm:p-5 space-y-5 flex-1 overflow-y-auto pb-36 max-w-md sm:max-w-xl md:max-w-2xl mx-auto w-full">
                {/* Total Customer Outstanding Summary Card */}
                <div className="bg-gradient-to-br from-purple-900 via-indigo-900 to-slate-900 text-white p-6 rounded-3xl shadow-xl space-y-3 relative overflow-hidden">
                    <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-purple-500/20 rounded-full blur-2xl pointer-events-none" />
                    
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-purple-200 uppercase tracking-wider flex items-center gap-1.5">
                            <Receipt className="h-4 w-4 text-purple-300" /> Total Outstanding Due
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full bg-white/10 text-[10px] font-black text-purple-200">
                            {bills.length} Pending {bills.length === 1 ? "Bill" : "Bills"}
                        </span>
                    </div>

                    <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold text-purple-300">₹</span>
                        <span className="text-4xl font-black tracking-tight text-white">
                            {totalDue.toLocaleString()}
                        </span>
                    </div>

                    <p className="text-[11px] text-purple-200/80 font-medium">
                        You can clear individual bills below or collect the total balance at once.
                    </p>
                </div>

                {/* Bill-by-Bill Itemized List */}
                <div className="space-y-3.5">
                    <div className="flex items-center justify-between px-1">
                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">
                            Bill Wise Outstanding ({bills.length})
                        </h4>
                    </div>

                    {bills.length === 0 ? (
                        <div className="bg-white rounded-3xl p-8 text-center border border-slate-100 shadow-sm space-y-2">
                            <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
                            <h4 className="text-sm font-black text-slate-800">All Dues Cleared!</h4>
                            <p className="text-xs text-slate-400 font-medium">This customer has zero outstanding balance.</p>
                        </div>
                    ) : (
                        bills.map((b: any) => {
                            const isCurrent = b.id === id;
                            const billAmt = Number(b.totalAmount || 0);
                            const dueAmt = Number(b.dueAmount || 0);
                            const paidAmt = Number(b.paidAmount || 0);
                            const isClearingThis = clearingBillId === b.id;

                            return (
                                <div 
                                    key={b.id} 
                                    className={`bg-white p-5 rounded-3xl border transition-all space-y-4 shadow-sm ${
                                        isCurrent ? "border-blue-300 ring-2 ring-blue-500/10 shadow-blue-100" : "border-slate-100"
                                    }`}
                                >
                                    {/* Bill Header */}
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-0.5">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-black text-slate-900 tracking-tight">
                                                    Order #{b.id.slice(-6).toUpperCase()}
                                                </span>
                                                {isCurrent && (
                                                    <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[9px] font-black uppercase tracking-wider">
                                                        Current Order
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 text-[10px] text-slate-400 font-semibold">
                                                <span className="flex items-center gap-1">
                                                    <Clock className="h-3 w-3" />
                                                    {new Date(b.createdAt).toLocaleDateString("en-IN", {
                                                        day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
                                                    })}
                                                </span>
                                                •
                                                <span className="flex items-center gap-1">
                                                    <Store className="h-3 w-3" />
                                                    {b.storeName || "Main Hub"}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="text-right">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase block">Remaining Due</span>
                                            <span className="text-base font-black text-rose-600">₹ {dueAmt.toLocaleString()}</span>
                                        </div>
                                    </div>

                                    {/* 3-Column Financial Breakdown */}
                                    <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-2xl text-xs">
                                        <div>
                                            <span className="block text-[10px] text-slate-400 font-bold uppercase">Total Bill</span>
                                            <span className="font-black text-slate-800">₹ {billAmt.toLocaleString()}</span>
                                        </div>
                                        <div>
                                            <span className="block text-[10px] text-slate-400 font-bold uppercase">Paid</span>
                                            <span className="font-black text-emerald-600">₹ {paidAmt.toLocaleString()}</span>
                                        </div>
                                        <div className="text-right">
                                            <span className="block text-[10px] text-slate-400 font-bold uppercase">Status</span>
                                            <span className="font-black text-amber-600 text-[11px] uppercase">
                                                {b.paymentStatus || "PENDING"}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Action Buttons for this Single Bill */}
                                    {dueAmt > 0 && (
                                        <div className="grid grid-cols-2 gap-2.5 pt-1">
                                            <Button
                                                size="sm"
                                                onClick={() => handleClearSingleDueCash(b.id, dueAmt)}
                                                disabled={isClearingThis}
                                                className="h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-sm flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                                            >
                                                {isClearingThis ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <>
                                                        <Banknote className="h-4 w-4" />
                                                        Cash ₹{dueAmt}
                                                    </>
                                                )}
                                            </Button>

                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => router.push(`/driver/orders/${b.id}/easebuzz?amount=${dueAmt}`)}
                                                className="h-11 rounded-xl border-2 border-blue-600 text-blue-600 hover:bg-blue-50 font-black text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                                            >
                                                <QrCode className="h-4 w-4" />
                                                UPI QR ₹{dueAmt}
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Sticky Bottom Bar for Clearing All Dues */}
            {totalDue > 0 && (
                <div className="fixed sm:absolute bottom-0 left-0 right-0 max-w-md sm:max-w-xl md:max-w-2xl mx-auto bg-white/95 backdrop-blur-md p-4 border-t border-slate-100 z-30 shadow-2xl flex items-center justify-between gap-3 sm:rounded-b-3xl">
                    <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Outstanding</span>
                        <p className="text-xl font-black text-purple-950">
                            ₹ {totalDue.toLocaleString()}
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button 
                            onClick={handleClearAllCash}
                            disabled={isClearingAll}
                            className="h-12 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md shadow-emerald-200 flex items-center gap-1.5 active:scale-95 transition-all"
                        >
                            {isClearingAll ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <>
                                    <Banknote className="h-4 w-4" />
                                    Clear All Cash
                                </>
                            )}
                        </Button>

                        <Button 
                            onClick={() => router.push(`/driver/orders/${id}/easebuzz?amount=${totalDue}`)}
                            className="h-12 px-4 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs shadow-md shadow-blue-200 flex items-center gap-1.5 active:scale-95 transition-all"
                        >
                            <QrCode className="h-4 w-4" />
                            Clear All UPI
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
