"use client";

import { useState, useEffect } from "react";
import api from "@/services/api";
import { toast } from "sonner";
import {
    Truck, Plus, Search, Building, Phone, Mail, MapPin,
    FileText, CheckCircle2, XCircle, Edit3, Trash2, Send,
    Store, Tag, ShieldCheck, ArrowRight, RefreshCw
} from "lucide-react";
import { useUserStore } from "@/store/useUserStore";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export default function VendorsPage() {
    const { user } = useUserStore();
    const router = useRouter();
    const [vendors, setVendors] = useState<any[]>([]);
    const [locations, setLocations] = useState<any[]>([]);
    const [selectedLocation, setSelectedLocation] = useState<string>("ALL");
    const [searchQuery, setSearchQuery] = useState<string>("");
    const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
    const [loading, setLoading] = useState(true);

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [editingVendor, setEditingVendor] = useState<any | null>(null);
    const [formData, setFormData] = useState({
        name: "",
        companyName: "",
        phone: "",
        email: "",
        address: "",
        gstNumber: "",
        paymentTerms: "NET_30",
        category: "VEGETABLES",
        locationId: "GLOBAL"
    });
    const [saving, setSaving] = useState(false);

    const isStoreAdmin = user?.role === "STORE_ADMIN";

    useEffect(() => {
        fetchLocations();
    }, []);

    useEffect(() => {
        fetchVendors();
    }, [selectedLocation, selectedCategory]);

    const fetchLocations = async () => {
        try {
            const res = await api.get("/locations");
            setLocations(res.data || []);
            if (isStoreAdmin && user?.locationId) {
                setSelectedLocation(user.locationId);
            }
        } catch { /* Silent */ }
    };

    const fetchVendors = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (selectedLocation !== "ALL") params.set("locationId", selectedLocation);
            if (selectedCategory !== "ALL") params.set("category", selectedCategory);
            if (searchQuery) params.set("query", searchQuery);

            const res = await api.get(`/vendors?${params.toString()}`);
            setVendors(res.data?.vendors || []);
        } catch (err: any) {
            toast.error("Failed to load vendors");
        } finally {
            setLoading(false);
        }
    };

    const handleOpenCreate = () => {
        setEditingVendor(null);
        setFormData({
            name: "",
            companyName: "",
            phone: "",
            email: "",
            address: "",
            gstNumber: "",
            paymentTerms: "NET_30",
            category: "VEGETABLES",
            locationId: selectedLocation !== "ALL" ? selectedLocation : "GLOBAL"
        });
        setShowModal(true);
    };

    const handleOpenEdit = (v: any) => {
        setEditingVendor(v);
        setFormData({
            name: v.name || "",
            companyName: v.companyName || "",
            phone: v.phone || "",
            email: v.email || "",
            address: v.address || "",
            gstNumber: v.gstNumber || "",
            paymentTerms: v.paymentTerms || "NET_30",
            category: v.category || "VEGETABLES",
            locationId: v.locationId || "GLOBAL"
        });
        setShowModal(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name || !formData.phone) {
            return toast.error("Vendor name and phone number are required.");
        }

        setSaving(true);
        try {
            const payload = {
                ...formData,
                locationId: formData.locationId === "GLOBAL" ? null : formData.locationId
            };

            if (editingVendor) {
                await api.put(`/vendors/${editingVendor.id}`, payload);
                toast.success("Vendor updated successfully!");
            } else {
                await api.post("/vendors", payload);
                toast.success("Vendor registered successfully!");
            }
            setShowModal(false);
            fetchVendors();
        } catch (err: any) {
            toast.error(err.response?.data?.message || "Failed to save vendor");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this vendor?")) return;
        try {
            await api.delete(`/vendors/${id}`);
            toast.success("Vendor deleted.");
            fetchVendors();
        } catch (err: any) {
            toast.error("Failed to delete vendor");
        }
    };

    const handleCreatePOForVendor = (v: any) => {
        router.push(`/admin/purchase-orders?vendorId=${v.id}&vendorName=${encodeURIComponent(v.name)}`);
    };

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/60 rounded-full text-teal-700 dark:text-teal-300 text-xs font-bold mb-2">
                        <Truck className="w-3.5 h-3.5" /> Supplier Network & Procurement
                    </div>
                    <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
                        <Building className="h-8 w-8 text-teal-500" />
                        Vendor Directory
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">
                        Register wholesale suppliers, manage procurement contracts, and automate PO dispatches.
                    </p>
                </div>

                <button
                    onClick={handleOpenCreate}
                    className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-sm transition-all shadow-md shadow-teal-600/20 flex items-center gap-2 cursor-pointer"
                >
                    <Plus className="w-4 h-4" /> Register New Vendor
                </button>
            </div>

            {/* Filters Bar */}
            <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/80 rounded-2xl shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
                <div className="flex-1 relative w-full">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && fetchVendors()}
                        placeholder="Search vendors by name, company, phone, GST..."
                        className="w-full h-10 pl-9 pr-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none"
                    />
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                    <select
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="h-10 px-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
                    >
                        <option value="ALL">All Categories</option>
                        <option value="VEGETABLES">🥦 Vegetables & Greens</option>
                        <option value="FRUITS">🍎 Fruits</option>
                        <option value="DAIRY">🥛 Dairy & Paneer</option>
                        <option value="PACKAGING">📦 Packaging & Crates</option>
                        <option value="GENERAL">🏷️ General Wholesale</option>
                    </select>

                    <select
                        value={selectedLocation}
                        onChange={(e) => setSelectedLocation(e.target.value)}
                        disabled={isStoreAdmin}
                        className="h-10 px-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
                    >
                        <option value="ALL">🌐 All Stores</option>
                        {locations.map(loc => (
                            <option key={loc.id} value={loc.id}>
                                🏬 {loc.name}
                            </option>
                        ))}
                    </select>

                    <button
                        onClick={fetchVendors}
                        className="h-10 px-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                        <RefreshCw className="w-3.5 h-3.5" /> Filter
                    </button>
                </div>
            </div>

            {/* Vendors Grid */}
            {loading ? (
                <div className="py-20 text-center text-slate-400 font-medium">Loading vendor directory...</div>
            ) : vendors.length === 0 ? (
                <div className="p-12 text-center bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-800 rounded-3xl space-y-3">
                    <Building className="w-12 h-12 text-slate-300 mx-auto" />
                    <h3 className="text-lg font-black text-slate-800 dark:text-white">No Vendors Registered Yet</h3>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto">
                        Register your local suppliers and wholesale vendors to generate purchase orders and auto-send WhatsApp POs.
                    </p>
                    <button
                        onClick={handleOpenCreate}
                        className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs"
                    >
                        + Register First Vendor
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {vendors.map((vendor) => (
                        <div
                            key={vendor.id}
                            className="p-6 rounded-[28px] bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/80 hover:border-teal-500/50 transition-all flex flex-col justify-between gap-5 shadow-xs relative overflow-hidden group"
                        >
                            <div className="space-y-4">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="text-lg font-black text-slate-900 dark:text-white group-hover:text-teal-600 transition-colors">
                                            {vendor.name}
                                        </h3>
                                        {vendor.companyName && (
                                            <p className="text-xs font-bold text-teal-600 dark:text-teal-400">
                                                {vendor.companyName}
                                            </p>
                                        )}
                                    </div>
                                    <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200/60 dark:border-teal-800/60">
                                        {vendor.category || "VEGETABLES"}
                                    </span>
                                </div>

                                <div className="space-y-2 text-xs text-slate-600 dark:text-slate-400 font-medium">
                                    <div className="flex items-center gap-2">
                                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                                        <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">{vendor.phone}</span>
                                    </div>
                                    {vendor.email && (
                                        <div className="flex items-center gap-2">
                                            <Mail className="w-3.5 h-3.5 text-slate-400" />
                                            <span>{vendor.email}</span>
                                        </div>
                                    )}
                                    {vendor.address && (
                                        <div className="flex items-start gap-2">
                                            <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                                            <span className="line-clamp-2">{vendor.address}</span>
                                        </div>
                                    )}
                                    {vendor.gstNumber && (
                                        <div className="flex items-center gap-2 pt-1">
                                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                                            <span className="font-mono text-[11px] text-slate-700 dark:text-slate-300">GST: {vendor.gstNumber}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200/60 dark:border-slate-800/80 flex justify-between items-center text-xs">
                                    <div>
                                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Terms</span>
                                        <span className="font-bold text-slate-800 dark:text-slate-200">{vendor.paymentTerms || "NET_30"}</span>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-[10px] uppercase font-bold text-slate-400 block">POs Placed</span>
                                        <span className="font-black text-teal-600 dark:text-teal-400">{vendor._count?.purchaseOrders || 0}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                                <button
                                    onClick={() => handleCreatePOForVendor(vendor)}
                                    className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                                >
                                    <FileText className="w-3.5 h-3.5" /> Generate Purchase Order
                                </button>
                                <div className="flex items-center justify-between text-xs pt-1 px-1">
                                    <button
                                        onClick={() => handleOpenEdit(vendor)}
                                        className="font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center gap-1 cursor-pointer"
                                    >
                                        <Edit3 className="w-3 h-3" /> Edit
                                    </button>
                                    <button
                                        onClick={() => handleDelete(vendor.id)}
                                        className="font-bold text-rose-500 hover:underline flex items-center gap-1 cursor-pointer"
                                    >
                                        <Trash2 className="w-3 h-3" /> Delete
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Vendor Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
                    <form onSubmit={handleSave} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[32px] w-full max-w-lg p-6 md:p-8 space-y-5 shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
                            <div>
                                <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                                    <Building className="w-5 h-5 text-teal-500" />
                                    {editingVendor ? "Edit Vendor Profile" : "Register New Vendor"}
                                </h2>
                                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                                    Supplier details for automatic Purchase Order routing.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowModal(false)}
                                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 flex items-center justify-center text-sm font-bold cursor-pointer"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="space-y-3.5 text-xs">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Contact Person Name *</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="e.g. Ramesh Patil"
                                        className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Company / Firm Name</label>
                                    <input
                                        type="text"
                                        value={formData.companyName}
                                        onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                                        placeholder="e.g. Patil Agri Farms"
                                        className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold outline-none"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">WhatsApp / Phone *</label>
                                    <input
                                        type="tel"
                                        required
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        placeholder="e.g. 9876543210"
                                        className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Email Address</label>
                                    <input
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        placeholder="supplier@mail.com"
                                        className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium outline-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase">Address / Mandi Location</label>
                                <textarea
                                    rows={2}
                                    value={formData.address}
                                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                    placeholder="e.g. APMC Mandi, Yard #4, Nashik"
                                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium outline-none"
                                />
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Category</label>
                                    <select
                                        value={formData.category}
                                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                        className="w-full h-10 px-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold outline-none cursor-pointer"
                                    >
                                        <option value="VEGETABLES">Vegetables</option>
                                        <option value="FRUITS">Fruits</option>
                                        <option value="DAIRY">Dairy</option>
                                        <option value="PACKAGING">Packaging</option>
                                        <option value="GENERAL">General</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Payment Terms</label>
                                    <select
                                        value={formData.paymentTerms}
                                        onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })}
                                        className="w-full h-10 px-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold outline-none cursor-pointer"
                                    >
                                        <option value="IMMEDIATE">Immediate / Cash</option>
                                        <option value="WEEKLY">Weekly</option>
                                        <option value="NET_15">Net 15 Days</option>
                                        <option value="NET_30">Net 30 Days</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Store Node</label>
                                    <select
                                        value={formData.locationId}
                                        onChange={(e) => setFormData({ ...formData, locationId: e.target.value })}
                                        className="w-full h-10 px-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold outline-none cursor-pointer"
                                    >
                                        <option value="GLOBAL">🌐 Global</option>
                                        {locations.map(loc => (
                                            <option key={loc.id} value={loc.id}>{loc.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase">GST Number (Optional)</label>
                                <input
                                    type="text"
                                    value={formData.gstNumber}
                                    onChange={(e) => setFormData({ ...formData, gstNumber: e.target.value })}
                                    placeholder="e.g. 27ABCDE1234F1Z5"
                                    className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono font-bold outline-none"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                            <button
                                type="button"
                                onClick={() => setShowModal(false)}
                                className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={saving}
                                className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-teal-600/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                            >
                                {saving ? "Saving..." : (editingVendor ? "Update Vendor" : "Register Vendor")}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
