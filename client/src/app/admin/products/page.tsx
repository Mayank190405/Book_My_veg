"use client";

import {
    Plus,
    Search,
    Filter,
    Edit2,
    Trash2,
    Package,
    Tag,
    Image as ImageIcon,
    Save,
    X,
    Activity,
    ChevronDown,
    ArrowUpRight,
    TrendingUp,
    Store,
    LayoutGrid,
    List,
    CheckSquare
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import api from "@/services/api";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import Papa from "papaparse";
import { useRef } from "react";

import { useUserStore } from "@/store/useUserStore";
import ImageUpload from "@/components/features/ImageUpload";

export default function AdminProducts() {
    const { user } = useUserStore();
    const [products, setProducts] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");

    const isStoreAdmin = user?.role === "STORE_ADMIN";

    // Modal State
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<any>(null);
    const [tagsString, setTagsString] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Inline Table State
    const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
    // editedRows: { [productId]: { name, sku, categoryId, tags, price } }
    const [editedRows, setEditedRows] = useState<Record<string, any>>({});
    const [savingIds, setSavingIds] = useState<Set<string>>(new Set());

    const handleInlineChange = (productId: string, field: string, value: string) => {
        setEditedRows(prev => ({
            ...prev,
            [productId]: {
                ...(prev[productId] || {}),
                [field]: value
            }
        }));
    };

    const handleInlineSave = async (product: any) => {
        const edits = editedRows[product.id];
        if (!edits) return;
        setSavingIds(prev => new Set(prev).add(product.id));
        try {
            const tagsArr = typeof edits.tags === "string"
                ? edits.tags.split(",").map((t: string) => t.trim()).filter(Boolean)
                : (product.tags || []);
            await api.put(`/products/${product.id}`, {
                ...product,
                name: edits.name ?? product.name,
                sku: edits.sku ?? product.sku,
                categoryId: edits.categoryId ?? product.categoryId,
                tags: tagsArr,
                ...(edits.price !== undefined ? {
                    variants: product.variants?.map((v: any, i: number) =>
                        i === 0 ? { ...v, price: edits.price } : v
                    )
                } : {})
            });
            toast.success(`${edits.name ?? product.name} saved`);
            setEditedRows(prev => { const n = { ...prev }; delete n[product.id]; return n; });
            fetchProducts();
        } catch (e: any) {
            toast.error(e.response?.data?.message || "Save failed");
        } finally {
            setSavingIds(prev => { const n = new Set(prev); n.delete(product.id); return n; });
        }
    };

    const handleSaveAll = async () => {
        const dirtyProducts = filteredProducts.filter((p: any) => editedRows[p.id]);
        await Promise.all(dirtyProducts.map((p: any) => handleInlineSave(p)));
    };

    const handleExport = () => {
        try {
            const exportData: any[] = [];
            products.forEach(p => {
                const baseInfo = {
                    "Product Name": p.name,
                    "SKU": p.sku || "",
                    "Category": p.category?.name || "",
                    "Image URL": p.images?.[0] || p.imageUrl || "",
                    "Description": p.description || ""
                };
                if (p.variants && p.variants.length > 0) {
                    p.variants.forEach((v: any) => {
                        exportData.push({
                            ...baseInfo,
                            "Variant Name": v.name,
                            "Weight": v.weight,
                            "Unit": v.weightUnit,
                            "Rate": v.price
                        });
                    });
                } else {
                    exportData.push({
                        ...baseInfo,
                        "Variant Name": "Standard",
                        "Weight": p.variants?.[0]?.weight || 0,
                        "Unit": p.variants?.[0]?.weightUnit || p.weightUnit || "kg",
                        "Rate": p.variants?.[0]?.price || p.basePrice || 0
                    });
                }
            });
            const csv = Papa.unparse(exportData);
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", `catalog_sync_${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            toast.success("Catalog protocol exported successfuly");
        } catch (error) {
            toast.error("Format conversion failed during export");
        }
    };

    const handleDownloadTemplate = () => {
        try {
            const templateData = [
                {
                    "Product Name": "Fresh Spinach",
                    "SKU": "SP-001",
                    "Category": categories[0]?.name || "Vegetables",
                    "Image URL": "https://example.com/spinach.jpg",
                    "Description": "Organic green leaves.",
                    "Variant Name": "Small Pack",
                    "Weight": "250",
                    "Unit": "GM",
                    "Rate": "15.00",
                    "Initial Qty": "100",
                    "Low Stock Alert": "5"
                },
                {
                    "Product Name": "Fresh Spinach",
                    "SKU": "SP-001",
                    "Category": categories[0]?.name || "Vegetables",
                    "Image URL": "https://example.com/spinach.jpg",
                    "Description": "Organic green leaves.",
                    "Variant Name": "Family Pack",
                    "Weight": "1",
                    "Unit": "KG",
                    "Rate": "45.00",
                    "Initial Qty": "50",
                    "Low Stock Alert": "10"
                }
            ];
            const csv = Papa.unparse(templateData);
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", `catalog_import_protocol.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            toast.success("Import protocol template generated.");
        } catch (error) {
            toast.error("Template generation failed");
        }
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setSubmitting(true);
        const formData = new FormData();
        formData.append("file", file);

        try {
            const response = await api.post("/products/import", formData, {
                headers: {
                    "Content-Type": "multipart/form-data"
                }
            });
            toast.success(response.data.message || "Merchandise Ingestion Complete.");
            fetchProducts();
            fetchCategories();
        } catch (error: any) {
            const errorMsg = error.response?.data?.message || error.message || "Bulk synchronization failed";
            toast.error(`Sync failure: ${errorMsg}`);
        } finally {
            setSubmitting(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const fetchProducts = async () => {
        setLoading(true);
        try {
            const adminUser = user as any;
            const params = isStoreAdmin && adminUser?.locationId ? `?locationId=${adminUser.locationId}` : "";
            // Use the unrestricted administrative registry for full synchronization
            const response = await api.get(`/products/admin${params}`);
            const productList = response.data?.data || response.data || [];
            if (Array.isArray(productList)) {
                setProducts(productList);
            } else {
                setProducts([]);
            }
        } catch (error) {
            toast.error("Failed to synchronize with central merchandise registry");
        }
        setLoading(false);
    };

    const fetchCategories = async () => {
        try {
            const res = await api.get("/categories");
            setCategories(res.data);
        } catch (error) {
            console.error("Failed to load categories");
        }
    };

    useEffect(() => {
        fetchProducts();
        fetchCategories();
    }, []);

    const handleSaveProduct = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const tagsArray = tagsString.split(",").map(t => t.trim()).filter(t => t.length > 0);
            // Format data for Prisma nested creation/update if necessary
            // For now sending the direct state as we matched naming with schema
            const productData = {
                ...editingProduct,
                tags: tagsArray,
                slug: editingProduct.name.toLowerCase().replace(/ /g, "-") + "-" + Date.now().toString().slice(-4)
            };

            if (editingProduct.id) {
                await api.put(`/products/${editingProduct.id}`, productData);
                toast.success("Catalog protocol updated successfully");
            } else {
                await api.post("/products", productData);
                toast.success("New merchandise committed to catalog");
            }
            fetchProducts();
            setIsProductModalOpen(false);
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Protocol validation failed");
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this product from the catalog?")) return;
        try {
            await api.delete(`/products/${id}`);
            toast.success("Product deleted successfully");
            fetchProducts();
        } catch (error) {
            toast.error("Failed to delete product");
        }
    };

    const filteredProducts = useMemo(() => {
        if (!Array.isArray(products)) return [];
        return products.filter(p =>
            p.name?.toLowerCase().includes(search.toLowerCase()) ||
            p.category?.name?.toLowerCase().includes(search.toLowerCase()) ||
            p.sku?.toLowerCase().includes(search.toLowerCase()) ||
            p.barcode?.toLowerCase().includes(search.toLowerCase())
        );
    }, [products, search]);

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-200">
                <div className="px-1 md:px-0">
                    <h2 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Product Catalog</h2>
                    <p className="text-sm text-slate-500 mt-1">Manage and monitor the global merchandise inventory.</p>
                </div>

                {/* Permitting STORE_ADMIN to initialize products if the catalog is empty, or if they have clearance */}
                <button
                    onClick={() => {
                        setEditingProduct({
                            name: "",
                            sku: "",
                            categoryId: "",
                            description: "",
                            images: [""],
                            variants: [{ name: "Standard", weight: "1", weightUnit: "KG", price: "0", quantity: "0", threshold: "5" }],
                            tags: []
                        });
                        setTagsString("");
                        setIsProductModalOpen(true);
                    }}
                    className="h-12 bg-emerald-600 text-white px-8 rounded-xl flex items-center justify-center gap-3 shadow-md shadow-emerald-100 hover:bg-emerald-700 active:scale-95 transition-all font-semibold w-full md:w-auto"
                >
                    <Plus className="h-5 w-5" />
                    <span>Add New Product</span>
                </button>
            </div>

            {/* Search and Advanced Operations */}
            <div className="flex flex-col lg:flex-row gap-6 items-end lg:items-center justify-between">
                <div className="w-full lg:max-w-md relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-emerald-600 transition-colors" />
                    <input
                        className="w-full h-12 bg-white border border-slate-200 rounded-xl pl-12 pr-4 text-sm text-slate-900 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 transition-all outline-none placeholder:text-slate-400 font-medium"
                        placeholder="Search products or categories..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleImport}
                        accept=".csv"
                        className="hidden"
                    />
                    {/* View Toggle */}
                    <div className="flex items-center bg-slate-100 rounded-xl p-1 gap-1">
                        <button
                            onClick={() => setViewMode("grid")}
                            className={`h-9 px-4 rounded-lg flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all ${
                                viewMode === "grid"
                                    ? "bg-white text-emerald-600 shadow-sm"
                                    : "text-slate-400 hover:text-slate-600"
                            }`}
                        >
                            <LayoutGrid className="h-3.5 w-3.5" />
                            <span>Cards</span>
                        </button>
                        <button
                            onClick={() => setViewMode("table")}
                            className={`h-9 px-4 rounded-lg flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all ${
                                viewMode === "table"
                                    ? "bg-white text-emerald-600 shadow-sm"
                                    : "text-slate-400 hover:text-slate-600"
                            }`}
                        >
                            <List className="h-3.5 w-3.5" />
                            <span>Table</span>
                        </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                        <button
                            onClick={handleExport}
                            className="h-12 bg-white border border-slate-200 text-slate-600 px-6 rounded-xl flex items-center justify-center gap-3 hover:bg-slate-50 active:scale-95 transition-all font-bold text-xs uppercase tracking-widest flex-1 md:flex-none"
                        >
                            <ArrowUpRight className="h-4 w-4" />
                            <span className="whitespace-nowrap">Export Catalog</span>
                        </button>
                        <button
                            onClick={handleDownloadTemplate}
                            className="h-12 bg-white border border-slate-200 text-slate-600 px-6 rounded-xl flex items-center justify-center gap-3 hover:bg-slate-50 active:scale-95 transition-all font-bold text-xs uppercase tracking-widest flex-1 md:flex-none"
                        >
                            <Tag className="h-4 w-4" />
                            <span className="whitespace-nowrap">Template</span>
                        </button>
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={submitting}
                            className="h-12 bg-slate-900 text-white px-6 rounded-xl flex items-center justify-center gap-3 hover:bg-slate-800 active:scale-95 transition-all font-bold text-xs uppercase tracking-widest disabled:opacity-50 flex-1 md:flex-none"
                        >
                            {submitting ? <Activity className="h-4 w-4 animate-spin" /> : <TrendingUp className="h-4 w-4" />}
                            <span className="whitespace-nowrap">Bulk Import</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Save All Banner – Table Mode Only */}
            {viewMode === "table" && Object.keys(editedRows).length > 0 && (
                <div className="flex items-center justify-between px-5 py-3 bg-amber-50 border border-amber-200 rounded-2xl animate-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                        <span className="text-xs font-bold text-amber-700 uppercase tracking-widest">
                            {Object.keys(editedRows).length} unsaved {Object.keys(editedRows).length === 1 ? "change" : "changes"}
                        </span>
                    </div>
                    <button
                        onClick={handleSaveAll}
                        className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white px-5 rounded-xl flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all active:scale-95"
                    >
                        <CheckSquare className="h-3.5 w-3.5" />
                        Save All Changes
                    </button>
                </div>
            )}

            {/* ==================== TABLE VIEW ==================== */}
            {viewMode === "table" && (
                <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
                    {loading ? (
                        <div className="p-8 space-y-3">
                            {[1,2,3,4,5].map(i => (
                                <div key={i} className="h-12 bg-slate-100 rounded-xl animate-pulse" />
                            ))}
                        </div>
                    ) : (
                        <table className="w-full text-sm border-collapse">
                            <thead>
                                <tr className="border-b border-slate-100 bg-slate-50">
                                    <th className="text-left px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest w-14"></th>
                                    <th className="text-left px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest min-w-[160px]">Product Name</th>
                                    <th className="text-left px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest min-w-[100px]">SKU</th>
                                    <th className="text-left px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest min-w-[140px]">Category</th>
                                    <th className="text-left px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest min-w-[200px]">Tags (comma-sep)</th>
                                    <th className="text-left px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest min-w-[100px]">Rate (₹)</th>
                                    <th className="text-left px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest min-w-[120px]">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredProducts.map((product: any) => {
                                    const row = editedRows[product.id];
                                    const isDirty = !!row;
                                    const isSaving = savingIds.has(product.id);
                                    const currentTags = Array.isArray(product.tags)
                                        ? product.tags.join(", ")
                                        : (typeof product.tags === "string" ? product.tags : "");

                                    return (
                                        <tr
                                            key={product.id}
                                            className={`border-b border-slate-50 transition-colors ${
                                                isDirty ? "bg-amber-50/60" : "hover:bg-slate-50/60"
                                            }`}
                                        >
                                            {/* Thumbnail */}
                                            <td className="px-3 py-2">
                                                <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center flex-shrink-0">
                                                    {(product.images?.[0] || product.imageUrl) ? (
                                                        <img src={product.images?.[0] || product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <ImageIcon className="h-4 w-4 text-slate-300" />
                                                    )}
                                                </div>
                                            </td>

                                            {/* Name */}
                                            <td className="px-2 py-2">
                                                <input
                                                    defaultValue={product.name}
                                                    onChange={e => handleInlineChange(product.id, "name", e.target.value)}
                                                    className={`w-full h-9 rounded-lg px-3 text-xs font-semibold text-slate-900 outline-none transition-all border ${
                                                        isDirty && row?.name !== undefined
                                                            ? "border-amber-300 bg-amber-50 focus:border-emerald-500"
                                                            : "border-transparent bg-transparent hover:border-slate-200 focus:border-emerald-500 focus:bg-white"
                                                    }`}
                                                />
                                            </td>

                                            {/* SKU */}
                                            <td className="px-2 py-2">
                                                <input
                                                    defaultValue={product.sku || ""}
                                                    onChange={e => handleInlineChange(product.id, "sku", e.target.value)}
                                                    placeholder="—"
                                                    className={`w-full h-9 rounded-lg px-3 text-xs font-mono text-slate-600 outline-none transition-all border ${
                                                        isDirty && row?.sku !== undefined
                                                            ? "border-amber-300 bg-amber-50 focus:border-emerald-500"
                                                            : "border-transparent bg-transparent hover:border-slate-200 focus:border-emerald-500 focus:bg-white"
                                                    }`}
                                                />
                                            </td>

                                            {/* Category */}
                                            <td className="px-2 py-2">
                                                <select
                                                    defaultValue={product.categoryId || ""}
                                                    onChange={e => handleInlineChange(product.id, "categoryId", e.target.value)}
                                                    className={`w-full h-9 rounded-lg px-2 text-xs font-semibold text-slate-900 outline-none transition-all border appearance-none ${
                                                        isDirty && row?.categoryId !== undefined
                                                            ? "border-amber-300 bg-amber-50 focus:border-emerald-500"
                                                            : "border-transparent bg-transparent hover:border-slate-200 focus:border-emerald-500 focus:bg-white"
                                                    }`}
                                                >
                                                    <option value="">— select —</option>
                                                    {categories.map((c: any) => (
                                                        <option key={c.id} value={c.id}>{c.name}</option>
                                                    ))}
                                                </select>
                                            </td>

                                            {/* Tags */}
                                            <td className="px-2 py-2">
                                                <input
                                                    defaultValue={currentTags}
                                                    onChange={e => handleInlineChange(product.id, "tags", e.target.value)}
                                                    placeholder="tag1, tag2, ..."
                                                    className={`w-full h-9 rounded-lg px-3 text-xs font-medium text-slate-600 outline-none transition-all border ${
                                                        isDirty && row?.tags !== undefined
                                                            ? "border-amber-300 bg-amber-50 focus:border-emerald-500"
                                                            : "border-transparent bg-transparent hover:border-slate-200 focus:border-emerald-500 focus:bg-white"
                                                    }`}
                                                />
                                            </td>

                                            {/* Price */}
                                            <td className="px-2 py-2">
                                                <input
                                                    type="number"
                                                    defaultValue={product.variants?.[0]?.price || product.basePrice || ""}
                                                    onChange={e => handleInlineChange(product.id, "price", e.target.value)}
                                                    placeholder="0"
                                                    className={`w-full h-9 rounded-lg px-3 text-xs font-bold text-slate-900 outline-none transition-all border ${
                                                        isDirty && row?.price !== undefined
                                                            ? "border-amber-300 bg-amber-50 focus:border-emerald-500"
                                                            : "border-transparent bg-transparent hover:border-slate-200 focus:border-emerald-500 focus:bg-white"
                                                    }`}
                                                />
                                            </td>

                                            {/* Actions */}
                                            <td className="px-3 py-2">
                                                <div className="flex items-center gap-1.5">
                                                    {isDirty ? (
                                                        <button
                                                            onClick={() => handleInlineSave(product)}
                                                            disabled={isSaving}
                                                            className="h-8 px-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-lg flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest transition-all active:scale-95"
                                                        >
                                                            {isSaving ? <Activity className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                                                            <span>{isSaving ? "..." : "Save"}</span>
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() => {
                                                                setEditingProduct(product);
                                                                setTagsString(currentTags);
                                                                setIsProductModalOpen(true);
                                                            }}
                                                            className="h-8 px-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest transition-all active:scale-95"
                                                        >
                                                            <Edit2 className="h-3 w-3" />
                                                            <span>Edit</span>
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => handleDelete(product.id)}
                                                        className="h-8 w-8 flex items-center justify-center bg-rose-50 hover:bg-rose-100 text-rose-500 rounded-lg transition-all active:scale-95"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {filteredProducts.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="py-16 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">
                                            No products found
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {/* ==================== CARD GRID VIEW ==================== */}
            {viewMode === "grid" && (
            <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-6">
                {loading ? (
                    [1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className="h-48 bg-white rounded-xl border border-slate-200 animate-pulse" />
                    ))
                ) : (
                    filteredProducts.map((product) => (
                        <div key={product.id} className="group relative bg-white rounded-3xl border border-slate-200 p-6 hover:shadow-2xl hover:border-emerald-200 transition-all duration-500 flex flex-col gap-6">
                            <div className="relative aspect-square w-full rounded-2xl bg-slate-50 overflow-hidden border border-slate-100 group-hover:border-emerald-100 transition-colors">
                                {(product.images?.[0] || product.imageUrl) ? (
                                    <img src={product.images?.[0] || product.imageUrl} alt={product.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                                ) : (
                                    <ImageIcon className="absolute inset-0 m-auto h-12 w-12 text-slate-200" />
                                )}
                                <div className="absolute top-4 right-4 flex gap-2 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setEditingProduct(product);
                                            setTagsString(Array.isArray(product.tags) ? product.tags.join(", ") : (typeof product.tags === "string" ? product.tags : ""));
                                            setIsProductModalOpen(true);
                                        }}
                                        className="w-10 h-10 rounded-xl bg-white/90 backdrop-blur-md shadow-lg flex items-center justify-center text-slate-600 hover:text-emerald-600 transition-colors"
                                    >
                                        <Edit2 className="h-5 w-5" />
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDelete(product.id);
                                        }}
                                        className="w-10 h-10 rounded-xl bg-white/90 backdrop-blur-md shadow-lg flex items-center justify-center text-slate-600 hover:text-red-500 transition-colors"
                                    >
                                        <Trash2 className="h-5 w-5" />
                                    </button>
                                </div>
                            </div>

                            <div className="flex-1 flex flex-col justify-between">
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="px-2.5 py-1 bg-emerald-50 text-[10px] font-black text-emerald-600 rounded-lg uppercase tracking-widest leading-none border border-emerald-100">
                                            {product.category?.name || "Inventory"}
                                        </span>
                                        {(product.sku || product.barcode) && (
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest italic leading-none">
                                                ID: {product.sku || product.barcode}
                                            </span>
                                        )}
                                    </div>
                                    <h3 className="text-xl font-bold text-slate-900 group-hover:text-emerald-700 transition-colors leading-tight mb-2">
                                        {product.name}
                                    </h3>
                                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                                        {product.description || "Primary merchandising asset description not specified."}
                                    </p>
                                </div>

                                <div className="mt-6 pt-6 border-t border-slate-50 flex items-end justify-between">
                                    <div>
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 leading-none">Catalog Rate</p>
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-2xl font-black text-slate-900 leading-none tracking-tighter">
                                                ₹{product.variants?.[0]?.price || product.price || "N/A"}
                                            </span>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                / {product.variants?.[0]?.weightUnit || product.weightUnit || "UNIT"}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1.5">
                                        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-100 group-hover:bg-emerald-50/50 group-hover:border-emerald-100 transition-colors">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" />
                                            <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest group-hover:text-emerald-600 transition-colors leading-none">Active in Catalog</span>
                                        </div>
                                        <span className="text-[8px] font-bold text-slate-300 uppercase tracking-[0.2em] leading-none">
                                            {product.variants?.length || 0} Professional Variants
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                )}

                {!loading && filteredProducts.length === 0 && (
                    <div className="lg:col-span-3 py-32 text-center bg-slate-50/20 rounded-[4rem] border-4 border-dashed border-slate-100">
                        <div className="flex flex-col items-center gap-6 max-w-sm mx-auto">
                            <div className="w-24 h-24 bg-white rounded-3xl shadow-2xl shadow-slate-200 flex items-center justify-center border border-slate-100 group hover:border-emerald-500 transition-all duration-500 rotate-12 hover:rotate-0">
                                <Package className="h-10 w-10 text-slate-300 group-hover:text-emerald-500 transition-colors" />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Catalog Registry Empty</h3>
                                <p className="text-sm text-slate-400 leading-relaxed font-medium">
                                    No records found in the current synchronization. Initialize your catalog or import merchandise protocols.
                                </p>
                            </div>
                            <div className="flex flex-col w-full gap-3 pt-4">
                                <button
                                    onClick={() => {
                                        setEditingProduct({
                                            name: "",
                                            sku: "",
                                            categoryId: "",
                                            description: "",
                                            images: [""],
                                            variants: [{ name: "Standard", weight: "1", weightUnit: "KG", price: "0", quantity: "0", threshold: "5" }],
                                            tags: []
                                        });
                                        setTagsString("");
                                        setIsProductModalOpen(true);
                                    }}
                                    className="h-14 bg-slate-900 hover:bg-emerald-600 text-white rounded-2xl flex items-center justify-center gap-3 font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-slate-200 transition-all active:scale-95"
                                >
                                    <Plus className="h-4 w-4" />
                                    <span>Manual Initialization</span>
                                </button>
                                <button
                                    onClick={handleDownloadTemplate}
                                    className="h-14 bg-white border border-slate-200 text-slate-600 rounded-2xl flex items-center justify-center gap-3 font-black text-[10px] uppercase tracking-[0.2em] hover:bg-slate-50 transition-all active:scale-95"
                                >
                                    <ArrowUpRight className="h-4 w-4" />
                                    <span>Download Import Template</span>
                                </button>
                                <button 
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={submitting}
                                    className="h-14 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-2xl flex items-center justify-center gap-3 font-black text-[10px] uppercase tracking-[0.2em] hover:bg-emerald-100 transition-all active:scale-95 shadow-xl shadow-emerald-50/20"
                                >
                                    <TrendingUp className="h-4 w-4" />
                                    <span>Bulk Protocol Ingestion</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {!loading && filteredProducts.length === 0 && (
                    <div className="lg:col-span-3 py-32 text-center bg-slate-50/20 rounded-[4rem] border-4 border-dashed border-slate-100">
                        <div className="flex flex-col items-center gap-6 max-w-sm mx-auto">
                            <div className="w-24 h-24 bg-white rounded-3xl shadow-2xl shadow-slate-200 flex items-center justify-center border border-slate-100 group hover:border-emerald-500 transition-all duration-500 rotate-12 hover:rotate-0">
                                <Package className="h-10 w-10 text-slate-300 group-hover:text-emerald-500 transition-colors" />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Catalog Registry Empty</h3>
                                <p className="text-sm text-slate-400 leading-relaxed font-medium">
                                    No records found in the current synchronization. Initialize your catalog or import merchandise protocols.
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            )}

            {isProductModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="absolute inset-0" onClick={() => setIsProductModalOpen(false)} />
                    <div className="bg-white w-[95vw] md:w-full max-w-4xl rounded-3xl shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-200 flex flex-col max-h-[90vh]">
                        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <div>
                                <h3 className="text-xl font-bold text-slate-900">Product Specification Editor</h3>
                                <p className="text-xs text-slate-500 mt-0.5">Define detailed merchandising protocols and variants.</p>
                            </div>
                            <button onClick={() => setIsProductModalOpen(false)} className="w-10 h-10 rounded-xl hover:bg-white flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all border border-transparent hover:border-slate-200">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSaveProduct} className="p-8 space-y-8 overflow-y-auto">
                            {/* Base Information Section */}
                            <div className="space-y-6">
                                <div className="flex items-center gap-3 pb-2 border-b border-slate-100">
                                    <div className="w-1.5 h-6 bg-emerald-500 rounded-full" />
                                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Core Information</h4>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Product Name</Label>
                                        <input
                                            value={editingProduct?.name || ""}
                                            onChange={e => setEditingProduct({ ...editingProduct, name: e.target.value })}
                                            className="w-full h-12 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-semibold text-slate-900 outline-none focus:border-emerald-500 focus:bg-white transition-all"
                                            placeholder="e.g., Fresh Organic Spinach"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Global SKU Code</Label>
                                        <input
                                            value={editingProduct?.sku || ""}
                                            onChange={e => setEditingProduct({ ...editingProduct, sku: e.target.value })}
                                            className="w-full h-12 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-semibold text-slate-900 outline-none focus:border-emerald-500 focus:bg-white transition-all"
                                            placeholder="SKU-XXXXXX"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Catalog Category</Label>
                                        <select
                                            value={editingProduct?.categoryId || ""}
                                            onChange={e => setEditingProduct({ ...editingProduct, categoryId: e.target.value })}
                                            className="w-full h-12 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-semibold text-slate-900 outline-none focus:border-emerald-500 focus:bg-white transition-all appearance-none"
                                            required
                                        >
                                            <option value="">Select Category</option>
                                            {categories.map(c => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-2 md:col-span-2">
                                        <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Product Photo</Label>
                                        <ImageUpload
                                            initialUrl={editingProduct?.images?.[0] || ""}
                                            onUploadComplete={(url) => {
                                                const imgs = [...(editingProduct?.images || [])];
                                                imgs[0] = url;
                                                setEditingProduct({ ...editingProduct, images: imgs });
                                            }}
                                            onImageRemove={() => {
                                                const imgs = [...(editingProduct?.images || [])];
                                                imgs[0] = "";
                                                setEditingProduct({ ...editingProduct, images: imgs });
                                            }}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Description</Label>
                                    <textarea
                                        value={editingProduct?.description || ""}
                                        onChange={e => setEditingProduct({ ...editingProduct, description: e.target.value })}
                                        className="w-full h-24 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-900 outline-none focus:border-emerald-500 focus:bg-white transition-all resize-none"
                                        placeholder="Detailed product descriptions..."
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Search Keywords / Tags (comma-separated)</Label>
                                    <input
                                        value={tagsString}
                                        onChange={e => setTagsString(e.target.value)}
                                        className="w-full h-12 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-semibold text-slate-900 outline-none focus:border-emerald-500 focus:bg-white transition-all"
                                        placeholder="e.g. onion, kanda, pyaz, fresh"
                                    />
                                </div>
                            </div>

                            {/* Variants Management */}
                            <div className="space-y-6 pt-4">
                                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                                    <div className="flex items-center gap-3">
                                        <div className="w-1.5 h-6 bg-blue-500 rounded-full" />
                                        <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Merchandise Variants</h4>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const variants = [...(editingProduct?.variants || [])];
                                            variants.push({ name: "", weight: "", weightUnit: "GM", price: "", quantity: "0", threshold: "5" });
                                            setEditingProduct({ ...editingProduct, variants });
                                        }}
                                        className="text-[10px] font-bold bg-blue-500 text-white px-3 py-1.5 rounded-lg hover:bg-blue-600 transition-all uppercase tracking-widest flex items-center gap-2"
                                    >
                                        <Plus className="h-3 w-3" />
                                        <span>Add Variant</span>
                                    </button>
                                </div>

                                <div className="space-y-4">
                                    {(!editingProduct?.variants || editingProduct.variants.length === 0) ? (
                                        <div className="py-12 border-2 border-dashed border-slate-100 rounded-2xl flex flex-col items-center justify-center text-slate-300">
                                            <Package className="h-8 w-8 mb-2 opacity-20" />
                                            <span className="text-[10px] font-bold uppercase tracking-widest">No Variants Defined</span>
                                        </div>
                                    ) : (
                                        editingProduct.variants.map((variant: any, index: number) => (
                                            <div key={index} className="bg-slate-50 rounded-2xl p-6 border border-slate-200 relative group animate-in slide-in-from-top-2 duration-300">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const variants = editingProduct.variants.filter((_: any, i: number) => i !== index);
                                                        setEditingProduct({ ...editingProduct, variants });
                                                    }}
                                                    className="absolute top-4 right-4 text-slate-300 hover:text-red-500 transition-colors"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-2">
                                                    <div className="md:col-span-1 space-y-2">
                                                        <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Variant Name</Label>
                                                        <input
                                                            value={variant.name || ""}
                                                            onChange={e => {
                                                                const variants = [...editingProduct.variants];
                                                                variants[index].name = e.target.value;
                                                                setEditingProduct({ ...editingProduct, variants });
                                                            }}
                                                            className="w-full h-10 bg-white border border-slate-200 rounded-lg px-3 text-xs font-bold text-slate-900 outline-none focus:border-blue-500 transition-all"
                                                            placeholder="Small Pack"
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Weight</Label>
                                                        <input
                                                            type="number"
                                                            value={variant.weight || ""}
                                                            onChange={e => {
                                                                const variants = [...editingProduct.variants];
                                                                variants[index].weight = e.target.value;
                                                                setEditingProduct({ ...editingProduct, variants });
                                                            }}
                                                            className="w-full h-10 bg-white border border-slate-200 rounded-lg px-3 text-xs font-bold text-slate-900 outline-none focus:border-blue-500 transition-all"
                                                            placeholder="0.00"
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Unit</Label>
                                                        <select
                                                            value={variant.weightUnit || "GM"}
                                                            onChange={e => {
                                                                const variants = [...editingProduct.variants];
                                                                variants[index].weightUnit = e.target.value;
                                                                setEditingProduct({ ...editingProduct, variants });
                                                            }}
                                                            className="w-full h-10 bg-white border border-slate-200 rounded-lg px-3 text-xs font-bold text-slate-900 outline-none focus:border-blue-500 transition-all"
                                                        >
                                                            <option value="GM">Grams</option>
                                                            <option value="KG">Kilograms</option>
                                                            <option value="ML">Milliliters</option>
                                                            <option value="LTR">Liters</option>
                                                            <option value="PIECE">Piece</option>
                                                            <option value="PACKET">Packet</option>
                                                        </select>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Rate (₹)</Label>
                                                        <input
                                                            type="number"
                                                            value={variant.price || ""}
                                                            onChange={e => {
                                                                const variants = [...editingProduct.variants];
                                                                variants[index].price = e.target.value;
                                                                setEditingProduct({ ...editingProduct, variants });
                                                            }}
                                                            className="w-full h-10 bg-white border border-slate-200 rounded-lg px-3 text-xs font-bold text-slate-900 outline-none focus:border-blue-500 transition-all"
                                                            placeholder="0.00"
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Initial Qty</Label>
                                                        <input
                                                            type="number"
                                                            value={variant.quantity || "0"}
                                                            onChange={e => {
                                                                const variants = [...editingProduct.variants];
                                                                variants[index].quantity = e.target.value;
                                                                setEditingProduct({ ...editingProduct, variants });
                                                            }}
                                                            className="w-full h-10 bg-white border border-emerald-100 rounded-lg px-3 text-xs font-bold text-slate-900 outline-none focus:border-emerald-500 transition-all"
                                                            placeholder="0"
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Alert At</Label>
                                                        <input
                                                            type="number"
                                                            value={variant.threshold || "5"}
                                                            onChange={e => {
                                                                const variants = [...editingProduct.variants];
                                                                variants[index].threshold = e.target.value;
                                                                setEditingProduct({ ...editingProduct, variants });
                                                            }}
                                                            className="w-full h-10 bg-white border border-rose-100 rounded-lg px-3 text-xs font-bold text-slate-900 outline-none focus:border-rose-500 transition-all"
                                                            placeholder="5"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            <div className="pt-8 border-t border-slate-100 sticky bottom-0 bg-white">
                                <button
                                    disabled={submitting}
                                    className="w-full h-14 bg-slate-900 text-white rounded-2xl font-bold uppercase tracking-[0.2em] text-xs hover:bg-slate-800 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3 shadow-xl"
                                >
                                    {submitting ? (
                                        <Activity className="h-5 w-5 animate-spin" />
                                    ) : (
                                        <>
                                            <Save className="h-5 w-5" />
                                            <span>Commit Catalog Changes</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
