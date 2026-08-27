"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import { useSearchParams, useRouter, useParams } from "next/navigation";
import { 
    CreditCard, ShieldCheck, CheckCircle2, AlertCircle, ShoppingBag, 
    User, Phone, FileText, ArrowRight, Loader2, RefreshCw, Check, Sparkles, Building,
    ChevronDown, ChevronUp, Receipt, ListFilter, CheckCircle, Tag
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getBaseURL } from "@/services/api";

interface PayPageProps {
    slugParams?: string[];
}

function PayContent({ slugParams }: PayPageProps) {
    const searchParams = useSearchParams();
    const router = useRouter();
    const routeParams = useParams();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [payData, setPayData] = useState<any>(null);
    const [customAmount, setCustomAmount] = useState<string>("");
    const [selectedBillId, setSelectedBillId] = useState<string | null>(null);
    const [showPendingList, setShowPendingList] = useState<boolean>(true);
    const [processing, setProcessing] = useState(false);
    const [paymentSuccess, setPaymentSuccess] = useState(false);

    // Extract userid, number, billid from query or path slug
    const extractedParams = useMemo(() => {
        let userid = searchParams.get("userid") || searchParams.get("userId") || "";
        let number = searchParams.get("number") || searchParams.get("phone") || "";
        let billid = searchParams.get("billid") || searchParams.get("billId") || "";

        const slug = slugParams || (routeParams?.slug as string[]);
        if (slug && slug.length > 0) {
            const pathStr = decodeURIComponent(slug.join("/"));
            const kvPairs = pathStr.split("&");
            for (const pair of kvPairs) {
                const [k, v] = pair.split("=");
                if (k && v) {
                    const cleanK = k.trim().toLowerCase();
                    const cleanV = v.trim();
                    if (cleanK === "userid" || cleanK === "user_id") userid = cleanV;
                    if (cleanK === "number" || cleanK === "phone") number = cleanV;
                    if (cleanK === "billid" || cleanK === "bill_id" || cleanK === "orderid") billid = cleanV;
                }
            }
        }

        if (typeof window !== "undefined" && (!userid || !number)) {
            const rawPath = window.location.pathname;
            if (rawPath.includes("/pay/")) {
                const pathSub = rawPath.split("/pay/")[1];
                if (pathSub) {
                    const pairs = pathSub.split("&");
                    for (const pair of pairs) {
                        const [k, v] = pair.split("=");
                        if (k && v) {
                            const cleanK = k.trim().toLowerCase();
                            const cleanV = v.trim();
                            if ((cleanK === "userid" || cleanK === "user_id") && !userid) userid = cleanV;
                            if ((cleanK === "number" || cleanK === "phone") && !number) number = cleanV;
                            if ((cleanK === "billid" || cleanK === "bill_id") && !billid) billid = cleanV;
                        }
                    }
                }
            }
        }

        return { userid, number, billid };
    }, [searchParams, routeParams, slugParams]);

    const fetchPayData = async () => {
        setLoading(true);
        setError(null);
        try {
            const query = new URLSearchParams();
            if (extractedParams.userid) query.set("userid", extractedParams.userid);
            if (extractedParams.number) query.set("number", extractedParams.number);
            if (extractedParams.billid) query.set("billid", extractedParams.billid);

            const res = await fetch(`${getBaseURL()}/pay/pay-info?${query.toString()}`);
            if (!res.ok) throw new Error("Failed to load payment details");
            const data = await res.json();
            setPayData(data);

            if (data.bill && !data.bill.isPaid) {
                setSelectedBillId(data.bill.id);
                setCustomAmount(data.bill.dueAmount.toString());
            } else if (data.totalDue > 0) {
                setCustomAmount(data.totalDue.toString());
            }
        } catch (err: any) {
            setError(err.message || "Could not fetch payment information");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPayData();
    }, [extractedParams]);

    const [payIframeUrl, setPayIframeUrl] = useState<string | null>(null);
    const [showPayIframeModal, setShowPayIframeModal] = useState(false);

    const handleSelectBill = (billObj: any) => {
        if (selectedBillId === billObj.id) {
            setSelectedBillId(null);
            setCustomAmount((payData?.totalDue || 0).toString());
        } else {
            setSelectedBillId(billObj.id);
            setCustomAmount(billObj.dueAmount.toString());
        }
    };

    const handleEasebuzzPayment = async () => {
        const payAmount = Number(customAmount);
        if (!payAmount || payAmount <= 0) {
            alert("Please enter a valid payment amount");
            return;
        }

        setProcessing(true);
        try {
            const targetBillId = selectedBillId || extractedParams.billid || payData?.bill?.id;
            const res = await fetch(`${getBaseURL()}/pay/pay-due`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId: extractedParams.userid || payData?.customer?.id,
                    phone: extractedParams.number || payData?.customer?.phone,
                    billId: targetBillId || undefined,
                    amount: payAmount
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.message || "Failed to initiate payment");

            if (data.accessKey || data.paymentLink) {
                let checkoutUrl = data.paymentLink || `https://${data.env === "prod" ? "pay" : "testpay"}.easebuzz.in/pay/${data.accessKey}`;
                if (typeof window !== "undefined" && window.location.protocol === "https:") {
                    checkoutUrl = checkoutUrl.replace(/^http:/, "https:");
                }
                const sdkUrl = "https://ebz-static.s3.ap-south-1.amazonaws.com/easecheckout/v2.0.0/easebuzz-checkout-v2.min.js";

                const triggerSdk = () => {
                    const EasebuzzCheckout = (window as any).EasebuzzCheckout;
                    if (EasebuzzCheckout && data.accessKey) {
                        setProcessing(false);
                        try {
                            const checkoutObj = new EasebuzzCheckout(data.key || "EASEBUZZ", data.env || "test");
                            checkoutObj.initiatePayment({
                                access_key: data.accessKey,
                                onResponse: async (response: any) => {
                                    setProcessing(false);
                                    const respStatus = (response?.status || "").toLowerCase();

                                    if (respStatus === "user_cancelled" || respStatus === "usercancelled" || respStatus === "cancelled") {
                                        alert("Easebuzz Payment was cancelled. Your bill remains unpaid.");
                                        return;
                                    }

                                    if (respStatus === "failed" || respStatus === "failure" || respStatus === "declined" || respStatus === "bounced") {
                                        alert("Easebuzz Payment failed or was declined. Please try again.");
                                        return;
                                    }

                                    if (respStatus === "success" || respStatus === "charged") {
                                        try {
                                            await fetch(`${getBaseURL()}/pay/verify`, {
                                                method: "POST",
                                                headers: { "Content-Type": "application/json" },
                                                body: JSON.stringify({
                                                    order_id: data.txnid || targetBillId || payData?.bill?.id,
                                                    status: "SUCCESS",
                                                    amount: payAmount,
                                                    txn_id: response.easepayid || response.txnid || response.easebuzz_id
                                                })
                                            });
                                        } catch (e) {
                                            console.error("Pay verify error:", e);
                                        }
                                        setPaymentSuccess(true);
                                        fetchPayData();
                                    }
                                }
                            });
                        } catch (sdkErr) {
                            setPayIframeUrl(checkoutUrl);
                            setShowPayIframeModal(true);
                        }
                    } else {
                        setProcessing(false);
                        setPayIframeUrl(checkoutUrl);
                        setShowPayIframeModal(true);
                    }
                };

                if (!(window as any).EasebuzzCheckout) {
                    const script = document.createElement("script");
                    script.src = sdkUrl;
                    script.async = true;
                    script.onload = triggerSdk;
                    script.onerror = () => {
                        setProcessing(false);
                        setPayIframeUrl(checkoutUrl);
                        setShowPayIframeModal(true);
                    };
                    document.body.appendChild(script);
                } else {
                    triggerSdk();
                }
            } else {
                throw new Error("No payment authorization key returned");
            }
        } catch (err: any) {
            setProcessing(false);
            alert(err.message || "Payment initiation failed");
        }
    };

    const isAmountLocked = useMemo(() => {
        return searchParams.get("lockAmount") === "true" || 
               searchParams.get("locked") === "true" || 
               searchParams.get("fixed") === "true";
    }, [searchParams]);

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4">
                <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mb-4" />
                <p className="text-slate-400 text-sm font-medium tracking-wide">Loading Secure Bill Portal...</p>
            </div>
        );
    }

    if (error || (!payData?.bill && !payData?.totalDue && !payData?.customer)) {
        return (
            <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center">
                <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mb-4">
                    <AlertCircle className="w-8 h-8" />
                </div>
                <h1 className="text-2xl font-black mb-2">Payment Details Not Found</h1>
                <p className="text-slate-400 text-sm max-w-md mb-6">{error || "The bill or customer account parameters could not be verified."}</p>
                <button 
                    onClick={fetchPayData}
                    className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-sm transition-all flex items-center gap-2"
                >
                    <RefreshCw className="w-4 h-4" /> Retry
                </button>
            </div>
        );
    }

    const isSingleBill = Boolean(payData?.bill);
    const bill = payData?.bill;
    const customer = payData?.customer;
    const unpaidOrders = payData?.unpaidOrders || [];
    const isPaid = isSingleBill ? bill?.isPaid : payData?.totalDue <= 0;
    const selectedBill = unpaidOrders.find((b: any) => b.id === selectedBillId);

    return (
        <div className="h-screen bg-[#fbfdfc] dark:bg-[#061512] text-slate-900 dark:text-slate-100 flex flex-col justify-between p-4 sm:p-6 lg:p-10 relative overflow-y-auto font-sans">
            {/* Ambient Website Theme Background Glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-emerald-500/10 dark:bg-emerald-500/15 blur-[140px] rounded-full pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-[400px] h-[300px] bg-teal-500/10 dark:bg-teal-500/15 blur-[120px] rounded-full pointer-events-none" />
            
            <div className="max-w-xl mx-auto w-full space-y-6 relative z-10 py-6">
                
                {/* Brand Header */}
                <div className="flex items-center justify-between pb-4 border-b border-slate-200/80 dark:border-slate-800/80">
                    <div className="flex items-center gap-3.5">
                        <div className="w-11 h-11 rounded-2xl bg-emerald-600 dark:bg-emerald-500 flex items-center justify-center text-white dark:text-slate-950 shadow-lg shadow-emerald-600/20 ring-4 ring-emerald-500/10">
                            <Building className="w-6 h-6 stroke-[2.5]" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white uppercase flex items-center gap-2">
                                Book My Veg
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            </h2>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-bold tracking-wide uppercase">Official Digital Payment Portal</p>
                        </div>
                    </div>
                    <div className="px-3.5 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-full text-emerald-700 dark:text-emerald-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-xs">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> 256-Bit Encrypted
                    </div>
                </div>

                {/* Customer Badge */}
                {customer && (
                    <div className="p-4 bg-white dark:bg-[#0b1c19] border border-slate-200/90 dark:border-emerald-500/20 rounded-2xl flex items-center justify-between shadow-xs">
                        <div className="flex items-center gap-3.5">
                            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-slate-800/80 border border-emerald-100 dark:border-slate-700/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                                <User className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-400 tracking-wider">Account Holder</p>
                                <p className="text-base font-black text-slate-900 dark:text-white tracking-wide">{customer.name || "Valued Customer"}</p>
                            </div>
                        </div>
                        {customer.phone && (
                            <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 dark:text-teal-300 bg-emerald-50 dark:bg-teal-500/10 px-3.5 py-2 rounded-xl border border-emerald-200 dark:border-teal-500/20">
                                <Phone className="w-3.5 h-3.5 text-emerald-600 dark:text-teal-400" />
                                <span>{customer.phone}</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Payment Completed Card */}
                {isPaid || paymentSuccess ? (
                    <div className="p-8 bg-emerald-50/80 dark:bg-gradient-to-b dark:from-emerald-950/40 dark:to-slate-900/60 border border-emerald-200 dark:border-emerald-500/30 rounded-[32px] text-center space-y-4 shadow-xl relative overflow-hidden">
                        <div className="w-20 h-20 bg-emerald-600 dark:bg-emerald-500 rounded-2xl flex items-center justify-center text-white dark:text-slate-950 mx-auto shadow-xl shadow-emerald-600/30 ring-8 ring-emerald-500/10">
                            <Check className="w-10 h-10 stroke-[3]" />
                        </div>
                        <div className="space-y-1">
                            <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight uppercase">
                                {isSingleBill ? "Payment Completed!" : "All Dues Cleared!"}
                            </h2>
                            <p className="text-slate-600 dark:text-slate-400 text-xs max-w-sm mx-auto font-medium">
                                Transaction processed successfully. Your account ledger and statement have been updated.
                            </p>
                        </div>
                        {bill && (
                            <div className="p-4 bg-white dark:bg-slate-950/80 rounded-2xl border border-emerald-100 dark:border-slate-800/80 text-left text-xs space-y-1.5 mt-4 shadow-xs">
                                <p className="text-slate-600 dark:text-slate-400 font-medium flex justify-between"><span>Bill Reference:</span> <span className="text-slate-900 dark:text-white font-mono font-bold">{bill.id}</span></p>
                                <p className="text-slate-600 dark:text-slate-400 font-medium flex justify-between"><span>Total Settled:</span> <span className="text-emerald-600 dark:text-emerald-400 font-bold text-sm">₹{bill.totalAmount.toFixed(2)}</span></p>
                            </div>
                        )}
                    </div>
                ) : (
                    <>
                        {/* Overall Outstanding Summary Card */}
                        <div className="p-6 bg-white dark:bg-slate-900/60 border border-slate-200/90 dark:border-slate-800/80 rounded-[28px] space-y-4 shadow-sm">
                            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800/80 pb-4">
                                <div>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400">Total Outstanding Balance</span>
                                    <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                                        ₹{(payData?.totalDue || bill?.dueAmount || 0).toFixed(2)}
                                    </h3>
                                </div>
                                {unpaidOrders.length > 0 && (
                                    <div className="px-3.5 py-1.5 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-400 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                                        <Tag className="w-3.5 h-3.5" />
                                        {unpaidOrders.length} Pending {unpaidOrders.length === 1 ? "Bill" : "Bills"}
                                    </div>
                                )}
                            </div>

                            {/* CHANGE 1 UI: Click to see pending bills Accordion Button */}
                            {unpaidOrders.length > 0 && (
                                <div className="space-y-3 pt-1">
                                    <button
                                        type="button"
                                        onClick={() => setShowPendingList(!showPendingList)}
                                        className="w-full p-4 bg-emerald-50/70 hover:bg-emerald-100/60 dark:bg-emerald-950/30 dark:hover:bg-emerald-900/40 border border-emerald-200/80 dark:border-emerald-500/30 rounded-2xl flex items-center justify-between transition-all cursor-pointer group shadow-xs"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-xl bg-emerald-600 dark:bg-emerald-500 text-white dark:text-slate-950 flex items-center justify-center font-bold shadow-sm">
                                                <Receipt className="w-5 h-5 stroke-[2.5]" />
                                            </div>
                                            <div className="text-left">
                                                <p className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                                                    Click to see pending bills
                                                    <Sparkles className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
                                                </p>
                                                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                                                    {selectedBillId ? `Selected Bill #${selectedBillId}` : "View invoice details & settle specific bills"}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="px-2.5 py-1 bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-[10px] font-black rounded-lg uppercase tracking-wider">
                                                {unpaidOrders.length} Invoices
                                            </span>
                                            {showPendingList ? (
                                                <ChevronUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400 group-hover:-translate-y-0.5 transition-transform" />
                                            ) : (
                                                <ChevronDown className="w-5 h-5 text-emerald-600 dark:text-emerald-400 group-hover:translate-y-0.5 transition-transform" />
                                            )}
                                        </div>
                                    </button>

                                    {/* Expandable Unpaid Invoices List */}
                                    {showPendingList && (
                                        <div className="space-y-2.5 pt-2 animate-in fade-in slide-in-from-top-2 duration-300">
                                            <div className="flex items-center justify-between px-1">
                                                <p className="text-[11px] font-black text-slate-400 dark:text-slate-400 uppercase tracking-wider">Pending Invoice Breakdown</p>
                                                {selectedBillId && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setSelectedBillId(null);
                                                            setCustomAmount((payData?.totalDue || 0).toString());
                                                        }}
                                                        className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline uppercase tracking-wider"
                                                    >
                                                        Reset to All Dues
                                                    </button>
                                                )}
                                            </div>

                                            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                                                {unpaidOrders.map((ord: any) => {
                                                    const isSelected = selectedBillId === ord.id;
                                                    return (
                                                        <div 
                                                            key={ord.id} 
                                                            className={cn(
                                                                "p-4 rounded-2xl border transition-all flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-xs shadow-xs relative overflow-hidden",
                                                                isSelected 
                                                                    ? "bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-500 dark:border-emerald-400 ring-2 ring-emerald-500/20" 
                                                                    : "bg-slate-50 dark:bg-slate-950/70 border-slate-200/80 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700"
                                                            )}
                                                        >
                                                            {isSelected && (
                                                                <div className="absolute top-0 right-0 bg-emerald-600 dark:bg-emerald-500 text-white dark:text-slate-950 text-[9px] font-black uppercase px-3 py-0.5 rounded-bl-xl tracking-wider flex items-center gap-1">
                                                                    <Check className="w-3 h-3 stroke-[3]" /> Selected
                                                                </div>
                                                            )}
                                                            <div className="space-y-1">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="font-mono font-black text-slate-900 dark:text-white text-sm">#{ord.id}</span>
                                                                    <span className="px-2 py-0.5 bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[9px] font-bold rounded-md uppercase">
                                                                        {ord.paymentStatus}
                                                                    </span>
                                                                </div>
                                                                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                                                                    Created: {new Date(ord.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                                                                </p>
                                                                <div className="flex items-center gap-3 text-[11px] font-bold pt-0.5">
                                                                    <span className="text-slate-500 dark:text-slate-400">Total: ₹{ord.totalAmount.toFixed(2)}</span>
                                                                    <span className="text-slate-500 dark:text-slate-400">Paid: ₹{(ord.paidAmount || 0).toFixed(2)}</span>
                                                                </div>
                                                            </div>
                                                            
                                                            <div className="sm:text-right space-y-2 w-full sm:w-auto">
                                                                <div>
                                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Remaining Due</span>
                                                                    <p className="text-base font-black text-emerald-600 dark:text-emerald-400">₹{ord.dueAmount.toFixed(2)}</p>
                                                                </div>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleSelectBill(ord)}
                                                                    className={cn(
                                                                        "w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-xs",
                                                                        isSelected
                                                                            ? "bg-slate-900 text-white dark:bg-white dark:text-slate-950 hover:opacity-90"
                                                                            : "bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-500 dark:hover:bg-emerald-400 dark:text-slate-950"
                                                                    )}
                                                                >
                                                                    <CreditCard className="w-3.5 h-3.5" />
                                                                    {isSelected ? "Paying This Bill" : `Settle Bill (₹${ord.dueAmount.toFixed(2)})`}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Single Bill Items Breakdown (If single bill URL requested) */}
                        {isSingleBill && bill && bill.items && bill.items.length > 0 && (
                            <div className="p-6 bg-white dark:bg-slate-900/60 border border-slate-200/90 dark:border-slate-800/80 rounded-[28px] space-y-3 shadow-xs">
                                <p className="text-[11px] font-black text-slate-400 dark:text-slate-400 uppercase tracking-wider">Item Breakdown (#{bill.id})</p>
                                <div className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-slate-50/80 dark:bg-slate-950/70 rounded-2xl border border-slate-200/60 dark:border-slate-800/80 p-3.5">
                                    {bill.items.map((item: any) => (
                                        <div key={item.id} className="py-2.5 flex justify-between items-center text-xs">
                                            <div>
                                                <p className="font-bold text-slate-800 dark:text-slate-100">{item.name}</p>
                                                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Qty: {item.quantity} × ₹{item.sellingPrice}</p>
                                            </div>
                                            <span className="font-mono font-bold text-slate-700 dark:text-slate-200 text-sm">₹{(item.quantity * item.sellingPrice).toFixed(2)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* CHANGE 2: Payment Input & Presets Section */}
                        <div className="p-6 bg-white dark:bg-slate-900/80 border border-slate-200/90 dark:border-slate-800/80 rounded-[28px] space-y-5 shadow-md">
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <label className="block text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                        <Tag className="w-3.5 h-3.5 text-emerald-500" />
                                        {selectedBillId ? `Settlement Amount for Bill #${selectedBillId} (₹)` : "Payment Amount (₹)"}
                                    </label>
                                    {isAmountLocked ? (
                                        <span className="text-[10px] font-bold bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 px-2.5 py-0.5 rounded-full border border-amber-200 dark:border-amber-500/20 flex items-center gap-1">
                                            🔒 Fixed Due Amount (Locked)
                                        </span>
                                    ) : (
                                        <span className="text-[10px] font-bold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-500/20">
                                            Custom Input Allowed
                                        </span>
                                    )}
                                </div>

                                <div className="relative">
                                    <input 
                                        type="number"
                                        value={customAmount}
                                        readOnly={isAmountLocked}
                                        onChange={(e) => !isAmountLocked && setCustomAmount(e.target.value)}
                                        placeholder="0.00"
                                        step="0.01"
                                        min="1"
                                        className={cn(
                                            "w-full h-16 border-2 rounded-2xl px-12 text-2xl font-black outline-none transition-all tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none shadow-inner",
                                            isAmountLocked 
                                                ? "bg-slate-100 dark:bg-slate-900 border-amber-300 dark:border-amber-600/50 text-slate-700 dark:text-slate-300 cursor-not-allowed" 
                                                : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-700/80 focus:border-emerald-500 text-slate-900 dark:text-white"
                                        )}
                                    />
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-black text-emerald-600 dark:text-emerald-500">₹</span>
                                    {isAmountLocked && (
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider bg-amber-100/80 dark:bg-amber-950/60 px-2 py-1 rounded-md border border-amber-300/60 dark:border-amber-700/60">
                                            Exact Amount
                                        </span>
                                    )}
                                </div>

                                {/* Preset Amount Buttons */}
                                {!isAmountLocked && (
                                    <div className="flex flex-wrap gap-2 pt-1">
                                        <button
                                            type="button"
                                            onClick={() => setCustomAmount((selectedBill ? selectedBill.dueAmount : (payData?.totalDue || 0)).toString())}
                                            className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl transition-all cursor-pointer border border-slate-200/80 dark:border-slate-700"
                                        >
                                            Full Due (₹{(selectedBill ? selectedBill.dueAmount : (payData?.totalDue || 0)).toFixed(2)})
                                        </button>
                                        {[500, 200, 100, 50, 1].map((amt) => (
                                            <button
                                                key={amt}
                                                type="button"
                                                onClick={() => setCustomAmount(amt.toString())}
                                                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl transition-all cursor-pointer border border-slate-200/60 dark:border-slate-700/60"
                                            >
                                                ₹{amt}
                                            </button>
                                        ))}
                                    </div>
                                )}

                                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed pt-1">
                                    {isAmountLocked 
                                        ? "🔒 Exact Due Amount: This payment link has been locked to prevent any modifications to the required settlement amount."
                                        : "💡 Automatic Ledger Sync: Any input amount paid creates a verified transaction ID, records a credit entry in your account ledger, and updates unpaid invoice statuses."}
                                </p>
                            </div>

                            <button
                                onClick={handleEasebuzzPayment}
                                disabled={processing || !customAmount || Number(customAmount) <= 0}
                                className="w-full h-16 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white dark:text-slate-950 font-black text-base uppercase tracking-wider rounded-2xl shadow-xl shadow-emerald-600/20 dark:shadow-emerald-500/25 transition-all active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-3 cursor-pointer"
                            >
                                {processing ? (
                                    <>
                                        <Loader2 className="w-6 h-6 animate-spin" /> Processing Payment...
                                    </>
                                ) : (
                                    <>
                                        <CreditCard className="w-5 h-5 stroke-[2.5]" /> Pay ₹{Number(customAmount || 0).toFixed(2)} via Easebuzz
                                    </>
                                )}
                            </button>
                        </div>
                    </>
                )}

                {/* Footer Security Note */}
                <div className="text-center pt-2 text-[11px] text-slate-400 dark:text-slate-400 font-semibold tracking-wide">
                    Protected by Easebuzz Gateway • Book My Veg Official Payment Desk
                </div>

                {/* In-App Payment Gateway Popup Modal Overlay */}
                {showPayIframeModal && (
                    <div className="fixed inset-0 z-[99999] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col">
                            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950/60">
                                <div className="flex items-center gap-2">
                                    <CreditCard className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                                    <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Easebuzz Secure Checkout</h3>
                                </div>
                                <button
                                    onClick={() => setShowPayIframeModal(false)}
                                    className="px-3.5 py-1.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
                                >
                                    Close / X
                                </button>
                            </div>
                            <div className="w-full h-[520px] bg-slate-100 dark:bg-slate-950 relative">
                                {payIframeUrl ? (
                                    <iframe
                                        src={payIframeUrl}
                                        className="w-full h-full border-none"
                                        title="Easebuzz Payment Portal"
                                    />
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-slate-400">
                                        <Loader2 className="w-8 h-8 text-emerald-600 dark:text-emerald-500 animate-spin mb-2" />
                                        <p className="text-xs">Loading Payment Portal...</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}

export default function PayPage(props: PayPageProps) {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
            </div>
        }>
            <PayContent {...props} />
        </Suspense>
    );
}
