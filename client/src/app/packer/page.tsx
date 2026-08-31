"use client";

import { useState, useEffect } from "react";
import api from "@/services/api";
import { toast } from "sonner";
import { 
    Package, 
    CheckCircle2, 
    PlusCircle,
    QrCode, 
    ClipboardList, 
    Search, 
    Trash2, 
    Phone, 
    AlertTriangle, 
    Check, 
    X,
    Clock,
    Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import QRScanner from "@/components/ui/qr-scanner";
import { useUserStore } from "@/store/useUserStore";

export default function PackerDashboard() {
    const { user } = useUserStore();
    const [assignments, setAssignments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Modals
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showQrScanner, setShowQrScanner] = useState(false);
    const [manualBillId, setManualBillId] = useState("");
    const [validatingQr, setValidatingQr] = useState(false);
    const [validationResult, setValidationResult] = useState<{ success: boolean; message: string; order?: any } | null>(null);

    // Order Creation Form State
    const [customerQuery, setCustomerQuery] = useState("");
    const [customerResults, setCustomerResults] = useState<any[]>([]);
    const [searchingCustomer, setSearchingCustomer] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
    const [isNewCustomer, setIsNewCustomer] = useState(false);
    const [newCustName, setNewCustName] = useState("");
    const [newCustPhone, setNewCustPhone] = useState("");
    const [newCustAddress, setNewCustAddress] = useState("");

    // Product Search & Packing Items
    const [productQuery, setProductQuery] = useState("");
    const [productResults, setProductResults] = useState<any[]>([]);
    const [searchingProduct, setSearchingProduct] = useState(false);
    const [packingList, setPackingList] = useState<Array<{
        productId: string;
        code: string;
        name: string;
        variantId?: string;
        variantName?: string;
        sellingPrice: number;
        quantity: number;
        unit: string;
        instructions?: string;
    }>>([]);
    const [orderNotes, setOrderNotes] = useState("");
    const [submittingOrder, setSubmittingOrder] = useState(false);

    const fetchOrders = async () => {
        setLoading(true);
        try {
            const res = await api.get("/orders/packing/assignments");
            setAssignments(res.data.data || []);
        } catch (error) {
            toast.error("Failed to load warehouse packing registry");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOrders();
    }, []);

    // Search Customers by Name or Phone
    useEffect(() => {
        if (!customerQuery.trim() || selectedCustomer) {
            setCustomerResults([]);
            return;
        }
        const timer = setTimeout(async () => {
            setSearchingCustomer(true);
            try {
                const res = await api.get(`/users/admin/all?search=${encodeURIComponent(customerQuery.trim())}&limit=5`);
                setCustomerResults(res.data.users || res.data || []);
            } catch (err) {
                // Ignore silent search errors
            } finally {
                setSearchingCustomer(false);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [customerQuery, selectedCustomer]);

    // Search Products by Code / Name
    useEffect(() => {
        if (!productQuery.trim()) {
            setProductResults([]);
            return;
        }
        const timer = setTimeout(async () => {
            setSearchingProduct(true);
            try {
                const res = await api.get(`/products?search=${encodeURIComponent(productQuery.trim())}&limit=8`);
                setProductResults(res.data.products || res.data || []);
            } catch (err) {
                // Ignore silent errors
            } finally {
                setSearchingProduct(false);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [productQuery]);

    // Add Product to Packing List
    const addProductToPackingList = (product: any, variant?: any) => {
        const existingIdx = packingList.findIndex(
            item => item.productId === product.id && (variant ? item.variantId === variant.id : !item.variantId)
        );

        if (existingIdx > -1) {
            const updated = [...packingList];
            updated[existingIdx].quantity += 1;
            setPackingList(updated);
            toast.info(`Updated quantity for ${product.name}`);
        } else {
            const price = variant ? Number(variant.price) : Number(product.basePrice || 0);
            const unit = variant?.weightUnit || product.weightUnit || "KG";
            const code = product.barcode || product.sku || product.id.slice(0, 6).toUpperCase();
            
            setPackingList(prev => [
                ...prev,
                {
                    productId: product.id,
                    code,
                    name: product.name,
                    variantId: variant?.id,
                    variantName: variant?.name,
                    sellingPrice: price,
                    quantity: 1,
                    unit,
                    instructions: ""
                }
            ]);
            toast.success(`Added ${product.name} to packing list`);
        }
        setProductQuery("");
        setProductResults([]);
    };

    const updateItemQty = (index: number, newQty: number) => {
        if (newQty <= 0) {
            removeItem(index);
            return;
        }
        const updated = [...packingList];
        updated[index].quantity = newQty;
        setPackingList(updated);
    };

    const updateItemInstructions = (index: number, note: string) => {
        const updated = [...packingList];
        updated[index].instructions = note;
        setPackingList(updated);
    };

    const removeItem = (index: number) => {
        setPackingList(prev => prev.filter((_, i) => i !== index));
    };

    const handleCreateOrder = async (e: React.FormEvent) => {
        e.preventDefault();
        if (packingList.length === 0) {
            toast.error("Please add at least one product to the packing list");
            return;
        }

        let customerIdVal = selectedCustomer?.id;
        let custNameVal = selectedCustomer?.name || newCustName;
        let custPhoneVal = selectedCustomer?.phone || newCustPhone;
        let custAddrVal = selectedCustomer?.addresses?.[0]?.fullAddress || selectedCustomer?.profileAddress || newCustAddress;

        if (!customerIdVal && !custPhoneVal) {
            toast.error("Customer phone or tagged customer is required");
            return;
        }

        setSubmittingOrder(true);
        try {
            const res = await api.post("/orders/packing/create-order", {
                customerId: customerIdVal,
                customerName: custNameVal,
                customerPhone: custPhoneVal,
                customerAddress: custAddrVal,
                items: packingList.map(item => ({
                    productId: item.productId,
                    variantId: item.variantId,
                    quantity: item.quantity,
                    sellingPrice: item.sellingPrice,
                    notes: item.instructions
                })),
                notes: orderNotes,
                isDelivery: true
            });

            toast.success("Order marked as PACKED and registered for billing!", {
                description: `Order ID: #${res.data.order?.id?.slice(-6).toUpperCase()}`
            });

            // Reset Form
            setShowCreateModal(false);
            setSelectedCustomer(null);
            setIsNewCustomer(false);
            setCustomerQuery("");
            setNewCustName("");
            setNewCustPhone("");
            setNewCustAddress("");
            setPackingList([]);
            setOrderNotes("");
            fetchOrders();
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Failed to create packed order");
        } finally {
            setSubmittingOrder(false);
        }
    };

    // QR Validation Trigger
    const handleScanQr = async (scannedText: string) => {
        setShowQrScanner(false);
        if (!scannedText.trim()) return;

        setValidatingQr(true);
        setValidationResult(null);

        try {
            const res = await api.post("/orders/packing/validate-qr", {
                qrData: scannedText.trim()
            });

            setValidationResult({
                success: true,
                message: res.data.message || "Bill Validated Successfully",
                order: res.data.order
            });
            toast.success("Bill Validated Successfully");
            fetchOrders();
        } catch (error: any) {
            const errMsg = error.response?.data?.message || "This bill was not packed by you. Please verify the order.";
            setValidationResult({
                success: false,
                message: errMsg
            });
            toast.error(errMsg);
        } finally {
            setValidatingQr(false);
        }
    };

    const handleManualQrSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!manualBillId.trim()) return;
        handleScanQr(manualBillId.trim());
        setManualBillId("");
    };

    return (
        <div className="space-y-6 pb-24 animate-in fade-in duration-500 max-w-2xl mx-auto">
            {/* Header Action Bar */}
            <div className="bg-white p-6 rounded-[2.5rem] shadow-xl border border-blue-50 relative overflow-hidden">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-xl font-black text-slate-900 tracking-tight">Packer Control Hub</h2>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                            Operator: <span className="text-blue-600 font-black">{user?.name || "Active Packer"}</span>
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
                        <Button 
                            onClick={() => setShowCreateModal(true)}
                            className="flex-1 sm:flex-initial h-13 px-5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-blue-200 flex items-center gap-2 active:scale-95"
                        >
                            <PlusCircle className="h-4 w-4" />
                            Create Order
                        </Button>
                        <Button 
                            onClick={() => setShowQrScanner(true)}
                            variant="outline"
                            className="flex-1 sm:flex-initial h-13 px-5 rounded-2xl border-2 border-slate-900 bg-slate-900 hover:bg-black text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-slate-200 flex items-center gap-2 active:scale-95"
                        >
                            <QrCode className="h-4 w-4 text-emerald-400" />
                            Validate Bill QR
                        </Button>
                    </div>
                </div>
            </div>

            {/* Validation Result Banner */}
            {validationResult && (
                <div className={cn(
                    "p-6 rounded-[2rem] border shadow-xl animate-in zoom-in-95 duration-300 flex items-start gap-4",
                    validationResult.success 
                        ? "bg-emerald-50 border-emerald-200 text-emerald-950" 
                        : "bg-rose-50 border-rose-200 text-rose-950"
                )}>
                    <div className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm",
                        validationResult.success ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"
                    )}>
                        {validationResult.success ? <CheckCircle2 className="h-6 w-6" /> : <AlertTriangle className="h-6 w-6" />}
                    </div>
                    <div className="flex-1 min-w-0">
                        <h4 className="text-base font-black uppercase tracking-tight">
                            {validationResult.success ? "Bill Validated Successfully" : "Validation Rejected"}
                        </h4>
                        <p className="text-xs font-bold mt-1 leading-relaxed opacity-90">
                            {validationResult.message}
                        </p>
                        {validationResult.order && (
                            <div className="mt-3 p-3 bg-white/70 rounded-xl text-[11px] font-bold space-y-1">
                                <div>Order ID: <span className="font-black text-slate-900">#{validationResult.order.id}</span></div>
                                <div>Customer: <span className="text-slate-700">{validationResult.order.user?.name} ({validationResult.order.user?.phone})</span></div>
                            </div>
                        )}
                    </div>
                    <button 
                        onClick={() => setValidationResult(null)}
                        className="p-1 rounded-full text-slate-400 hover:text-slate-700"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>
            )}

            {/* Quick Bill ID Input Option */}
            <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm">
                <form onSubmit={handleManualQrSubmit} className="flex gap-2">
                    <Input 
                        type="text" 
                        placeholder="Scan or enter POS Bill / Order ID to validate..."
                        value={manualBillId}
                        onChange={(e) => setManualBillId(e.target.value)}
                        className="h-13 rounded-2xl bg-slate-50 border-none text-xs font-bold pl-4 shadow-inner"
                    />
                    <Button 
                        type="submit" 
                        disabled={!manualBillId.trim() || validatingQr}
                        className="h-13 px-6 rounded-2xl bg-slate-900 text-white font-black text-xs uppercase tracking-wider shrink-0"
                    >
                        {validatingQr ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify Bill"}
                    </Button>
                </form>
            </div>

            {/* Active Packing Queue */}
            <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                        <ClipboardList className="h-4 w-4 text-blue-600" />
                        Warehouse Packing Log ({assignments.length})
                    </h3>
                    <Button variant="ghost" size="sm" onClick={fetchOrders} className="text-xs font-bold text-slate-500">
                        Refresh
                    </Button>
                </div>

                {loading ? (
                    <div className="p-12 text-center bg-white rounded-3xl border border-slate-100 shadow-sm">
                        <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600 mb-3" />
                        <p className="text-xs font-black uppercase tracking-widest text-slate-400">Loading Warehouse Logs...</p>
                    </div>
                ) : assignments.length === 0 ? (
                    <div className="p-12 text-center bg-white rounded-[2.5rem] border border-slate-100 shadow-sm space-y-3">
                        <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mx-auto shadow-inner">
                            <Package className="h-8 w-8" />
                        </div>
                        <h4 className="text-base font-bold text-slate-900">No Orders in Queue</h4>
                        <p className="text-xs text-slate-400 max-w-xs mx-auto font-medium">
                            Create a WhatsApp order above or wait for store orders to be dispatched.
                        </p>
                    </div>
                ) : (
                    assignments.map((order) => {
                        const isValidated = Boolean(order.packerValidatedAt);
                        return (
                            <div 
                                key={order.id}
                                className={cn(
                                    "bg-white rounded-[2rem] p-6 border transition-all duration-300 shadow-sm hover:shadow-md",
                                    isValidated ? "border-emerald-200 bg-emerald-50/20" : "border-slate-100"
                                )}
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="space-y-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-black uppercase text-slate-900 tracking-wider">
                                                #{order.id.slice(-8).toUpperCase()}
                                            </span>
                                            {isValidated ? (
                                                <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-700 flex items-center gap-1">
                                                    <Check className="h-3 w-3" /> Bill Validated
                                                </span>
                                            ) : (
                                                <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-amber-100 text-amber-700">
                                                    Awaiting Bill QR Scan
                                                </span>
                                            )}
                                        </div>
                                        <h4 className="text-base font-black text-slate-800 truncate">
                                            {order.user?.name || "WhatsApp Client"}
                                        </h4>
                                        <p className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
                                            <Phone className="h-3 w-3 text-slate-400" /> {order.user?.phone}
                                        </p>
                                    </div>

                                    <div className="text-right shrink-0">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Bill</p>
                                        <p className="text-base font-black text-slate-900">₹{Number(order.totalAmount).toFixed(2)}</p>
                                    </div>
                                </div>

                                {/* Items packing list */}
                                <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                        Packing List ({order.items?.length || 0} Items)
                                    </p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {order.items?.map((item: any, idx: number) => (
                                            <div key={idx} className="p-2.5 bg-slate-50 rounded-xl text-xs font-bold flex justify-between items-center">
                                                <div className="truncate pr-2">
                                                    <span className="text-[9px] text-blue-600 font-black block uppercase">
                                                        [{item.product?.barcode || item.product?.sku || item.productId.slice(0, 5).toUpperCase()}]
                                                    </span>
                                                    <span className="text-slate-800">{item.product?.name}</span>
                                                </div>
                                                <span className="px-2 py-1 bg-white rounded-lg text-slate-900 font-black text-[11px] shrink-0 border border-slate-100">
                                                    {Number(item.quantity)} {item.variant?.weightUnit || item.product?.weightUnit || "KG"}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {!isValidated && (
                                    <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                                        <p className="text-[10px] font-bold text-amber-700 flex items-center gap-1">
                                            <Clock className="h-3.5 w-3.5" /> Please scan the printed bill QR to complete validation
                                        </p>
                                        <Button
                                            size="sm"
                                            onClick={() => handleScanQr(order.id)}
                                            className="h-10 px-4 rounded-xl bg-slate-900 hover:bg-black text-white text-[10px] font-black uppercase tracking-wider"
                                        >
                                            Validate Now
                                        </Button>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
