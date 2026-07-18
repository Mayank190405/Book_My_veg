"use client";

import { 
    Plus, 
    Search, 
    Edit2,
    Trash2,
    Ticket,
    X,
    Activity,
    Tag,
    Calendar,
    Zap,
    ShieldCheck,
    CreditCard,
    MapPin,
    Users,
    Phone
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import api from "@/services/api";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";

export default function AdminCoupons() {
    const [coupons, setCoupons] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    
    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCoupon, setEditingCoupon] = useState<any>(null);
    const [submitting, setSubmitting] = useState(false);
    const [modalStep, setModalStep] = useState(1);

    const fetchCoupons = async () => {
        setLoading(true);
        try {
            const res = await api.get("/coupons");
            setCoupons(res.data);
        } catch (error) {
            toast.error("Failed to synchronize coupon directory");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCoupons();
    }, []);

    const openCreateModal = () => {
        setEditingCoupon({ 
            code: "", 
            type: "DISCOUNT",
            description: "",
            discountType: "FLAT", 
            discountValue: "", 
            minOrderAmount: 0, 
            maxDiscount: 0, 
            expiresAt: format(new Date(Date.now() + 7 * 86400000), 'yyyy-MM-dd'), 
            isActive: true,
            rewardProductId: "",
            specialPrice: "",
            userUsageLimit: 1,
            allowedPincodes: "",
            allowedPayment: "",
            userSegments: ["ALL"],
            targetedPhoneNumbers: "",
            minTrustScore: ""
        });
        setModalStep(1);
        setIsModalOpen(true);
    };

    const openEditModal = (coupon: any) => {
        setEditingCoupon({
            ...coupon,
            discountValue: coupon.discountValue !== null ? coupon.discountValue.toString() : "",
            minOrderAmount: coupon.minOrderAmount !== null ? coupon.minOrderAmount.toString() : "0",
            maxDiscount: coupon.maxDiscount !== null ? coupon.maxDiscount.toString() : "",
            specialPrice: coupon.specialPrice !== null ? coupon.specialPrice.toString() : "",
            userUsageLimit: coupon.userUsageLimit !== null ? coupon.userUsageLimit.toString() : "1",
            allowedPincodes: Array.isArray(coupon.allowedPincodes) ? coupon.allowedPincodes.join(", ") : "",
            allowedPayment: Array.isArray(coupon.allowedPayment) ? coupon.allowedPayment.join(", ") : "",
            userSegments: Array.isArray(coupon.userSegments) ? coupon.userSegments : ["ALL"],
            targetedPhoneNumbers: Array.isArray(coupon.targetedUsers) 
                ? coupon.targetedUsers.map((tu: any) => tu.user?.phone).filter(Boolean).join(", ") 
                : "",
            minTrustScore: coupon.cartRulesJson && (coupon.cartRulesJson as any).minTrustScore !== undefined && (coupon.cartRulesJson as any).minTrustScore !== null
                ? (coupon.cartRulesJson as any).minTrustScore.toString()
                : ""
        });
        setModalStep(1);
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            // Parse array strings
            const pincodesArray = typeof editingCoupon.allowedPincodes === 'string'
                ? editingCoupon.allowedPincodes.split(',').map((p: string) => p.trim()).filter(Boolean)
                : editingCoupon.allowedPincodes || [];
            
            const paymentArray = typeof editingCoupon.allowedPayment === 'string'
                ? editingCoupon.allowedPayment.split(',').map((p: string) => p.trim().toUpperCase()).filter(Boolean)
                : editingCoupon.allowedPayment || [];

            const targetedPhoneNumbersArray = typeof editingCoupon.targetedPhoneNumbers === 'string'
                ? editingCoupon.targetedPhoneNumbers.split(',').map((p: string) => p.trim()).filter(Boolean)
                : editingCoupon.targetedPhoneNumbers || [];

            const cartRules = editingCoupon.cartRulesJson ? { ...(editingCoupon.cartRulesJson as any) } : {};
            if (editingCoupon.minTrustScore !== undefined && editingCoupon.minTrustScore !== "") {
                cartRules.minTrustScore = parseInt(editingCoupon.minTrustScore) || null;
            } else {
                delete cartRules.minTrustScore;
            }

            const payload = {
                ...editingCoupon,
                discountValue: editingCoupon.discountValue !== "" ? parseFloat(editingCoupon.discountValue) : 0,
                minOrderAmount: editingCoupon.minOrderAmount !== "" ? parseFloat(editingCoupon.minOrderAmount) : 0,
                maxDiscount: editingCoupon.maxDiscount !== "" && editingCoupon.maxDiscount !== "0" && editingCoupon.maxDiscount !== 0 ? parseFloat(editingCoupon.maxDiscount) : null,
                specialPrice: editingCoupon.specialPrice !== "" && editingCoupon.specialPrice !== "0" && editingCoupon.specialPrice !== 0 ? parseFloat(editingCoupon.specialPrice) : null,
                userUsageLimit: parseInt(editingCoupon.userUsageLimit) || 1,
                allowedPincodes: pincodesArray,
                allowedPayment: paymentArray,
                targetedPhoneNumbers: targetedPhoneNumbersArray,
                cartRulesJson: Object.keys(cartRules).length > 0 ? cartRules : null,
            };

            if (editingCoupon.id) {
                await api.put(`/coupons/${editingCoupon.id}`, payload);
                toast.success("Coupon updated successfully");
            } else {
                await api.post("/coupons", payload);
                toast.success("New coupon added to catalog");
            }
            fetchCoupons();
            setIsModalOpen(false);
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Failed to save coupon changes");
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this coupon code?")) return;
        try {
            await api.delete(`/coupons/${id}`);
            toast.success("Coupon deleted from system");
            fetchCoupons();
        } catch (error) {
            toast.error("Failed to remove coupon");
        }
    };

    const toggleStatus = async (coupon: any) => {
        try {
            await api.put(`/coupons/${coupon.id}`, { ...coupon, isActive: !coupon.isActive });
            toast.success(`Coupon status ${!coupon.isActive ? 'Enabled' : 'Disabled'}`);
            fetchCoupons();
        } catch (error) {
            toast.error("Failed to update coupon status");
        }
    };

    const handleSegmentToggle = (segment: string) => {
        const currentSegments = [...(editingCoupon.userSegments || [])];
        if (segment === "ALL") {
            setEditingCoupon({ ...editingCoupon, userSegments: ["ALL"] });
            return;
        }
        
        let newSegments = currentSegments.filter(s => s !== "ALL");
        if (newSegments.includes(segment)) {
            newSegments = newSegments.filter(s => s !== segment);
            if (newSegments.length === 0) newSegments = ["ALL"];
        } else {
            newSegments.push(segment);
        }
        setEditingCoupon({ ...editingCoupon, userSegments: newSegments });
    };

    const filteredCoupons = useMemo(() => {
        if (!Array.isArray(coupons)) return [];
        return coupons.filter(c => c.code?.toLowerCase().includes(search.toLowerCase()));
    }, [coupons, search]);

    const segmentsList = [
        { id: "ALL", name: "All Users" },
        { id: "FIRST_ORDER_BUYERS", name: "First Order Buyers" },
        { id: "LOYAL_SHOPPERS", name: "Loyal Shoppers" },
        { id: "SENIOR_CITIZENS", name: "Senior Citizens" },
        { id: "STUDENTS", name: "Students" },
        { id: "CORPORATE_PANTRY", name: "Corporate Pantries" }
    ];

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-200">
                <div className="px-1 md:px-0">
                    <h2 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Coupon Management</h2>
                    <p className="text-sm text-slate-500 mt-1">Create and manage discount codes, BOGOs, geofences, and segment-targeted vouchers.</p>
                </div>
                
                <button 
                    onClick={openCreateModal}
                    className="h-12 bg-emerald-600 hover:bg-emerald-700 text-white px-6 rounded-xl flex items-center justify-center gap-3 shadow-lg shadow-emerald-100 transition-all active:scale-95 font-bold text-sm w-full md:w-auto"
                >
                    <Plus className="h-5 w-5" />
                    <span>Generate New Coupon</span>
                </button>
            </div>

            {/* Filter Section */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="lg:col-span-2 relative group flex items-center">
                    <Search className="absolute left-4 h-5 w-5 text-slate-400 group-focus-within/input:text-emerald-600 transition-colors" />
                    <input 
                        className="w-full h-12 bg-white border border-slate-200 rounded-xl pl-12 pr-4 text-sm font-medium text-slate-900 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 transition-all outline-none placeholder:text-slate-400"
                        placeholder="Search by Coupon Code..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            {/* Coupons Display Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                {loading ? (
                    [1, 2, 3].map(i => (
                        <div key={i} className="h-64 bg-white rounded-2xl border border-slate-200 animate-pulse" />
                    ))
                ) : (
                    filteredCoupons.map((coupon) => (
                        <div key={coupon.id} className="bg-white rounded-2xl border border-slate-200 p-8 hover:border-emerald-200 hover:shadow-xl hover:shadow-emerald-500/5 transition-all duration-500 group relative flex flex-col justify-between overflow-hidden">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-slate-50 rounded-full -mr-12 -mt-12 transition-colors group-hover:bg-emerald-50/50" />
                            
                            <div className="space-y-6">
                                <div className="flex items-center justify-between relative z-10">
                                    <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-emerald-600 border border-slate-100 group-hover:scale-110 transition-transform shadow-sm">
                                        <Ticket className="h-6 w-6" />
                                    </div>
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => openEditModal(coupon)}
                                            className="w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:text-emerald-600 hover:border-emerald-200 transition-all active:scale-90 bg-white"
                                        >
                                            <Edit2 className="h-4 w-4" />
                                        </button>
                                        <button 
                                            onClick={() => handleDelete(coupon.id)}
                                            className="w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:text-red-500 hover:border-red-200 transition-all active:scale-90 bg-white"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-3 relative z-10">
                                    <h3 className="text-2xl font-bold text-slate-900 tracking-tight uppercase font-mono">{coupon.code}</h3>
                                    <div className="flex flex-wrap gap-2">
                                        <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded text-[9px] font-black text-emerald-600 uppercase tracking-wider">
                                            {coupon.type}
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <div className={cn(
                                                "w-1.5 h-1.5 rounded-full shadow-sm",
                                                coupon.isActive ? "bg-emerald-500" : "bg-slate-300"
                                            )} />
                                            <span className={cn(
                                                "text-[9px] font-bold uppercase tracking-widest",
                                                coupon.isActive ? "text-emerald-600" : "text-slate-400"
                                            )}>
                                                {coupon.isActive ? "Redeemable" : "Suspended"}
                                            </span>
                                        </div>
                                        {coupon.cartRulesJson && (coupon.cartRulesJson as any).minTrustScore !== undefined && (coupon.cartRulesJson as any).minTrustScore !== null && (
                                            <div className="flex items-center gap-1 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded text-[9px] font-black text-amber-700 uppercase tracking-wider">
                                                ★ Min Trust: {(coupon.cartRulesJson as any).minTrustScore}%
                                            </div>
                                        )}
                                    </div>
                                    {coupon.description && (
                                        <p className="text-[11px] font-bold text-slate-400 leading-normal uppercase">{coupon.description}</p>
                                    )}
                                    {coupon.targetedUsers && coupon.targetedUsers.length > 0 && (
                                        <div className="mt-2.5 p-2.5 bg-indigo-50/50 rounded-xl border border-indigo-100/50 flex flex-col gap-1">
                                            <p className="text-[8px] font-black text-indigo-600 uppercase tracking-widest leading-none">Targeted Users</p>
                                            <p className="text-[9px] font-bold text-indigo-700 leading-normal font-mono truncate">
                                                {coupon.targetedUsers.map((tu: any) => tu.user?.phone).filter(Boolean).join(", ")}
                                            </p>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-1 relative z-10">
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">Coupon Reward</p>
                                    <p className="text-lg font-black text-slate-900 uppercase">
                                        {coupon.type === "DISCOUNT" && (
                                            coupon.discountType === "PERCENTAGE" ? `${coupon.discountValue}% Off Basket` : `₹${coupon.discountValue} Flat Discount`
                                        )}
                                        {coupon.type === "ITEM_DISCOUNT" && (
                                            `Product Discount: ${coupon.discountType === "PERCENTAGE" ? `${coupon.discountValue}% Off` : `₹${coupon.discountValue} Off`}`
                                        )}
                                        {coupon.type === "SPECIAL_PRICE_ITEM" && (
                                            `Item Special Price: ₹${coupon.specialPrice}`
                                        )}
                                        {coupon.type === "FREE_GIFT" && (
                                            "Free gift item BOGO"
                                        )}
                                        {coupon.type === "CASHBACK" && (
                                            `Cashback Yield: ${coupon.discountType === "PERCENTAGE" ? `${coupon.discountValue}%` : `₹${coupon.discountValue}`}`
                                        )}
                                    </p>
                                </div>
                            </div>

                            <div className="mt-6 pt-6 border-t border-slate-50 space-y-4 relative z-10">
                                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                    <div className="flex items-center gap-2">
                                        <Calendar className="h-3.5 w-3.5 text-slate-300" /> {coupon.expiresAt ? format(new Date(coupon.expiresAt), 'MMM dd, yyyy') : 'No Expiry'}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Zap className="h-3.5 w-3.5 text-amber-500" /> Min: ₹{coupon.minOrderAmount}
                                    </div>
                                </div>
                                <button 
                                    onClick={() => toggleStatus(coupon)}
                                    className={cn(
                                        "w-full py-3 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all active:scale-95 border",
                                        coupon.isActive ? "bg-slate-900 text-white border-slate-900 hover:bg-slate-800" : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                                    )}
                                >
                                    {coupon.isActive ? "Deactivate Coupon" : "Activate Coupon"}
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Coupon Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="absolute inset-0" onClick={() => setIsModalOpen(false)} />
                    <form onSubmit={handleSave} className="bg-white w-[95vw] md:w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl border border-slate-200 shadow-2xl relative z-10 animate-in zoom-in-95 duration-300 flex flex-col">
                        {/* Header */}
                        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 border border-emerald-100">
                                    <Ticket className="h-6 w-6" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight italic">
                                        {editingCoupon?.id ? "Edit Coupon" : "Create New Coupon"}
                                    </h3>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        {editingCoupon?.id ? `Modifying coupon: ${editingCoupon.code}` : "Step-by-step assistant to create new promotional code"}
                                    </p>
                                </div>
                            </div>
                            <button type="button" onClick={() => setIsModalOpen(false)} className="w-10 h-10 rounded-xl hover:bg-white flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all border border-transparent hover:border-slate-200">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Step Indicators */}
                        <div className="px-8 py-4 border-b border-slate-100 bg-slate-50/20 flex justify-center">
                            <div className="flex items-center gap-6 w-full max-w-xl flex-wrap justify-center">
                                <button
                                    type="button"
                                    onClick={() => setModalStep(1)}
                                    className="flex items-center gap-2 focus:outline-none"
                                >
                                    <div className={cn(
                                        "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all",
                                        modalStep === 1 ? "bg-emerald-600 text-white ring-4 ring-emerald-500/20" : modalStep > 1 ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-400"
                                    )}>1</div>
                                    <span className={cn("text-xs font-bold uppercase tracking-wider", modalStep >= 1 ? "text-slate-900" : "text-slate-400")}>Select Type</span>
                                </button>
                                
                                <div className="flex-1 min-w-[30px] h-[2px] bg-slate-200">
                                    <div className={cn("h-full bg-emerald-600 transition-all duration-300", modalStep >= 2 ? "w-full" : "w-0")} />
                                </div>

                                <button
                                    type="button"
                                    onClick={() => modalStep > 1 && setModalStep(2)}
                                    className="flex items-center gap-2 focus:outline-none"
                                    disabled={modalStep < 2}
                                >
                                    <div className={cn(
                                        "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all",
                                        modalStep === 2 ? "bg-emerald-600 text-white ring-4 ring-emerald-500/20" : modalStep > 2 ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-400"
                                    )}>2</div>
                                    <span className={cn("text-xs font-bold uppercase tracking-wider", modalStep >= 2 ? "text-slate-900" : "text-slate-400")}>Configure</span>
                                </button>

                                <div className="flex-1 min-w-[30px] h-[2px] bg-slate-200">
                                    <div className={cn("h-full bg-emerald-600 transition-all duration-300", modalStep >= 3 ? "w-full" : "w-0")} />
                                </div>

                                <button
                                    type="button"
                                    onClick={() => modalStep > 2 && setModalStep(3)}
                                    className="flex items-center gap-2 focus:outline-none"
                                    disabled={modalStep < 3}
                                >
                                    <div className={cn(
                                        "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all",
                                        modalStep === 3 ? "bg-emerald-600 text-white ring-4 ring-emerald-500/20" : "bg-slate-100 text-slate-400"
                                    )}>3</div>
                                    <span className={cn("text-xs font-bold uppercase tracking-wider", modalStep >= 3 ? "text-slate-900" : "text-slate-400")}>Targeting</span>
                                </button>
                            </div>
                        </div>
                        
                        {/* Form Content */}
                        <div className="p-8 overflow-y-auto flex-1">
                            {/* STEP 1: Select Type */}
                            {modalStep === 1 && (
                                <div className="space-y-6">
                                    <div className="text-center max-w-md mx-auto mb-4">
                                        <h4 className="text-lg font-bold text-slate-900">What kind of promotion is this?</h4>
                                        <p className="text-xs text-slate-400 mt-1">Select the baseline reward behavior. This determines what options will be available in the next step.</p>
                                    </div>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {[
                                            {
                                                id: "DISCOUNT",
                                                title: "Standard Discount",
                                                desc: "Apply a flat amount (e.g. ₹50 off) or percentage discount (e.g. 10% off) on the total order value.",
                                                icon: Ticket,
                                                color: "text-emerald-600 bg-emerald-50 border-emerald-100"
                                            },
                                            {
                                                id: "ITEM_DISCOUNT",
                                                title: "Product-Specific Discount",
                                                desc: "Apply a flat or percentage discount to a single specific item in the cart (e.g. 20% off cauliflower).",
                                                icon: Tag,
                                                color: "text-blue-600 bg-blue-50 border-blue-100"
                                            },
                                            {
                                                id: "SPECIAL_PRICE_ITEM",
                                                title: "Special Deal Price",
                                                desc: "Set an exact fixed cost for a specific product when this code is entered (e.g. Get coriander for ₹1).",
                                                icon: Zap,
                                                color: "text-amber-600 bg-amber-50 border-amber-100"
                                            },
                                            {
                                                id: "FREE_GIFT",
                                                title: "Free Gift Reward",
                                                desc: "Offer a selected product completely free as an added bonus item to the cart subtotal.",
                                                icon: Plus,
                                                color: "text-purple-600 bg-purple-50 border-purple-100"
                                            },
                                            {
                                                id: "CASHBACK",
                                                title: "Wallet Cashback",
                                                desc: "Reward buyers with currency added directly to their virtual account wallet upon order fulfillment.",
                                                icon: CreditCard,
                                                color: "text-indigo-600 bg-indigo-50 border-indigo-100"
                                            }
                                        ].map((t) => (
                                            <button
                                                key={t.id}
                                                type="button"
                                                onClick={() => {
                                                    setEditingCoupon({ ...editingCoupon, type: t.id });
                                                    setModalStep(2);
                                                }}
                                                className={cn(
                                                    "p-5 rounded-2xl border text-left flex gap-4 transition-all duration-300 active:scale-98 hover:shadow-md w-full",
                                                    editingCoupon?.type === t.id 
                                                        ? "border-slate-900 bg-slate-50/50 ring-2 ring-slate-900/5" 
                                                        : "border-slate-200 hover:border-slate-300 bg-white"
                                                )}
                                            >
                                                <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border", t.color)}>
                                                    <t.icon className="h-6 w-6" />
                                                </div>
                                                <div className="space-y-1">
                                                    <h5 className="font-bold text-sm text-slate-900">{t.title}</h5>
                                                    <p className="text-xs text-slate-500 leading-normal">{t.desc}</p>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                    
                                    <div className="flex justify-end pt-4">
                                        <button
                                            type="button"
                                            onClick={() => setModalStep(2)}
                                            className="h-11 bg-slate-900 text-white px-6 rounded-xl font-bold uppercase tracking-wider text-xs hover:bg-slate-800 transition-all active:scale-95 flex items-center gap-2"
                                        >
                                            Next Step
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* STEP 2: Configure Coupon details */}
                            {modalStep === 2 && (
                                <div className="space-y-6 max-w-3xl mx-auto animate-in fade-in duration-300">
                                    <h4 className="text-xs font-black text-emerald-600 uppercase tracking-widest border-b border-slate-100 pb-2">2. Configuration Details ({editingCoupon?.type})</h4>
                                    
                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Coupon Code (e.g. MONSOON20)</Label>
                                            <input 
                                                value={editingCoupon?.code || ""}
                                                onChange={e => setEditingCoupon({...editingCoupon, code: e.target.value.toUpperCase()})}
                                                className="w-full h-12 bg-white border border-slate-200 rounded-xl px-4 text-base font-bold text-slate-900 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 transition-all tracking-widest font-mono uppercase"
                                                placeholder="SAVE50"
                                                required
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Public Description</Label>
                                            <input 
                                                value={editingCoupon?.description || ""}
                                                onChange={e => setEditingCoupon({...editingCoupon, description: e.target.value})}
                                                className="w-full h-12 bg-white border border-slate-200 rounded-xl px-4 text-sm font-medium text-slate-900 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 transition-all"
                                                placeholder="Get flat ₹50 off on orders above ₹499"
                                                required
                                            />
                                        </div>
                                    </div>

                                    {/* Fields for DISCOUNT / ITEM_DISCOUNT / CASHBACK */}
                                    {(editingCoupon?.type === "DISCOUNT" || editingCoupon?.type === "ITEM_DISCOUNT" || editingCoupon?.type === "CASHBACK") && (
                                        <div className="grid grid-cols-2 gap-6 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Discount Mode</Label>
                                                <select 
                                                    value={editingCoupon?.discountType || "FLAT"}
                                                    onChange={e => setEditingCoupon({...editingCoupon, discountType: e.target.value})}
                                                    className="w-full h-12 bg-white border border-slate-200 rounded-xl px-4 text-sm font-bold text-slate-600 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 transition-all"
                                                >
                                                    <option value="FLAT">Flat Cash Value (₹)</option>
                                                    <option value="PERCENTAGE">Percentage rate (%)</option>
                                                </select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Discount Value</Label>
                                                <input 
                                                    type="number"
                                                    value={editingCoupon?.discountValue || ""}
                                                    onChange={e => setEditingCoupon({...editingCoupon, discountValue: e.target.value})}
                                                    className="w-full h-12 bg-white border border-slate-200 rounded-xl px-4 text-sm font-bold text-slate-900 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 transition-all"
                                                    placeholder="50"
                                                    required
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* Fields for ITEM_DISCOUNT / SPECIAL_PRICE_ITEM / FREE_GIFT */}
                                    {(editingCoupon?.type === "ITEM_DISCOUNT" || editingCoupon?.type === "SPECIAL_PRICE_ITEM" || editingCoupon?.type === "FREE_GIFT") && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Reward Product ID (UUID)</Label>
                                                <input 
                                                    value={editingCoupon?.rewardProductId || ""}
                                                    onChange={e => setEditingCoupon({...editingCoupon, rewardProductId: e.target.value})}
                                                    className="w-full h-12 bg-white border border-slate-200 rounded-xl px-4 text-xs font-medium text-slate-900 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 transition-all font-mono"
                                                    placeholder="Enter product database ID"
                                                    required
                                                />
                                            </div>
                                            
                                            {editingCoupon?.type === "SPECIAL_PRICE_ITEM" && (
                                                <div className="space-y-2">
                                                    <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Special Deal Price (₹)</Label>
                                                    <input 
                                                        type="number"
                                                        value={editingCoupon?.specialPrice || ""}
                                                        onChange={e => setEditingCoupon({...editingCoupon, specialPrice: e.target.value})}
                                                        className="w-full h-12 bg-white border border-slate-200 rounded-xl px-4 text-sm font-bold text-slate-900 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 transition-all"
                                                        placeholder="1.00"
                                                        required
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Minimum Order Amount (₹)</Label>
                                            <input 
                                                type="number"
                                                value={editingCoupon?.minOrderAmount || ""}
                                                onChange={e => setEditingCoupon({...editingCoupon, minOrderAmount: e.target.value})}
                                                className="w-full h-12 bg-white border border-slate-200 rounded-xl px-4 text-sm font-bold text-slate-900 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 transition-all"
                                                placeholder="0"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Maximum Discount Cap (₹)</Label>
                                            <input 
                                                type="number"
                                                value={editingCoupon?.maxDiscount || ""}
                                                onChange={e => setEditingCoupon({...editingCoupon, maxDiscount: e.target.value})}
                                                className="w-full h-12 bg-white border border-slate-200 rounded-xl px-4 text-sm font-bold text-slate-900 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 transition-all"
                                                placeholder="No Cap"
                                                disabled={editingCoupon?.discountType !== "PERCENTAGE"}
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Valid Until (Expiry)</Label>
                                            <input 
                                                type="date"
                                                value={editingCoupon?.expiresAt ? format(new Date(editingCoupon.expiresAt), 'yyyy-MM-dd') : ""}
                                                onChange={e => setEditingCoupon({...editingCoupon, expiresAt: e.target.value})}
                                                className="w-full h-12 bg-white border border-slate-200 rounded-xl px-4 text-sm font-medium text-slate-900 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 transition-all"
                                                required
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Global Max Usage Limit</Label>
                                            <input 
                                                type="number"
                                                value={editingCoupon?.usageLimit || ""}
                                                onChange={e => setEditingCoupon({...editingCoupon, usageLimit: e.target.value})}
                                                className="w-full h-12 bg-white border border-slate-200 rounded-xl px-4 text-sm font-bold text-slate-900 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 transition-all"
                                                placeholder="No Limit"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Per-User Usage Limit</Label>
                                            <input 
                                                type="number"
                                                value={editingCoupon?.userUsageLimit || "1"}
                                                onChange={e => setEditingCoupon({...editingCoupon, userUsageLimit: e.target.value})}
                                                className="w-full h-12 bg-white border border-slate-200 rounded-xl px-4 text-sm font-bold text-slate-900 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 transition-all"
                                                placeholder="1"
                                                required
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Allowed Payment Modes (Comma Sep)</Label>
                                            <input 
                                                value={editingCoupon?.allowedPayment || ""}
                                                onChange={e => setEditingCoupon({...editingCoupon, allowedPayment: e.target.value})}
                                                className="w-full h-12 bg-white border border-slate-200 rounded-xl px-4 text-sm font-semibold text-slate-900 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 transition-all uppercase"
                                                placeholder="UPI, WALLET, COD"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-6">
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Geofenced Delivery Pincodes (Comma Sep)</Label>
                                            <input 
                                                value={editingCoupon?.allowedPincodes || ""}
                                                onChange={e => setEditingCoupon({...editingCoupon, allowedPincodes: e.target.value})}
                                                className="w-full h-12 bg-white border border-slate-200 rounded-xl px-4 text-sm font-semibold text-slate-900 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 transition-all font-mono"
                                                placeholder="422001, 422002"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Min Trust Score Required (%)</Label>
                                            <input 
                                                type="number"
                                                value={editingCoupon?.minTrustScore || ""}
                                                onChange={e => setEditingCoupon({...editingCoupon, minTrustScore: e.target.value})}
                                                className="w-full h-12 bg-white border border-slate-200 rounded-xl px-4 text-sm font-semibold text-slate-900 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 transition-all"
                                                placeholder="e.g. 80"
                                                min="0"
                                                max="100"
                                            />
                                        </div>
                                        <div className="space-y-2 flex flex-col justify-end">
                                            <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                                                <div>
                                                    <p className="text-[10px] font-bold text-slate-700 uppercase tracking-tight">Active Status</p>
                                                    <p className="text-[8px] text-slate-400 mt-0.5 font-medium leading-none">Activate voucher now.</p>
                                                </div>
                                                <button 
                                                    type="button"
                                                    onClick={() => setEditingCoupon({...editingCoupon, isActive: !editingCoupon.isActive})}
                                                    className={cn(
                                                        "w-10 h-5 rounded-full transition-all group relative flex items-center px-1 shadow-inner",
                                                        editingCoupon?.isActive ? "bg-emerald-500 shadow-emerald-100" : "bg-slate-200 shadow-slate-100"
                                                    )}
                                                >
                                                    <div className={cn(
                                                        "w-3.5 h-3.5 rounded-full bg-white shadow-md transition-all",
                                                        editingCoupon?.isActive ? "translate-x-45" : "translate-x-0"
                                                    )}
                                                    style={{
                                                        transform: editingCoupon?.isActive ? 'translateX(18px)' : 'translateX(0px)'
                                                    }} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between pt-6 border-t border-slate-100">
                                        <button
                                            type="button"
                                            onClick={() => setModalStep(1)}
                                            className="h-11 border border-slate-200 text-slate-600 px-6 rounded-xl font-bold uppercase tracking-wider text-xs hover:bg-slate-50 transition-all active:scale-95"
                                        >
                                            Back
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (!editingCoupon.code) return toast.error("Coupon Code is required");
                                                if (!editingCoupon.description) return toast.error("Public Description is required");
                                                setModalStep(3);
                                            }}
                                            className="h-11 bg-slate-900 text-white px-6 rounded-xl font-bold uppercase tracking-wider text-xs hover:bg-slate-800 transition-all active:scale-95"
                                        >
                                            Next: Target Audience
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* STEP 3: Assign to users */}
                            {modalStep === 3 && (
                                <div className="space-y-8 max-w-2xl mx-auto animate-in fade-in duration-300">
                                    <div className="text-center max-w-md mx-auto mb-4">
                                        <h4 className="text-lg font-bold text-slate-900">Step 3: Assign to Users</h4>
                                        <p className="text-xs text-slate-400 mt-1">Configure who is eligible to redeem this coupon. You can target group segments, specific phone numbers, or both.</p>
                                    </div>

                                    {/* 1. Target Loyalty Segments */}
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                                            <Users className="h-4 w-4 text-indigo-600" />
                                            <h5 className="text-xs font-bold text-slate-800 uppercase tracking-widest">Assign by User Group / Loyalty Segment</h5>
                                        </div>
                                        <p className="text-xs text-slate-400 mt-1">Select one or more user segments that qualify for this coupon.</p>
                                        <div className="flex flex-wrap gap-2.5 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                                            {segmentsList.map((segment) => {
                                                const isSelected = (editingCoupon.userSegments || []).includes(segment.id);
                                                return (
                                                    <button
                                                        key={segment.id}
                                                        type="button"
                                                        onClick={() => handleSegmentToggle(segment.id)}
                                                        className={cn(
                                                            "px-3.5 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all border active:scale-95",
                                                            isSelected 
                                                                ? "bg-slate-900 border-slate-900 text-white shadow-sm" 
                                                                : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                                                        )}
                                                    >
                                                        {segment.name}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* 2. Target Specific Users by Phone Numbers */}
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                                            <Phone className="h-4 w-4 text-emerald-600" />
                                            <h5 className="text-xs font-bold text-slate-800 uppercase tracking-widest">Assign to Specific Phone Numbers (Optional)</h5>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">User Phone Numbers (Comma Separated)</Label>
                                            <textarea 
                                                value={editingCoupon?.targetedPhoneNumbers || ""}
                                                onChange={e => setEditingCoupon({...editingCoupon, targetedPhoneNumbers: e.target.value})}
                                                className="w-full min-h-[100px] bg-white border border-slate-200 rounded-2xl p-4 text-sm font-semibold text-slate-900 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 transition-all font-mono"
                                                placeholder="9876543210, 8765432109, 7654321098"
                                            />
                                            <p className="text-[10px] text-slate-400 leading-normal">
                                                Leave empty to allow all users (matching the segment above) to redeem. If phone numbers are entered, this coupon will be strictly restricted to only these registered customer accounts.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between pt-8 border-t border-slate-100">
                                        <button
                                            type="button"
                                            onClick={() => setModalStep(2)}
                                            className="h-11 border border-slate-200 text-slate-600 px-6 rounded-xl font-bold uppercase tracking-wider text-xs hover:bg-slate-50 transition-all active:scale-95"
                                        >
                                            Back
                                        </button>
                                        
                                        <button 
                                            type="submit"
                                            disabled={submitting}
                                            className="h-12 bg-emerald-600 text-white px-8 rounded-xl font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-emerald-700 transition-all active:scale-95 shadow-lg shadow-emerald-100"
                                        >
                                            {submitting ? (
                                                <Activity className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <>
                                                    <ShieldCheck className="h-4 w-4" />
                                                    Submit & Save Coupon
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
