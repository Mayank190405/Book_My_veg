"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
    FileText,
    Plus,
    Search,
    Filter,
    CheckCircle2,
    Clock,
    Truck,
    PackageCheck,
    XCircle,
    Store,
    UserCheck,
    DollarSign,
    ArrowRight,
    RefreshCw,
    Edit3,
    PackagePlus,
    Building2,
    Calendar,
    ChevronRight,
    Sparkles,
    AlertCircle
} from "lucide-react";
import api from "@/services/api";
import { toast } from "sonner";
import { useUserStore } from "@/store/useUserStore";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface PurchaseOrderItem {
    id?: string;
    productId: string;
    variantId?: string | null;
    requestedQty: number | string;
    approvedQty?: number | string;
    receivedQty?: number | string;
    buyingPrice: number | string;
    totalCost?: number | string;
    addedByManager?: boolean;
    product?: { id: string; name: string; sku?: string; images?: string[]; basePrice?: number };
    variant?: { id: string; name: string; price?: number };
}

interface PurchaseOrder {
    id: string;
    poNumber: string;
    locationId: string;
    createdById: string;
    reviewedById?: string | null;
    supplierName?: string | null;
    supplierPhone?: string | null;
    notes?: string | null;
    status: "DRAFT" | "SUBMITTED" | "APPROVED" | "ORDERED" | "PARTIALLY_RECEIVED" | "RECEIVED" | "CANCELLED";
    totalEstimatedCost: number;
    actualCost: number;
    expectedDate?: string | null;
    receivedAt?: string | null;
    createdAt: string;
    location?: { id: string; name: string; slug: string };
    createdBy?: { id: string; name: string; role: string; phone?: string };
    reviewedBy?: { id: string; name: string; role: string; phone?: string };
    items: PurchaseOrderItem[];
}

export default function PurchaseOrdersPage() {
    const { user, activeStore } = useUserStore();
    const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
    const [locations, setLocations] = useState<any[]>([]);
    const [products, setProducts] = useState<any[]>([]);
    const [vendors, setVendors] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [sendingWhatsAppId, setSendingWhatsAppId] = useState<string | null>(null);

    // Filters
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [locationFilter, setLocationFilter] = useState("ALL");
    const [searchQuery, setSearchQuery] = useState("");

    // Create PO Modal State
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [createTargetLocation, setCreateTargetLocation] = useState("");
    const [createVendorId, setCreateVendorId] = useState("");
    const [createSupplier, setCreateSupplier] = useState("");
    const [createSupplierPhone, setCreateSupplierPhone] = useState("");
    const [createNotes, setCreateNotes] = useState("");
    const [createItems, setCreateItems] = useState<{ productId: string; variantId: string | null; name: string; quantity: string; buyingPrice: string }[]>([]);
    const [productSearch, setProductSearch] = useState("");

    // Manager Review PO Modal State
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
    const [reviewSupplierName, setReviewSupplierName] = useState("");
    const [reviewSupplierPhone, setReviewSupplierPhone] = useState("");
    const [reviewNotes, setReviewNotes] = useState("");
    const [reviewItems, setReviewItems] = useState<any[]>([]);
    const [extraProductSearch, setExtraProductSearch] = useState("");

    // Receive / Inward PO Modal State
    const [showReceiveModal, setShowReceiveModal] = useState(false);
    const [receiveItems, setReceiveItems] = useState<any[]>([]);

    const isPurchaseManager = user?.role === "PURCHASE_MANAGER" || user?.role === "ADMIN";

    // ─── Fetch Data ───────────────────────────────────────────────────────────

    const fetchPurchaseOrders = useCallback(async () => {
        setLoading(true);
        try {
            const params: any = {};
            if (statusFilter !== "ALL") params.status = statusFilter;
            if (locationFilter !== "ALL") params.locationId = locationFilter;

            const res = await api.get("/purchase-orders", { params });
            setPurchaseOrders(res.data.purchaseOrders || []);
        } catch (err: any) {
            toast.error("Failed to load purchase orders.");
        } finally {
            setLoading(false);
        }
    }, [statusFilter, locationFilter]);

    const fetchMetadata = async () => {
        try {
            const [locRes, prodRes, vendRes] = await Promise.all([
                api.get("/locations"),
                api.get("/products/admin"),
                api.get("/vendors").catch(() => ({ data: { vendors: [] } }))
            ]);
            setLocations(locRes.data || []);
            setProducts(prodRes.data?.products || prodRes.data || []);
            setVendors(vendRes.data?.vendors || []);
        } catch (err) { console.error(err); }
    };

    const handleSendPOWhatsApp = async (poId: string, vendorPhone?: string) => {
        setSendingWhatsAppId(poId);
        try {
            const res = await api.post(`/purchase-orders/${poId}/send-whatsapp`, {
                vendorPhone: vendorPhone || undefined
            });
            if (res.data?.success) {
                toast.success(res.data.message || "Purchase Order sent to Vendor via WhatsApp!");
            } else {
                toast.error(res.data?.message || "Failed to send WhatsApp message");
            }
        } catch (err: any) {
            toast.error(err.response?.data?.message || "WhatsApp dispatch failed.");
        } finally {
            setSendingWhatsAppId(null);
        }
    };

    useEffect(() => {
        fetchMetadata();
    }, []);

    useEffect(() => {
        fetchPurchaseOrders();
    }, [fetchPurchaseOrders]);

    // ─── Filtered POs ─────────────────────────────────────────────────────────

    const filteredPOs = useMemo(() => {
        return purchaseOrders.filter(po => {
            const q = searchQuery.toLowerCase();
            const matchesQuery = !searchQuery ||
                po.poNumber.toLowerCase().includes(q) ||
                po.location?.name.toLowerCase().includes(q) ||
                po.createdBy?.name?.toLowerCase().includes(q) ||
                po.supplierName?.toLowerCase().includes(q);
            return matchesQuery;
        });
    }, [purchaseOrders, searchQuery]);

    // ─── Stats ────────────────────────────────────────────────────────────────

    const stats = useMemo(() => {
        const total = purchaseOrders.length;
        const pending = purchaseOrders.filter(p => p.status === "SUBMITTED").length;
        const approved = purchaseOrders.filter(p => p.status === "APPROVED" || p.status === "ORDERED").length;
        const received = purchaseOrders.filter(p => p.status === "RECEIVED").length;
        const totalSpend = purchaseOrders
            .filter(p => p.status === "RECEIVED")
            .reduce((sum, p) => sum + Number(p.actualCost || 0), 0);
        return { total, pending, approved, received, totalSpend };
    }, [purchaseOrders]);

    // ─── Create PO Handlers ───────────────────────────────────────────────────

    const addProductToCreateList = (product: any, variant: any = null) => {
        const itemKey = `${product.id}-${variant?.id || 'base'}`;
        if (createItems.some(i => `${i.productId}-${i.variantId || 'base'}` === itemKey)) {
            toast.info("Item already added to PO draft.");
            return;
        }

        const defaultPrice = variant?.price || product.basePrice || 0;

        setCreateItems(prev => [
            ...prev,
            {
                productId: product.id,
                variantId: variant?.id || null,
                name: `${product.name} ${variant ? `(${variant.name})` : ''}`,
                quantity: "10",
                buyingPrice: (defaultPrice * 0.7).toFixed(2)
            }
        ]);
        setProductSearch("");
    };

    const handleCreateSubmit = async () => {
        if (createItems.length === 0) {
            toast.error("Please add at least one product to the purchase order.");
            return;
        }

        try {
            await api.post("/purchase-orders", {
                locationId: createTargetLocation || user?.locationId,
                vendorId: createVendorId || undefined,
                supplierName: createSupplier,
                supplierPhone: createSupplierPhone || undefined,
                notes: createNotes,
                items: createItems.map(i => ({
                    productId: i.productId,
                    variantId: i.variantId,
                    requestedQty: parseFloat(i.quantity) || 1,
                    buyingPrice: parseFloat(i.buyingPrice) || 0
                }))
            });

            toast.success("Purchase Order request submitted successfully!");
            setShowCreateModal(false);
            setCreateItems([]);
            setCreateVendorId("");
            setCreateSupplier("");
            setCreateSupplierPhone("");
            setCreateNotes("");
            fetchPurchaseOrders();
        } catch (err: any) {
            toast.error(err.response?.data?.message || "Failed to create Purchase Order.");
        }
    };

    // ─── Manager Review Handlers ──────────────────────────────────────────────

    const openReviewModal = (po: PurchaseOrder) => {
        setSelectedPO(po);
        setReviewSupplierName(po.supplierName || "");
        setReviewSupplierPhone(po.supplierPhone || "");
        setReviewNotes(po.notes || "");
        setReviewItems(
            po.items.map((item: any) => ({
                id: item.id,
                productId: item.productId,
                variantId: item.variantId,
                name: `${item.product?.name || 'Product'} ${item.variant ? `(${item.variant.name})` : ''}`,
                requestedQty: Number(item.requestedQty),
                approvedQty: Number(item.approvedQty !== undefined ? item.approvedQty : item.requestedQty),
                buyingPrice: Number(item.buyingPrice || 0),
                sellingPrice: Number(item.variant?.price || item.product?.basePrice || 0),
                addedByManager: Boolean(item.addedByManager),
                itemStatus: item.itemStatus || "APPROVED"
            }))
        );
        setShowReviewModal(true);
    };

    const addExtraProductToReview = (product: any, variant: any = null) => {
        const itemKey = `${product.id}-${variant?.id || 'base'}`;
        if (reviewItems.some(i => `${i.productId}-${i.variantId || 'base'}` === itemKey)) {
            toast.info("Item already in PO list.");
            return;
        }

        const sellingPrice = variant?.price || product.basePrice || 0;

        setReviewItems(prev => [
            ...prev,
            {
                productId: product.id,
                variantId: variant?.id || null,
                name: `${product.name} ${variant ? `(${variant.name})` : ''}`,
                requestedQty: 0,
                approvedQty: 10,
                buyingPrice: (sellingPrice * 0.7).toFixed(2),
                sellingPrice,
                addedByManager: true,
                itemStatus: "APPROVED"
            }
        ]);
        setExtraProductSearch("");
        toast.success(`Added extra product: ${product.name}`);
    };

    const handleReviewSubmit = async (finalStatus: "APPROVED" | "CANCELLED" = "APPROVED") => {
        if (!selectedPO) return;

        try {
            await api.put(`/purchase-orders/${selectedPO.id}/review`, {
                supplierName: reviewSupplierName,
                supplierPhone: reviewSupplierPhone,
                notes: reviewNotes,
                status: finalStatus,
                items: reviewItems.map(i => ({
                    productId: i.productId,
                    variantId: i.variantId,
                    requestedQty: parseFloat(i.requestedQty) || 0,
                    approvedQty: i.itemStatus === "REJECTED" ? 0 : (parseFloat(i.approvedQty) || 0),
                    buyingPrice: parseFloat(i.buyingPrice) || 0,
                    addedByManager: i.addedByManager,
                    itemStatus: i.itemStatus || "APPROVED"
                }))
            });

            toast.success(`Purchase Order ${finalStatus.toLowerCase()} successfully!`);
            setShowReviewModal(false);
            fetchPurchaseOrders();
        } catch (err: any) {
            toast.error(err.response?.data?.message || "Failed to update Purchase Order.");
        }
    };

    // ─── Receive & Inward Handlers ────────────────────────────────────────────

    const openReceiveModal = (po: PurchaseOrder) => {
        setSelectedPO(po);
        setReceiveItems(
            po.items.map(item => ({
                id: item.id,
                productId: item.productId,
                variantId: item.variantId,
                name: `${item.product?.name || 'Product'} ${item.variant ? `(${item.variant.name})` : ''}`,
                approvedQty: Number(item.approvedQty || item.requestedQty),
                receivedQty: Number(item.approvedQty || item.requestedQty),
                buyingPrice: Number(item.buyingPrice || 0)
            }))
        );
        setShowReceiveModal(true);
    };

    const handleReceiveSubmit = async () => {
        if (!selectedPO) return;

        try {
            await api.post(`/purchase-orders/${selectedPO.id}/receive`, {
                items: receiveItems.map(i => ({
                    id: i.id,
                    productId: i.productId,
                    variantId: i.variantId,
                    receivedQty: parseFloat(i.receivedQty) || 0,
                    buyingPrice: parseFloat(i.buyingPrice) || 0
                }))
            });

            toast.success("Purchase Order inwarded successfully! Inventory updated.");
            setShowReceiveModal(false);
            fetchPurchaseOrders();
        } catch (err: any) {
            toast.error(err.response?.data?.message || "Failed to inward Purchase Order.");
        }
    };

    // Product search suggestions
    const filteredSearchProducts = useMemo(() => {
        if (!productSearch) return [];
        const q = productSearch.toLowerCase();
        return products.filter(p => p.name.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q)).slice(0, 5);
    }, [products, productSearch]);

    const filteredExtraProducts = useMemo(() => {
        if (!extraProductSearch) return [];
        const q = extraProductSearch.toLowerCase();
        return products.filter(p => p.name.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q)).slice(0, 5);
    }, [products, extraProductSearch]);

    return (
        <div className="p-4 sm:p-8 space-y-8 max-w-[1600px] mx-auto min-h-screen bg-slate-50/50">
            {/* Header Banner */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm">
                <div>
                    <div className="flex items-center gap-2.5">
                        <div className="p-2.5 rounded-2xl bg-teal-50 text-teal-600">
                            <FileText className="h-6 w-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Purchase Orders (PO)</h1>
                            <p className="text-xs text-slate-500 font-medium">Manage store procurement requests, manager approvals, buying prices & stock inwarding</p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => fetchPurchaseOrders()}
                        className="p-3 rounded-2xl border border-slate-200 text-slate-600 hover:bg-slate-100 transition-all"
                        title="Refresh"
                    >
                        <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                    </button>
                    <button
                        onClick={() => {
                            setCreateTargetLocation(user?.locationId || locations[0]?.id || "");
                            setCreateItems([]);
                            setShowCreateModal(true);
                        }}
                        className="px-5 py-3 rounded-2xl bg-teal-600 text-white font-black text-xs uppercase tracking-wider hover:bg-teal-700 shadow-md shadow-teal-600/20 flex items-center gap-2 transition-all"
                    >
                        <Plus className="h-4 w-4" /> Create PO Request
                    </button>
                </div>
            </div>

            {/* Metrics Dashboard */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Total PO Requests</p>
                    <p className="text-2xl font-black text-slate-900">{stats.total}</p>
                </div>
                <div className="bg-amber-50/60 p-5 rounded-3xl border border-amber-200/60 shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-wider text-amber-700 mb-1">Pending Manager Review</p>
                    <p className="text-2xl font-black text-amber-800">{stats.pending}</p>
                </div>
                <div className="bg-sky-50/60 p-5 rounded-3xl border border-sky-200/60 shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-wider text-sky-700 mb-1">Approved / Ordered</p>
                    <p className="text-2xl font-black text-sky-800">{stats.approved}</p>
                </div>
                <div className="bg-emerald-50/60 p-5 rounded-3xl border border-emerald-200/60 shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700 mb-1">Inwarded & Received</p>
                    <p className="text-2xl font-black text-emerald-800">{stats.received}</p>
                </div>
                <div className="bg-purple-50/60 p-5 rounded-3xl border border-purple-200/60 shadow-sm col-span-2 lg:col-span-1">
                    <p className="text-[10px] font-black uppercase tracking-wider text-purple-700 mb-1">Completed Spend</p>
                    <p className="text-2xl font-black text-purple-800 tabular-nums">₹{stats.totalSpend.toLocaleString()}</p>
                </div>
            </div>

            {/* Filters Bar */}
            <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
                {/* Status Tabs */}
                <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 scrollbar-none">
                    {["ALL", "SUBMITTED", "APPROVED", "RECEIVED", "CANCELLED"].map((status) => (
                        <button
                            key={status}
                            onClick={() => setStatusFilter(status)}
                            className={cn(
                                "px-4 py-2 rounded-2xl text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all",
                                statusFilter === status
                                    ? "bg-slate-900 text-white shadow-md"
                                    : "text-slate-500 hover:bg-slate-100"
                            )}
                        >
                            {status === "SUBMITTED" ? "Pending Approval" : status}
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    {/* Store Filter */}
                    <div className="relative flex-1 md:flex-initial">
                        <select
                            value={locationFilter}
                            onChange={(e) => setLocationFilter(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-xs font-bold text-slate-700 outline-none appearance-none pr-8 cursor-pointer"
                        >
                            <option value="ALL">All Store Hubs</option>
                            {locations.map((loc) => (
                                <option key={loc.id} value={loc.id}>{loc.name}</option>
                            ))}
                        </select>
                        <Building2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                    </div>

                    {/* Search Input */}
                    <div className="relative flex-1 md:w-64">
                        <input
                            type="text"
                            placeholder="Search PO #, Store..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-9 pr-4 py-2.5 text-xs font-medium text-slate-900 outline-none focus:border-teal-500 transition-all"
                        />
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    </div>
                </div>
            </div>

            {/* PO List Grid */}
            <div className="space-y-4">
                {loading ? (
                    <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center text-slate-400 space-y-3">
                        <RefreshCw className="h-8 w-8 animate-spin mx-auto text-teal-600" />
                        <p className="text-xs font-bold uppercase tracking-wider">Loading Purchase Orders...</p>
                    </div>
                ) : filteredPOs.length === 0 ? (
                    <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center text-slate-400 space-y-3">
                        <FileText className="h-10 w-10 mx-auto text-slate-300" />
                        <p className="text-sm font-bold text-slate-700">No Purchase Orders Found</p>
                        <p className="text-xs text-slate-400">Try adjusting your filters or create a new store PO request.</p>
                    </div>
                ) : (
                    filteredPOs.map((po) => {
                        const isSubmitted = po.status === "SUBMITTED";
                        const isApproved = po.status === "APPROVED" || po.status === "ORDERED";
                        const isReceived = po.status === "RECEIVED";

                        return (
                            <div key={po.id} className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                                <div className="space-y-3 flex-1">
                                    <div className="flex flex-wrap items-center gap-3">
                                        <span className="text-lg font-black text-slate-900 tracking-tight">{po.poNumber}</span>
                                        <span className={cn(
                                            "px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider border",
                                            isSubmitted && "bg-amber-50 text-amber-700 border-amber-200",
                                            isApproved && "bg-sky-50 text-sky-700 border-sky-200",
                                            isReceived && "bg-emerald-50 text-emerald-700 border-emerald-200",
                                            po.status === "CANCELLED" && "bg-slate-100 text-slate-500 border-slate-200"
                                        )}>
                                            {po.status === "SUBMITTED" ? "Pending Approval" : po.status}
                                        </span>
                                        <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
                                            <Calendar className="h-3.5 w-3.5" />
                                            {new Date(po.createdAt).toLocaleDateString()} {new Date(po.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                                        <div>
                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Store Location</span>
                                            <span className="font-bold text-slate-800">{po.location?.name || "Store Hub"}</span>
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Requested By</span>
                                            <span className="font-bold text-slate-800">{po.createdBy?.name || "Store Manager"}</span>
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Supplier</span>
                                            <span className="font-bold text-slate-800">{po.supplierName || "Unassigned"}</span>
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Items Count</span>
                                            <span className="font-bold text-slate-800">{po.items?.length || 0} Products</span>
                                        </div>
                                    </div>

                                    {/* Items Preview */}
                                    <div className="flex flex-wrap gap-2 pt-1">
                                        {po.items?.slice(0, 4).map((item, idx) => (
                                            <span key={idx} className="bg-slate-50 border border-slate-200/60 rounded-xl px-2.5 py-1 text-[11px] font-bold text-slate-600 flex items-center gap-1.5">
                                                {item.product?.name}
                                                {item.addedByManager && <span className="bg-teal-100 text-teal-700 text-[9px] px-1 rounded font-black">Manager Extra</span>}
                                                <span className="text-slate-400">×{Number(item.approvedQty || item.requestedQty)}</span>
                                            </span>
                                        ))}
                                        {po.items?.length > 4 && (
                                            <span className="text-[11px] font-bold text-slate-400 self-center">+{po.items.length - 4} more</span>
                                        )}
                                    </div>
                                </div>

                                {/* Right Action Panel */}
                                <div className="flex flex-row lg:flex-col items-end justify-between lg:justify-center gap-3 border-t lg:border-t-0 lg:border-l border-slate-100 pt-4 lg:pt-0 lg:pl-6">
                                    <div className="text-left lg:text-right">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Est. / Total Amount</span>
                                        <span className="text-xl font-black text-teal-700 tabular-nums">
                                            ₹{Number(isReceived ? po.actualCost : po.totalEstimatedCost).toLocaleString()}
                                        </span>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2">
                                        <button
                                            onClick={() => handleSendPOWhatsApp(po.id, po.supplierPhone || undefined)}
                                            disabled={sendingWhatsAppId === po.id}
                                            className="px-3.5 py-2.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 font-bold text-xs border border-emerald-300 dark:border-emerald-700 hover:bg-emerald-100 flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer"
                                            title="Send PO details to vendor WhatsApp"
                                        >
                                            {sendingWhatsAppId === po.id ? "Sending..." : "📲 WhatsApp PO"}
                                        </button>

                                        {isSubmitted && isPurchaseManager && (
                                            <button
                                                onClick={() => openReviewModal(po)}
                                                className="px-4 py-2.5 rounded-2xl bg-amber-600 text-white font-black text-xs uppercase tracking-wider hover:bg-amber-700 shadow-md shadow-amber-600/20 flex items-center gap-1.5 transition-all whitespace-nowrap"
                                            >
                                                <Edit3 className="h-3.5 w-3.5" /> Review & Add Extra
                                            </button>
                                        )}

                                        {isApproved && (
                                            <button
                                                onClick={() => openReceiveModal(po)}
                                                className="px-4 py-2.5 rounded-2xl bg-emerald-600 text-white font-black text-xs uppercase tracking-wider hover:bg-emerald-700 shadow-md shadow-emerald-600/20 flex items-center gap-1.5 transition-all whitespace-nowrap"
                                            >
                                                <PackageCheck className="h-3.5 w-3.5" /> Inward Stock
                                            </button>
                                        )}

                                        {isSubmitted && !isPurchaseManager && (
                                            <span className="text-xs font-bold text-amber-600 bg-amber-50 px-3 py-2 rounded-xl border border-amber-200">
                                                Awaiting Manager Approval
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* ── CREATE PO MODAL ── */}
            <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
                <DialogContent className="max-w-3xl bg-white rounded-3xl p-6 sm:p-8 border-none shadow-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black uppercase text-slate-900 flex items-center gap-2">
                            <PackagePlus className="h-6 w-6 text-teal-600" /> Create Store Purchase Order
                        </DialogTitle>
                        <DialogDescription className="text-xs text-slate-500">
                            Submit a new product request from store hub to your assigned Purchase Manager.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6 mt-4">
                        {/* Store & Supplier Inputs */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1.5">Destination Store Hub *</label>
                                <select
                                    value={createTargetLocation}
                                    onChange={(e) => setCreateTargetLocation(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs font-bold text-slate-900 outline-none"
                                >
                                    {locations.map(loc => (
                                        <option key={loc.id} value={loc.id}>{loc.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1.5">Select Registered Vendor / Supplier</label>
                                <select
                                    value={createVendorId}
                                    onChange={(e) => {
                                        const vId = e.target.value;
                                        setCreateVendorId(vId);
                                        const matched = vendors.find(v => v.id === vId);
                                        if (matched) {
                                            setCreateSupplier(matched.companyName || matched.name);
                                            setCreateSupplierPhone(matched.phone || "");
                                        }
                                    }}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs font-bold text-slate-900 outline-none cursor-pointer"
                                >
                                    <option value="">-- Choose from Vendor Directory --</option>
                                    {vendors.map(v => (
                                        <option key={v.id} value={v.id}>
                                            🚚 {v.name} {v.companyName ? `(${v.companyName})` : ''} - {v.phone}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1.5">Supplier Name</label>
                                <input
                                    type="text"
                                    placeholder="e.g. FreshAgro Vendors"
                                    value={createSupplier}
                                    onChange={(e) => setCreateSupplier(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs font-medium text-slate-900 outline-none"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1.5">Supplier WhatsApp / Phone</label>
                                <input
                                    type="tel"
                                    placeholder="e.g. 9876543210"
                                    value={createSupplierPhone}
                                    onChange={(e) => setCreateSupplierPhone(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs font-medium text-slate-900 outline-none"
                                />
                            </div>
                        </div>

                        {/* Product Search & Add */}
                        <div className="space-y-2 relative">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Search & Add Product to PO *</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Type product name or SKU to add..."
                                    value={productSearch}
                                    onChange={(e) => setProductSearch(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-4 py-3 text-xs font-medium text-slate-900 outline-none focus:border-teal-500"
                                />
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            </div>

                            {/* Dropdown Suggestions */}
                            {filteredSearchProducts.length > 0 && (
                                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden divide-y divide-slate-100">
                                    {filteredSearchProducts.map(p => (
                                        <button
                                            key={p.id}
                                            type="button"
                                            onClick={() => addProductToCreateList(p)}
                                            className="w-full p-3 text-left hover:bg-teal-50/60 transition-all flex items-center justify-between"
                                        >
                                            <div>
                                                <p className="text-xs font-bold text-slate-900">{p.name}</p>
                                                <p className="text-[10px] text-slate-400">SKU: {p.sku || 'N/A'}</p>
                                            </div>
                                            <span className="text-xs font-black text-teal-600">+ Add</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Items Table */}
                        <div className="space-y-3">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">PO Item List ({createItems.length})</label>
                            {createItems.length === 0 ? (
                                <div className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-6 text-center text-slate-400 text-xs font-medium">
                                    No items added yet. Search products above to build your PO draft.
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {createItems.map((item, idx) => (
                                        <div key={idx} className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 flex items-center justify-between gap-4">
                                            <span className="text-xs font-bold text-slate-800 flex-1">{item.name}</span>
                                            <div className="flex items-center gap-3">
                                                <div>
                                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Req Qty</span>
                                                    <input
                                                        type="number"
                                                        value={item.quantity}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            setCreateItems(prev => prev.map((it, i) => i === idx ? { ...it, quantity: val } : it));
                                                        }}
                                                        className="w-20 bg-white border border-slate-200 rounded-xl px-2 py-1 text-xs font-bold text-slate-900 text-center outline-none"
                                                    />
                                                </div>
                                                <div>
                                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Est Buying Price</span>
                                                    <input
                                                        type="number"
                                                        value={item.buyingPrice}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            setCreateItems(prev => prev.map((it, i) => i === idx ? { ...it, buyingPrice: val } : it));
                                                        }}
                                                        className="w-24 bg-white border border-slate-200 rounded-xl px-2 py-1 text-xs font-bold text-slate-900 text-center outline-none"
                                                    />
                                                </div>
                                                <button
                                                    onClick={() => setCreateItems(prev => prev.filter((_, i) => i !== idx))}
                                                    className="p-1.5 text-slate-400 hover:text-red-500 transition-all"
                                                >
                                                    <XCircle className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Submit Button */}
                        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="px-5 py-2.5 rounded-2xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreateSubmit}
                                className="px-6 py-3 rounded-2xl bg-teal-600 text-white font-black text-xs uppercase tracking-wider hover:bg-teal-700 shadow-md shadow-teal-600/20"
                            >
                                Submit PO Request
                            </button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* ── PURCHASE MANAGER REVIEW & EDIT MODAL ── */}
            <Dialog open={showReviewModal} onOpenChange={setShowReviewModal}>
                <DialogContent className="max-w-4xl bg-white rounded-3xl p-6 sm:p-8 border-none shadow-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black uppercase text-slate-900 flex items-center gap-2">
                            <Edit3 className="h-6 w-6 text-amber-600" /> Review & Approve PO #{selectedPO?.poNumber}
                        </DialogTitle>
                        <DialogDescription className="text-xs text-slate-500">
                            As Purchase Manager, review store requests, add extra products, and define unit buying prices.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6 mt-4">
                        {/* Supplier Info */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1.5">Supplier Name *</label>
                                <input
                                    type="text"
                                    value={reviewSupplierName}
                                    onChange={(e) => setReviewSupplierName(e.target.value)}
                                    placeholder="Enter vendor name..."
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-xs font-bold text-slate-900 outline-none"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1.5">Supplier Contact Phone</label>
                                <input
                                    type="text"
                                    value={reviewSupplierPhone}
                                    onChange={(e) => setReviewSupplierPhone(e.target.value)}
                                    placeholder="+91 9876543210"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-xs font-medium text-slate-900 outline-none"
                                />
                            </div>
                        </div>

                        {/* Add Extra Product Bar */}
                        <div className="space-y-2 relative bg-amber-50/50 p-4 rounded-2xl border border-amber-200/60">
                            <div className="flex items-center gap-2">
                                <Sparkles className="h-4 w-4 text-amber-600" />
                                <label className="text-xs font-black uppercase tracking-wider text-amber-800">Add Extra Product (Manager Override)</label>
                            </div>
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Search extra product to add to this PO..."
                                    value={extraProductSearch}
                                    onChange={(e) => setExtraProductSearch(e.target.value)}
                                    className="w-full bg-white border border-amber-200 rounded-2xl pl-10 pr-4 py-2.5 text-xs font-medium text-slate-900 outline-none focus:border-amber-500"
                                />
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-amber-500" />
                            </div>

                            {/* Dropdown Suggestions */}
                            {filteredExtraProducts.length > 0 && (
                                <div className="absolute left-4 right-4 top-full mt-1 bg-white border border-amber-200 rounded-2xl shadow-xl z-50 overflow-hidden divide-y divide-slate-100">
                                    {filteredExtraProducts.map(p => (
                                        <button
                                            key={p.id}
                                            type="button"
                                            onClick={() => addExtraProductToReview(p)}
                                            className="w-full p-3 text-left hover:bg-amber-50 transition-all flex items-center justify-between"
                                        >
                                            <div>
                                                <p className="text-xs font-bold text-slate-900">{p.name}</p>
                                                <p className="text-[10px] text-slate-400">Selling Price: ₹{p.basePrice}</p>
                                            </div>
                                            <span className="text-xs font-black text-amber-600">+ Add Extra</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Items Review Table */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Product-Wise Approval & Unit Buying Prices</label>
                                <span className="text-xs font-bold text-teal-700">
                                    Approved Total: ₹{reviewItems.filter(i => i.itemStatus !== "REJECTED").reduce((sum, i) => sum + (parseFloat(i.approvedQty) || 0) * (parseFloat(i.buyingPrice) || 0), 0).toFixed(2)}
                                </span>
                            </div>
                            <div className="overflow-x-auto rounded-2xl border border-slate-200">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-200">
                                        <tr>
                                            <th className="p-3">Product</th>
                                            <th className="p-3 text-center">Store Requested</th>
                                            <th className="p-3 text-center">Product-Wise Action</th>
                                            <th className="p-3 text-center">Approved Qty</th>
                                            <th className="p-3 text-center">Buying Price (₹)</th>
                                            <th className="p-3 text-right">Total Cost (₹)</th>
                                            <th className="p-3"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                                        {reviewItems.map((item, idx) => {
                                            const isRejected = item.itemStatus === "REJECTED";
                                            const total = isRejected ? 0 : (parseFloat(item.approvedQty) || 0) * (parseFloat(item.buyingPrice) || 0);
                                            return (
                                                <tr key={idx} className={cn(
                                                    item.addedByManager && "bg-amber-50/40",
                                                    isRejected && "bg-red-50/40 opacity-70"
                                                )}>
                                                    <td className="p-3 font-bold">
                                                        <div className="flex items-center gap-2">
                                                            <span className={cn(isRejected && "line-through text-slate-400")}>{item.name}</span>
                                                            {item.addedByManager && (
                                                                <span className="bg-amber-100 text-amber-800 text-[9px] px-1.5 py-0.5 rounded-md font-black uppercase">Manager Extra</span>
                                                            )}
                                                            {isRejected && (
                                                                <span className="bg-red-100 text-red-700 text-[9px] px-1.5 py-0.5 rounded-md font-black uppercase">Rejected</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="p-3 text-center text-slate-500">{item.requestedQty}</td>
                                                    <td className="p-3 text-center">
                                                        <div className="flex items-center justify-center gap-1 bg-slate-100 p-1 rounded-xl w-max mx-auto">
                                                            <button
                                                                type="button"
                                                                onClick={() => setReviewItems(prev => prev.map((it, i) => i === idx ? { ...it, itemStatus: "APPROVED" } : it))}
                                                                className={cn(
                                                                    "px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all",
                                                                    !isRejected
                                                                        ? "bg-emerald-600 text-white shadow-sm"
                                                                        : "text-slate-500 hover:text-slate-900"
                                                                )}
                                                            >
                                                                ✓ Approve
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => setReviewItems(prev => prev.map((it, i) => i === idx ? { ...it, itemStatus: "REJECTED", approvedQty: 0 } : it))}
                                                                className={cn(
                                                                    "px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all",
                                                                    isRejected
                                                                        ? "bg-red-600 text-white shadow-sm"
                                                                        : "text-slate-500 hover:text-slate-900"
                                                                )}
                                                            >
                                                                ✕ Reject
                                                            </button>
                                                        </div>
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        <input
                                                            type="number"
                                                            disabled={isRejected}
                                                            value={isRejected ? 0 : item.approvedQty}
                                                            onChange={(e) => {
                                                                const val = e.target.value;
                                                                setReviewItems(prev => prev.map((it, i) => i === idx ? { ...it, approvedQty: val } : it));
                                                            }}
                                                            className={cn(
                                                                "w-20 bg-white border border-slate-200 rounded-xl px-2 py-1 text-center font-bold outline-none",
                                                                isRejected && "bg-slate-100 text-slate-400 cursor-not-allowed"
                                                            )}
                                                        />
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        <input
                                                            type="number"
                                                            disabled={isRejected}
                                                            value={item.buyingPrice}
                                                            onChange={(e) => {
                                                                const val = e.target.value;
                                                                setReviewItems(prev => prev.map((it, i) => i === idx ? { ...it, buyingPrice: val } : it));
                                                            }}
                                                            className={cn(
                                                                "w-24 bg-white border border-slate-200 rounded-xl px-2 py-1 text-center font-bold text-teal-700 outline-none",
                                                                isRejected && "bg-slate-100 text-slate-400 cursor-not-allowed"
                                                            )}
                                                        />
                                                    </td>
                                                    <td className="p-3 text-right font-black text-slate-900 tabular-nums">
                                                        ₹{total.toFixed(2)}
                                                    </td>
                                                    <td className="p-3 text-right">
                                                        <button
                                                            onClick={() => setReviewItems(prev => prev.filter((_, i) => i !== idx))}
                                                            className="text-slate-400 hover:text-red-500"
                                                        >
                                                            <XCircle className="h-4 w-4" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                            <button
                                onClick={() => handleReviewSubmit("CANCELLED")}
                                className="px-4 py-2.5 rounded-2xl bg-red-50 text-red-600 font-bold text-xs hover:bg-red-100"
                            >
                                Reject PO
                            </button>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setShowReviewModal(false)}
                                    className="px-5 py-2.5 rounded-2xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => handleReviewSubmit("APPROVED")}
                                    className="px-6 py-3 rounded-2xl bg-amber-600 text-white font-black text-xs uppercase tracking-wider hover:bg-amber-700 shadow-md shadow-amber-600/20"
                                >
                                    Approve & Order PO
                                </button>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* ── INWARD STOCK MODAL ── */}
            <Dialog open={showReceiveModal} onOpenChange={setShowReceiveModal}>
                <DialogContent className="max-w-3xl bg-white rounded-3xl p-6 sm:p-8 border-none shadow-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black uppercase text-slate-900 flex items-center gap-2">
                            <PackageCheck className="h-6 w-6 text-emerald-600" /> Inward Stock Delivery #{selectedPO?.poNumber}
                        </DialogTitle>
                        <DialogDescription className="text-xs text-slate-500">
                            Confirm physical quantities received at store counter to update inventory & create cost batches.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6 mt-4">
                        <div className="overflow-x-auto rounded-2xl border border-slate-200">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-200">
                                    <tr>
                                        <th className="p-3">Product</th>
                                        <th className="p-3 text-center">Approved Qty</th>
                                        <th className="p-3 text-center">Received Qty</th>
                                        <th className="p-3 text-right">Buying Price (₹)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                                    {receiveItems.map((item, idx) => (
                                        <tr key={idx}>
                                            <td className="p-3 font-bold">{item.name}</td>
                                            <td className="p-3 text-center text-slate-500">{item.approvedQty}</td>
                                            <td className="p-3 text-center">
                                                <input
                                                    type="number"
                                                    value={item.receivedQty}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        setReceiveItems(prev => prev.map((it, i) => i === idx ? { ...it, receivedQty: val } : it));
                                                    }}
                                                    className="w-24 bg-white border border-slate-200 rounded-xl px-2 py-1 text-center font-bold text-emerald-700 outline-none"
                                                />
                                            </td>
                                            <td className="p-3 text-right font-black text-slate-900 tabular-nums">
                                                ₹{Number(item.buyingPrice).toFixed(2)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                            <button
                                onClick={() => setShowReceiveModal(false)}
                                className="px-5 py-2.5 rounded-2xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleReceiveSubmit}
                                className="px-6 py-3 rounded-2xl bg-emerald-600 text-white font-black text-xs uppercase tracking-wider hover:bg-emerald-700 shadow-md shadow-emerald-600/20"
                            >
                                Confirm & Inward Stock
                            </button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
