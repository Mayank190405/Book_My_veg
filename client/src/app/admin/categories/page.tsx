"use client";

import {
    Plus,
    Search,
    Edit2,
    Trash2,
    Layers,
    Save,
    X,
    Activity,
    ChevronRight,
    Check,
    Globe,
    ImageIcon,
    ArrowUpRight,
    TrendingUp,
} from "lucide-react";
import { useState, useEffect, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";
import api from "@/services/api";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import Papa from "papaparse";

export default function AdminCategories() {
    const [categories, setCategories] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<any>(null);
    const [submitting, setSubmitting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleDownloadTemplate = () => {
        const template = [
            { "Category Name": "Vegetables", "Slug": "vegetables", "Icon": "Layers", "Sort Order": "1" },
            { "Category Name": "Fruits", "Slug": "fruits", "Icon": "Layers", "Sort Order": "2" }
        ];
        const csv = Papa.unparse(template);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "categories_template.csv";
        link.click();
    };

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
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
                        const name = row["Category Name"] || row["name"];
                        if (!name) continue;

                        await api.post("/categories", {
                            name,
                            slug: row["Slug"] || name.toLowerCase().replace(/ /g, "-"),
                            icon: row["Icon"] || "Layers",
                            sortOrder: parseInt(row["Sort Order"] || "0"),
                            isActive: true
                        });
                        success++;
                    } catch (error) {
                        failure++;
                    }
                }
                toast.success(`Import complete: ${success} categories initialized, ${failure} failed.`);
                fetchCategories();
                setSubmitting(false);
            }
        });
    };

    const fetchCategories = async () => {
        setLoading(true);
        try {
            // Updated to fetch all categories for management
            const response = await api.get("/categories");
            setCategories(response.data);
        } catch (error) {
            toast.error("Failed to synchronize with central category registry");
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchCategories();
    }, []);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const data = {
                ...editingCategory,
                slug: editingCategory.slug || editingCategory.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
            };

            if (editingCategory.id) {
                await api.put(`/categories/${editingCategory.id}`, data);
                toast.success("Category updated successfully");
            } else {
                await api.post("/categories", data);
                toast.success("New category created successfully");
            }
            fetchCategories();
            setIsModalOpen(false);
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Protocol validation failed");
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure? This will remove the category from the global registry.")) return;
        try {
            await api.delete(`/categories/${id}`);
            toast.success("Category deleted successfully");
            fetchCategories();
        } catch (error) {
            toast.error("Failed to delete category");
        }
    };

    const filteredCategories = useMemo(() => {
        if (!Array.isArray(categories)) return [];
        return categories.filter(c =>
            c.name?.toLowerCase().includes(search.toLowerCase()) ||
            c.slug?.toLowerCase().includes(search.toLowerCase())
        );
    }, [categories, search]);

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-200">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Merchandise Categories</h2>
                    <p className="text-sm text-slate-500 mt-1">Configure the hierarchical classification system for the marketplace.</p>
                </div>

                <button
                    onClick={() => {
                        setEditingCategory({
                            name: "",
                            slug: "",
                            icon: "",
                            imageUrl: "",
                            isActive: true,
                            sortOrder: 0,
                            parentId: null
                        });
                        setIsModalOpen(true);
                    }}
                    className="h-12 bg-emerald-600 text-white px-8 rounded-xl flex items-center justify-center gap-3 shadow-md shadow-emerald-100 hover:bg-emerald-700 active:scale-95 transition-all font-semibold"
                >
                    <Plus className="h-5 w-5" />
                    <span>Initialize Category</span>
                </button>
            </div>

            {/* Bulk Operations */}
            <div className="flex items-center gap-3">
                <input type="file" ref={fileInputRef} onChange={handleImport} accept=".csv" className="hidden" />
                <button 
                    onClick={handleDownloadTemplate}
                    className="h-12 bg-white border border-slate-200 text-slate-600 px-6 rounded-xl flex items-center justify-center gap-3 hover:bg-slate-50 active:scale-95 transition-all font-bold text-xs uppercase tracking-widest"
                >
                    <ArrowUpRight className="h-4 w-4" />
                    <span>Download Template</span>
                </button>
                <button 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={submitting}
                    className="h-12 bg-slate-900 text-white px-6 rounded-xl flex items-center justify-center gap-3 hover:bg-slate-800 active:scale-95 transition-all font-bold text-xs uppercase tracking-widest disabled:opacity-50"
                >
                    {submitting ? <Activity className="h-4 w-4 animate-spin" /> : <TrendingUp className="h-4 w-4" />}
                    <span>Bulk Ingestion</span>
                </button>
            </div>

            {/* Search Bar */}
            <div className="flex flex-col lg:flex-row gap-6 items-end lg:items-center justify-between">
                <div className="w-full lg:max-w-md relative group text-slate-900">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-emerald-600 transition-colors" />
                    <input
                        className="w-full h-12 bg-white border border-slate-200 rounded-xl pl-12 pr-4 text-sm text-slate-900 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 transition-all outline-none placeholder:text-slate-400 font-medium"
                        placeholder="Search registry by name or identifier..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            {/* Content Area */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {loading ? (
                    [1, 2, 3].map(i => (
                        <div key={i} className="h-32 bg-white rounded-2xl border border-slate-100 animate-pulse" />
                    ))
                ) : (
                    filteredCategories.map((category) => (
                        <div key={category.id} className="group bg-white rounded-3xl border border-slate-200 p-6 hover:shadow-xl hover:border-emerald-200 transition-all duration-300">
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100 group-hover:bg-emerald-50 transition-colors">
                                        {category.imageUrl ? (
                                            <img src={category.imageUrl} className="w-full h-full object-cover rounded-2xl" alt="" />
                                        ) : (
                                            <Layers className="h-6 w-6 text-slate-400 group-hover:text-emerald-500" />
                                        )}
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">{category.name}</h3>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">{category.slug}</p>
                                    </div>
                                </div>
                                <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => { setEditingCategory(category); setIsModalOpen(true); }}
                                        className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-emerald-600"
                                    >
                                        <Edit2 className="h-4 w-4" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(category.id)}
                                        className="p-2 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-600"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                            <div className="mt-6 flex items-center justify-between border-t border-slate-50 pt-4">
                                <div className="flex items-center gap-2">
                                    <div className={cn("w-2 h-2 rounded-full", category.isActive ? "bg-emerald-500 shadow-[0_0_8px_emerald]" : "bg-slate-300")} />
                                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                                        {category.isActive ? "Network Active" : "Disabled"}
                                    </span>
                                </div>
                                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                    Sort Order: {category.sortOrder}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {!loading && filteredCategories.length === 0 && (
                <div className="py-24 text-center bg-slate-50/20 rounded-[3rem] border-2 border-dashed border-slate-100">
                    <div className="flex flex-col items-center gap-4 max-w-sm mx-auto">
                        <div className="w-16 h-16 bg-white rounded-2xl shadow-lg flex items-center justify-center text-slate-200">
                            <Layers className="h-8 w-8" />
                        </div>
                        <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em]">Registry Empty</h3>
                        <div className="flex flex-col w-full gap-2 pt-4">
                            <button 
                                onClick={() => {
                                    setEditingCategory({ name: "", slug: "", isActive: true, sortOrder: 0 });
                                    setIsModalOpen(true);
                                }}
                                className="h-12 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-lg shadow-slate-200"
                            >
                                Manual Initialization
                            </button>
                            <button 
                                onClick={() => fileInputRef.current?.click()}
                                className="h-12 bg-white border border-slate-200 text-slate-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all"
                            >
                                Bulk Registry Import
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-200">
                        <div className="px-10 py-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                            <div>
                                <h3 className="text-xl font-bold text-slate-900">Category Configurator</h3>
                                <p className="text-xs text-slate-500 mt-1 uppercase tracking-widest font-black opacity-60">Classification Registry</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="w-10 h-10 rounded-xl hover:bg-white flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all border border-transparent hover:border-slate-200">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <form onSubmit={handleSave} className="p-10 space-y-6">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Internal Title</Label>
                                <input
                                    required
                                    value={editingCategory?.name || ""}
                                    onChange={e => setEditingCategory({ ...editingCategory, name: e.target.value })}
                                    className="w-full h-12 bg-slate-50 border border-slate-200 rounded-2xl px-5 text-sm font-semibold text-slate-900 outline-none focus:border-emerald-500 focus:bg-white transition-all"
                                    placeholder="e.g., Organic Farm Range"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Sort Priority</Label>
                                    <input
                                        type="number"
                                        value={editingCategory?.sortOrder || 0}
                                        onChange={e => setEditingCategory({ ...editingCategory, sortOrder: parseInt(e.target.value) })}
                                        className="w-full h-12 bg-slate-50 border border-slate-200 rounded-2xl px-5 text-sm font-semibold text-slate-900 outline-none focus:border-emerald-500 focus:bg-white transition-all"
                                    />
                                </div>
                                <div className="flex items-center gap-3 pt-6 px-4">
                                    <button
                                        type="button"
                                        onClick={() => setEditingCategory({ ...editingCategory, isActive: !editingCategory.isActive })}
                                        className={cn(
                                            "w-12 h-6 rounded-full relative transition-colors duration-300",
                                            editingCategory?.isActive ? "bg-emerald-500" : "bg-slate-200"
                                        )}
                                    >
                                        <div className={cn(
                                            "absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300",
                                            editingCategory?.isActive ? "left-7" : "left-1"
                                        )} />
                                    </button>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Active</span>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Visual Asset (URL)</Label>
                                <input
                                    value={editingCategory?.imageUrl || ""}
                                    onChange={e => setEditingCategory({ ...editingCategory, imageUrl: e.target.value })}
                                    className="w-full h-12 bg-slate-50 border border-slate-200 rounded-2xl px-5 text-sm font-semibold text-slate-900 outline-none focus:border-emerald-500 focus:bg-white transition-all"
                                    placeholder="https://..."
                                />
                            </div>
                            <div className="pt-6">
                                <button
                                    disabled={submitting}
                                    className="w-full h-14 bg-slate-900 text-white rounded-[1.25rem] font-black uppercase tracking-[0.2em] text-[10px] hover:bg-emerald-600 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3 shadow-xl"
                                >
                                    {submitting ? <Activity className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                                    <span>Synchronize Entry</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
