"use client";

import { useState, useEffect } from "react";
import api from "@/services/api";
import { toast } from "sonner";
import { 
    Truck, 
    Package, 
    MapPin, 
    Phone, 
    CheckCircle2, 
    QrCode, 
    AlertTriangle, 
    ExternalLink, 
    CreditCard, 
    Banknote, 
    Layers, 
    Clock, 
    Store, 
    User, 
    ShieldCheck, 
    Camera, 
    RotateCcw, 
    X, 
    ChevronRight,
    Loader2,
    Check,
    Navigation
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import QRScanner from "@/components/ui/qr-scanner";
import { useUserStore } from "@/store/useUserStore";

export default function DriverDashboard() {
    const { user } = useUserStore();
    const [orders, setOrders] = useState<any[]>([]);
    const [returnsList, setReturnsList] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<"DELIVERIES" | "RETURNS">("DELIVERIES");
    const [loading, setLoading] = useState(true);

    // QR Claim states
    const [showClaimScanner, setShowClaimScanner] = useState(false);
    const [manualClaimId, setManualClaimId] = useState("");
    const [isClaiming, setIsClaiming] = useState(false);

    // Customer Dues Modal
    const [selectedCustomerDues, setSelectedCustomerDues] = useState<any>(null);
    const [loadingDues, setLoadingDues] = useState(false);
    const [showDuesModal, setShowDuesModal] = useState(false);

    // Cash OTP Collection Modal
    const [showCashModal, setShowCashModal] = useState(false);
    const [cashOrder, setCashOrder] = useState<any>(null);
    const [cashAmount, setCashAmount] = useState<number | string>("");
    const [cashOtpStep, setCashOtpStep] = useState<"AMOUNT" | "OTP">("AMOUNT");
    const [cashOtp, setCashOtp] = useState("");
    const [isSendingCashOtp, setIsSendingCashOtp] = useState(false);
    const [isVerifyingCashOtp, setIsVerifyingCashOtp] = useState(false);

    // Easebuzz Online / Partial Payment Modal
    const [showEasebuzzModal, setShowEasebuzzModal] = useState(false);
    const [easebuzzOrder, setEasebuzzOrder] = useState<any>(null);
    const [easebuzzAmount, setEasebuzzAmount] = useState<number | string>("");
    const [isInitiatingEasebuzz, setIsInitiatingEasebuzz] = useState(false);

    // Mark Delivered Modal
    const [showDeliverModal, setShowDeliverModal] = useState(false);
    const [deliveringOrder, setDeliveringOrder] = useState<any>(null);
    const [deliverPhoto, setDeliverPhoto] = useState<string>("");
    const [deliverNotes, setDeliverNotes] = useState<string>("");
    const [isSubmittingDeliver, setIsSubmittingDeliver] = useState(false);

    const fetchDashboardData = async () => {
        setLoading(true);
        try {
            const [ordersRes, returnsRes] = await Promise.all([
                api.get("/orders/driver/assigned"),
                api.get("/orders/driver/returns").catch(() => ({ data: { returns: [] } }))
            ]);
            setOrders(ordersRes.data.data || ordersRes.data || []);
            setReturnsList(returnsRes.data.returns || returnsRes.data || []);
        } catch (error) {
            toast.error("Failed to sync fleet assignments");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDashboardData();
    }, []);

    // 1. Claim Delivery via QR
    const handleClaimQr = async (scannedData: string) => {
        setShowClaimScanner(false);
        if (!scannedData.trim()) return;

        setIsClaiming(true);
        try {
            const res = await api.post("/orders/driver/claim-qr", {
                qrData: scannedData.trim()
            });
            toast.success("Delivery Claimed Successfully!", {
                description: `Order #${res.data.order?.id?.slice(-6).toUpperCase()} assigned to your active route.`
            });
            fetchDashboardData();
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Failed to claim delivery. Please check if packer validated this bill.");
        } finally {
            setIsClaiming(false);
        }
    };

    const handleManualClaim = (e: React.FormEvent) => {
        e.preventDefault();
        if (!manualClaimId.trim()) return;
        handleClaimQr(manualClaimId.trim());
        setManualClaimId("");
    };

    // 2. View All Customer Dues
    const handleViewCustomerDues = async (order: any) => {
        const customerId = order.userId || order.user?.id;
        if (!customerId) {
            toast.error("Customer ID not found for dues inquiry");
            return;
        }

        setLoadingDues(true);
        setShowDuesModal(true);
        try {
            const res = await api.get(`/orders/customer/${customerId}/dues`);
            setSelectedCustomerDues(res.data);
        } catch (error: any) {
            toast.error("Failed to load customer dues ledger");
            setShowDuesModal(false);
        } finally {
            setLoadingDues(false);
        }
    };

    // 3. Cash Collection with WhatsApp OTP Flow
    const openCashModalForOrder = (order: any, defaultAmount?: number) => {
        const orderDue = Number(order.totalAmount || 0) - Number(order.cashCollected || 0) - Number(order.easebuzzCollected || 0);
        setCashOrder(order);
        setCashAmount(defaultAmount !== undefined ? defaultAmount : Math.max(0, orderDue));
        setCashOtpStep("AMOUNT");
        setCashOtp("");
        setShowCashModal(true);
    };

    const handleSendCashOtp = async () => {
        if (!cashAmount || Number(cashAmount) <= 0) {
            toast.error("Please enter a valid cash amount to collect");
            return;
        }

        setIsSendingCashOtp(true);
        try {
            await api.post("/orders/driver/send-cash-otp", {
                orderId: cashOrder.id,
                customerId: cashOrder.userId || cashOrder.user?.id,
                amount: Number(cashAmount)
            });
            toast.success("Cash Collection OTP sent to customer WhatsApp!");
            setCashOtpStep("OTP");
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Failed to send cash verification OTP");
        } finally {
            setIsSendingCashOtp(false);
        }
    };

    const handleVerifyCashOtp = async () => {
        if (!cashOtp || cashOtp.length < 4) {
            toast.error("Please enter the 6-digit verification code");
            return;
        }

        setIsVerifyingCashOtp(true);
        try {
            await api.post("/orders/driver/verify-cash-otp", {
                orderId: cashOrder.id,
                customerId: cashOrder.userId || cashOrder.user?.id,
                amount: Number(cashAmount),
                otp: cashOtp.trim()
            });

            toast.success(`Cash Collection of ₹${Number(cashAmount).toFixed(2)} Verified & Recorded!`);
            setShowCashModal(false);
            fetchDashboardData();
            if (showDuesModal && selectedCustomerDues) {
                handleViewCustomerDues(cashOrder);
            }
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Invalid OTP code entered");
        } finally {
            setIsVerifyingCashOtp(false);
        }
    };

    // 4. Easebuzz Digital Payment & Partial Payment via Iframe
    const openEasebuzzModalForOrder = (order: any, defaultAmount?: number) => {
        const orderDue = Number(order.totalAmount || 0) - Number(order.cashCollected || 0) - Number(order.easebuzzCollected || 0);
        setEasebuzzOrder(order);
        setEasebuzzAmount(defaultAmount !== undefined ? defaultAmount : Math.max(0, orderDue));
        setShowEasebuzzModal(true);
    };

    const handleInitiateEasebuzz = async () => {
        if (!easebuzzAmount || Number(easebuzzAmount) <= 0) {
            toast.error("Please enter a valid amount for digital collection");
            return;
        }

        setIsInitiatingEasebuzz(true);
        try {
            const res = await api.post(`/payments/${easebuzzOrder.id}/generate-link`, {
                amount: Number(easebuzzAmount)
            });

            const data = res.data;
            if (data.iframe && data.accessKey) {
                // Ensure Easebuzz checkout script is loaded
                const launchCheckout = () => {
                    const EasebuzzCheckout = (window as any).EasebuzzCheckout;
                    if (EasebuzzCheckout) {
                        const checkout = new EasebuzzCheckout(data.key || "EASEBUZZ", data.env || "test");
                        checkout.initiatePayment({
                            access_key: data.accessKey,
                            onResponse: (response: any) => {
                                if (response.status === "success") {
                                    toast.success("Easebuzz Digital Payment Confirmed!");
                                    setShowEasebuzzModal(false);
                                    fetchDashboardData();
                                } else {
                                    toast.error(response.error_desc || "Payment was not completed");
                                }
                            }
                        });
                    } else {
                        toast.error("Easebuzz Checkout SDK could not be initialized");
                    }
                };

                if (!(window as any).EasebuzzCheckout) {
                    const script = document.createElement("script");
                    script.src = "https://ebz-static.s3.ap-south-1.amazonaws.com/easecheckout/v2.0.0/easebuzz-checkout-v2.min.js";
                    script.onload = launchCheckout;
                    document.body.appendChild(script);
                } else {
                    launchCheckout();
                }
            } else if (data.paymentLink) {
                window.open(data.paymentLink, "_blank");
                toast.info("Opened payment gateway link");
                setShowEasebuzzModal(false);
            }
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Failed to initiate Easebuzz checkout");
        } finally {
            setIsInitiatingEasebuzz(false);
        }
    };

    // 5. Mark Delivered Flow
    const openDeliverModalForOrder = (order: any) => {
        setDeliveringOrder(order);
        setDeliverPhoto("https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?q=80&w=2070&auto=format&fit=crop");
        setDeliverNotes("");
        setShowDeliverModal(true);
    };

    const handleConfirmDelivery = async () => {
        setIsSubmittingDeliver(true);
        try {
            await api.patch(`/orders/driver/${deliveringOrder.id}/deliver`, {
                deliveryPhoto: deliverPhoto,
                notes: deliverNotes
            });

            toast.success("Order Marked as DELIVERED!");
            setShowDeliverModal(false);
            fetchDashboardData();
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Failed to complete delivery");
        } finally {
            setIsSubmittingDeliver(false);
        }
    };

    return (
        <div className="space-y-6 pb-28 animate-in fade-in duration-500 max-w-2xl mx-auto">
            {/* Driver Fleet Header */}
            <div className="bg-white p-6 rounded-[2.5rem] shadow-xl border border-emerald-100 relative overflow-hidden">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                            <Truck className="h-5 w-5 text-emerald-600" />
                            <h2 className="text-xl font-black text-slate-900 tracking-tight">Delivery Fleet Hub</h2>
                        </div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                            Driver: <span className="text-emerald-700 font-black">{user?.name || "Delivery Partner"}</span>
                        </p>
                    </div>

                    <Button 
                        onClick={() => setShowClaimScanner(true)}
                        className="w-full sm:w-auto h-13 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-200 flex items-center gap-2 active:scale-95"
                    >
                        <QrCode className="h-4 w-4" />
                        Scan Bill QR to Claim
                    </Button>
                </div>
            </div>

            {/* Quick Bill ID Input Option */}
            <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm">
                <form onSubmit={handleManualClaim} className="flex gap-2">
                    <Input 
                        type="text" 
                        placeholder="Scan or enter POS Bill / Order ID to claim..."
                        value={manualClaimId}
                        onChange={(e) => setManualClaimId(e.target.value)}
                        className="h-13 rounded-2xl bg-slate-50 border-none text-xs font-bold pl-4 shadow-inner"
                    />
                    <Button 
                        type="submit" 
                        disabled={!manualClaimId.trim() || isClaiming}
                        className="h-13 px-6 rounded-2xl bg-slate-900 text-white font-black text-xs uppercase tracking-wider shrink-0"
                    >
                        {isClaiming ? <Loader2 className="h-4 w-4 animate-spin" /> : "Claim"}
                    </Button>
                </form>
            </div>

            {/* Tabs: Active Deliveries vs Returns */}
            <div className="flex bg-slate-200/70 p-1.5 rounded-2xl">
                <button
                    type="button"
                    onClick={() => setActiveTab("DELIVERIES")}
                    className={cn(
                        "flex-1 py-3 text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2",
                        activeTab === "DELIVERIES" ? "bg-white text-slate-900 shadow-md" : "text-slate-500 hover:text-slate-800"
                    )}
                >
                    <Package className="h-4 w-4 text-emerald-600" />
                    My Deliveries ({orders.length})
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab("RETURNS")}
                    className={cn(
                        "flex-1 py-3 text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2",
                        activeTab === "RETURNS" ? "bg-white text-slate-900 shadow-md" : "text-slate-500 hover:text-slate-800"
                    )}
                >
                    <RotateCcw className="h-4 w-4 text-amber-600" />
                    Return Tasks ({returnsList.length})
                </button>
            </div>

            {/* Active Deliveries List */}
            {activeTab === "DELIVERIES" ? (
                <div className="space-y-4">
                    {loading ? (
                        <div className="p-12 text-center bg-white rounded-3xl border border-slate-100 shadow-sm">
                            <Loader2 className="h-8 w-8 animate-spin mx-auto text-emerald-600 mb-3" />
                            <p className="text-xs font-black uppercase tracking-widest text-slate-400">Syncing Delivery Assignments...</p>
                        </div>
                    ) : orders.length === 0 ? (
                        <div className="p-12 text-center bg-white rounded-[2.5rem] border border-slate-100 shadow-sm space-y-3">
                            <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto shadow-inner">
                                <Truck className="h-8 w-8" />
                            </div>
                            <h4 className="text-base font-bold text-slate-900">No Active Deliveries</h4>
                            <p className="text-xs text-slate-400 max-w-xs mx-auto font-medium">
                                Scan the QR code on any POS printed bill above to claim a delivery.
                            </p>
                        </div>
                    ) : (
                        orders.map((order) => {
                            const isPaid = order.isPaid || order.paymentStatus === "PAID" || order.paymentStatus === "COMPLETED";
                            const cashColl = Number(order.cashCollected || 0);
                            const easebuzzColl = Number(order.easebuzzCollected || 0);
                            const totalBill = Number(order.totalAmount || 0);
                            const billDue = Math.max(0, totalBill - cashColl - easebuzzColl);
                            const custAddress = (order.shippingAddress as any)?.address || order.shippingAddress || order.user?.addresses?.[0]?.fullAddress || order.user?.profileAddress || "Store Delivery Point";
                            const custPhone = (order.shippingAddress as any)?.phone || order.user?.phone;
                            const custName = (order.shippingAddress as any)?.name || order.user?.name || "Valued Customer";

                            return (
                                <div 
                                    key={order.id}
                                    className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 space-y-5"
                                >
                                    {/* Order Header & Status */}
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="space-y-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-black uppercase text-slate-900 tracking-wider">
                                                    #{order.id.slice(-8).toUpperCase()}
                                                </span>
                                                <span className={cn(
                                                    "px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest",
                                                    order.status === "DELIVERED" ? "bg-emerald-100 text-emerald-800" : "bg-blue-100 text-blue-800"
                                                )}>
                                                    {order.status}
                                                </span>
                                            </div>
                                            <h4 className="text-base font-black text-slate-900 truncate">{custName}</h4>
                                        </div>

                                        <div className="text-right shrink-0">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Current Bill Due</p>
                                            <p className={cn(
                                                "text-lg font-black",
                                                billDue > 0 ? "text-rose-600" : "text-emerald-600"
                                            )}>
                                                ₹{billDue.toFixed(2)}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Store Origin Info */}
                                    {order.location && (
                                        <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between text-xs">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <Store className="h-4 w-4 text-slate-400 shrink-0" />
                                                <div className="truncate">
                                                    <span className="font-black text-slate-800 block text-[11px]">{order.location.name}</span>
                                                    <span className="text-[10px] text-slate-400 truncate">{order.location.address}</span>
                                                </div>
                                            </div>
                                            {order.location.phone && (
                                                <a 
                                                    href={`tel:${order.location.phone}`}
                                                    className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-black uppercase text-slate-700 flex items-center gap-1 shrink-0"
                                                >
                                                    <Phone className="h-3 w-3" /> Call Store
                                                </a>
                                            )}
                                        </div>
                                    )}

                                    {/* Customer Details & Navigation */}
                                    <div className="p-4 bg-emerald-50/40 border border-emerald-100 rounded-2xl space-y-3">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="space-y-0.5 min-w-0">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-800 flex items-center gap-1">
                                                    <MapPin className="h-3.5 w-3.5 text-emerald-600" /> Delivery Address
                                                </p>
                                                <p className="text-xs font-bold text-slate-800 leading-snug">{custAddress}</p>
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap gap-2 pt-1">
                                            {custPhone && (
                                                <a
                                                    href={`tel:${custPhone}`}
                                                    className="px-3 py-2 bg-white border border-emerald-200 rounded-xl text-xs font-black text-emerald-800 flex items-center gap-1.5 shadow-sm active:scale-95"
                                                >
                                                    <Phone className="h-3.5 w-3.5 text-emerald-600" /> Call {custPhone}
                                                </a>
                                            )}
                                            <a
                                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(custAddress)}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm active:scale-95"
                                            >
                                                <Navigation className="h-3.5 w-3.5" /> Navigate in Maps
                                            </a>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleViewCustomerDues(order)}
                                                className="h-9 px-3 rounded-xl border-emerald-300 text-emerald-900 font-black text-[11px] uppercase tracking-wider bg-white shadow-sm ml-auto"
                                            >
                                                View All Due
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Packer Verification Badge & Items Summary */}
                                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-slate-500 pt-1">
                                        <div className="flex items-center gap-1.5">
                                            <ShieldCheck className="h-4 w-4 text-blue-600" />
                                            <span>Packed by: <strong className="text-slate-800">{order.packer?.name || "Store Packer"}</strong></span>
                                        </div>
                                        <span className="text-[11px] text-slate-400">
                                            {order.items?.length || 0} Products Packed
                                        </span>
                                    </div>

                                    {/* Payment Collections & Action Buttons */}
                                    <div className="pt-3 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-3 gap-2">
                                        {/* Collect Cash Button */}
                                        <Button
                                            onClick={() => openCashModalForOrder(order)}
                                            className="h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md shadow-emerald-100 active:scale-95"
                                        >
                                            <Banknote className="h-4 w-4" /> Collect Cash
                                        </Button>

                                        {/* Easebuzz Digital Pay Button */}
                                        <Button
                                            onClick={() => openEasebuzzModalForOrder(order)}
                                            className="h-12 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md shadow-indigo-100 active:scale-95"
                                        >
                                            <CreditCard className="h-4 w-4" /> Easebuzz Pay
                                        </Button>

                                        {/* Mark Delivered Button */}
                                        <Button
                                            onClick={() => openDeliverModalForOrder(order)}
                                            variant="outline"
                                            className="col-span-2 sm:col-span-1 h-12 rounded-xl border-2 border-slate-900 bg-slate-900 hover:bg-black text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 active:scale-95"
                                        >
                                            <Check className="h-4 w-4 text-emerald-400" /> Mark Delivered
                                        </Button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            ) : (
                /* Returns Queue */
                <div className="space-y-4">
                    {returnsList.length === 0 ? (
                        <div className="p-12 text-center bg-white rounded-[2.5rem] border border-slate-100 shadow-sm space-y-3">
                            <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-3xl flex items-center justify-center mx-auto shadow-inner">
                                <RotateCcw className="h-8 w-8" />
                            </div>
                            <h4 className="text-base font-bold text-slate-900">No Return Tasks</h4>
                            <p className="text-xs text-slate-400 max-w-xs mx-auto font-medium">
                                Any returned orders will be routed here for return pickup.
                            </p>
                        </div>
                    ) : (
                        returnsList.map((retOrder) => (
                            <div key={retOrder.id} className="bg-white rounded-[2rem] p-6 border border-amber-200 shadow-sm space-y-3">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <span className="text-[10px] font-black uppercase tracking-widest text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                                            Return Task #{retOrder.id.slice(-6).toUpperCase()}
                                        </span>
                                        <h4 className="text-base font-black text-slate-900 mt-1">{retOrder.user?.name}</h4>
                                        <p className="text-xs text-slate-500 font-bold">{retOrder.user?.phone}</p>
                                    </div>
                                    <span className="text-sm font-black text-slate-900">₹{Number(retOrder.totalAmount).toFixed(2)}</span>
                                </div>
                                {retOrder.returnReason && (
                                    <p className="text-xs bg-amber-50 p-2.5 rounded-xl text-amber-900 font-medium border border-amber-100">
                                        Reason: {retOrder.returnReason}
                                    </p>
                                )}
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* MODAL 1: VIEW ALL DUE (Total Customer Dues) */}
            {showDuesModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-md max-h-[90vh] rounded-[2.5rem] shadow-2xl border border-slate-100 flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <div>
                                <h3 className="text-lg font-black text-slate-900">Customer Dues Statement</h3>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">
                                    {selectedCustomerDues?.customer?.name || "Customer Ledger"}
                                </p>
                            </div>
                            <button onClick={() => setShowDuesModal(false)} className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto space-y-6 flex-1">
                            {loadingDues ? (
                                <div className="p-12 text-center">
                                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-emerald-600 mb-2" />
                                    <p className="text-xs font-bold text-slate-400">Loading dues breakdown...</p>
                                </div>
                            ) : (
                                <>
                                    {/* Big Total Due Card */}
                                    <div className="p-6 bg-slate-900 text-white rounded-[2rem] space-y-1 shadow-xl">
                                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">Total Outstanding Due</p>
                                        <p className="text-3xl font-black tabular-nums">
                                            ₹{Number(selectedCustomerDues?.totalOutstandingDue || 0).toFixed(2)}
                                        </p>
                                        <p className="text-[10px] text-slate-400 font-medium">
                                            Across {selectedCustomerDues?.dueOrders?.length || 0} unpaid or partial bills
                                        </p>
                                    </div>

                                    {/* Itemized Unpaid Bills List */}
                                    <div className="space-y-2.5">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Unpaid Invoices</p>
                                        {selectedCustomerDues?.dueOrders?.map((b: any) => (
                                            <div key={b.id} className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between text-xs">
                                                <div>
                                                    <span className="font-black text-slate-900 block">#{b.id.slice(-8).toUpperCase()}</span>
                                                    <span className="text-[10px] text-slate-400">{new Date(b.createdAt).toLocaleDateString()}</span>
                                                </div>
                                                <div className="text-right">
                                                    <span className="text-rose-600 font-black block">Due: ₹{Number(b.remainingDue).toFixed(2)}</span>
                                                    <span className="text-[9px] text-slate-400">Total: ₹{Number(b.totalAmount).toFixed(2)}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
                            <Button 
                                onClick={() => {
                                    setShowDuesModal(false);
                                    if (selectedCustomerDues?.dueOrders?.[0]) {
                                        openCashModalForOrder(selectedCustomerDues.dueOrders[0], Number(selectedCustomerDues.totalOutstandingDue));
                                    }
                                }}
                                className="flex-1 h-13 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider shadow-md shadow-emerald-200"
                            >
                                Collect All Cash
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL 2: CASH COLLECTION WITH WHATSAPP OTP */}
            {showCashModal && cashOrder && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl border border-slate-100 p-6 space-y-6 animate-in zoom-in-95 duration-300">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-black text-slate-900">Cash Payment Collection</h3>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">WhatsApp OTP Verified</p>
                            </div>
                            <button onClick={() => setShowCashModal(false)} className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {cashOtpStep === "AMOUNT" ? (
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Amount to Collect (₹)</Label>
                                    <Input 
                                        type="number"
                                        value={cashAmount}
                                        onChange={(e) => setCashAmount(e.target.value)}
                                        className="h-14 rounded-2xl bg-slate-50 border-none text-2xl font-black text-slate-900 px-4"
                                        placeholder="0.00"
                                        autoFocus
                                    />
                                </div>
                                <p className="text-xs text-slate-500 font-medium">
                                    An authorization OTP will be sent directly to the customer's WhatsApp mobile before marking cash as collected.
                                </p>
                                <Button 
                                    onClick={handleSendCashOtp}
                                    disabled={isSendingCashOtp || !cashAmount || Number(cashAmount) <= 0}
                                    className="w-full h-14 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-200"
                                >
                                    {isSendingCashOtp ? <Loader2 className="h-5 w-5 animate-spin" /> : "Send Customer OTP"}
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 text-center space-y-1">
                                    <p className="text-[10px] font-black uppercase text-emerald-800 tracking-wider">Collecting Amount</p>
                                    <p className="text-2xl font-black text-emerald-950">₹{Number(cashAmount).toFixed(2)}</p>
                                </div>

                                <div className="space-y-2 text-center">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Customer WhatsApp OTP</Label>
                                    <Input 
                                        type="text"
                                        placeholder="• • • • • •"
                                        value={cashOtp}
                                        onChange={(e) => setCashOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                        className="h-16 rounded-2xl bg-slate-50 border-none text-center text-3xl font-black tracking-[0.4em]"
                                        autoFocus
                                    />
                                </div>

                                <Button 
                                    onClick={handleVerifyCashOtp}
                                    disabled={isVerifyingCashOtp || cashOtp.length < 4}
                                    className="w-full h-14 rounded-2xl bg-slate-900 hover:bg-black text-white font-black text-xs uppercase tracking-widest shadow-xl shadow-slate-200"
                                >
                                    {isVerifyingCashOtp ? <Loader2 className="h-5 w-5 animate-spin" /> : "Verify & Complete Cash Payment"}
                                </Button>

                                <button 
                                    type="button"
                                    onClick={() => setCashOtpStep("AMOUNT")}
                                    className="w-full text-center text-xs font-bold text-slate-400 hover:text-slate-600"
                                >
                                    Change Amount
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* MODAL 3: EASEBUZZ DIGITAL & PARTIAL PAYMENT */}
            {showEasebuzzModal && easebuzzOrder && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl border border-slate-100 p-6 space-y-6 animate-in zoom-in-95 duration-300">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-black text-slate-900">Easebuzz Payment</h3>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-600">UPI, Card & Netbanking</p>
                            </div>
                            <button onClick={() => setShowEasebuzzModal(false)} className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Payment Amount (Full / Partial ₹)</Label>
                                <Input 
                                    type="number"
                                    value={easebuzzAmount}
                                    onChange={(e) => setEasebuzzAmount(e.target.value)}
                                    className="h-14 rounded-2xl bg-slate-50 border-none text-2xl font-black text-slate-900 px-4"
                                    placeholder="0.00"
                                />
                            </div>

                            {/* Quick Presets */}
                            <div className="flex gap-2">
                                {[500, 1000, 2000].map(amt => (
                                    <button
                                        key={amt}
                                        type="button"
                                        onClick={() => setEasebuzzAmount(amt)}
                                        className="flex-1 py-2 rounded-xl bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-xs font-bold text-slate-700 transition-all"
                                    >
                                        ₹{amt}
                                    </button>
                                ))}
                            </div>

                            <p className="text-xs text-slate-500 font-medium">
                                Opens Easebuzz secure payment modal directly on screen for instantaneous UPI QR or card payment.
                            </p>

                            <Button 
                                onClick={handleInitiateEasebuzz}
                                disabled={isInitiatingEasebuzz || !easebuzzAmount || Number(easebuzzAmount) <= 0}
                                className="w-full h-14 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-200"
                            >
                                {isInitiatingEasebuzz ? <Loader2 className="h-5 w-5 animate-spin" /> : "Pay via Easebuzz Checkout"}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL 4: MARK DELIVERED WITH PHOTO */}
            {showDeliverModal && deliveringOrder && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl border border-slate-100 p-6 space-y-6 animate-in zoom-in-95 duration-300">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-black text-slate-900">Complete Delivery</h3>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">Handover Proof</p>
                            </div>
                            <button onClick={() => setShowDeliverModal(false)} className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Delivery Photo Confirmation</Label>
                                <div className="h-40 rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50/20 overflow-hidden relative group flex items-center justify-center">
                                    {deliverPhoto ? (
                                        <img src={deliverPhoto} alt="Delivery Handover Proof" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="flex flex-col items-center gap-2 text-slate-400">
                                            <Camera className="h-8 w-8" />
                                            <span className="text-[10px] font-bold uppercase tracking-wider">Tap to Capture Photo</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-1">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Delivery Notes</Label>
                                <Input 
                                    placeholder="Handed over to customer / security..."
                                    value={deliverNotes}
                                    onChange={(e) => setDeliverNotes(e.target.value)}
                                    className="h-12 rounded-xl bg-slate-50 text-xs font-bold"
                                />
                            </div>

                            <Button 
                                onClick={handleConfirmDelivery}
                                disabled={isSubmittingDeliver}
                                className="w-full h-14 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-200"
                            >
                                {isSubmittingDeliver ? <Loader2 className="h-5 w-5 animate-spin" /> : "Confirm Order Delivered ✓"}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* QR Scanner to Claim */}
            {showClaimScanner && (
                <QRScanner 
                    title="Scan Bill QR to Claim Delivery"
                    onScan={handleClaimQr}
                    onClose={() => setShowClaimScanner(false)}
                />
            )}
        </div>
    );
}
