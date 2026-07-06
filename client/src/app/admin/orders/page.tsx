"use client";

import { 
    ShoppingCart, 
    Search, 
    Filter, 
    MoreHorizontal,
    Eye,
    ChevronLeft,
    ChevronRight,
    ArrowUpDown,
    CheckCircle2,
    XCircle,
    Truck,
    Clock,
    User,
    CreditCard,
    ExternalLink,
    X,
    Save,
    MapPin,
    AlertCircle,
    Activity,
    Smartphone,
    PackageCheck,
    Box,
    Check,
    RefreshCcw,
    ShieldCheck,
    MessageSquare
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import api from "@/services/api";
import { toast } from "sonner";
import { format } from "date-fns";
import { initSocket } from "@/services/socketService";
import { useUserStore } from "@/store/useUserStore";
import { Volume2, VolumeX } from "lucide-react";
import Link from "next/link";

const STEPS = [
    { key: "PENDING", label: "Order Placed", icon: Clock },
    { key: "CONFIRMED", label: "Confirmed", icon: CheckCircle2 },
    { key: "PROCESSING", label: "Processing", icon: Activity },
    { key: "SHIPPED", label: "Shipped", icon: Box },
    { key: "OUT_FOR_DELIVERY", label: "Out for Delivery", icon: Truck },
    { key: "DELIVERED", label: "Delivered", icon: Check },
];

const ORDER_STATUSES = [
    "PENDING", 
    "CONFIRMED", 
    "PROCESSING", 
    "PACKED", 
    "SHIPPED", 
    "OUT_FOR_DELIVERY", 
    "DELIVERED", 
    "CANCELLED", 
    "RETURNED"
];

export default function AdminOrders() {
    const { user } = useUserStore();
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [selectedOrder, setSelectedOrder] = useState<any>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    
    // Driver Assignment Details
    const [drivers, setDrivers] = useState<any[]>([]);
    const [isDriverSelectOpen, setIsDriverSelectOpen] = useState(false);
    const [selectedDriverId, setSelectedDriverId] = useState("");

    const fetchOrders = async () => {
        setLoading(true);
        try {
            const res = await api.get("/orders/admin/all");
            setOrders(res.data.data || []);
        } catch (error) {
            toast.error("Failed to synchronize commerce data");
        } finally {
            setLoading(false);
        }
    };
    
    const fetchDrivers = async () => {
        try {
            const res = await api.get("/users/admin/drivers");
            setDrivers(res.data || []);
        } catch (error) {
            toast.error("Failed to fetch available logistical partners");
        }
    };

    useEffect(() => {
        fetchOrders();
    }, []);

    const filteredOrders = useMemo(() => {
        if (!Array.isArray(orders)) return [];
        return orders.filter(order => {
            const matchesSearch = 
                order.id?.toLowerCase().includes(search.toLowerCase()) || 
                order.user?.name?.toLowerCase().includes(search.toLowerCase());
            const matchesStatus = statusFilter === "ALL" || order.status === statusFilter;
            return matchesSearch && matchesStatus;
        });
    }, [orders, search, statusFilter]);

    const handleViewDetails = (order: any) => {
        setSelectedOrder(order);
        setIsDetailOpen(true);
    };

    const updateStatus = async (newStatus: string, assignedDriverId?: string) => {
        if (!selectedOrder) return;
        
        // Intercept SHIPPED status to assign driver if not yet assigned
        if (newStatus === "SHIPPED" && !assignedDriverId) {
            if (drivers.length === 0) fetchDrivers();
            setIsDriverSelectOpen(true);
            return;
        }

        setIsUpdating(true);
        try {
            const payload: any = { status: newStatus };
            if (assignedDriverId) payload.deliveryPartnerId = assignedDriverId;
            
            const res = await api.patch(`/orders/${selectedOrder.id}/status`, payload);
            toast.success(`Protocol updated to ${newStatus}`);
            setSelectedOrder({ 
                ...selectedOrder, 
                status: newStatus,
                ...(assignedDriverId && { deliveryPartnerId: assignedDriverId })
            });
            setIsDriverSelectOpen(false);
            setSelectedDriverId("");
            fetchOrders();
        } catch (error) {
            toast.error("Failed to override fulfillment state.");
        } finally {
            setIsUpdating(false);
        }
    };

    const markAsPaid = async (paidState: boolean) => {
        if (!selectedOrder) return;
        setIsUpdating(true);
        try {
            await api.patch(`/orders/${selectedOrder.id}/payment`, { isPaid: paidState });
            toast.success(`Financial record marked as ${paidState ? 'AUTHORIZED' : 'PENDING'}`);
            setSelectedOrder({ ...selectedOrder, isPaid: paidState });
            fetchOrders();
        } catch (error) {
            toast.error("Failed to reconcile financial protocol.");
        } finally {
            setIsUpdating(false);
        }
    };

    const getStepIndex = (status: string) => {
        return STEPS.findIndex(step => step.key === status);
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <Dialog open={isDriverSelectOpen} onOpenChange={setIsDriverSelectOpen}>
                <DialogContent className="max-w-md p-6 bg-white border-none rounded-3xl shadow-2xl">
                    <div className="space-y-6">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center">
                                <Truck className="h-5 w-5" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-slate-900 tracking-tight">Assign Partner</h3>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select logistical resource</p>
                            </div>
                        </div>

                        <div className="space-y-2">
                            {drivers.length === 0 ? (
                                <p className="text-sm text-slate-500 py-4 text-center">No active delivery partners found.</p>
                            ) : (
                                drivers.map(driver => (
                                    <button
                                        key={driver.id}
                                        onClick={() => setSelectedDriverId(driver.id)}
                                        className={cn(
                                            "w-full flex items-center justify-between p-4 rounded-2xl border transition-all",
                                            selectedDriverId === driver.id 
                                                ? "border-emerald-500 bg-emerald-50 text-emerald-900" 
                                                : "border-slate-200 hover:border-emerald-200 hover:bg-slate-50 text-slate-700"
                                        )}
                                    >
                                        <div className="flex flex-col items-start gap-1">
                                            <span className="text-sm font-bold">{driver.name || "Unknown"}</span>
                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">TEL: {driver.phone}</span>
                                        </div>
                                        {selectedDriverId === driver.id && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                                    </button>
                                ))
                            )}
                        </div>

                        <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                            <button 
                                onClick={() => setIsDriverSelectOpen(false)}
                                className="flex-1 h-12 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold uppercase tracking-widest transition-colors"
                            >
                                Cancel
                            </button>
                            <button 
                                disabled={!selectedDriverId || isUpdating}
                                onClick={() => updateStatus("SHIPPED", selectedDriverId)}
                                className="flex-1 h-12 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
                            >
                                {isUpdating && <RefreshCcw className="h-3 w-3 animate-spin" />}
                                Dispatch
                            </button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
                <DialogContent className="max-w-4xl w-[95vw] md:w-full p-0 overflow-hidden border-none bg-slate-50 rounded-2xl md:rounded-[32px] shadow-2xl">
                    {selectedOrder && (
                        <div className="flex flex-col max-h-[90vh]">
                            {/* Modal Header */}
                            <div className="p-8 pb-6 bg-white border-b border-slate-100">
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center">
                                            <ShoppingCart className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-bold text-slate-900 tracking-tight tracking-[-0.04em]">Order #{selectedOrder.id.slice(-8).toUpperCase()}</h3>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{selectedOrder.location?.name || "Main fulfillment hub"}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="relative group">
                                            <select 
                                                disabled={isUpdating}
                                                value={selectedOrder.status}
                                                onChange={(e) => updateStatus(e.target.value)}
                                                className="h-10 pl-4 pr-10 rounded-xl bg-slate-100 border-none text-[10px] font-black uppercase tracking-widest text-slate-600 appearance-none cursor-pointer hover:bg-slate-200 transition-colors"
                                            >
                                                {ORDER_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                                            </select>
                                            <RefreshCcw className={cn("absolute right-3 top-3 h-4 w-4 text-slate-400 pointer-events-none", isUpdating && "animate-spin")} />
                                        </div>

                                        <button onClick={() => setIsDetailOpen(false)} className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 hover:text-slate-900 transition-colors flex items-center justify-center">
                                            <X className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>

                                {/* LOGISTICAL PROGRESS STEPPER (VERTICAL IN SIDEBAR) */}
                            </div>

                            <div className="flex-1 overflow-y-auto p-8 grid grid-cols-1 lg:grid-cols-4 gap-8">
                                {/* Left column: Logistical Progress Vertical Stepper */}
                                <div className="lg:col-span-1 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm h-fit">
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 px-1">Logistical Pipeline</h4>
                                    
                                    <div className="relative flex flex-col gap-6 pl-4 border-l-2 border-slate-100 ml-4 py-2">
                                        {STEPS.map((step, idx: number) => {
                                            const isCompleted = getStepIndex(selectedOrder.status) >= idx;
                                            const isCurrent = step.key === selectedOrder.status;
                                            const StepIcon = step.icon;
                                            
                                            return (
                                                <button 
                                                    key={idx} 
                                                    disabled={isUpdating}
                                                    onClick={() => updateStatus(step.key)}
                                                    className="relative z-10 flex items-center gap-4 group/step text-left w-full hover:bg-slate-50 p-2 rounded-xl transition-all"
                                                >
                                                    {/* Left dot/icon indicator */}
                                                    <div className={cn(
                                                        "w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500 border-4 shrink-0 -ml-[30px] z-20 bg-white",
                                                        isCompleted 
                                                            ? "bg-emerald-500 border-emerald-100 text-white shadow-md shadow-emerald-500/20" 
                                                            : "border-slate-50 text-slate-300 group-hover/step:border-emerald-100"
                                                    )}>
                                                        <StepIcon className={cn("h-4 w-4", isCurrent && "animate-pulse")} />
                                                    </div>
                                                    <div className="flex-1">
                                                        <span className={cn(
                                                            "text-[10px] font-black uppercase tracking-widest block leading-none",
                                                            isCompleted ? "text-emerald-600" : "text-slate-400"
                                                        )}>
                                                            {step.label}
                                                        </span>
                                                        {isCurrent && (
                                                            <span className="inline-block text-[8px] bg-emerald-50 text-emerald-600 border border-emerald-200 font-bold px-1.5 py-0.5 rounded uppercase tracking-wider mt-1.5">Active</span>
                                                        )}
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Right column: Details and lists */}
                                <div className="lg:col-span-3 space-y-8">
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                                            <div className="flex items-center gap-2 mb-4">
                                                <User className="h-4 w-4 text-emerald-500" />
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Client Identifier</span>
                                            </div>
                                            <div className="space-y-2">
                                                <p className="text-sm font-bold text-slate-900">{selectedOrder.user?.name || "Anonymous Guest"}</p>
                                                <div className="flex items-center gap-2 text-slate-500">
                                                    <Smartphone className="h-3 w-3" />
                                                    <span className="text-[11px] font-medium tracking-tight">TEL: {selectedOrder.user?.phone || "Registry Missing"}</span>
                                                </div>
                                                {selectedOrder.userId && (
                                                    <Link 
                                                        href={`/admin/chat?userId=${selectedOrder.userId}&orderId=${selectedOrder.id}`}
                                                        className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-black text-emerald-600 uppercase tracking-widest hover:underline"
                                                    >
                                                        <MessageSquare className="h-3.5 w-3.5" />
                                                        Chat referencing Order
                                                    </Link>
                                                )}
                                            </div>
                                        </div>

                                        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative group/pay">
                                            <div className="flex items-center gap-2 mb-4">
                                                <CreditCard className="h-4 w-4 text-emerald-500" />
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pricing Protocol</span>
                                            </div>
                                            <div className="space-y-2">
                                                <p className="text-2xl font-black text-slate-900 tabular-nums tracking-tighter">₹{Number(selectedOrder.totalAmount).toLocaleString()}</p>
                                                <div className="flex items-center gap-3">
                                                    <div className={cn(
                                                        "inline-flex px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest leading-none",
                                                        selectedOrder.isPaid ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                                                    )}>
                                                        {selectedOrder.isPaid ? "PAYMENT_AUTHORIZED" : "PAYMENT_AWAITING"}
                                                    </div>
                                                    
                                                    {!selectedOrder.isPaid && (
                                                        <button 
                                                            disabled={isUpdating}
                                                            onClick={() => markAsPaid(true)}
                                                            className="text-[9px] font-black text-emerald-600 uppercase tracking-widest hover:underline flex items-center gap-1"
                                                        >
                                                            <ShieldCheck className="h-3 w-3" />
                                                            Reconcile Payment
                                                        </button>
                                                    )}
                                                    {selectedOrder.isPaid && (
                                                        <button 
                                                            disabled={isUpdating}
                                                            onClick={() => markAsPaid(false)}
                                                            className="text-[9px] font-black text-slate-300 uppercase tracking-widest hover:text-red-400 transition-colors opacity-0 group-hover/pay:opacity-100"
                                                        >
                                                            Void Payment
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm col-span-1 md:col-span-2 lg:col-span-1">
                                            <div className="flex items-center gap-2 mb-4">
                                                <MapPin className="h-4 w-4 text-emerald-500" />
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Destination Node</span>
                                            </div>
                                            <div className="text-[11px] font-medium text-slate-600 leading-relaxed overflow-hidden text-ellipsis">
                                                {selectedOrder.shippingAddress?.fullAddress ? (
                                                    selectedOrder.shippingAddress.fullAddress
                                                ) : selectedOrder.user?.addresses?.[0]?.fullAddress || selectedOrder.user?.profileAddress ? (
                                                    selectedOrder.user.addresses?.[0]?.fullAddress || selectedOrder.user.profileAddress
                                                ) : (
                                                    "No registered shipping coordinate"
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-sm">
                                        <div className="px-8 py-4 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Fulfillment Registry</span>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{selectedOrder.items?.length || 0} Units</span>
                                        </div>
                                        <div className="p-4 space-y-2">
                                            {(selectedOrder.items || []).map((item: any, idx: number) => (
                                                <div key={idx} className="flex items-center justify-between p-4 rounded-2xl hover:bg-slate-50 transition-all border border-transparent hover:border-slate-100">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-12 h-12 rounded-xl bg-slate-100 overflow-hidden border border-slate-200 flex items-center justify-center">
                                                            {item.product?.images?.[0] ? (
                                                                <img src={item.product.images[0]} alt={item.product.name} className="w-full h-full object-cover" />
                                                            ) : (
                                                                <div className="w-full h-full flex items-center justify-center text-slate-300">
                                                                    <ShoppingCart className="h-5 w-5" />
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-bold text-slate-900 leading-none mb-1">{item.product?.name || "Merchandise Item"}</p>
                                                            <p className="text-[10px] font-black text-slate-400 tracking-wider uppercase">SKU: {item.productId.slice(0, 8).toUpperCase()} • Qty: {item.quantity}</p>
                                                        </div>
                                                    </div>
                                                    <p className="text-sm font-black text-slate-900 tabular-nums">₹{Number(item.sellingPrice).toLocaleString()}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-200">
                <div className="px-1 md:px-0">
                    <h2 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight tracking-[-0.04em]">Merchandise Orders</h2>
                    <p className="text-sm text-slate-500 mt-1">Execute and monitor global transaction protocols across the retail network.</p>
                </div>
                
                <div className="flex flex-wrap items-center gap-4">
                    <div className="hidden lg:flex items-center gap-3 bg-white border border-slate-200 px-4 py-2 rounded-xl shadow-sm">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Global Node Sync: Active</span>
                    </div>
 
                    <button onClick={fetchOrders} className="h-12 bg-slate-900 hover:bg-slate-800 text-white px-8 rounded-2xl flex items-center justify-center gap-3 shadow-xl shadow-slate-200 transition-all active:scale-95 font-black text-[10px] uppercase tracking-widest flex-1 md:flex-none">
                        <Activity className="h-4 w-4" />
                        <span>Synchronize Records</span>
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="lg:col-span-2 relative group flex items-center">
                    <Search className="absolute left-4 h-4 w-4 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                    <input 
                        className="w-full h-12 bg-slate-50 border border-slate-200 rounded-xl pl-12 pr-4 text-xs font-bold text-slate-900 focus:border-emerald-500 focus:bg-white transition-all outline-none placeholder:text-slate-400 uppercase tracking-tight"
                        placeholder="Search by ID or Client Identifier..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                
                <div className="lg:col-span-2">
                    <div className="h-12 bg-slate-50 border border-slate-200 rounded-xl px-4 flex items-center">
                        <Filter className="h-3.5 w-3.5 text-slate-300 mr-3" />
                        <select 
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="bg-transparent border-none outline-none text-[10px] font-black uppercase tracking-widest text-slate-500 cursor-pointer flex-1 appearance-none"
                        >
                            <option value="ALL">Protocol: All Statuses</option>
                            <option value="PENDING">Protocol: Awaiting Authorization</option>
                            <option value="PROCESSING">Protocol: In Production</option>
                            <option value="DELIVERED">Protocol: Fully Fulfilled</option>
                            <option value="CANCELLED">Protocol: Voided/Terminated</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl shadow-slate-100 overflow-hidden min-h-[500px]">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-100">
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Transaction Identifier</th>
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Client Information</th>
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Financial Protocol</th>
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Fulfillment State</th>
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Temporal Data</th>
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Ops</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                [1, 2, 3, 4, 5, 6].map(i => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={6} className="px-8 py-8">
                                            <div className="h-10 w-full bg-slate-50 rounded-xl" />
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                filteredOrders.map((order) => (
                                    <tr key={order.id} className="group hover:bg-slate-50/50 transition-colors">
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-3">
                                                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                                                <div className="space-y-0.5">
                                                    <span className="text-xs font-bold text-slate-900 uppercase tracking-tight font-mono">#{order.id.slice(-8).toUpperCase()}</span>
                                                    <span className="text-[10px] font-medium text-slate-400 block uppercase tracking-wide">{order.location?.name || "Main Hub"}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 border border-slate-200 group-hover:bg-white transition-colors">
                                                    <User className="h-5 w-5" />
                                                </div>
                                                <div className="space-y-0.5">
                                                    <p className="text-sm font-bold text-slate-900 leading-tight">{order.user?.name || "Anonymous Guest"}</p>
                                                    <span className="text-[10px] font-semibold text-slate-400 tracking-wider">TEL: {order.user?.phone || "NONE"}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="space-y-1">
                                                <p className="text-sm font-bold text-slate-900 tabular-nums">₹{Number(order.totalAmount).toLocaleString()}</p>
                                                <div className={cn(
                                                    "inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider",
                                                    order.isPaid ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"
                                                )}>
                                                    <CreditCard className="h-3 w-3" />
                                                    {order.isPaid ? "AUTHORIZED" : "UNPAID"}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <span className={cn(
                                                "px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all",
                                                order.status === "DELIVERED" && "bg-emerald-50 text-emerald-600 border-emerald-100",
                                                order.status === "PENDING" && "bg-amber-50 text-amber-600 border-amber-100",
                                                order.status === "PROCESSING" && "bg-blue-50 text-blue-600 border-blue-100",
                                                (order.status === "CANCELLED" || order.status === "RETURNED") && "bg-red-50 text-red-600 border-red-100"
                                            )}>
                                                {order.status}
                                            </span>
                                        </td>
                                        <td className="px-8 py-6">
                                            <p className="text-[11px] font-bold text-slate-600 tracking-tight">{format(new Date(order.createdAt), "dd MMM, yyyy")}</p>
                                            <p className="text-[10px] font-medium text-slate-400 mt-0.5">{format(new Date(order.createdAt), "HH:mm")} IST</p>
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button 
                                                    onClick={() => handleViewDetails(order)}
                                                    title="View Details" 
                                                    className="w-10 h-10 rounded-xl border border-slate-200 text-slate-400 hover:text-emerald-600 hover:border-emerald-200 hover:bg-emerald-50 transition-all active:scale-95 flex items-center justify-center"
                                                >
                                                    <Eye className="h-4 w-4" />
                                                </button>
                                                <button title="More Actions" className="w-10 h-10 rounded-xl border border-slate-200 text-slate-400 hover:text-slate-900 hover:bg-slate-50 transition-all active:scale-95 flex items-center justify-center">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                            {!loading && filteredOrders.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="py-32 text-center text-slate-400">
                                         <div className="flex flex-col items-center gap-4">
                                            <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-200 shadow-inner">
                                                <ShoppingCart className="h-8 w-8" />
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">No Active Orders Found</p>
                                                <p className="text-xs text-slate-400">No transactions match your current filter scope.</p>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="px-8 py-5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Activity className="h-3.5 w-3.5 text-slate-400" />
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Operational Oversight Active • Sync: Real-Time</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
