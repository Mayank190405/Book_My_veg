"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useCartStore } from "@/store/useCartStore";
import { useUserStore } from "@/store/useUserStore";
import { useRouter } from "next/navigation";
import { createOrder } from "@/services/orderService";
import { getAddresses, Address } from "@/services/addressService";
import { getTrendingProducts } from "@/services/productService";
import { Button } from "@/components/ui/button";
import {
    Loader2, Plus, Minus, MapPin, ArrowRight, ChevronLeft,
    CreditCard, Wallet, Tag, ShoppingBag, Clock, ChevronRight
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import AddressForm from "@/components/features/AddressForm";
import { useQuery } from "@tanstack/react-query";
import AuthGuard from "@/components/auth/AuthGuard";
import PaymentButton from "@/components/checkout/PaymentButton";
import DeliverySlotPicker from "@/components/checkout/DeliverySlotPicker";
import { cn } from "@/lib/utils";
import Image from "next/image";

export default function CheckoutPage() {
    const router = useRouter();
    const { items, totalPrice, totalItems, updateQuantity, clearCart, couponCode, discount } = useCartStore();
    const { user } = useUserStore();

    const [loading, setLoading] = useState(false);
    const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
    const [isAddressDialogOpen, setIsAddressDialogOpen] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState<"COD" | "ONLINE">("COD");
    const [deliverySlot, setDeliverySlot] = useState<{ date: string; time: string } | null>(null);

    const deliveryFee = totalPrice >= 249 ? 0 : 40;
    const grandTotal = totalPrice + deliveryFee - discount;

    const { data: addresses } = useQuery({
        queryKey: ["addresses"],
        queryFn: getAddresses,
        enabled: !!user,
    });

    const { data: recommended } = useQuery({
        queryKey: ["recommended-checkout"],
        queryFn: () => getTrendingProducts(),
    });

    useEffect(() => {
        if (addresses && !selectedAddressId) {
            const defaultAddr = addresses.find((a: Address) => a.isDefault);
            if (defaultAddr) setSelectedAddressId(defaultAddr.id);
            else if (addresses.length > 0) setSelectedAddressId(addresses[0].id);
        }
    }, [addresses, selectedAddressId]);

    const handlePlaceOrder = async () => {
        if (!selectedAddressId || !deliverySlot) {
            toast.error("Please select address and delivery slot");
            return;
        }
        const selectedAddr = addresses?.find((a: Address) => a.id === selectedAddressId);
        if (!selectedAddr) return;
        setLoading(true);
        try {
            await createOrder({
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
                paymentMethod: "COD",
                items: items.map((i: any) => ({ productId: i.productId, quantity: i.quantity, price: i.price })),
                totalAmount: grandTotal,
                deliverySlot: deliverySlot.time,
                deliveryDate: deliverySlot.date,
                couponCode: couponCode || undefined,
            });
            clearCart();
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
            <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-app">
                <ShoppingBag className="h-16 w-16 text-emerald-600/30 mb-6" />
                <h1 className="text-xl font-bold text-emerald-950 mb-2">Your basket is empty</h1>
                <Button onClick={() => router.push("/")} className="bg-emerald-600 hover:bg-emerald-700 rounded-2xl px-8">
                    Start Shopping
                </Button>
            </div>
        );
    }

    const selectedAddr = addresses?.find((a: Address) => a.id === selectedAddressId);

    return (
        <AuthGuard>
            <div className="min-h-screen bg-gradient-app">
                {/* Header */}
                <header className="fixed top-0 left-0 right-0 z-50 px-4 py-4 flex items-center gap-4 bg-white/40 backdrop-blur-xl border-b border-emerald-950/5">
                    <button
                        onClick={() => router.back()}
                        className="w-10 h-10 flex items-center justify-center bg-white/60 rounded-2xl border border-emerald-950/5 shadow-sm active:scale-90 transition-all"
                    >
                        <ChevronLeft className="h-5 w-5 text-emerald-950" />
                    </button>
                    <div>
                        <h1 className="text-base font-black text-emerald-950 uppercase tracking-tight leading-none">Checkout</h1>
                        <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mt-0.5">
                            {totalItems} item{totalItems > 1 ? "s" : ""} · ₹{grandTotal.toFixed(0)} total
                        </p>
                    </div>
                </header>

                <main className="pt-24 pb-80 px-4 max-w-2xl mx-auto space-y-4">

                    {/* Delivery ETA */}
                    <div className="bg-white/60 backdrop-blur-xl rounded-[2.5rem] border border-emerald-950/5 p-5 flex items-center gap-4 shadow-sm">
                        <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center">
                            <Clock className="h-6 w-6 text-emerald-600" />
                        </div>
                        <div>
                            <h2 className="text-base font-black text-emerald-950 leading-none">Delivery in 8 minutes</h2>
                            <p className="text-xs text-emerald-950/40 mt-1 font-medium">
                                Shipment of {totalItems} item{totalItems > 1 ? "s" : ""}
                            </p>
                        </div>
                    </div>

                    {/* Items */}
                    <section className="bg-white/60 backdrop-blur-xl rounded-[2.5rem] border border-emerald-950/5 shadow-sm overflow-hidden">
                        <div className="p-5 space-y-5">
                            {items.map((item, idx) => (
                                <div key={item.productId}>
                                    <div className="flex gap-4">
                                        <div className="relative w-20 h-20 bg-white rounded-2xl overflow-hidden border border-emerald-950/5 shadow-sm flex-shrink-0">
                                            <Image
                                                src={item.image || "/placeholder.png"}
                                                alt={item.name}
                                                fill
                                                className="object-contain p-2"
                                            />
                                        </div>
                                        <div className="flex-1 flex flex-col justify-between py-0.5">
                                            <h3 className="text-sm font-black text-emerald-950 leading-tight line-clamp-2">{item.name}</h3>
                                            <div className="flex items-center justify-between mt-2">
                                                <span className="text-sm font-black text-emerald-950">
                                                    ₹{(item.price * item.quantity).toFixed(0)}
                                                </span>
                                                <div className="flex items-center gap-1.5 bg-white border border-emerald-950/5 rounded-xl p-1 shadow-sm">
                                                    <button
                                                        onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                                                        className="w-7 h-7 flex items-center justify-center text-emerald-900/50 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all active:scale-90"
                                                    >
                                                        <Minus className="h-3.5 w-3.5" />
                                                    </button>
                                                    <span className="w-6 text-center text-xs font-black text-emerald-950 tabular-nums">{item.quantity}</span>
                                                    <button
                                                        onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                                                        className="w-7 h-7 flex items-center justify-center text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all active:scale-90"
                                                    >
                                                        <Plus className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    {idx < items.length - 1 && <div className="mt-5 border-b border-emerald-950/5" />}
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Delivery Slot */}
                    <DeliverySlotPicker onSelect={setDeliverySlot} />

                    {/* Address */}
                    <section className="bg-white/60 backdrop-blur-xl rounded-[2.5rem] border border-emerald-950/5 p-5 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-emerald-600" />
                                <h3 className="text-xs font-black text-emerald-950 uppercase tracking-widest opacity-60">Delivering To</h3>
                            </div>
                            <button
                                onClick={() => setIsAddressDialogOpen(true)}
                                className="text-[10px] font-black text-emerald-600 uppercase tracking-widest"
                            >
                                {selectedAddr ? "Change" : "Add Address"}
                            </button>
                        </div>
                        {selectedAddr ? (
                            <div className="bg-emerald-50/60 rounded-2xl p-4 border border-emerald-500/10">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-[9px] font-black uppercase text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-md">{selectedAddr.type}</span>
                                    <span className="text-[10px] font-black text-emerald-950 uppercase">{selectedAddr.name}</span>
                                </div>
                                <p className="text-xs font-medium text-emerald-900/60 leading-relaxed">{selectedAddr.fullAddress}</p>
                            </div>
                        ) : (
                            <button
                                onClick={() => setIsAddressDialogOpen(true)}
                                className="w-full p-4 flex items-center justify-center gap-2 border-2 border-dashed border-emerald-200 rounded-2xl text-emerald-400 hover:bg-emerald-50 transition-all"
                            >
                                <Plus className="h-4 w-4" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Add Delivery Address</span>
                            </button>
                        )}
                    </section>

                    {/* Coupon */}
                    <section className="bg-white/60 backdrop-blur-xl rounded-[2.5rem] border border-emerald-950/5 p-5 shadow-sm flex items-center justify-between group cursor-pointer hover:bg-white/80 transition-colors">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center">
                                <Tag className="h-5 w-5 text-amber-500" />
                            </div>
                            <div>
                                <p className="text-sm font-black text-emerald-950 uppercase tracking-tight">Apply Coupon</p>
                                <p className="text-[10px] font-bold text-emerald-950/40 uppercase tracking-widest">Check for best deals</p>
                            </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-emerald-950/20 group-hover:text-emerald-950/40 transition-colors" />
                    </section>

                    {/* Bill Summary */}
                    <section className="bg-white/60 backdrop-blur-xl rounded-[2.5rem] border border-emerald-950/5 p-6 shadow-sm space-y-3">
                        <h3 className="text-xs font-black text-emerald-950 uppercase tracking-widest opacity-50 mb-4">Bill Details</h3>
                        <div className="flex justify-between items-center">
                            <span className="text-xs font-medium text-emerald-950/50">Item Total</span>
                            <span className="text-sm font-black text-emerald-950">₹{totalPrice.toFixed(0)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-xs font-medium text-emerald-950/50">Delivery Fee</span>
                            <span className={cn("text-sm font-black", deliveryFee === 0 ? "text-emerald-600" : "text-emerald-950")}>
                                {deliveryFee === 0 ? "FREE" : `₹${deliveryFee}`}
                            </span>
                        </div>
                        {discount > 0 && (
                            <div className="flex justify-between items-center p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                                <span className="text-xs font-black text-emerald-700">Coupon Discount</span>
                                <span className="text-sm font-black text-emerald-600">-₹{discount}</span>
                            </div>
                        )}
                        <div className="pt-4 border-t border-emerald-950/5 flex justify-between items-center">
                            <span className="text-sm font-black text-emerald-950 uppercase tracking-tight">Grand Total</span>
                            <span className="text-2xl font-black text-emerald-950 tracking-tighter tabular-nums">₹{grandTotal.toFixed(0)}</span>
                        </div>
                    </section>

                    {/* Trending Products */}
                    {recommended && recommended.length > 0 && (
                        <section className="space-y-4">
                            <h3 className="text-base font-black text-emerald-950 uppercase tracking-tight px-1">You might also like</h3>
                            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                                {recommended.slice(0, 8).map((product: any) => (
                                    <div key={product.id} className="flex-shrink-0 w-36 bg-white/60 backdrop-blur-sm rounded-[2rem] border border-emerald-950/5 p-3 shadow-sm">
                                        <div className="relative w-full aspect-square bg-white rounded-2xl overflow-hidden mb-3">
                                            <Image src={product.image || "/placeholder.png"} alt={product.name} fill className="object-contain p-2" />
                                        </div>
                                        <p className="text-[10px] font-black text-emerald-950 uppercase tracking-tight line-clamp-2 leading-snug h-7">{product.name}</p>
                                        <p className="text-xs font-black text-emerald-600 mt-1">₹{product.price}</p>
                                        <button className="w-full mt-2 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all border border-emerald-100">
                                            ADD
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}
                </main>

                {/* Sticky Footer */}
                <div className="fixed bottom-0 left-0 right-0 z-[60]">
                    <div className="bg-white/60 backdrop-blur-2xl border-t border-emerald-950/5 shadow-[0_-8px_40px_rgba(0,0,0,0.08)] p-4 space-y-3 max-w-2xl mx-auto">

                        {/* Address Row */}
                        {selectedAddr && (
                            <button
                                onClick={() => setIsAddressDialogOpen(true)}
                                className="w-full flex items-center justify-between px-4 py-2.5 bg-emerald-50/60 hover:bg-emerald-50 rounded-2xl border border-emerald-100 transition-all"
                            >
                                <div className="flex items-center gap-2 min-w-0">
                                    <MapPin className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />
                                    <p className="text-[10px] font-bold text-emerald-950/60 truncate">
                                        Delivering to <span className="text-emerald-700 font-black">{selectedAddr.type}</span> · {selectedAddr.fullAddress}
                                    </p>
                                </div>
                                <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest flex-shrink-0 ml-2">Change</span>
                            </button>
                        )}

                        {/* Payment Method Selector */}
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={() => setPaymentMethod('COD')}
                                className={cn(
                                    "flex items-center justify-center gap-2 py-3 rounded-2xl border text-xs font-black uppercase tracking-widest transition-all",
                                    paymentMethod === 'COD'
                                        ? "bg-emerald-600 text-white border-emerald-600 shadow-lg shadow-emerald-200"
                                        : "bg-white/60 text-emerald-950/50 border-emerald-950/5 hover:bg-white"
                                )}
                            >
                                <Wallet className="h-4 w-4" />
                                Cash on Delivery
                            </button>
                            <button
                                onClick={() => setPaymentMethod('ONLINE')}
                                className={cn(
                                    "flex items-center justify-center gap-2 py-3 rounded-2xl border text-xs font-black uppercase tracking-widest transition-all",
                                    paymentMethod === 'ONLINE'
                                        ? "bg-emerald-600 text-white border-emerald-600 shadow-lg shadow-emerald-200"
                                        : "bg-white/60 text-emerald-950/50 border-emerald-950/5 hover:bg-white"
                                )}
                            >
                                <CreditCard className="h-4 w-4" />
                                Pay Online
                            </button>
                        </div>

                        {/* CTA */}
                        {paymentMethod === 'COD' ? (
                            <Button
                                className="w-full h-16 bg-emerald-600 hover:bg-emerald-700 text-white rounded-[2.5rem] flex items-center justify-between px-8 shadow-xl shadow-emerald-200 transition-all active:scale-95 group"
                                onClick={handlePlaceOrder}
                                disabled={loading || !selectedAddressId || !deliverySlot}
                            >
                                {loading ? (
                                    <Loader2 className="animate-spin h-5 w-5 mx-auto" />
                                ) : (
                                    <>
                                        <div className="flex flex-col items-start leading-none">
                                            <span className="text-base font-black tabular-nums">₹{grandTotal.toFixed(0)}</span>
                                            <span className="text-[8px] font-bold uppercase tracking-widest opacity-60 mt-0.5">Pay on Delivery</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold uppercase tracking-widest">Place Order</span>
                                            <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center group-hover:translate-x-1 transition-transform">
                                                <ArrowRight className="h-3.5 w-3.5" />
                                            </div>
                                        </div>
                                    </>
                                )}
                            </Button>
                        ) : (
                            <PaymentButton
                                amount={grandTotal}
                                address={selectedAddr ? {
                                    fullAddress: selectedAddr.fullAddress,
                                    landmark: selectedAddr.landmark,
                                    type: selectedAddr.type,
                                } : null}
                                items={items}
                                className="w-full !h-16 !rounded-[2.5rem] !mt-0 shadow-xl shadow-emerald-200"
                            />
                        )}

                        {!deliverySlot && (
                            <p className="text-center text-[9px] font-black uppercase tracking-widest text-amber-600 animate-pulse">
                                ⚠ Please select a delivery time slot above
                            </p>
                        )}
                    </div>
                </div>
            </div>

            <Dialog open={isAddressDialogOpen} onOpenChange={setIsAddressDialogOpen}>
                <DialogContent className="rounded-[2.5rem] p-0 border-0 overflow-hidden max-w-lg">
                    <AddressForm
                        onSuccess={() => setIsAddressDialogOpen(false)}
                        onCancel={() => setIsAddressDialogOpen(false)}
                    />
                </DialogContent>
            </Dialog>
        </AuthGuard>
    );
}
