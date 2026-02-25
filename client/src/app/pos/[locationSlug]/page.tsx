"use client";

import { use, useState, useEffect, useRef } from "react";
import {
    QrCode, Search, User as UserIcon, CreditCard,
    Banknote, Trash2, ArrowRight, Pause, RotateCcw,
    Minus, Plus, History, ShoppingCart, Loader2, Package, Globe
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/services/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function POSPage({ params }: any) {
    const { locationSlug } = use(params) as any;
    const [cart, setCart] = useState<any[]>([]);
    const [customer, setCustomer] = useState<any>(null);
    const [paymentMethod, setPaymentMethod] = useState<"CASH" | "ONLINE" | "CREDIT">("CASH");
    const [searchTerm, setSearchTerm] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);
    const [cartDiscount, setCartDiscount] = useState<number>(0);
    const [discountModal, setDiscountModal] = useState<{ type: 'ITEM' | 'CART', index?: number } | null>(null);
    const [activeCategory, setActiveCategory] = useState<string>("all");

    // Suspend & Hold State
    const [suspendedOrders, setSuspendedOrders] = useState<any[]>([]);
    const [showHoldList, setShowHoldList] = useState(false);
    const [showWebOrders, setShowWebOrders] = useState(false);

    // Cash Denomination State
    const [showCashModal, setShowCashModal] = useState(false);
    const [showCustomerModal, setShowCustomerModal] = useState(false);
    const [denominations, setDenominations] = useState<Record<number, number>>({
        500: 0, 200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 2: 0, 1: 0
    });

    // ── Queries ───────────────────────────────────────────────────────
    const { data: storeInfo } = useQuery({
        queryKey: ["store", locationSlug],
        queryFn: async () => {
            const res = await api.get(`/locations/slug/${locationSlug}`);
            return res.data;
        }
    });

    const { data: categories } = useQuery({
        queryKey: ["pos-categories"],
        queryFn: async () => {
            const res = await api.get("/categories");
            return res.data;
        }
    });

    const { data: products } = useQuery({
        queryKey: ["pos-products", storeInfo?.id],
        enabled: !!storeInfo?.id,
        queryFn: async () => {
            const res = await api.get(`/products?limit=100`);
            return res.data.data;
        }
    });

    // ── Barcode Logic ──────────────────────────────────────────────────
    useEffect(() => {
        let barcodeBuffer = "";
        let timeoutId: NodeJS.Timeout;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") return;

            if (e.key === "Enter") {
                if (barcodeBuffer) {
                    // Match SKU-Weight e.g., 101-0.25 (SKU: 101, Weight: 0.25)
                    const match = barcodeBuffer.match(/^(\w+)-(\d+(?:\.\d+)?)$/);
                    if (match && products) {
                        const sku = match[1];
                        const qty = parseFloat(match[2]);
                        const product = products.find((p: any) => p.sku === sku);
                        if (product) {
                            addToCart(product, qty);
                            toast.success(`Scanned ${product.name} x ${qty}${product.weightUnit}`);
                        } else {
                            toast.error("Product not found: " + sku);
                        }
                    } else if (products) {
                        toast.error("Invalid barcode format: " + barcodeBuffer);
                    }
                    barcodeBuffer = "";
                }
                return;
            }

            if (e.key.length === 1) {
                barcodeBuffer += e.key;
                clearTimeout(timeoutId);
                timeoutId = setTimeout(() => { barcodeBuffer = ""; }, 100);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [products]);

    // ── Calculations ──────────────────────────────────────────────────
    const cartSubtotal = cart.reduce((acc, item) => acc + ((item.basePrice - (item.itemDiscount || 0)) * item.quantity), 0);
    const cartTotal = Math.max(0, cartSubtotal - cartDiscount);
    const totalCashReceived = Object.entries(denominations).reduce((acc, [den, qty]) => acc + (Number(den) * qty), 0);
    const changeToReturn = totalCashReceived - cartTotal;

    // ── Handlers ──────────────────────────────────────────────────────
    const addToCart = (product: any, qty: number = 1) => {
        setCart(prev => {
            const existing = prev.find(item => item.id === product.id);
            if (existing) {
                return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + qty } : item);
            }
            return [...prev, { ...product, quantity: qty, itemDiscount: 0 }];
        });
    };

    const handleCheckout = () => {
        if (!customer) {
            toast.error("Please tag a customer for POS transactions");
            return;
        }

        if (paymentMethod === "CASH") {
            setShowCashModal(true);
        } else {
            processOrder();
        }
    };

    const processOrder = async () => {
        if (paymentMethod === "CASH" && changeToReturn < 0) {
            toast.error("Insufficient cash received");
            return;
        }

        setIsProcessing(true);
        try {
            await api.post("/orders/pos/place", {
                userId: customer.id,
                items: cart.map(i => ({ productId: i.id, quantity: i.quantity, discount: i.itemDiscount || 0 })),
                channel: "POS",
                paymentMethod,
                totalAmount: cartTotal,
                isCredit: paymentMethod === "CREDIT"
            });
            toast.success("Order Placed Successfully!");
            setCart([]);
            setCustomer(null);
            setCartDiscount(0);
            setShowCashModal(false);
            setDenominations({ 500: 0, 200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 2: 0, 1: 0 });
        } catch (err: any) {
            toast.error("Failed to place order: " + err.message);
        } finally {
            setIsProcessing(false);
        }
    };

    const suspendOrder = () => {
        if (cart.length === 0) return;
        setSuspendedOrders(prev => [...prev, {
            id: Date.now().toString(),
            cart,
            customer,
            cartDiscount,
            timestamp: new Date()
        }]);
        setCart([]);
        setCustomer(null);
        setCartDiscount(0);
        toast.success("Order Suspended!");
    };

    const resumeOrder = (suspendedOrder: any) => {
        if (cart.length > 0) {
            // Swap current active with suspended if active has items
            setSuspendedOrders(prev => [
                ...prev.filter(o => o.id !== suspendedOrder.id),
                { id: Date.now().toString(), cart, customer, cartDiscount, timestamp: new Date() }
            ]);
        } else {
            setSuspendedOrders(prev => prev.filter(o => o.id !== suspendedOrder.id));
        }
        setCart(suspendedOrder.cart);
        setCustomer(suspendedOrder.customer);
        setCartDiscount(suspendedOrder.cartDiscount);
        setShowHoldList(false);
        toast.success("Order Resumed");
    };

    return (
        <div className="flex h-[calc(100vh-64px)] gap-6 overflow-hidden relative">
            {/* Left Column: Product Selection */}
            <div className="flex-1 flex flex-col gap-6 overflow-hidden">
                <div className="bg-white rounded-3xl border border-gray-100 p-4 shadow-sm flex items-center justify-between gap-4">
                    <div className="flex-1 relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <input
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search product name or SKU..."
                            className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-green-500 font-medium"
                        />
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <button onClick={suspendOrder} disabled={cart.length === 0} className="px-5 py-3.5 bg-orange-50 text-orange-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-orange-100 disabled:opacity-50 transition-all flex items-center gap-2">
                            <Pause className="w-4 h-4" /> Suspend
                        </button>
                        <button onClick={() => setShowHoldList(true)} className="px-5 py-3.5 bg-gray-50 text-gray-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-gray-100 transition-all flex items-center gap-2 relative">
                            <History className="w-4 h-4" /> Hold List
                            {suspendedOrders.length > 0 && (
                                <span className="absolute -top-2 -right-2 w-6 h-6 bg-orange-500 text-white rounded-full flex items-center justify-center text-[10px]">{suspendedOrders.length}</span>
                            )}
                        </button>
                        <button onClick={() => setShowWebOrders(true)} className="px-5 py-3.5 bg-blue-50 text-blue-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-100 transition-all flex items-center gap-2 relative">
                            <Globe className="w-4 h-4" /> Web Orders
                        </button>
                    </div>
                </div>

                {/* Category Quick Access Tabs */}
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 shrink-0 px-1">
                    <button
                        onClick={() => setActiveCategory("all")}
                        className={cn("px-5 py-2.5 rounded-xl font-black text-xs whitespace-nowrap transition-all uppercase tracking-widest", activeCategory === "all" ? "bg-green-600 text-white shadow-md shadow-green-100" : "bg-white text-gray-400 border border-gray-100 hover:border-green-500 hover:text-green-600")}
                    >
                        ALL ITEMS
                    </button>
                    {categories?.map((c: any) => (
                        <button
                            key={c.id}
                            onClick={() => setActiveCategory(c.id)}
                            className={cn("px-5 py-2.5 rounded-xl font-black text-xs whitespace-nowrap transition-all uppercase tracking-widest", activeCategory === c.id ? "bg-green-600 text-white shadow-md shadow-green-100" : "bg-white text-gray-400 border border-gray-100 hover:border-green-500 hover:text-green-600")}
                        >
                            {c.name}
                        </button>
                    ))}
                </div>

                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 content-start">
                    {products?.filter((p: any) => {
                        const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
                        const matchesCategory = activeCategory === "all" || p.categoryId === activeCategory;
                        return matchesSearch && matchesCategory;
                    }).map((p: any) => (
                        <div
                            key={p.id}
                            onClick={() => addToCart(p)}
                            className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm cursor-pointer hover:border-green-500 hover:shadow-lg transition-all active:scale-95 flex flex-col items-center text-center group"
                        >
                            <div className="w-20 h-20 bg-gray-50 rounded-2xl mb-3 flex items-center justify-center overflow-hidden border border-gray-50 group-hover:bg-green-50 transition-colors">
                                {p.images?.[0] ? <img src={p.images[0]} alt="" className="object-cover w-full h-full" /> : <Package className="h-8 w-8 text-gray-200" />}
                            </div>
                            <p className="text-sm font-bold text-gray-900 leading-tight mb-1 line-clamp-2">{p.name}</p>
                            <p className="text-lg font-black text-green-600">₹{p.basePrice}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Right Column: Checkout/Cart */}
            <div className="w-96 bg-white rounded-[2.5rem] border border-gray-100 shadow-xl flex flex-col overflow-hidden">
                <div className="px-6 py-5 bg-gray-50/50 border-b border-gray-100">
                    <h3 className="font-black text-gray-900 flex items-center gap-2 mb-4">
                        <UserIcon className="h-4 w-4" /> Customer
                    </h3>
                    {!customer ? (
                        <button onClick={() => setShowCustomerModal(true)} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-gray-200 text-gray-400 hover:border-green-500 hover:text-green-600 transition-all font-black text-sm active:scale-95 bg-white">
                            <Plus className="h-4 w-4" /> Tag Customer
                        </button>
                    ) : (
                        <div className="flex items-center gap-3 bg-white p-3 rounded-2xl border border-green-100">
                            <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center text-green-600 font-bold">M</div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-black text-gray-900 truncate">{customer.name}</p>
                                <p className="text-[10px] text-gray-400 font-bold">{customer.phone}</p>
                            </div>
                            <button onClick={() => setCustomer(null)} className="p-1.5 hover:bg-gray-50 rounded-lg text-gray-400"><Trash2 className="h-4 w-4" /></button>
                        </div>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                    {cart.map((item, idx) => (
                        <div key={idx} className="flex gap-3 items-center group">
                            <div className="flex-1">
                                <p className="text-sm font-bold text-gray-900 truncate">{item.name}</p>
                                <div className="flex items-center gap-2">
                                    <p className="text-xs text-gray-400 font-medium">₹{item.basePrice} x {item.quantity}</p>
                                    {(item.itemDiscount > 0) && (
                                        <span className="bg-red-50 text-red-600 text-[10px] px-1.5 rounded font-black tracking-widest uppercase">
                                            -₹{item.itemDiscount}/ea
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="flex flex-col items-end">
                                <p className="text-sm font-black text-gray-900">₹{(item.basePrice - (item.itemDiscount || 0)) * item.quantity}</p>
                                <button onClick={() => setDiscountModal({ type: 'ITEM', index: idx })} className="text-[10px] text-gray-400 font-black uppercase tracking-widest hover:text-green-600 opacity-0 group-hover:opacity-100 transition-opacity">
                                    Apply Disc
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="px-8 pt-6 pb-8 border-t border-gray-100 space-y-6 bg-white shrink-0">
                    <div className="space-y-2 mb-4">
                        <div className="flex justify-between text-sm font-bold text-gray-400">
                            <span>Subtotal</span>
                            <span>₹{cartSubtotal}</span>
                        </div>
                        {cartDiscount > 0 ? (
                            <div className="flex justify-between text-sm font-black text-red-500">
                                <span>Cart Discount</span>
                                <div className="flex items-center gap-2">
                                    <span>-₹{cartDiscount}</span>
                                    <button onClick={() => setCartDiscount(0)} className="text-gray-300 hover:text-red-600"><Trash2 className="h-3 w-3" /></button>
                                </div>
                            </div>
                        ) : (
                            <button onClick={() => setDiscountModal({ type: 'CART' })} className="text-xs font-black text-green-600 uppercase tracking-widest hover:text-green-700 transition-colors">
                                + Add Cart Discount
                            </button>
                        )}
                        <div className="flex justify-between text-xl font-black text-gray-900 pt-2 border-t border-gray-100">
                            <span>Total</span>
                            <span className="text-green-600 font-black">₹{cartTotal}</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                        <PaymentTypeBtn active={paymentMethod === "CASH"} onClick={() => setPaymentMethod("CASH")} icon={<Banknote className="h-4 w-4" />} label="Cash" />
                        <PaymentTypeBtn active={paymentMethod === "ONLINE"} onClick={() => setPaymentMethod("ONLINE")} icon={<CreditCard className="h-4 w-4" />} label="Online" />
                        <PaymentTypeBtn active={paymentMethod === "CREDIT"} onClick={() => setPaymentMethod("CREDIT")} icon={<History className="h-4 w-4" />} label="Credit" />
                    </div>

                    <button
                        onClick={handleCheckout}
                        disabled={cart.length === 0 || isProcessing}
                        className="w-full flex items-center justify-center gap-2 py-4 bg-green-600 text-white rounded-2xl font-black text-sm hover:bg-green-700 transition-all active:scale-95 shadow-lg shadow-green-100 disabled:opacity-50"
                    >
                        {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                        Process Checkout
                    </button>
                </div>
            </div>

            {/* Cash Denomination Modal */}
            {showCashModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-[3rem] w-full max-w-xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="p-10 space-y-8">
                            <div className="flex items-center justify-between">
                                <h2 className="text-2xl font-black text-gray-900 tracking-tight">Enter Denominations</h2>
                                <button onClick={() => setShowCashModal(false)} className="bg-gray-50 p-2 rounded-xl text-gray-400 hover:text-gray-900"><Trash2 className="h-5 w-5" /></button>
                            </div>

                            <div className="grid grid-cols-2 gap-x-12 gap-y-6">
                                {[500, 200, 100, 50, 20, 10, 5, 2, 1].map(den => (
                                    <div key={den} className="flex items-center gap-4">
                                        <div className="w-16 h-10 bg-gray-900 rounded-xl flex items-center justify-center text-white font-black text-sm shadow-sm ring-4 ring-gray-50">₹{den}</div>
                                        <span className="text-gray-300 font-bold">×</span>
                                        <input
                                            type="number"
                                            value={denominations[den] || ""}
                                            onChange={(e) => setDenominations({ ...denominations, [den]: parseInt(e.target.value) || 0 })}
                                            className="w-20 bg-gray-50 border-none rounded-xl py-2 px-3 text-center font-black text-gray-900 focus:ring-2 focus:ring-green-500"
                                            placeholder="0"
                                        />
                                    </div>
                                ))}
                            </div>

                            <div className="bg-gray-50 rounded-[2rem] p-8 space-y-4">
                                <div className="flex justify-between text-gray-500 font-bold text-sm">
                                    <span>Total Amount Due</span>
                                    <span>₹{cartTotal}</span>
                                </div>
                                <div className="flex justify-between text-gray-900 font-black text-lg">
                                    <span>Total Cash Given</span>
                                    <span className="text-blue-600">₹{totalCashReceived}</span>
                                </div>
                                <div className="pt-4 border-t border-gray-200 flex justify-between items-center">
                                    <span className="text-gray-500 font-bold">Balance to Return</span>
                                    <span className={cn("text-2xl font-black", changeToReturn >= 0 ? "text-green-600" : "text-red-500")}>
                                        ₹{changeToReturn}
                                    </span>
                                </div>
                            </div>

                            <button
                                onClick={processOrder}
                                disabled={changeToReturn < 0 || isProcessing}
                                className="w-full bg-green-600 text-white py-5 rounded-[2rem] font-black text-lg hover:bg-green-700 transition-all disabled:opacity-50 shadow-xl shadow-green-100"
                            >
                                {isProcessing ? "Processing..." : "Confirm & Print Bill"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Discount Modal */}
            {discountModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl relative">
                        <h3 className="text-xl font-black text-gray-900 tracking-tight mb-2">Apply Discount</h3>
                        <p className="text-sm text-gray-400 font-medium mb-6">
                            {discountModal.type === 'CART' ? "Discount applied to overall bill" : `Discount for ${cart[discountModal.index!]?.name}`}
                        </p>
                        <form onSubmit={(e: any) => {
                            e.preventDefault();
                            const val = parseFloat(e.target.amount.value) || 0;
                            if (discountModal.type === 'CART') {
                                setCartDiscount(val);
                            } else {
                                setCart(prev => {
                                    const newCart = [...prev];
                                    newCart[discountModal.index!].itemDiscount = val;
                                    return newCart;
                                });
                            }
                            setDiscountModal(null);
                        }} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Flat Discount Amount (₹)</label>
                                <input
                                    name="amount"
                                    type="number"
                                    step="0.01"
                                    required
                                    autoFocus
                                    placeholder="0"
                                    defaultValue={discountModal.type === 'CART' ? (cartDiscount || "") : (cart[discountModal.index!]?.itemDiscount || "")}
                                    className="w-full px-6 py-4 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-green-500 font-black text-lg text-gray-900 text-center"
                                />
                            </div>
                            <div className="flex gap-2">
                                <button type="button" onClick={() => setDiscountModal(null)} className="flex-1 py-4 bg-gray-100 text-gray-600 rounded-2xl font-black text-sm hover:bg-gray-200 transition-all">Cancel</button>
                                <button type="submit" className="flex-1 py-4 bg-green-600 text-white rounded-2xl font-black text-sm hover:bg-green-700 active:scale-95 transition-all shadow-lg shadow-green-100">Apply</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <CustomerModal isOpen={showCustomerModal} onClose={() => setShowCustomerModal(false)} onSelect={setCustomer} />

            {/* Hold List Modal */}
            {showHoldList && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-2xl p-8 shadow-2xl relative max-h-[80vh] flex flex-col">
                        <button onClick={() => setShowHoldList(false)} className="absolute right-6 top-6 p-2 bg-gray-50 text-gray-400 rounded-xl hover:bg-gray-100 hover:text-gray-900 transition-all">✕</button>
                        <div className="mb-8 shrink-0">
                            <h2 className="text-2xl font-black text-gray-900">Suspended Orders</h2>
                            <p className="text-sm font-bold text-gray-400">Resume orders placed on hold</p>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4">
                            {suspendedOrders.length === 0 ? (
                                <div className="py-20 flex flex-col items-center justify-center text-gray-300">
                                    <History className="h-12 w-12 opacity-20 mb-4" />
                                    <p className="font-black text-sm uppercase tracking-widest opacity-40">No Suspended Orders</p>
                                </div>
                            ) : (
                                suspendedOrders.map(so => (
                                    <div key={so.id} className="bg-gray-50 p-6 rounded-3xl border border-gray-100 flex items-center justify-between group hover:border-orange-500 transition-all">
                                        <div>
                                            <div className="flex items-center gap-3 mb-2">
                                                <span className="px-3 py-1 bg-white rounded-lg text-[10px] font-black uppercase text-gray-500 shadow-sm border border-gray-100">
                                                    {so.timestamp.toLocaleTimeString()}
                                                </span>
                                                {so.customer && <span className="text-sm font-black text-gray-900">{so.customer.name}</span>}
                                                {!so.customer && <span className="text-sm font-bold text-orange-500 italic">Walk-in</span>}
                                            </div>
                                            <p className="text-xs font-bold text-gray-400">{so.cart.length} unique items • Subtotal: ₹{so.cart.reduce((acc: number, item: any) => acc + (item.basePrice * item.quantity), 0)}</p>
                                        </div>
                                        <button
                                            onClick={() => resumeOrder(so)}
                                            className="px-6 py-3 bg-white text-orange-600 rounded-xl font-black text-sm shadow-sm border border-gray-100 hover:bg-orange-600 hover:text-white transition-all active:scale-95"
                                        >
                                            Resume Order
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            <WebOrdersModal isOpen={showWebOrders} onClose={() => setShowWebOrders(false)} locationId={storeInfo?.id} />
        </div>
    );
}

function PaymentTypeBtn({ active, onClick, icon, label }: any) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "flex flex-col items-center gap-1.5 py-3 rounded-2xl border transition-all",
                active ? "bg-green-600 border-green-600 text-white shadow-md shadow-green-100" : "border-gray-100 bg-white text-gray-400"
            )}
        >
            {icon}
            <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
        </button>
    );
}

function CustomerModal({ isOpen, onClose, onSelect }: any) {
    const [search, setSearch] = useState("");

    // Quick inline query for existing users
    const { data: users, isLoading } = useQuery({
        queryKey: ["user-search", search],
        enabled: search.length >= 3,
        queryFn: async () => {
            const res = await api.get(`/users/search?search=${search}`);
            return res.data;
        }
    });

    const createMutation = useMutation({
        mutationFn: (data: any) => api.post("/user-analytics/create-staff", { ...data, role: "CUSTOMER", locationId: null }),
        onSuccess: (res) => {
            toast.success("Customer Registered!");
            onSelect(res.data.user || res.data);
            onClose();
        }
    });

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-[2.5rem] w-full max-w-md p-8 shadow-2xl relative">
                <button onClick={onClose} className="absolute right-6 top-6 p-2 bg-gray-50 text-gray-400 rounded-xl hover:bg-gray-100 hover:text-gray-900 transition-all">✕</button>
                <div className="mb-8">
                    <h2 className="text-2xl font-black text-gray-900">Tag Customer</h2>
                    <p className="text-sm font-bold text-gray-400">Search existing or add new</p>
                </div>

                <div className="space-y-6">
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <input
                            autoFocus
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Enter Name or 10-digit Phone..."
                            className="w-full pl-12 pr-4 py-4 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-green-500 font-bold"
                        />
                    </div>

                    {search.length >= 3 ? (
                        <div className="space-y-2 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                            {isLoading && <p className="text-center font-bold text-gray-400 py-4">Searching...</p>}
                            {users?.map((u: any) => (
                                <button
                                    key={u.id}
                                    onClick={() => { onSelect(u); onClose(); }}
                                    className="w-full flex items-center justify-between p-4 rounded-2xl bg-white border border-gray-100 hover:border-green-500 hover:bg-green-50 transition-all text-left"
                                >
                                    <div>
                                        <p className="font-black text-gray-900">{u.name}</p>
                                        <p className="text-xs font-bold text-gray-400">{u.phone}</p>
                                    </div>
                                    <div className="h-8 w-8 bg-green-100 text-green-600 rounded-xl flex items-center justify-center shadow-inner">
                                        <ArrowRight className="h-4 w-4" />
                                    </div>
                                </button>
                            ))}
                            {users?.length === 0 && (
                                <div className="text-center py-4 space-y-4">
                                    <p className="font-bold text-gray-400">No customer found.</p>
                                    <form onSubmit={(e: any) => {
                                        e.preventDefault();
                                        const phone = /[0-9]{10}/.test(search) ? search : "";
                                        const name = phone ? "" : search;
                                        createMutation.mutate({
                                            phone: e.target.phone.value,
                                            name: e.target.name.value,
                                            password: "DUMMY_PASSWORD_123"
                                        });
                                    }} className="space-y-3 p-4 bg-gray-50 border border-gray-200 rounded-3xl">
                                        <input name="name" required defaultValue={/[0-9]/.test(search) ? "" : search} placeholder="Full Name" className="w-full px-4 py-3 rounded-xl border border-gray-200 font-bold text-sm" />
                                        <input name="phone" required defaultValue={/[0-9]{10}/.test(search) ? search : ""} placeholder="Phone Number" className="w-full px-4 py-3 rounded-xl border border-gray-200 font-bold text-sm" />
                                        <button disabled={createMutation.isPending} type="submit" className="w-full bg-gray-900 text-white py-3 rounded-xl font-black text-sm hover:bg-black transition-all">
                                            {createMutation.isPending ? "Registering..." : "Quick Register"}
                                        </button>
                                    </form>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="py-10 text-center text-gray-300 flex flex-col items-center gap-4">
                            <Search className="h-10 w-10 opacity-20" />
                            <p className="font-black text-xs uppercase tracking-widest opacity-40">Type at least 3 chars</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function WebOrdersModal({ isOpen, onClose, locationId }: any) {
    const queryClient = useQueryClient();
    const { data: orders, isLoading } = useQuery({
        queryKey: ["web-orders", locationId],
        enabled: isOpen && !!locationId,
        queryFn: async () => {
            const res = await api.get(`/orders/admin/all?channel=WEB`);
            return res.data.data;
        }
    });

    const processMutation = useMutation({
        mutationFn: (orderId: string) => api.post(`/orders/${orderId}/process-web-order`, { locationId }),
        onSuccess: () => {
            toast.success("Web Order Processed & Moved to Packer");
            queryClient.invalidateQueries({ queryKey: ["web-orders"] });
        }
    });

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-[2.5rem] w-full max-w-2xl p-8 shadow-2xl relative max-h-[80vh] flex flex-col">
                <button onClick={onClose} className="absolute right-6 top-6 p-2 bg-gray-50 text-gray-400 rounded-xl hover:bg-gray-100 hover:text-gray-900 transition-all">✕</button>
                <div className="mb-8 shrink-0">
                    <h2 className="text-2xl font-black text-gray-900">Web Orders</h2>
                    <p className="text-sm font-bold text-gray-400">Process incoming orders from the app/website</p>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4">
                    {isLoading && <p className="text-center font-bold text-gray-400 py-10">Loading...</p>}
                    {!isLoading && orders?.filter((o: any) => o.status === 'PENDING' || o.status === 'CONFIRMED').length === 0 && (
                        <div className="py-20 flex flex-col items-center justify-center text-gray-300">
                            <Globe className="h-12 w-12 opacity-20 mb-4" />
                            <p className="font-black text-sm uppercase tracking-widest opacity-40">No Pending Web Orders</p>
                        </div>
                    )}
                    {!isLoading && orders?.filter((o: any) => o.status === 'PENDING' || o.status === 'CONFIRMED').map((o: any) => (
                        <div key={o.id} className="bg-blue-50 p-6 rounded-3xl border border-blue-100 flex items-center justify-between group hover:border-blue-500 transition-all">
                            <div>
                                <div className="flex items-center gap-3 mb-2">
                                    <span className="px-3 py-1 bg-white rounded-lg text-[10px] font-black uppercase text-blue-600 shadow-sm border border-blue-100">
                                        {new Date(o.createdAt).toLocaleTimeString()}
                                    </span>
                                    <span className="text-sm font-black text-gray-900">{o.user?.name || 'Guest'}</span>
                                </div>
                                <p className="text-xs font-bold text-gray-500">{o.items.length} items • ₹{o.totalAmount} • {o.channel}</p>
                            </div>
                            <button
                                onClick={() => processMutation.mutate(o.id)}
                                disabled={processMutation.isPending}
                                className="px-6 py-3 bg-blue-600 text-white rounded-xl font-black text-sm shadow-sm hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50"
                            >
                                Process Order
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
