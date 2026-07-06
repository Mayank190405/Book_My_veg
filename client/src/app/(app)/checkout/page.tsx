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
import { Button } from "@/components/ui/button";
import {
    Loader2, Plus, Minus, MapPin, ArrowRight, ChevronLeft, Info,
    CreditCard, Wallet, Tag, ShoppingBag, Clock, ChevronRight, Zap, CheckCircle2, ShieldCheck, FileText, ChevronDown, HelpCircle, AlertCircle
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
    const { items, totalPrice: rawTotalPrice, totalItems, updateQuantity, clearCart, couponCode, discount: rawDiscount } = useCartStore();
    const { user, activeStore } = useUserStore();
 
    const totalPrice = Number(rawTotalPrice) || 0;
    const discount = Number(rawDiscount) || 0;
 
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
 
    const deliveryFee = totalPrice >= 249 ? 0 : 40;
    const grandTotal = totalPrice + deliveryFee - discount;
 
    const { data: addresses } = useQuery({
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
            toast.error("Please select address and delivery mode");
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
                items: items.map((i: any) => ({ productId: i.productId, quantity: Number(i.quantity), price: Number(i.price), variantId: i.variantId })),
                totalAmount: grandTotal,
                deliveryCharge: deliveryFee,
                deliverySlot: deliveryInfo.time,
                deliveryDate: deliveryInfo.date,
                couponCode: couponCode || undefined,
                locationId: activeStore?.id,
            });
            clearCart();
            if (method === "ONLINE") {
                try {
                    const payRes = await api.post(`/payments/${order.id}/generate-link`);
                    if (payRes.data?.paymentLink) {
                        window.location.href = payRes.data.paymentLink;
                        return;
                    }
                } catch (payErr) {
                    console.error("Failed to generate payment link:", payErr);
                    toast.error("Order placed, but failed to redirect to payment gateway.");
                }
            }
            router.push("/orders?success=true");
        } catch (error) {
            console.error(error);
            toast.error("Failed to place order");
        } finally {
            setLoading(false);
        }
    };
 
    if (items.length === 0) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#f4faf7]">
                <div className="w-24 h-24 bg-emerald-50 rounded-3xl flex items-center justify-center border border-emerald-100 mb-8">
                    <ShoppingBag className="h-10 w-10 text-emerald-600/30" />
                </div>
                <h1 className="text-xl font-black text-gray-900 uppercase tracking-widest mb-2">Basket Empty</h1>
                <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-8">Add items to proceed to checkout</p>
                <Button onClick={() => router.push("/")} className="bg-[#0b5c3e] hover:bg-[#0b5c3e]/90 rounded-2xl px-12 h-14 font-black uppercase tracking-widest shadow-lg shadow-emerald-950/20">
                    Explore Menu
                </Button>
            </div>
        );
    }
 
    const selectedAddr = addresses?.find((a: Address) => a.id === selectedAddressId);
 
    return (
        <AuthGuard>
            <div className="min-h-screen bg-[#f7f9f8] pb-40">
                {/* Header */}
                <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-100 px-6 py-4 flex items-center gap-4">
                    <button
                        onClick={() => {
                            if (currentStep === "payment") {
                                setCurrentStep("address");
                            } else {
                                router.back();
                            }
                        }}
                        className="w-10 h-10 flex items-center justify-center bg-[#f4faf7] rounded-full border border-gray-100 active:scale-95 text-gray-800 hover:bg-gray-50 transition-all"
                    >
                        <ChevronLeft className="h-5 w-5 text-gray-700" strokeWidth={2.5} />
                    </button>
                    <div className="text-left">
                        <h1 className="text-lg font-black text-gray-900 uppercase tracking-tight leading-none italic">
                            Checkout
                        </h1>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                            Review and place your order
                        </p>
                    </div>
                </header>
 
                {/* Steps indicator */}
                <div className="bg-white border-b border-gray-100 pb-5 pt-20 px-6 shadow-sm">
                    <div className="max-w-2xl mx-auto flex items-center justify-between relative px-2">
                        {/* Connection lines */}
                        <div className="absolute top-[18px] left-[10%] right-[10%] h-0.5 bg-gray-100 -z-10" />
                        <div 
                            className="absolute top-[18px] left-[10%] h-0.5 bg-[#0b5c3e] transition-all duration-500 -z-10"
                            style={{ 
                                width: currentStep === "payment" ? "80%" : "40%"
                            }} 
                        />
 
                        {/* Cart Step */}
                        <div className="flex flex-col items-center gap-1.5 flex-1">
                            <div className="w-9 h-9 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 font-bold text-sm">
                                <CheckCircle2 className="h-5 w-5 text-[#0b5c3e] fill-emerald-50" />
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600">Cart</span>
                        </div>
 
                        {/* Address Step */}
                        <div className="flex flex-col items-center gap-1.5 flex-1">
                            <button 
                                onClick={() => setCurrentStep("address")}
                                className={cn(
                                    "w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300",
                                    currentStep === "address" 
                                        ? "bg-[#0b5c3e] text-white shadow-md shadow-emerald-950/20"
                                        : "bg-emerald-50 border border-emerald-100 text-emerald-600"
                                )}
                            >
                                {currentStep === "payment" ? <CheckCircle2 className="h-5 w-5 text-[#0b5c3e] fill-emerald-50" /> : "2"}
                            </button>
                            <span className={cn("text-[10px] font-black uppercase tracking-wider", currentStep === "address" || currentStep === "payment" ? "text-emerald-600" : "text-gray-400")}>Address</span>
                        </div>
 
                        {/* Payment Step */}
                        <div className="flex flex-col items-center gap-1.5 flex-1">
                            <div className={cn(
                                "w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300",
                                currentStep === "payment"
                                    ? "bg-[#0b5c3e] text-white shadow-md shadow-emerald-950/20"
                                    : "bg-white border border-gray-200 text-gray-400"
                            )}>
                                3
                            </div>
                            <span className={cn("text-[10px] font-black uppercase tracking-wider", currentStep === "payment" ? "text-emerald-600" : "text-gray-400")}>Payment</span>
                        </div>
 
                        {/* Confirm Step */}
                        <div className="flex flex-col items-center gap-1.5 flex-1">
                            <div className="w-9 h-9 rounded-full bg-white border border-gray-200 text-gray-400 flex items-center justify-center font-bold text-sm">
                                4
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">Confirm</span>
                        </div>
                    </div>
                </div>
 
                {/* Main Content Area */}
                <main className="pt-6 px-6 max-w-xl mx-auto space-y-5">
                    
                    {/* ADDRESS STEP VIEW */}
                    {currentStep === "address" && (
                        <>
                            {/* Deliver to Card */}
                            <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-[0_4px_24px_rgba(0,0,0,0.02)] space-y-4">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-2.5">
                                        <MapPin className="h-5 w-5 text-[#0b5c3e]" />
                                        <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider">Deliver to</h3>
                                    </div>
                                    <button 
                                        onClick={() => setIsAddressListOpen(true)}
                                        className="text-[10px] font-black text-[#0b5c3e] uppercase tracking-widest"
                                    >
                                        CHANGE
                                    </button>
                                </div>
 
                                {selectedAddr ? (
                                    <div className="space-y-1 pl-7 text-left">
                                        <h4 className="text-sm font-black text-gray-800 uppercase tracking-tight">{selectedAddr.type}</h4>
                                        <p className="text-xs text-gray-500 font-medium leading-relaxed">{selectedAddr.fullAddress}</p>
                                        {selectedAddr.landmark && (
                                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wide mt-1">Landmark: {selectedAddr.landmark}</p>
                                        )}
                                        <p className="text-[11px] font-bold text-gray-800 uppercase tracking-widest mt-2">
                                            {selectedAddr.name} • {selectedAddr.phone || "No phone added"}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="pl-7 py-2">
                                        <button 
                                            onClick={() => setIsAddressDialogOpen(true)}
                                            className="text-xs font-black text-red-500 bg-red-50 border border-red-100 rounded-xl px-4 py-2 uppercase tracking-widest"
                                        >
                                            Add Delivery Address
                                        </button>
                                    </div>
                                )}
 
                                {/* Delivery Instructions Collapsible */}
                                <div className="border-t border-gray-50 pt-4 mt-2">
                                    <button 
                                        onClick={() => setIsInstructionsOpen(!isInstructionsOpen)}
                                        className="w-full flex items-center justify-between text-left group"
                                    >
                                        <div className="flex items-center gap-2.5">
                                            <Clock className="h-4.5 w-4.5 text-gray-400" />
                                            <span className="text-xs font-black text-gray-500 uppercase tracking-wider">Delivery Instructions (Optional)</span>
                                        </div>
                                        <ChevronDown className={cn("h-4 w-4 text-gray-400 transition-transform duration-300", isInstructionsOpen && "rotate-180")} />
                                    </button>
                                    {isInstructionsOpen && (
                                        <div className="mt-3 pl-7 animate-in slide-in-from-top-1 duration-200">
                                            <textarea
                                                value={deliveryInstructions}
                                                onChange={(e) => setDeliveryInstructions(e.target.value)}
                                                placeholder="e.g. Leave with security, ring bell, call before arrival"
                                                className="w-full h-20 p-3 bg-gray-50 border border-gray-100 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#0b5c3e] focus:bg-white text-gray-800"
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
 
                            {/* Arrival slot selection */}
                            <section className="space-y-4">
                                <div className="flex items-center gap-2 px-1">
                                    <div className="w-5 h-5 rounded-full border-2 border-[#0b5c3e] flex items-center justify-center text-[#0b5c3e]">
                                        <div className="w-2 h-2 rounded-full bg-[#0b5c3e]" />
                                    </div>
                                    <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Select Delivery Slot</h3>
                                </div>
                                <DeliverySlotPicker onSelect={(info: any) => setDeliveryInfo(info)} />
                            </section>
                        </>
                    )}
 
                    {/* PAYMENT STEP VIEW */}
                    {currentStep === "payment" && (
                        <>
                            {/* Compact Deliver To Card */}
                            <div className="bg-white rounded-3xl border border-gray-100 p-5 shadow-sm flex items-center justify-between">
                                <div className="flex items-start gap-3 min-w-0 flex-1">
                                    <MapPin className="h-5 w-5 text-[#0b5c3e] shrink-0 mt-0.5" />
                                    <div className="min-w-0 text-left">
                                        <h4 className="text-xs font-black text-gray-900 uppercase tracking-tight">Deliver to {selectedAddr?.type || "Address"}</h4>
                                        <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold truncate mt-0.5">
                                            {selectedAddr?.fullAddress || "Select Address"}
                                        </p>
                                        <p className="text-[9px] font-bold text-gray-900 uppercase tracking-widest mt-1">
                                            {selectedAddr?.name} • {selectedAddr?.phone}
                                        </p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => { setCurrentStep("address"); setIsAddressListOpen(true); }}
                                    className="text-[9px] font-black text-[#0b5c3e] uppercase tracking-widest shrink-0 ml-4"
                                >
                                    CHANGE
                                </button>
                            </div>
 
                            {/* Delivery Speed / Slot Alert */}
                            <div className="bg-[#f0fbf8] border border-emerald-500/10 rounded-2xl p-4 flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-[#0b5c3e] flex items-center justify-center text-white shrink-0">
                                    <Zap className="h-4.5 w-4.5 fill-current" />
                                </div>
                                <div className="text-left">
                                    <span className="text-[11px] font-black text-emerald-950 uppercase tracking-wider">
                                        {deliveryInfo?.mode === "INSTANT" ? "Delivery in 30-40 mins" : `Scheduled Delivery`}
                                    </span>
                                    <p className="text-[9px] text-emerald-800/80 mt-0.5 font-bold uppercase tracking-wider">
                                        {deliveryInfo?.mode === "INSTANT" ? "Fresh priority shipping active" : `${deliveryInfo?.date} • ${deliveryInfo?.time}`}
                                    </p>
                                </div>
                            </div>
 
                            {/* Payment Options Section */}
                            <section className="space-y-4">
                                <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest pl-1">Payment Options</h3>
 
                                <div className="space-y-3">
                                    {/* Cash on Delivery */}
                                    <div 
                                        onClick={() => setPaymentMethod("COD")}
                                        className={cn(
                                            "bg-white rounded-3xl border p-5 cursor-pointer transition-all duration-300",
                                            paymentMethod === "COD" ? "border-[#0b5c3e] shadow-sm" : "border-gray-100"
                                        )}
                                    >
                                        <div className="flex items-center justify-between gap-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 bg-[#0b5c3e]/15 text-[#0b5c3e] rounded-xl flex items-center justify-center shrink-0">
                                                    <Wallet className="h-4.5 w-4.5" />
                                                </div>
                                                <div className="text-left">
                                                    <h4 className="text-xs font-black text-gray-900 uppercase tracking-wider leading-none">Cash on Delivery</h4>
                                                    <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider mt-1">Pay in cash when your order is delivered</p>
                                                </div>
                                            </div>
                                            <div className={cn(
                                                "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0",
                                                paymentMethod === "COD" ? "border-[#0b5c3e]" : "border-gray-300"
                                            )}>
                                                {paymentMethod === "COD" && <div className="w-2.5 h-2.5 rounded-full bg-[#0b5c3e]" />}
                                            </div>
                                        </div>
 
                                        {paymentMethod === "COD" && (
                                            <div className="mt-4 pt-3 border-t border-dashed border-emerald-500/10 flex items-center gap-2.5 text-[#0b5c3e] animate-in fade-in duration-300">
                                                <ShieldCheck className="h-4.5 w-4.5 shrink-0" />
                                                <p className="text-[9px] font-black uppercase tracking-widest leading-none">No extra charges. Pay safely on delivery.</p>
                                            </div>
                                        )}
                                    </div>
 
                                    {/* Pay Online */}
                                    <div 
                                        onClick={() => setPaymentMethod("ONLINE")}
                                        className={cn(
                                            "bg-white rounded-3xl border p-5 cursor-pointer transition-all duration-300 space-y-4",
                                            paymentMethod === "ONLINE" ? "border-[#0b5c3e] shadow-sm" : "border-gray-100"
                                        )}
                                    >
                                        <div className="flex items-center justify-between gap-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 bg-pink-500/10 text-pink-500 rounded-xl flex items-center justify-center shrink-0">
                                                    <CreditCard className="h-4.5 w-4.5" />
                                                </div>
                                                <div className="text-left">
                                                    <h4 className="text-xs font-black text-gray-900 uppercase tracking-wider leading-none">Pay Online</h4>
                                                    <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider mt-1">Pay using UPI, Card, Net Banking</p>
                                                </div>
                                            </div>
                                            <div className={cn(
                                                "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0",
                                                paymentMethod === "ONLINE" ? "border-[#0b5c3e]" : "border-gray-300"
                                            )}>
                                                {paymentMethod === "ONLINE" && <div className="w-2.5 h-2.5 rounded-full bg-[#0b5c3e]" />}
                                            </div>
                                        </div>
 
                                        {/* Nested payment channels (visible but styled differently based on selection) */}
                                        <div className="space-y-2.5 pt-2 border-t border-gray-50">
                                            {/* UPI */}
                                            <div className="flex items-center justify-between p-3.5 bg-gray-50 hover:bg-gray-100/70 rounded-2xl border border-gray-100/50 transition-colors">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <span className="text-[8px] font-black text-gray-400 uppercase tracking-wider shrink-0 w-8">UPI</span>
                                                    <div className="flex items-center gap-2 overflow-x-hidden">
                                                        <span className="text-[9px] font-black text-gray-700 bg-white border border-gray-200 px-2 py-0.5 rounded uppercase">GPay</span>
                                                        <span className="text-[9px] font-black text-purple-700 bg-white border border-gray-200 px-2 py-0.5 rounded uppercase">PhonePe</span>
                                                        <span className="text-[9px] font-black text-cyan-600 bg-white border border-gray-200 px-2 py-0.5 rounded uppercase">Paytm</span>
                                                    </div>
                                                </div>
                                                <ChevronRight className="h-4 w-4 text-gray-400" />
                                            </div>
 
                                            {/* Card */}
                                            <div className="flex items-center justify-between p-3.5 bg-gray-50 hover:bg-gray-100/70 rounded-2xl border border-gray-100/50 transition-colors">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <span className="text-[8px] font-black text-gray-400 uppercase tracking-wider shrink-0 w-8">Card</span>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[9px] font-black text-blue-800 bg-white border border-gray-200 px-2 py-0.5 rounded uppercase">VISA</span>
                                                        <span className="text-[9px] font-black text-red-500 bg-white border border-gray-200 px-2 py-0.5 rounded uppercase">Master</span>
                                                        <span className="text-[9px] font-black text-indigo-700 bg-white border border-gray-200 px-2 py-0.5 rounded uppercase">RuPay</span>
                                                    </div>
                                                </div>
                                                <ChevronRight className="h-4 w-4 text-gray-400" />
                                            </div>
 
                                            {/* Net Banking */}
                                            <div className="flex items-center justify-between p-3.5 bg-gray-50 hover:bg-gray-100/70 rounded-2xl border border-gray-100/50 transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <span className="text-[8px] font-black text-gray-400 uppercase tracking-wider shrink-0 w-8">Bank</span>
                                                    <span className="text-[10px] font-black text-gray-700 uppercase tracking-wider leading-none">Net Banking</span>
                                                </div>
                                                <ChevronRight className="h-4 w-4 text-gray-400" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </section>
 
                            {/* Safe payment trust banner */}
                            <div className="flex items-center justify-center gap-2 py-2 text-gray-400">
                                <ShieldCheck className="h-5.5 w-5.5 text-emerald-500/75 shrink-0" />
                                <div className="text-left">
                                    <span className="text-[9px] font-black text-gray-900 uppercase tracking-widest block leading-none">Secure Payments</span>
                                    <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest block mt-0.5">Your payment details are 100% safe with us.</span>
                                </div>
                            </div>
                        </>
                    )}
 
                    {/* Collapsible Order Summary Card */}
                    <div className="bg-white rounded-3xl border border-gray-100 shadow-[0_4px_24px_rgba(0,0,0,0.02)] overflow-hidden">
                        <button 
                            onClick={() => setIsOrderSummaryExpanded(!isOrderSummaryExpanded)}
                            className="w-full px-6 py-5 flex items-center justify-between hover:bg-gray-50/50 transition-colors text-left"
                        >
                            <h3 className="text-xs font-black text-gray-950 uppercase tracking-wider leading-none">Order Summary</h3>
                            <div className="flex items-center gap-1">
                                <span className="text-[10px] font-black text-[#0b5c3e] uppercase tracking-widest bg-emerald-50 px-2.5 py-1 rounded-lg">
                                    {totalItems} {totalItems === 1 ? "Item" : "Items"}
                                </span>
                                <ChevronDown className={cn("h-4 w-4 text-gray-400 transition-transform duration-300", isOrderSummaryExpanded && "rotate-180")} />
                            </div>
                        </button>
 
                        {isOrderSummaryExpanded && (
                            <div className="px-6 pb-6 pt-2 border-t border-gray-50 space-y-4 animate-in slide-in-from-top-2 duration-300">
                                {/* Items list */}
                                <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1 scrollbar-hide">
                                    {items.map((item) => (
                                        <div key={`${item.productId}-${item.variantId}`} className="flex items-center justify-between gap-4">
                                            <div className="flex items-center gap-3 min-w-0 flex-1">
                                                <div className="relative w-12 h-12 bg-gray-50 rounded-xl overflow-hidden border border-gray-100 flex-shrink-0 flex items-center justify-center p-1.5">
                                                    <Image src={item.image || "/placeholder.png"} alt={item.name} width={40} height={40} className="object-contain" />
                                                </div>
                                                <div className="min-w-0 text-left">
                                                    <h5 className="text-[11px] font-black text-gray-800 uppercase tracking-tight leading-tight line-clamp-2">
                                                        <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-[#0b5c3e] text-white text-[9px] font-black mr-1.5 shrink-0">{item.quantity}</span>
                                                        {item.name}
                                                    </h5>
                                                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-1">1 unit</p>
                                                </div>
                                            </div>
                                            <span className="text-xs font-black text-gray-900 tabular-nums">₹{(item.price * item.quantity).toFixed(0)}</span>
                                        </div>
                                    ))}
                                </div>
 
                                {/* Summary breakdown */}
                                <div className="pt-4 border-t border-dashed border-gray-100 space-y-3">
                                    <div className="flex justify-between items-center text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                        <span>Item Total</span>
                                        <span className="text-gray-950 font-black">₹{totalPrice.toFixed(0)}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                        <span>Delivery Charges</span>
                                        <span className={cn("font-black", deliveryFee === 0 ? "text-emerald-600" : "text-gray-950")}>
                                            {deliveryFee === 0 ? "FREE" : `₹${deliveryFee}`}
                                        </span>
                                    </div>
                                    {discount > 0 && (
                                        <div className="flex justify-between items-center text-[10px] font-black text-emerald-600 uppercase tracking-widest">
                                            <span>You saved on this order</span>
                                            <span className="font-black">-₹{discount}</span>
                                        </div>
                                    )}
                                    <div className="border-t border-gray-100 pt-3 flex justify-between items-end">
                                        <span className="text-[10px] font-black text-gray-950 uppercase tracking-[0.2em] leading-none mb-1">To Pay</span>
                                        <span className="text-xl font-black text-[#0b5c3e] italic tracking-tight leading-none">₹{grandTotal.toFixed(0)}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </main>
 
                {/* STICKY FOOTER FOOTPRINTS */}
 
                {/* STEP 2 STICKY FOOTER */}
                {currentStep === "address" && mounted && createPortal(
                    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-100 px-6 py-4 pb-[calc(1.2rem+env(safe-area-inset-bottom))] shadow-[0_-8px_30px_rgba(0,0,0,0.05)]">
                        <div className="max-w-xl mx-auto flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2 text-left">
                                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#0b5c3e] flex items-center justify-center shrink-0">
                                    <ShieldCheck className="h-5 w-5" />
                                </div>
                                <div>
                                    <span className="text-[10px] font-black text-gray-900 uppercase tracking-widest block leading-none">Safe and Secure Payments</span>
                                    <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest block mt-0.5">100% Secure</span>
                                </div>
                            </div>
                            
                            <button
                                onClick={() => {
                                    if (!selectedAddressId) {
                                        toast.error("Please add/select a delivery address first.");
                                        setIsAddressListOpen(true);
                                        return;
                                    }
                                    if (!deliveryInfo) {
                                        toast.error("Please select a delivery slot preference.");
                                        return;
                                    }
                                    setCurrentStep("payment");
                                    setIsOrderSummaryExpanded(false); // collapse for payment view
                                }}
                                className="flex items-center gap-3 bg-[#0b5c3e] hover:bg-[#0b5c3e]/90 active:scale-95 transition-all text-white font-black text-[11px] uppercase tracking-widest pl-6 pr-3 py-2.5 rounded-2xl shadow-lg shadow-emerald-950/20 shrink-0"
                            >
                                <span>₹{grandTotal.toFixed(0)} CONTINUE</span>
                                <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center shrink-0 text-[#0b5c3e]">
                                    <ArrowRight className="h-4 w-4" strokeWidth={3} />
                                </div>
                            </button>
                        </div>
                    </div>,
                    document.body
                )}
 
                {/* STEP 3 STICKY FOOTER */}
                {currentStep === "payment" && mounted && createPortal(
                    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-100 px-6 py-4 pb-[calc(1.2rem+env(safe-area-inset-bottom))] shadow-[0_-8px_30px_rgba(0,0,0,0.05)]">
                        <div className="max-w-xl mx-auto space-y-4">
                            <div className="flex items-center justify-between gap-4">
                                <div className="text-left">
                                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block leading-none">Total Amount</span>
                                    <span className="text-xl font-black text-gray-900 tracking-tighter block mt-1">₹{grandTotal.toFixed(0)}</span>
                                    <button 
                                        onClick={() => setIsOrderSummaryExpanded(true)}
                                        className="text-[9px] font-black text-[#0b5c3e] uppercase tracking-widest block mt-0.5 hover:underline text-left"
                                    >
                                        View Details
                                    </button>
                                </div>
 
                                <button
                                    onClick={() => handlePlaceOrder(paymentMethod)}
                                    disabled={loading}
                                    className="flex-1 flex items-center justify-center gap-2 bg-[#0b5c3e] hover:bg-[#084831] disabled:bg-gray-100 disabled:text-gray-400 active:scale-[0.98] transition-all text-white font-black text-xs uppercase tracking-widest h-12.5 rounded-2xl shadow-lg shadow-emerald-950/15"
                                >
                                    <span>PLACE ORDER</span>
                                    {loading ? <Loader2 className="h-4 w-4 animate-spin text-white" /> : <ArrowRight className="h-4.5 w-4.5 text-white" strokeWidth={3} />}
                                </button>
                            </div>
                            
                            <p className="text-center text-[8px] font-black text-gray-300 uppercase tracking-widest leading-none">
                                {paymentMethod === "COD" 
                                    ? `You will pay ₹${grandTotal.toFixed(0)} in cash on delivery` 
                                    : `Secure online payment of ₹${grandTotal.toFixed(0)}`}
                            </p>
                        </div>
                    </div>,
                    document.body
                )}
            </div>
 
            {/* Address Form Dialog */}
            <Dialog open={isAddressDialogOpen} onOpenChange={setIsAddressDialogOpen}>
                <DialogContent className="dark rounded-3xl p-0 border-0 overflow-hidden max-w-lg bg-[#061512]">
                    <AddressForm
                        onSuccess={() => setIsAddressDialogOpen(false)}
                        onCancel={() => setIsAddressDialogOpen(false)}
                    />
                </DialogContent>
            </Dialog>
 
            {/* Saved Address List Dialog */}
            <Dialog open={isAddressListOpen} onOpenChange={setIsAddressListOpen}>
                <DialogContent className="dark rounded-3xl p-0 border-0 overflow-hidden max-w-lg bg-[#061512] shadow-2xl">
                    <div className="p-8 border-b border-white/5 bg-gradient-to-br from-emerald-500/10 to-transparent">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                                    <MapPin className="h-6 w-6 text-white" />
                                </div>
                                <div className="text-left">
                                    <h2 className="text-xl font-black text-white uppercase tracking-tight italic">Saved Addresses</h2>
                                    <p className="text-xs font-bold text-emerald-500/60 uppercase tracking-widest">Select a delivery location</p>
                                </div>
                            </div>
                            <button 
                                type="button"
                                onClick={() => { setIsAddressListOpen(false); setIsAddressDialogOpen(true); }}
                                className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-white/5 text-emerald-500 hover:bg-emerald-500 hover:text-white transition-all duration-300"
                            >
                                <Plus className="h-5 w-5" />
                            </button>
                        </div>
                    </div>
                    <div className="p-8 space-y-4 max-h-[60vh] overflow-y-auto scrollbar-hide">
                        {addresses && addresses.length > 0 ? (
                            addresses.map((addr: Address) => {
                                const active = selectedAddressId === addr.id;
                                return (
                                    <div 
                                        key={addr.id} 
                                        onClick={() => {
                                            setSelectedAddressId(addr.id);
                                            setIsAddressListOpen(false);
                                            toast.success(`Delivery address updated!`);
                                        }}
                                        className={cn(
                                            "border rounded-2xl p-5 flex flex-col justify-between hover:bg-white/10 transition-all group cursor-pointer text-left",
                                            active 
                                                ? "bg-emerald-500/10 border-emerald-500/30 text-white" 
                                                : "bg-white/5 border-white/10 text-white/60"
                                        )}
                                    >
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="space-y-1 flex-1">
                                                <div className="flex items-center gap-2.5">
                                                    <span className={cn(
                                                        "text-[9px] font-black uppercase tracking-[0.2em] px-2.5 py-0.5 rounded-full border",
                                                        active 
                                                            ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-500" 
                                                            : "bg-white/5 border-white/10 text-white/40"
                                                    )}>
                                                        {addr.type}
                                                    </span>
                                                    <span className="text-xs font-black uppercase tracking-widest text-white">{addr.name}</span>
                                                </div>
                                                <p className="text-[11px] font-bold uppercase tracking-wider leading-relaxed pt-2 opacity-60">
                                                    {addr.fullAddress}
                                                </p>
                                                {addr.phone && (
                                                    <p className="text-[9px] font-bold text-white/30 uppercase tracking-widest mt-1">Phone: {addr.phone}</p>
                                                )}
                                            </div>
                                            {active && (
                                                <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/30 flex-shrink-0 mt-0.5">
                                                    <CheckCircle2 className="h-4 w-4 text-white" />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="text-center py-12 space-y-3 opacity-30">
                                <MapPin className="h-10 w-10 mx-auto text-white animate-pulse" />
                                <p className="text-[10px] font-black text-white uppercase tracking-widest">No Saved Addresses Found</p>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </AuthGuard>
    );
}
