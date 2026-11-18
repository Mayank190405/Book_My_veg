"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { useCartStore } from "@/store/useCartStore";
import { useUserStore } from "@/store/useUserStore";
import { useRouter } from "next/navigation";
import { createOrder } from "@/services/orderService";
import api from "@/services/api";
import { getAddresses, Address } from "@/services/addressService";
import {
    Loader2, Plus, MapPin, ArrowRight, ChevronLeft, Info,
    CreditCard, Wallet, ShoppingBag, Clock, ChevronRight, Zap, CheckCircle2, ShieldCheck, ChevronDown, Check
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import AddressForm from "@/components/features/AddressForm";
import { useQuery } from "@tanstack/react-query";
import AuthGuard from "@/components/auth/AuthGuard";
import DeliverySlotPicker from "@/components/checkout/DeliverySlotPicker";
import { cn } from "@/lib/utils";
import Image from "next/image";

export default function CheckoutPage() {
    const router = useRouter();
    const { items, totalPrice: rawTotalPrice, totalItems, clearCart, couponCode, discount: rawDiscount } = useCartStore();
    const { user, activeStore } = useUserStore();

    const totalPrice = Number(rawTotalPrice) || 0;
    const discount = Number(rawDiscount) || 0;

    const deliveryFee = totalPrice >= 249 ? 0 : 40;
    const grandTotal = Math.max(0, totalPrice + deliveryFee - discount);

    const [loading, setLoading] = useState(false);
    const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
    const [isAddressDialogOpen, setIsAddressDialogOpen] = useState(false);
    const [isAddressListOpen, setIsAddressListOpen] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState<"COD" | "ONLINE">("COD");
    const [deliveryInfo, setDeliveryInfo] = useState<{ date: string; time: string; mode: "INSTANT" | "SCHEDULED" } | null>(null);

    // Step configuration: "address" or "payment"
    const [currentStep, setCurrentStep] = useState<"address" | "payment">("address");
    const [isOrderSummaryExpanded, setIsOrderSummaryExpanded] = useState(true);
    const [deliveryInstructions, setDeliveryInstructions] = useState("");
    const [isInstructionsOpen, setIsInstructionsOpen] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const [eligibility, setEligibility] = useState<{
        codAllowed: boolean;
        reasons: string[];
        onlineAllowed: boolean;
        nextOrderIndex: number;
        advanceAmount: number;
        codAmount: number;
    } | null>(null);
    const [eligibilityLoading, setEligibilityLoading] = useState(false);

    useEffect(() => {
        const fetchEligibility = async () => {
            if (currentStep !== "payment" || !user) return;
            setEligibilityLoading(true);
            try {
                const res = await api.get(`/payments/eligibility?amount=${grandTotal}`);
                setEligibility(res.data);

                // If COD is not allowed, default to ONLINE
                if (res.data && !res.data.codAllowed) {
                    setPaymentMethod("ONLINE");
                }
            } catch (err) {
                console.error("Failed to fetch payment eligibility:", err);
            } finally {
                setEligibilityLoading(false);
            }
        };
        fetchEligibility();
    }, [currentStep, grandTotal, user]);

    const { data: addresses, refetch: refetchAddresses } = useQuery({
        queryKey: ["addresses"],
        queryFn: getAddresses,
        enabled: !!user,
    });

    useEffect(() => {
        if (addresses && !selectedAddressId) {
            const defaultAddr = addresses.find((a: Address) => a.isDefault);
            if (defaultAddr) setSelectedAddressId(defaultAddr.id);
            else if (addresses.length > 0) setSelectedAddressId(addresses[0].id);
        }
    }, [addresses, selectedAddressId]);

    const handlePlaceOrder = async (method: "COD" | "ONLINE") => {
        if (!selectedAddressId || !deliveryInfo) {
            toast.error("Please select address and delivery slot");
            return;
        }
        const selectedAddr = addresses?.find((a: Address) => a.id === selectedAddressId);
        if (!selectedAddr) return;
        setLoading(true);
        try {
            const order = await createOrder({
                address: {
                    fullAddress: selectedAddr.fullAddress,
                    landmark: selectedAddr.landmark,
                    type: selectedAddr.type,
                    city: selectedAddr.city,
                    state: selectedAddr.state,
                    pincode: selectedAddr.pincode,
                    name: selectedAddr.name,
                    phone: selectedAddr.phone,
                },
                paymentMethod: method,
                items: items.map((i: any) => ({
                    productId: i.productId,
                    quantity: Number(i.quantity),
                    price: Number(i.price),
                    variantId: i.variantId,
                })),
                totalAmount: grandTotal,
                deliveryCharge: deliveryFee,
                deliverySlot: deliveryInfo.time,
                deliveryDate: deliveryInfo.date,
                couponCode: couponCode || undefined,
                locationId: activeStore?.id,
            });
            const hasOnlinePart = method === "ONLINE" || (eligibility && eligibility.advanceAmount > 0);
            if (!hasOnlinePart) {
                clearCart();
            }

            if (hasOnlinePart) {
                try {
                    const payRes = await api.post(`/payments/${order.id}/generate-link`);

                    if (payRes.data?.iframe && payRes.data?.accessKey) {
                        const triggerIframeCheckout = () => {
                            const EasebuzzCheckout = (window as any).EasebuzzCheckout;
                            if (EasebuzzCheckout) {
                                const checkoutObj = new EasebuzzCheckout(payRes.data.key, payRes.data.env);
                                const options = {
                                    access_key: payRes.data.accessKey,
                                    onResponse: (response: any) => {
                                        console.log("[Easebuzz Iframe Response]", response);
                                        const isSuccess = response.status === "success";
                                        if (isSuccess) {
                                            router.push(`/payment/success?order_id=${order.id}&status=success`);
                                        } else {
                                            toast.error("Payment failed or cancelled. Your basket remains preserved.");
                                            router.push("/cart");
                                        }
                                    }
                                };
                                checkoutObj.initiatePayment(options);
                            } else {
                                toast.error("Easebuzz Checkout SDK failed to load");
                                router.push("/cart");
                            }
                        };

                        if (!(window as any).EasebuzzCheckout) {
                            const script = document.createElement("script");
                            script.src = "https://ebz-static.s3.ap-south-1.amazonaws.com/easecheckout/v2.0.0/easebuzz-checkout-v2.min.js";
                            script.async = true;
                            script.onload = triggerIframeCheckout;
                            script.onerror = () => {
                                toast.error("Failed to load Easebuzz script");
                                router.push("/cart");
                            };
                            document.body.appendChild(script);
                        } else {
                            triggerIframeCheckout();
                        }
                        return;
                    } else if (payRes.data?.paymentLink) {
                        window.location.href = payRes.data.paymentLink;
                        return;
                    }
                } catch (payErr) {
                    console.error("Failed to generate payment link:", payErr);
                    toast.error("Order placed, but failed to redirect to payment gateway.");
                }
            } else {
                router.push("/orders?success=true");
            }
        } catch (error) {
            console.error(error);
            toast.error("Failed to place order");
        } finally {
            setLoading(false);
        }
    };

    if (items.length === 0) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50">
                <div className="w-20 h-20 bg-[#e8f7ef] rounded-3xl flex items-center justify-center border border-[#a3e4c4]/60 mb-5">
                    <ShoppingBag className="h-9 w-9 text-[#017649]" />
                </div>
                <h1 className="text-xl font-bold text-slate-900 tracking-tight mb-1.5">Your Basket is Empty</h1>
                <p className="text-slate-500 text-xs font-medium mb-6">Add fresh veggies and fruits to proceed with checkout</p>
                <button
                    onClick={() => router.push("/")}
                    className="bg-[#017649] hover:bg-[#015f3b] text-white rounded-xl px-8 h-12 text-sm font-bold shadow-sm transition-all active:scale-95"
                >
                    Start Shopping
                </button>
            </div>
        );
    }

    const selectedAddr = addresses?.find((a: Address) => a.id === selectedAddressId);

    const QUICK_INSTRUCTIONS = [
        "Leave at the door",
        "Ring doorbell",
        "Avoid calling",
        "Leave with guard",
    ];

    return (
        <AuthGuard>
            <div className="min-h-screen bg-[#F8FAF9] pb-40">
                {/* Header */}
                <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-6 py-3.5 flex items-center gap-3">
                    <button
                        onClick={() => {
                            if (currentStep === "payment") {
                                setCurrentStep("address");
                            } else {
                                router.back();
                            }
                        }}
                        aria-label="Go back"
                        className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 active:scale-95 transition-all"
                    >
                        <ChevronLeft className="h-5 w-5" strokeWidth={2.5} />
                    </button>
                    <div>
                        <h1 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                            Checkout
                        </h1>
                        <p className="text-[11px] font-medium text-slate-400">
                            {currentStep === "address" ? "Step 2 of 3: Delivery Details" : "Step 3 of 3: Payment"}
                        </p>
                    </div>
                </header>

                {/* Step Progress Bar */}
                <div className="bg-white border-b border-slate-100 py-3.5 px-6 shadow-2xs">
                    <div className="max-w-md mx-auto flex items-center justify-between relative">
                        {/* Connecting Track */}
                        <div className="absolute top-4 left-6 right-6 h-0.5 bg-slate-200 -z-10" />
                        <div
                            className="absolute top-4 left-6 h-0.5 bg-[#017649] transition-all duration-300 -z-10"
                            style={{ width: currentStep === "payment" ? "calc(100% - 3rem)" : "50%" }}
                        />

                        {/* Step 1: Cart */}
                        <button
                            onClick={() => router.push("/cart")}
                            className="flex flex-col items-center gap-1 group"
                        >
                            <div className="w-8 h-8 rounded-full bg-[#017649] text-white flex items-center justify-center text-xs font-bold shadow-xs">
                                <Check className="w-4 h-4 stroke-[3]" />
                            </div>
                            <span className="text-[11px] font-bold text-[#017649]">Cart</span>
                        </button>

                        {/* Step 2: Address */}
                        <button
                            onClick={() => setCurrentStep("address")}
                            className="flex flex-col items-center gap-1 group"
                        >
                            <div className={cn(
                                "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-xs",
                                currentStep === "address"
                                    ? "bg-[#017649] text-white ring-4 ring-[#e8f7ef]"
                                    : "bg-[#017649] text-white"
                            )}>
                                {currentStep === "payment" ? <Check className="w-4 h-4 stroke-[3]" /> : "2"}
                            </div>
                            <span className={cn(
                                "text-[11px] font-bold",
                                currentStep === "address" || currentStep === "payment" ? "text-[#017649]" : "text-slate-400"
                            )}>
                                Delivery
                            </span>
                        </button>

                        {/* Step 3: Payment */}
                        <div className="flex flex-col items-center gap-1">
                            <div className={cn(
                                "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all",
                                currentStep === "payment"
                                    ? "bg-[#017649] text-white ring-4 ring-[#e8f7ef] shadow-xs"
                                    : "bg-slate-100 text-slate-400 border border-slate-200"
                            )}>
                                3
                            </div>
                            <span className={cn(
                                "text-[11px] font-bold",
                                currentStep === "payment" ? "text-[#017649]" : "text-slate-400"
                            )}>
                                Payment
                            </span>
                        </div>
                    </div>
                </div>

                {/* Main Content */}
                <main className="pt-4 px-3 sm:px-6 max-w-2xl mx-auto space-y-4">

                    {/* ADDRESS STEP VIEW */}
                    {currentStep === "address" && (
                        <>
                            {/* Deliver to Card */}
                            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs space-y-3.5">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-xl bg-[#e8f7ef] flex items-center justify-center text-[#017649]">
                                            <MapPin className="h-4.5 w-4.5" />
                                        </div>
                                        <h3 className="text-sm font-bold text-slate-900">Delivery Address</h3>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setIsAddressListOpen(true)}
                                        className="text-xs font-bold text-[#017649] hover:text-[#015f3b] transition-colors px-2 py-1 rounded-lg hover:bg-[#e8f7ef]"
                                    >
                                        CHANGE
                                    </button>
                                </div>

                                {selectedAddr ? (
                                    <div className="space-y-1.5 pl-10 text-left">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-bold uppercase tracking-wider bg-[#e8f7ef] text-[#017649] px-2 py-0.5 rounded-md">
                                                {selectedAddr.type || "HOME"}
                                            </span>
                                            <span className="text-xs font-bold text-slate-900">
                                                {selectedAddr.name} • {selectedAddr.phone || "No phone"}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-600 leading-relaxed font-normal pt-0.5">
                                            {selectedAddr.fullAddress}
                                        </p>
                                        {selectedAddr.landmark && (
                                            <p className="text-[11px] text-slate-400 font-medium">
                                                Landmark: {selectedAddr.landmark}
                                            </p>
                                        )}
                                    </div>
                                ) : (
                                    <div className="pl-10 py-1">
                                        <button
                                            type="button"
                                            onClick={() => setIsAddressDialogOpen(true)}
                                            className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2 hover:bg-emerald-100 transition-colors"
                                        >
                                            + Add Delivery Address
                                        </button>
                                    </div>
                                )}

                                {/* Delivery Instructions Collapsible */}
                                <div className="border-t border-slate-100 pt-3 mt-1">
                                    <button
                                        type="button"
                                        onClick={() => setIsInstructionsOpen(!isInstructionsOpen)}
                                        className="w-full flex items-center justify-between text-left group"
                                    >
                                        <div className="flex items-center gap-2 text-slate-600">
                                            <Clock className="h-4 w-4 text-slate-400" />
                                            <span className="text-xs font-bold text-slate-700">Delivery Instructions (Optional)</span>
                                        </div>
                                        <ChevronDown className={cn("h-4 w-4 text-slate-400 transition-transform duration-200", isInstructionsOpen && "rotate-180")} />
                                    </button>

                                    {isInstructionsOpen && (
                                        <div className="mt-2.5 space-y-2 animate-in slide-in-from-top-1 duration-200">
                                            <div className="flex flex-wrap gap-1.5">
                                                {QUICK_INSTRUCTIONS.map((instr) => (
                                                    <button
                                                        key={instr}
                                                        type="button"
                                                        onClick={() => {
                                                            setDeliveryInstructions(prev =>
                                                                prev.includes(instr)
                                                                    ? prev.replace(instr, "").trim()
                                                                    : `${prev ? prev + ", " : ""}${instr}`
                                                            );
                                                        }}
                                                        className={cn(
                                                            "text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-all",
                                                            deliveryInstructions.includes(instr)
                                                                ? "bg-[#017649] text-white border-[#017649]"
                                                                : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                                                        )}
                                                    >
                                                        {instr}
                                                    </button>
                                                ))}
                                            </div>
                                            <textarea
                                                value={deliveryInstructions}
                                                onChange={(e) => setDeliveryInstructions(e.target.value)}
                                                placeholder="Write specific directions or notes for the delivery executive..."
                                                className="w-full h-16 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-[#017649] focus:bg-white text-slate-800 placeholder:text-slate-400 resize-none"
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Delivery Slot Picker */}
                            <section className="space-y-2.5">
                                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">
                                    Delivery Timing Preference
                                </h3>
                                <DeliverySlotPicker onSelect={(info: any) => setDeliveryInfo(info)} />
                            </section>
                        </>
                    )}

                    {/* PAYMENT STEP VIEW */}
                    {currentStep === "payment" && (
                        <>
                            {/* Summary Card of Address & Slot */}
                            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs space-y-2.5">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="w-7 h-7 rounded-lg bg-[#e8f7ef] flex items-center justify-center text-[#017649]">
                                            <MapPin className="h-4 w-4" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-slate-900 leading-tight">
                                                Delivering to {selectedAddr?.type || "Home"}
                                            </p>
                                            <p className="text-[11px] text-slate-500 truncate max-w-[260px] sm:max-w-md">
                                                {selectedAddr?.fullAddress}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => { setCurrentStep("address"); }}
                                        className="text-[11px] font-bold text-[#017649] hover:underline"
                                    >
                                        Change
                                    </button>
                                </div>

                                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-1.5 text-slate-600">
                                        <Clock className="h-3.5 w-3.5 text-[#017649]" />
                                        <span className="font-semibold">
                                            {deliveryInfo?.mode === "INSTANT"
                                                ? "Instant Priority Delivery"
                                                : `${deliveryInfo?.date} (${deliveryInfo?.time})`}
                                        </span>
                                    </div>
                                    <span className="text-[11px] font-bold text-[#017649] bg-[#e8f7ef] px-2 py-0.5 rounded">
                                        {deliveryFee === 0 ? "FREE Delivery" : `₹${deliveryFee} Delivery`}
                                    </span>
                                </div>
                            </div>

                            {/* Payment Options Section */}
                            <section className="space-y-3">
                                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">
                                    Choose Payment Method
                                </h3>

                                <div className="space-y-2.5">
                                    {/* Cash on Delivery */}
                                    <div
                                        onClick={() => {
                                            if (eligibility && !eligibility.codAllowed) {
                                                toast.error(eligibility.reasons[0] || "COD is not available for this order.");
                                                return;
                                            }
                                            setPaymentMethod("COD");
                                        }}
                                        className={cn(
                                            "bg-white rounded-2xl border p-4 cursor-pointer transition-all relative overflow-hidden",
                                            paymentMethod === "COD"
                                                ? "border-[#017649] ring-2 ring-[#017649]/20 shadow-xs"
                                                : "border-slate-200/90 hover:border-slate-300",
                                            eligibility && !eligibility.codAllowed && "opacity-50 cursor-not-allowed bg-slate-50/60"
                                        )}
                                    >
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-[#e8f7ef] text-[#017649] flex items-center justify-center shrink-0">
                                                    <Wallet className="h-5 w-5" />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <h4 className="text-sm font-bold text-slate-900 leading-none">
                                                            Cash on Delivery (COD)
                                                        </h4>
                                                        {eligibility?.codAllowed && eligibility.advanceAmount > 0 && (
                                                            <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                                                PARTIAL ADVANCE
                                                            </span>
                                                        )}
                                                        {eligibility?.codAllowed && eligibility.advanceAmount === 0 && (
                                                            <span className="bg-emerald-100 text-[#017649] text-[10px] font-bold px-2 py-0.5 rounded-full">
                                                                FULL COD
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-[11px] text-slate-500 font-medium mt-1">
                                                        {eligibilityLoading ? (
                                                            "Checking payment eligibility..."
                                                        ) : eligibility && !eligibility.codAllowed ? (
                                                            "Not available for this order level"
                                                        ) : eligibility && eligibility.advanceAmount > 0 ? (
                                                            `Pay ₹${eligibility.advanceAmount} advance online + ₹${eligibility.codAmount} on delivery`
                                                        ) : (
                                                            "Pay with cash or UPI scan when your order arrives"
                                                        )}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className={cn(
                                                "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
                                                paymentMethod === "COD" ? "border-[#017649] bg-[#017649]" : "border-slate-300"
                                            )}>
                                                {paymentMethod === "COD" && <div className="w-2 h-2 rounded-full bg-white" />}
                                            </div>
                                        </div>

                                        {paymentMethod === "COD" && eligibility?.codAllowed && (
                                            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center gap-2 text-xs font-semibold text-[#017649]">
                                                <ShieldCheck className="h-4 w-4 shrink-0" />
                                                <span>
                                                    {eligibility.advanceAmount > 0
                                                        ? `Advance ₹${eligibility.advanceAmount} secures your booking`
                                                        : "No extra charges. Pay safely on doorstep."}
                                                </span>
                                            </div>
                                        )}

                                        {eligibility && !eligibility.codAllowed && (
                                            <div className="mt-3 pt-2.5 border-t border-red-100 flex items-center gap-2 text-xs font-medium text-rose-600">
                                                <Info className="h-4 w-4 shrink-0" />
                                                <span>{eligibility.reasons[0]}</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Pay Online via UPI Only */}
                                    <div
                                        onClick={() => setPaymentMethod("ONLINE")}
                                        className={cn(
                                            "bg-white rounded-2xl border p-4 cursor-pointer transition-all relative overflow-hidden space-y-3",
                                            paymentMethod === "ONLINE"
                                                ? "border-[#017649] ring-2 ring-[#017649]/20 shadow-xs"
                                                : "border-slate-200/90 hover:border-slate-300"
                                        )}
                                    >
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-[#e8f7ef] text-[#017649] flex items-center justify-center shrink-0">
                                                    <Zap className="h-5 w-5 fill-current" />
                                                </div>
                                                <div>
                                                    <h4 className="text-sm font-bold text-slate-900 leading-none">
                                                        Pay Online via UPI
                                                    </h4>
                                                    <p className="text-[11px] text-slate-500 font-medium mt-1">
                                                        Google Pay, PhonePe, Paytm, BHIM or any UPI QR
                                                    </p>
                                                </div>
                                            </div>

                                            <div className={cn(
                                                "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
                                                paymentMethod === "ONLINE" ? "border-[#017649] bg-[#017649]" : "border-slate-300"
                                            )}>
                                                {paymentMethod === "ONLINE" && <div className="w-2 h-2 rounded-full bg-white" />}
                                            </div>
                                        </div>

                                        {/* UPI App badges */}
                                        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-1.5 text-[10px] font-bold">
                                            <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                                                Google Pay
                                            </span>
                                            <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                                                PhonePe
                                            </span>
                                            <span className="px-2 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200">
                                                Paytm
                                            </span>
                                            <span className="px-2 py-0.5 rounded bg-slate-50 text-slate-700 border border-slate-200">
                                                BHIM / Any UPI
                                            </span>
                                            <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                                                Scan & Pay QR
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {/* Safe payment trust banner */}
                            <div className="flex items-center justify-center gap-2 py-2 text-slate-500 text-xs font-medium">
                                <ShieldCheck className="h-4.5 w-4.5 text-[#017649]" />
                                <span>100% Safe & Secure Payments (256-bit SSL encrypted)</span>
                            </div>
                        </>
                    )}

                    {/* Collapsible Order Summary Card */}
                    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
                        <button
                            type="button"
                            onClick={() => setIsOrderSummaryExpanded(!isOrderSummaryExpanded)}
                            className="w-full px-4 sm:px-5 py-3.5 flex items-center justify-between hover:bg-slate-50/50 transition-colors text-left"
                        >
                            <div className="flex items-center gap-2">
                                <h3 className="text-xs sm:text-sm font-bold text-slate-900">Order Summary</h3>
                                <span className="text-[11px] font-bold text-[#017649] bg-[#e8f7ef] px-2 py-0.5 rounded-full">
                                    {totalItems} {totalItems === 1 ? "Item" : "Items"}
                                </span>
                            </div>
                            <ChevronDown className={cn("h-4 w-4 text-slate-400 transition-transform duration-200", isOrderSummaryExpanded && "rotate-180")} />
                        </button>

                        {isOrderSummaryExpanded && (
                            <div className="px-4 sm:px-5 pb-4 pt-1 border-t border-slate-100 space-y-3 animate-in slide-in-from-top-1 duration-200">
                                {/* Items list */}
                                <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1 scrollbar-hide">
                                    {items.map((item) => (
                                        <div key={`${item.productId}-${item.variantId}`} className="flex items-center justify-between gap-3 text-left">
                                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                                <div className="relative w-10 h-10 bg-slate-50 rounded-lg overflow-hidden border border-slate-100 shrink-0 flex items-center justify-center p-1">
                                                    <Image
                                                        src={item.image || "/placeholder.png"}
                                                        alt={item.name}
                                                        width={36}
                                                        height={36}
                                                        className="object-contain"
                                                    />
                                                </div>
                                                <div className="min-w-0">
                                                    <h5 className="text-xs font-bold text-slate-800 leading-tight line-clamp-1">
                                                        {item.name}
                                                    </h5>
                                                    <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                                                        Qty: {item.quantity} {item.variantName ? `• ${item.variantName}` : (item.weight ? `• ${item.weight}${item.weightUnit || 'g'}` : "")}
                                                    </p>
                                                </div>
                                            </div>
                                            <span className="text-xs font-black tabular-nums text-slate-900 shrink-0">
                                                ₹{(Number(item.price) * Number(item.quantity)).toFixed(0)}
                                            </span>
                                        </div>
                                    ))}
                                </div>

                                {/* Summary Breakdown */}
                                <div className="pt-3 border-t border-slate-100 space-y-2 text-xs">
                                    <div className="flex justify-between items-center text-slate-600 font-medium">
                                        <span>Item Total</span>
                                        <span className="font-bold text-slate-900">₹{totalPrice.toFixed(0)}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-slate-600 font-medium">
                                        <span>Delivery Fee</span>
                                        <span className={cn("font-bold", deliveryFee === 0 ? "text-[#017649]" : "text-slate-900")}>
                                            {deliveryFee === 0 ? "FREE" : `₹${deliveryFee}`}
                                        </span>
                                    </div>
                                    {discount > 0 && (
                                        <div className="flex justify-between items-center text-[#017649] font-bold">
                                            <span>Coupon Discount {couponCode ? `(${couponCode})` : ""}</span>
                                            <span>-₹{discount.toFixed(0)}</span>
                                        </div>
                                    )}
                                    <div className="border-t border-slate-100 pt-2 flex justify-between items-baseline">
                                        <span className="text-xs font-bold text-slate-900">Total Amount</span>
                                        <span className="text-lg font-black text-[#017649] tabular-nums">
                                            ₹{grandTotal.toFixed(0)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </main>

                {/* STICKY BOTTOM ACTION BAR */}

                {/* STEP 1 (Address) STICKY BAR */}
                {currentStep === "address" && mounted && createPortal(
                    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200/90 px-4 sm:px-6 py-3 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-6px_25px_rgba(0,0,0,0.06)]">
                        <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
                            <div className="text-left">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block leading-tight">Total Amount</span>
                                <span className="text-lg sm:text-xl font-black text-slate-900 leading-tight">₹{grandTotal.toFixed(0)}</span>
                            </div>

                            <button
                                type="button"
                                onClick={() => {
                                    if (!selectedAddressId) {
                                        toast.error("Please add or select a delivery address.");
                                        setIsAddressListOpen(true);
                                        return;
                                    }
                                    if (!deliveryInfo) {
                                        toast.error("Please choose your delivery slot preference.");
                                        return;
                                    }
                                    setCurrentStep("payment");
                                    setIsOrderSummaryExpanded(false);
                                    window.scrollTo({ top: 0, behavior: "smooth" });
                                }}
                                className="flex items-center gap-2 bg-[#017649] hover:bg-[#015f3b] active:scale-95 transition-all text-white font-bold text-xs sm:text-sm px-6 py-3 rounded-xl shadow-xs"
                            >
                                <span>PROCEED TO PAYMENT</span>
                                <ArrowRight className="h-4 w-4 stroke-[3]" />
                            </button>
                        </div>
                    </div>,
                    document.body
                )}

                {/* STEP 2 (Payment) STICKY BAR */}
                {currentStep === "payment" && mounted && createPortal(
                    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200/90 px-4 sm:px-6 py-3 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-6px_25px_rgba(0,0,0,0.06)]">
                        <div className="max-w-2xl mx-auto space-y-2">
                            <div className="flex items-center justify-between gap-4">
                                <div className="text-left">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block leading-tight">To Pay</span>
                                    <span className="text-lg sm:text-xl font-black text-slate-900 leading-tight">₹{grandTotal.toFixed(0)}</span>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => handlePlaceOrder(paymentMethod)}
                                    disabled={loading || eligibilityLoading}
                                    className="flex-1 max-w-sm flex items-center justify-center gap-2 bg-[#017649] hover:bg-[#015f3b] disabled:bg-slate-200 disabled:text-slate-400 active:scale-[0.98] transition-all text-white font-bold text-xs sm:text-sm h-12 rounded-xl shadow-xs"
                                >
                                    <span>
                                        {paymentMethod === "COD" && eligibility && eligibility.advanceAmount > 0
                                            ? `PAY ₹${eligibility.advanceAmount} ADVANCE & ORDER`
                                            : "PLACE ORDER"}
                                    </span>
                                    {loading || eligibilityLoading ? (
                                        <Loader2 className="h-4 w-4 animate-spin text-white" />
                                    ) : (
                                        <ArrowRight className="h-4 w-4 stroke-[3]" />
                                    )}
                                </button>
                            </div>

                            <p className="text-center text-[10px] text-slate-500 font-semibold leading-tight">
                                {paymentMethod === "COD"
                                    ? (eligibility && eligibility.advanceAmount > 0
                                        ? `Pay ₹${eligibility.advanceAmount} advance online now and balance ₹${eligibility.codAmount} on delivery`
                                        : `Pay ₹${grandTotal.toFixed(0)} via cash/UPI upon delivery`)
                                    : `Instant secure UPI payment of ₹${grandTotal.toFixed(0)}`}
                            </p>
                        </div>
                    </div>,
                    document.body
                )}
            </div>

            {/* Address Form Dialog */}
            <Dialog open={isAddressDialogOpen} onOpenChange={setIsAddressDialogOpen}>
                <DialogContent className="rounded-3xl p-0 border border-slate-100 overflow-hidden max-w-lg bg-white shadow-2xl">
                    <AddressForm
                        onSuccess={() => {
                            setIsAddressDialogOpen(false);
                            refetchAddresses();
                        }}
                        onCancel={() => setIsAddressDialogOpen(false)}
                    />
                </DialogContent>
            </Dialog>

            {/* Saved Address List Dialog */}
            <Dialog open={isAddressListOpen} onOpenChange={setIsAddressListOpen}>
                <DialogContent className="rounded-3xl p-0 border border-slate-100 overflow-hidden max-w-lg bg-white shadow-2xl">
                    <div className="p-5 border-b border-slate-100 bg-[#e8f7ef]/50">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-[#017649] rounded-xl flex items-center justify-center text-white shadow-xs">
                                    <MapPin className="h-5 w-5" />
                                </div>
                                <div className="text-left">
                                    <h2 className="text-base font-bold text-slate-900">Delivery Addresses</h2>
                                    <p className="text-xs text-slate-500 font-medium">Select where to deliver your order</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setIsAddressListOpen(false);
                                    setIsAddressDialogOpen(true);
                                }}
                                className="flex items-center gap-1 bg-[#017649] hover:bg-[#015f3b] text-white text-xs font-bold px-3 py-2 rounded-xl transition-all active:scale-95 shadow-2xs"
                            >
                                <Plus className="h-3.5 w-3.5" />
                                <span>Add New</span>
                            </button>
                        </div>
                    </div>

                    <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto scrollbar-hide">
                        {addresses && addresses.length > 0 ? (
                            addresses.map((addr: Address) => {
                                const active = selectedAddressId === addr.id;
                                return (
                                    <div
                                        key={addr.id}
                                        onClick={() => {
                                            setSelectedAddressId(addr.id);
                                            setIsAddressListOpen(false);
                                            toast.success("Delivery address updated");
                                        }}
                                        className={cn(
                                            "border rounded-2xl p-4 flex items-start justify-between gap-3 hover:border-[#017649] transition-all cursor-pointer text-left",
                                            active
                                                ? "bg-[#e8f7ef]/50 border-[#017649] ring-2 ring-[#017649]/20"
                                                : "bg-white border-slate-200 hover:bg-slate-50/60"
                                        )}
                                    >
                                        <div className="space-y-1 min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className={cn(
                                                    "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md",
                                                    active
                                                        ? "bg-[#017649] text-white"
                                                        : "bg-slate-100 text-slate-700"
                                                )}>
                                                    {addr.type || "HOME"}
                                                </span>
                                                <span className="text-xs font-bold text-slate-900">{addr.name}</span>
                                            </div>
                                            <p className="text-xs text-slate-600 leading-relaxed font-normal pt-1">
                                                {addr.fullAddress}
                                            </p>
                                            {addr.phone && (
                                                <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                                                    Phone: {addr.phone}
                                                </p>
                                            )}
                                        </div>

                                        <div className={cn(
                                            "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5",
                                            active ? "border-[#017649] bg-[#017649] text-white" : "border-slate-300"
                                        )}>
                                            {active && <Check className="h-3 w-3 stroke-[3]" />}
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="text-center py-10 space-y-2 text-slate-400">
                                <MapPin className="h-8 w-8 mx-auto text-slate-300" />
                                <p className="text-xs font-semibold text-slate-500">No saved addresses found</p>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsAddressListOpen(false);
                                        setIsAddressDialogOpen(true);
                                    }}
                                    className="text-xs font-bold text-[#017649] hover:underline"
                                >
                                    Add your first address
                                </button>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </AuthGuard>
    );
}
