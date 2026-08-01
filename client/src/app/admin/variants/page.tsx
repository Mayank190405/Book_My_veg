"use client";

import {
    Plus,
    Search,
    Edit2,
    Trash2,
    Tag,
    Save,
    X,
    Activity,
    Package,
    ChevronDown,
    ArrowUpRight,
    TrendingUp,
    CheckCircle2,
    XCircle,
    Download,
    Upload,
    Scale,
    Sparkles,
    Filter,
    RefreshCw
} from "lucide-react";
import { useState, useEffect, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";
import api from "@/services/api";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import Papa from "papaparse";
import Image from "next/image";

const WEIGHT_UNITS = ["GM", "KG", "LITRE", "ML", "PIECE", "PACK"];

export default function AdminVariants() {
    const [variants, setVariants] = useState<any[]>([]);
    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [productFilter, setProductFilter] = useState("ALL");
    const [statusFilter, setStatusFilter] = useState("ALL");

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingVariant, setEditingVariant] = useState<any>(null);
    const [submitting, setSubmitting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Form state
    const [formData, setFormData] = useState({
        productId: "",
        name: "",
        price: "",
        weight: "",
        weightUnit: "GM",
        isActive: true
    });

    const fetchVariants = async () => {
        setLoading(true);
        try {
            const res = await api.get("/variants");
            if (res.data.success) {
                setVariants(res.data.data);
            }
        } catch (error: any) {
            toast.error("Failed to load variants");
        } finally {
            setLoading(false);
        }
    };

    const fetchProducts = async () => {
        try {
            const res = await api.get("/products/admin");
            const prods = Array.isArray(res.data) ? res.data : (res.data?.products || res.data?.data || []);
            setProducts(prods);
        } catch (error) {
            console.error("Failed to fetch products for variant creation", error);
        }
    };

    useEffect(() => {
        fetchVariants();
        fetchProducts();
    }, []);

    // Filtered variants
    const filteredVariants = useMemo(() => {
        return variants.filter((variant) => {
            const matchesSearch =
                variant.name.toLowerCase().includes(search.toLowerCase()) ||
                (variant.product?.name || "").toLowerCase().includes(search.toLowerCase()) ||
                (variant.product?.sku || "").toLowerCase().includes(search.toLowerCase());

            const matchesProduct = productFilter === "ALL" || variant.productId === productFilter;
            const matchesStatus =
                statusFilter === "ALL" ||
                (statusFilter === "ACTIVE" && variant.isActive) ||
                (statusFilter === "INACTIVE" && !variant.isActive);

            return matchesSearch && matchesProduct && matchesStatus;
        });
    }, [variants, search, productFilter, statusFilter]);

    // Stats
    const stats = useMemo(() => {
        const total = variants.length;
        const active = variants.filter(v => v.isActive).length;
        const outOfStock = variants.filter(v => (v.totalStock || 0) <= 0).length;
        const avgPrice = total > 0 ? (variants.reduce((acc, v) => acc + (v.price || 0), 0) / total).toFixed(2) : "0.00";
        return { total, active, outOfStock, avgPrice };
    }, [variants]);

    const handleOpenCreateModal = () => {
        setEditingVariant(null);
        setFormData({
            productId: products[0]?.id || "",
            name: "",
            price: "",
            weight: "",
            weightUnit: "GM",
            isActive: true
        });
        setIsModalOpen(true);
    };

    const handleOpenEditModal = (variant: any) => {
        setEditingVariant(variant);
        setFormData({
            productId: variant.productId || "",
            name: variant.name || "",
            price: variant.price !== undefined ? String(variant.price) : "",
            weight: variant.weight !== null && variant.weight !== undefined ? String(variant.weight) : "",
            weightUnit: variant.weightUnit || "GM",
            isActive: Boolean(variant.isActive)
        });
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.productId) {
            toast.error("Please select a target product");
            return;
        }
        if (!formData.name.trim()) {
            toast.error("Variant name is required");
            return;
        }
        if (!formData.price || isNaN(Number(formData.price)) || Number(formData.price) < 0) {
            toast.error("Valid price is required");
            return;
        }

        setSubmitting(true);
        try {
            const payload = {
                productId: formData.productId,
                name: formData.name.trim(),
                price: Number(formData.price),
                weight: formData.weight ? Number(formData.weight) : null,
                weightUnit: formData.weightUnit,
                isActive: formData.isActive
            };

            if (editingVariant) {
                await api.put(`/variants/${editingVariant.id}`, payload);
                toast.success(`Variant "${formData.name}" updated successfully!`);
            } else {
                await api.post("/variants", payload);
                toast.success(`Variant "${formData.name}" created successfully!`);
            }

            setIsModalOpen(false);
            fetchVariants();
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Failed to save variant");
        } finally {
            setSubmitting(false);
        }
    };

    const handleToggleStatus = async (variant: any) => {
        try {
            const res = await api.patch(`/variants/${variant.id}/toggle`);
            if (res.data.success) {
                toast.success(res.data.message);
                setVariants(prev => prev.map(v => v.id === variant.id ? { ...v, isActive: !v.isActive } : v));
            }
        } catch (error: any) {
            toast.error("Failed to toggle variant status");
        }
    };

    const handleDelete = async (variant: any) => {
        if (!confirm(`Are you sure you want to delete variant "${variant.name}"? This action cannot be undone.`)) {
            return;
        }
        try {
            await api.delete(`/variants/${variant.id}`);
            toast.success("Variant deleted successfully");
            setVariants(prev => prev.filter(v => v.id !== variant.id));
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Failed to delete variant");
        }
    };

    // CSV Export
    const handleExportCSV = () => {
        const data = variants.map(v => ({
            "Variant ID": v.id,
            "Product ID": v.productId,
            "Product Name": v.product?.name || "N/A",
            "Variant Name": v.name,
            "Price": v.price,
            "Weight": v.weight || "",
            "Weight Unit": v.weightUnit,
            "Status": v.isActive ? "ACTIVE" : "INACTIVE",
            "Total Stock": v.totalStock || 0
        }));
        const csv = Papa.unparse(data);
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `product_variants_${new Date().toISOString().split("T")[0]}.csv`;
        link.click();
    };

    const handleDownloadTemplate = () => {
        const template = [
            { "Product ID": products[0]?.id || "product_id_here", "Variant Name": "500 GM Pack", "Price": "150", "Weight": "500", "Weight Unit": "GM", "Active": "true" },
            { "Product ID": products[0]?.id || "product_id_here", "Variant Name": "1 KG Pack", "Price": "280", "Weight": "1", "Weight Unit": "KG", "Active": "true" }
        ];
        const csv = Papa.unparse(template);
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "variants_import_template.csv";
        link.click();
    };

    const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                setSubmitting(true);
                let success = 0;
                let failure = 0;

                for (const row of results.data as any[]) {
                    try {
                        const productId = row["Product ID"] || row["productId"];
                        const name = row["Variant Name"] || row["name"];
                        const price = row["Price"] || row["price"];

                        if (!productId || !name || !price) continue;

                        await api.post("/variants", {
                            productId: productId.trim(),
                            name: String(name).trim(),
                            price: Number(price),
                            weight: row["Weight"] ? Number(row["Weight"]) : null,
                            weightUnit: row["Weight Unit"] || row["weightUnit"] || "GM",
                            isActive: row["Active"] ? String(row["Active"]).toLowerCase() === "true" : true
                        });
                        success++;
                    } catch (err) {
                        failure++;
                    }
                }
                toast.success(`Import Finished: ${success} variants added, ${failure} failed.`);
                fetchVariants();
                setSubmitting(false);
            }
        });
    };

    return (
        <div className="space-y-6 pb-12">
            {/* Top Navigation & Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card/60 backdrop-blur-md p-6 rounded-2xl border border-border/50 shadow-sm">
                <div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                        <span>Admin</span>
                        <span>/</span>
                        <span className="text-foreground font-medium">Product Variants</span>
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                        <Tag className="w-6 h-6 text-emerald-500" />
                        Product Variants Management
                    </h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        Manage all package sizes, weights, and channel price variants across products.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <button
                        onClick={fetchVariants}
                        className="p-2.5 rounded-xl border border-border bg-card hover:bg-accent text-foreground transition-all duration-200"
                        title="Refresh Variants"
                    >
                        <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
                    </button>

                    <button
                        onClick={handleExportCSV}
                        className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-border bg-card hover:bg-accent text-sm font-medium text-foreground transition-all duration-200"
                    >
                        <Download className="w-4 h-4 text-emerald-500" />
                        Export
                    </button>

                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleImportCSV}
                        accept=".csv"
                        className="hidden"
                    />

                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-border bg-card hover:bg-accent text-sm font-medium text-foreground transition-all duration-200"
                    >
                        <Upload className="w-4 h-4 text-blue-500" />
                        Import CSV
                    </button>

                    <button
                        onClick={handleOpenCreateModal}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold shadow-lg shadow-emerald-600/20 transition-all duration-200"
                    >
                        <Plus className="w-4 h-4" />
                        Add New Variant
                    </button>
                </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-card p-5 rounded-2xl border border-border/50 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Variants</p>
                        <h3 className="text-2xl font-bold text-foreground mt-1">{stats.total}</h3>
                    </div>
                    <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl">
                        <Tag className="w-5 h-5" />
                    </div>
                </div>

                <div className="bg-card p-5 rounded-2xl border border-border/50 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Active Variants</p>
                        <h3 className="text-2xl font-bold text-foreground mt-1">{stats.active}</h3>
                    </div>
                    <div className="p-3 bg-blue-500/10 text-blue-500 rounded-xl">
                        <CheckCircle2 className="w-5 h-5" />
                    </div>
                </div>

                <div className="bg-card p-5 rounded-2xl border border-border/50 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Out of Stock</p>
                        <h3 className="text-2xl font-bold text-amber-500 mt-1">{stats.outOfStock}</h3>
                    </div>
                    <div className="p-3 bg-amber-500/10 text-amber-500 rounded-xl">
                        <XCircle className="w-5 h-5" />
                    </div>
                </div>

                <div className="bg-card p-5 rounded-2xl border border-border/50 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Average Price</p>
                        <h3 className="text-2xl font-bold text-foreground mt-1">₹{stats.avgPrice}</h3>
                    </div>
                    <div className="p-3 bg-purple-500/10 text-purple-500 rounded-xl">
                        <TrendingUp className="w-5 h-5" />
                    </div>
                </div>
            </div>

            {/* Filter and Search Controls */}
            <div className="bg-card p-4 rounded-2xl border border-border/50 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="relative w-full md:w-80">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Search variant or product name..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 rounded-xl bg-accent/40 border border-border/60 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-foreground transition-all"
                    />
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    {/* Product Filter */}
                    <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4 text-muted-foreground hidden sm:block" />
                        <select
                            value={productFilter}
                            onChange={(e) => setProductFilter(e.target.value)}
                            className="bg-accent/40 border border-border/60 rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                        >
                            <option value="ALL">All Products</option>
                            {products.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Status Filter */}
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="bg-accent/40 border border-border/60 rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    >
                        <option value="ALL">All Status</option>
                        <option value="ACTIVE">Active Only</option>
                        <option value="INACTIVE">Inactive Only</option>
                    </select>
                </div>
            </div>

            {/* Variants Table / Content */}
            <div className="bg-card rounded-2xl border border-border/50 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="py-20 text-center text-muted-foreground flex flex-col items-center justify-center gap-3">
                        <RefreshCw className="w-8 h-8 animate-spin text-emerald-500" />
                        <p className="text-sm font-medium">Loading variants...</p>
                    </div>
                ) : filteredVariants.length === 0 ? (
                    <div className="py-16 text-center text-muted-foreground flex flex-col items-center justify-center gap-3">
                        <Package className="w-12 h-12 text-muted-foreground/40" />
                        <p className="text-base font-semibold text-foreground">No variants found</p>
                        <p className="text-sm max-w-md">
                            {search || productFilter !== "ALL" || statusFilter !== "ALL"
                                ? "No product variants match your filter criteria."
                                : "Create your first product variant by clicking 'Add New Variant' above."}
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm border-collapse">
                            <thead>
                                <tr className="border-b border-border/60 bg-muted/40 text-muted-foreground font-semibold text-xs uppercase tracking-wider">
                                    <th className="py-3.5 px-4">Variant</th>
                                    <th className="py-3.5 px-4">Parent Product</th>
                                    <th className="py-3.5 px-4">Price</th>
                                    <th className="py-3.5 px-4">Weight / Size</th>
                                    <th className="py-3.5 px-4">Stock</th>
                                    <th className="py-3.5 px-4">Status</th>
                                    <th className="py-3.5 px-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/40">
                                {filteredVariants.map((variant) => {
                                    const imgUrl = variant.product?.images?.[0] || "/placeholder.png";
                                    return (
                                        <tr key={variant.id} className="hover:bg-accent/30 transition-colors">
                                            {/* Variant Name & ID */}
                                            <td className="py-3.5 px-4">
                                                <div className="font-semibold text-foreground flex items-center gap-2">
                                                    <Tag className="w-4 h-4 text-emerald-500 shrink-0" />
                                                    <span>{variant.name}</span>
                                                </div>
                                                <span className="text-[11px] text-muted-foreground font-mono block mt-0.5">
                                                    ID: {variant.id.slice(0, 8)}...
                                                </span>
                                            </td>

                                            {/* Parent Product */}
                                            <td className="py-3.5 px-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-lg border border-border/60 overflow-hidden bg-accent shrink-0 relative">
                                                        <img
                                                            src={imgUrl}
                                                            alt={variant.product?.name || "Product"}
                                                            className="w-full h-full object-cover"
                                                            onError={(e) => { (e.target as HTMLElement).style.display = "none"; }}
                                                        />
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-foreground">{variant.product?.name || "Unassigned"}</p>
                                                        <p className="text-xs text-muted-foreground">{variant.product?.category?.name || "No Category"}</p>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Price */}
                                            <td className="py-3.5 px-4 font-bold text-foreground">
                                                ₹{Number(variant.price).toFixed(2)}
                                            </td>

                                            {/* Weight & Unit */}
                                            <td className="py-3.5 px-4">
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-accent text-xs font-semibold text-foreground border border-border/50">
                                                    <Scale className="w-3.5 h-3.5 text-emerald-500" />
                                                    {variant.weight ? `${variant.weight} ${variant.weightUnit}` : variant.weightUnit}
                                                </span>
                                            </td>

                                            {/* Stock */}
                                            <td className="py-3.5 px-4">
                                                <span className={cn(
                                                    "px-2.5 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1",
                                                    (variant.totalStock || 0) > 10 ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20" :
                                                    (variant.totalStock || 0) > 0 ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20" :
                                                    "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20"
                                                )}>
                                                    {variant.totalStock || 0} units
                                                </span>
                                            </td>

                                            {/* Status Badge */}
                                            <td className="py-3.5 px-4">
                                                <button
                                                    onClick={() => handleToggleStatus(variant)}
                                                    className={cn(
                                                        "px-3 py-1 rounded-full text-xs font-semibold border transition-all duration-200 flex items-center gap-1.5",
                                                        variant.isActive
                                                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
                                                            : "bg-muted text-muted-foreground border-border hover:bg-accent"
                                                    )}
                                                >
                                                    <span className={cn("w-1.5 h-1.5 rounded-full", variant.isActive ? "bg-emerald-500" : "bg-muted-foreground")} />
                                                    {variant.isActive ? "Active" : "Inactive"}
                                                </button>
                                            </td>

                                            {/* Action Buttons */}
                                            <td className="py-3.5 px-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => handleOpenEditModal(variant)}
                                                        className="p-2 rounded-lg border border-border/60 hover:bg-emerald-500/10 hover:border-emerald-500/30 text-muted-foreground hover:text-emerald-500 transition-all"
                                                        title="Edit Variant"
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(variant)}
                                                        className="p-2 rounded-lg border border-border/60 hover:bg-red-500/10 hover:border-red-500/30 text-muted-foreground hover:text-red-500 transition-all"
                                                        title="Delete Variant"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Create / Edit Modal Dialog */}
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="sm:max-w-md bg-card border-border rounded-2xl p-6 shadow-2xl">
                    <div className="flex items-center justify-between border-b border-border/60 pb-4 mb-4">
                        <div className="flex items-center gap-2">
                            <Tag className="w-5 h-5 text-emerald-500" />
                            <h2 className="text-lg font-bold text-foreground">
                                {editingVariant ? "Edit Product Variant" : "Create New Variant"}
                            </h2>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Parent Product */}
                        <div>
                            <Label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">
                                Target Product *
                            </Label>
                            <select
                                value={formData.productId}
                                onChange={(e) => setFormData({ ...formData, productId: e.target.value })}
                                className="w-full bg-accent/40 border border-border/60 rounded-xl px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                                required
                            >
                                <option value="">Select Parent Product</option>
                                {products.map(p => (
                                    <option key={p.id} value={p.id}>{p.name} ({p.sku || "No SKU"})</option>
                                ))}
                            </select>
                        </div>

                        {/* Variant Name */}
                        <div>
                            <Label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">
                                Variant Name *
                            </Label>
                            <input
                                type="text"
                                placeholder="e.g. 500 GM Pack, 1 KG Bag"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="w-full bg-accent/40 border border-border/60 rounded-xl px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                                required
                            />
                        </div>

                        {/* Price & Weight Grid */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">
                                    Price (₹) *
                                </Label>
                                <input
                                    type="number"
                                    step="0.01"
                                    placeholder="0.00"
                                    value={formData.price}
                                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                    className="w-full bg-accent/40 border border-border/60 rounded-xl px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                                    required
                                />
                            </div>

                            <div>
                                <Label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">
                                    Weight Value
                                </Label>
                                <input
                                    type="number"
                                    step="0.01"
                                    placeholder="e.g. 500, 1, 250"
                                    value={formData.weight}
                                    onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                                    className="w-full bg-accent/40 border border-border/60 rounded-xl px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                                />
                            </div>
                        </div>

                        {/* Weight Unit */}
                        <div>
                            <Label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">
                                Weight Unit *
                            </Label>
                            <select
                                value={formData.weightUnit}
                                onChange={(e) => setFormData({ ...formData, weightUnit: e.target.value })}
                                className="w-full bg-accent/40 border border-border/60 rounded-xl px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                            >
                                {WEIGHT_UNITS.map(unit => (
                                    <option key={unit} value={unit}>{unit}</option>
                                ))}
                            </select>
                        </div>

                        {/* Active Toggle */}
                        <div className="flex items-center justify-between pt-2">
                            <span className="text-sm font-medium text-foreground">Is Active Variant?</span>
                            <button
                                type="button"
                                onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
                                className={cn(
                                    "w-12 h-6 rounded-full transition-colors relative p-1",
                                    formData.isActive ? "bg-emerald-600" : "bg-accent border border-border"
                                )}
                            >
                                <div className={cn(
                                    "w-4 h-4 rounded-full bg-white transition-transform",
                                    formData.isActive ? "translate-x-6" : "translate-x-0"
                                )} />
                            </button>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/60">
                            <button
                                type="button"
                                onClick={() => setIsModalOpen(false)}
                                className="px-4 py-2 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-accent transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={submitting}
                                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold shadow-md transition-all flex items-center gap-2"
                            >
                                {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                {editingVariant ? "Update Variant" : "Save Variant"}
                            </button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
