"use client";

import { 
    Plus, 
    Search, 
    Filter, 
    Edit2,
    Trash2,
    Image as ImageIcon,
    Save,
    X,
    Activity,
    ExternalLink,
    Maximize2,
    Zap,
    Globe,
    MonitorSmartphone
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import api from "@/services/api";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export default function AdminBanners() {
    const [banners, setBanners] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [categories, setCategories] = useState<any[]>([]);
    const [products, setProducts] = useState<any[]>([]);
    
    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingBanner, setEditingBanner] = useState<any>(null);
    const [submitting, setSubmitting] = useState(false);

    const fetchBanners = async () => {
        setLoading(true);
        try {
            const res = await api.get("/banners");
            setBanners(res.data);
        } catch (error) {
            toast.error("Failed to synchronize banner assets");
        } finally {
            setLoading(false);
        }
    };

    const fetchCategories = async () => {
        try {
            const res = await api.get("/categories");
            setCategories(res.data);
        } catch (error) {
            console.error("Failed to fetch categories", error);
        }
    };

    const fetchProducts = async () => {
        try {
            const res = await api.get("/products?limit=200");
            const prodList = res.data?.data || res.data || [];
            setProducts(prodList);
        } catch (error) {
            console.error("Failed to fetch products", error);
        }
    };

    useEffect(() => {
        fetchBanners();
        fetchCategories();
        fetchProducts();
    }, []);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            if (editingBanner.id) {
                await api.put(`/banners/${editingBanner.id}`, editingBanner);
                toast.success("Banner details updated successfully");
            } else {
                await api.post("/banners", editingBanner);
                toast.success("Banner published to store frontend");
            }
            fetchBanners();
            setIsModalOpen(false);
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Failed to save banner changes");
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this promotional banner?")) return;
        try {
            await api.delete(`/banners/${id}`);
            toast.success("Banner removed from system");
            fetchBanners();
        } catch (error) {
            toast.error("Failed to delete banner asset");
        }
    };

    const toggleStatus = async (banner: any) => {
        try {
            await api.put(`/banners/${banner.id}`, { ...banner, isActive: !banner.isActive });
            toast.success(`Banner display ${!banner.isActive ? 'Enabled' : 'Disabled'}`);
            fetchBanners();
        } catch (error) {
            toast.error("Failed to update banner status");
        }
    };

    const visibleBanners = useMemo(() => {
        return Array.isArray(banners) ? banners : [];
    }, [banners]);

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-200">
                <div className="px-1 md:px-0">
                    <h2 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Banner Management</h2>
                    <p className="text-sm text-slate-500 mt-1">Manage promotional banners, hero images, and click-through marketing assets.</p>
                </div>
                
                <button 
                    onClick={() => {
                        setEditingBanner({ 
                            title: "", 
                            subtitle: "", 
                            imageUrl: "", 
                            link: "", 
                            isActive: true, 
                            priority: 0,
                            sortOrder: 0,
                            position: "HOME_TOP",
                            redirectType: "category",
                            redirectId: "",
                            buttonText: "SHOP NOW"
                        });
                        setIsModalOpen(true);
                    }}
                    className="h-12 bg-emerald-600 hover:bg-emerald-700 text-white px-6 rounded-xl flex items-center justify-center gap-3 shadow-lg shadow-emerald-100 transition-all active:scale-95 font-bold text-sm w-full md:w-auto"
                >
                    <Plus className="h-5 w-5" />
                    <span>Create New Banner</span>
                </button>
            </div>

            {/* Banner Display Grid */}
            <div className="grid grid-cols-1 gap-8">
                {loading ? (
                    [1, 2, 3].map(i => (
                        <div key={i} className="h-80 bg-white rounded-2xl border border-slate-200 animate-pulse flex flex-col p-8 space-y-6">
                             <div className="h-10 w-64 bg-slate-100 rounded-lg" />
                             <div className="h-40 w-full bg-slate-50 rounded-xl" />
                             <div className="h-10 w-full bg-slate-100 rounded-lg mt-auto" />
                        </div>
                    ))
                ) : (
                    visibleBanners.map((banner, idx: number) => (
                        <div key={banner.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:border-emerald-200 hover:shadow-xl hover:shadow-emerald-500/5 transition-all duration-500 group relative flex flex-col md:flex-row min-h-[350px]">
                            {/* Action Floating Controls */}
                            <div className="absolute top-4 right-4 z-20 flex gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300">
                                <button 
                                    onClick={() => {
                                        setEditingBanner(banner);
                                        setIsModalOpen(true);
                                    }}
                                    className="w-10 h-10 rounded-xl bg-white/95 backdrop-blur-sm shadow-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:text-emerald-600 hover:border-emerald-200 transition-all active:scale-90"
                                >
                                    <Edit2 className="h-4 w-4" />
                                </button>
                                <button 
                                    onClick={() => handleDelete(banner.id)}
                                    className="w-10 h-10 rounded-xl bg-white/95 backdrop-blur-sm shadow-lg border border-slate-200 flex items-center justify-center text-red-500 hover:text-red-700 hover:border-red-200 transition-all active:scale-90"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>

                            {/* Image Preview Area */}
                            <div className="md:w-5/12 relative overflow-hidden bg-slate-100">
                                <img 
                                    src={banner.imageUrl} 
                                    alt={banner.title} 
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent flex flex-col justify-end p-8">
                                    <div className="flex items-center gap-2 mb-2">
                                        <MonitorSmartphone className="h-3.5 w-3.5 text-emerald-400" />
                                        <span className="text-[10px] font-bold text-emerald-100 uppercase tracking-[0.2em]">Featured Asset 0{idx+1}</span>
                                    </div>
                                    <h3 className="text-2xl font-bold text-white tracking-tight leading-tight">{banner.title}</h3>
                                </div>
                            </div>

                            {/* Details Area */}
                            <div className="flex-1 p-8 flex flex-col justify-between">
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2.5">
                                            <div className={cn(
                                                "w-2 h-2 rounded-full shadow-sm",
                                                banner.isActive ? "bg-emerald-500" : "bg-slate-300"
                                            )} />
                                            <span className={cn(
                                                "text-[10px] font-bold uppercase tracking-widest",
                                                banner.isActive ? "text-emerald-600" : "text-slate-400"
                                            )}>
                                                {banner.isActive ? "Published & Visible" : "Hidden / Inactive"}
                                            </span>
                                        </div>
                                        <button 
                                            onClick={() => toggleStatus(banner)}
                                            className="px-3 py-1 rounded-md border border-slate-200 text-[9px] font-bold text-slate-500 uppercase tracking-widest hover:border-slate-900 hover:text-slate-900 transition-all bg-white"
                                        >
                                            Change Visibility
                                        </button>
                                    </div>

                                    <div className="space-y-4">
                                        <p className="text-xs font-medium text-slate-500 leading-relaxed uppercase tracking-wider">
                                            {banner.subtitle || "No promotional subtitle available for this banner."}
                                        </p>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                                            <div className="space-y-1">
                                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">Banner Position</p>
                                                <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                                                    <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded-md uppercase tracking-wider text-[9px]">{banner.position || "HOME_TOP"}</span>
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">Target Destination</p>
                                                <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                                                    <span className="bg-emerald-50 text-emerald-800 border border-emerald-500/10 px-2 py-0.5 rounded-md uppercase tracking-wider text-[9px]">{banner.redirectType || "external"}</span>
                                                    <span className="truncate max-w-[120px]" title={banner.redirectId || banner.link || "/"}>{banner.redirectId || banner.link || "/"}</span>
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">Display Priority</p>
                                                <div className="flex items-center gap-2">
                                                    <Zap className="h-3.5 w-3.5 text-amber-500" />
                                                    <span className="text-xs font-bold text-slate-700">Level {banner.priority}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {banner.redirectType === "product" && (
                                            <div className="mt-4 p-3 bg-slate-50/50 border border-slate-100 rounded-2xl flex items-center gap-3 w-fit max-w-full">
                                                {(() => {
                                                    const prod = products.find(p => p.id === banner.redirectId);
                                                    if (prod) {
                                                        return (
                                                            <>
                                                                <div className="w-10 h-10 rounded-xl bg-white overflow-hidden border border-slate-200 flex items-center justify-center shrink-0">
                                                                    {prod.images?.[0] ? (
                                                                        <img src={prod.images[0]} alt={prod.name} className="w-full h-full object-cover" />
                                                                    ) : (
                                                                        <ImageIcon className="h-5 w-5 text-slate-300" />
                                                                    )}
                                                                </div>
                                                                <div className="min-w-0 pr-2">
                                                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Promoting Product</p>
                                                                    <p className="text-xs font-black text-slate-800 truncate leading-none uppercase tracking-tight italic">{prod.name}</p>
                                                                </div>
                                                            </>
                                                        );
                                                    } else {
                                                        return (
                                                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider px-2">Product ID: {banner.redirectId.slice(0, 8)}...</span>
                                                        );
                                                    }
                                                })()}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="pt-6 border-t border-slate-50 mt-6 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400 border border-slate-100">
                                            <Activity className="h-4 w-4" />
                                        </div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Asset Integrity Verified</p>
                                    </div>
                                    <button className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:text-slate-900 transition-all border border-transparent hover:border-slate-100 px-3 py-1.5 rounded-lg group">
                                        <Maximize2 className="h-3.5 w-3.5 group-hover:scale-110 transition-transform" />
                                        Audit History
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Banner Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="absolute inset-0" onClick={() => setIsModalOpen(false)} />
                    <div className="bg-white w-[95vw] md:w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 shadow-2xl relative z-10 animate-in zoom-in-95 duration-300">
                        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 border border-emerald-100">
                                    <ImageIcon className="h-6 w-6" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-slate-900">Manage Banner Asset</h3>
                                    <p className="text-xs text-slate-500 mt-0.5">Configure marketing visuals and target deep-links.</p>
                                </div>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="w-10 h-10 rounded-xl hover:bg-white flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all border border-transparent hover:border-slate-200">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        
                        <form onSubmit={handleSave} className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                            {/* Column 1: Core Details */}
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Headline (Title)</Label>
                                    <input 
                                        value={editingBanner?.title || ""}
                                        onChange={e => setEditingBanner({...editingBanner, title: e.target.value})}
                                        className="w-full h-12 bg-white border border-slate-200 rounded-xl px-4 text-sm font-medium text-slate-900 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 transition-all placeholder:text-slate-300"
                                        placeholder="Organic Vegetables"
                                        required
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Description / Subtitle</Label>
                                    <input 
                                        value={editingBanner?.subtitle || ""}
                                        onChange={e => setEditingBanner({...editingBanner, subtitle: e.target.value})}
                                        className="w-full h-12 bg-white border border-slate-200 rounded-xl px-4 text-sm font-medium text-slate-900 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 transition-all placeholder:text-slate-300"
                                        placeholder="Get up to 30% off on fresh organic greens"
                                    />
                                </div>
                                
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Image Source URL</Label>
                                    <input 
                                        value={editingBanner?.imageUrl || ""}
                                        onChange={e => setEditingBanner({...editingBanner, imageUrl: e.target.value})}
                                        className="w-full h-12 bg-white border border-slate-200 rounded-xl px-4 text-sm font-medium text-slate-900 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 transition-all placeholder:text-slate-300"
                                        placeholder="/images/fresh_produce_banner.png"
                                        required
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Button Call-to-Action</Label>
                                        <input 
                                            value={editingBanner?.buttonText || ""}
                                            onChange={e => setEditingBanner({...editingBanner, buttonText: e.target.value})}
                                            className="w-full h-12 bg-white border border-slate-200 rounded-xl px-4 text-sm font-medium text-slate-900 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 transition-all placeholder:text-slate-300"
                                            placeholder="SHOP NOW"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Position Placement</Label>
                                        <select 
                                            value={editingBanner?.position || "HOME_TOP"}
                                            onChange={e => setEditingBanner({...editingBanner, position: e.target.value})}
                                            className="w-full h-12 bg-white border border-slate-200 rounded-xl px-4 text-sm font-medium text-slate-900 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 transition-all"
                                        >
                                            <option value="HOME_TOP">Home Page Top</option>
                                            <option value="HOME_MIDDLE">Home Page Middle</option>
                                            <option value="CATEGORY_TOP">Category Top</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Column 2: Redirects & Priority */}
                            <div className="space-y-6">
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Redirect Type</Label>
                                        <select 
                                            value={editingBanner?.redirectType || "external"}
                                            onChange={e => setEditingBanner({
                                                ...editingBanner, 
                                                redirectType: e.target.value,
                                                redirectId: e.target.value === "external" ? "" : editingBanner.redirectId
                                            })}
                                            className="w-full h-12 bg-white border border-slate-200 rounded-xl px-4 text-sm font-medium text-slate-900 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 transition-all"
                                        >
                                            <option value="category">Category Direct</option>
                                            <option value="product">Product Detail</option>
                                            <option value="coupon">Coupon Discount</option>
                                            <option value="external">External Link</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Sort Weight (Priority)</Label>
                                        <input 
                                            type="number"
                                            value={editingBanner?.priority || 0}
                                            onChange={e => setEditingBanner({
                                                ...editingBanner, 
                                                priority: parseInt(e.target.value) || 0,
                                                sortOrder: parseInt(e.target.value) || 0
                                            })}
                                            className="w-full h-12 bg-white border border-slate-200 rounded-xl px-4 text-sm font-bold text-slate-900 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 transition-all"
                                        />
                                    </div>
                                </div>

                                {editingBanner?.redirectType === "category" ? (
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Target Category</Label>
                                        <select 
                                            value={editingBanner?.redirectId || ""}
                                            onChange={e => {
                                                const catId = e.target.value;
                                                setEditingBanner({
                                                    ...editingBanner, 
                                                    redirectId: catId,
                                                    link: `/category/${catId}`
                                                });
                                            }}
                                            className="w-full h-12 bg-white border border-slate-200 rounded-xl px-4 text-sm font-medium text-slate-900 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 transition-all"
                                            required
                                        >
                                            <option value="" disabled>Select Target Category...</option>
                                            {categories.map((cat: any) => (
                                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                ) : editingBanner?.redirectType === "product" ? (
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Target Product</Label>
                                        <select 
                                            value={editingBanner?.redirectId || ""}
                                            onChange={e => {
                                                const prodId = e.target.value;
                                                setEditingBanner({
                                                    ...editingBanner, 
                                                    redirectId: prodId,
                                                    link: `/products/${prodId}`
                                                });
                                            }}
                                            className="w-full h-12 bg-white border border-slate-200 rounded-xl px-4 text-sm font-medium text-slate-900 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 transition-all"
                                            required
                                        >
                                            <option value="" disabled>Select Target Product...</option>
                                            {products.map((prod: any) => (
                                                <option key={prod.id} value={prod.id}>{prod.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">
                                            {editingBanner?.redirectType === "coupon" ? "Target Coupon Code" : "Backup Target Path"}
                                        </Label>
                                        <input 
                                            value={editingBanner?.redirectId || editingBanner?.link || ""}
                                            onChange={e => {
                                                const val = e.target.value;
                                                if (editingBanner?.redirectType === "external") {
                                                    setEditingBanner({...editingBanner, link: val, redirectId: ""});
                                                } else {
                                                    setEditingBanner({...editingBanner, redirectId: val});
                                                }
                                            }}
                                            className="w-full h-12 bg-white border border-slate-200 rounded-xl px-4 text-sm font-medium text-slate-900 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 transition-all placeholder:text-slate-300"
                                            placeholder={editingBanner?.redirectType === "coupon" ? "SAVE50" : "/offers"}
                                            required={editingBanner?.redirectType !== "external"}
                                        />
                                    </div>
                                )}

                                <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-xl">
                                    <div>
                                        <p className="text-xs font-bold text-slate-700 uppercase tracking-tight">Active Status</p>
                                        <p className="text-[10px] text-slate-400 mt-0.5 font-medium">Toggle visibility on the storefront.</p>
                                    </div>
                                    <button 
                                        type="button"
                                        onClick={() => setEditingBanner({...editingBanner, isActive: !editingBanner.isActive})}
                                        className={cn(
                                            "w-12 h-6 rounded-full transition-all group relative flex items-center px-1 shadow-inner",
                                            editingBanner?.isActive ? "bg-emerald-500 shadow-emerald-100" : "bg-slate-200 shadow-slate-100"
                                        )}
                                    >
                                        <div className={cn(
                                            "w-4 h-4 rounded-full bg-white shadow-md transition-all",
                                            editingBanner?.isActive ? "translate-x-6" : "translate-x-0"
                                        )} />
                                    </button>
                                </div>
                                
                                <button 
                                    disabled={submitting}
                                    className="w-full h-14 bg-slate-900 text-white rounded-xl font-bold uppercase tracking-widest text-sm flex items-center justify-center gap-3 hover:bg-slate-800 transition-all active:scale-95 shadow-lg shadow-slate-200"
                                >
                                    {submitting ? (
                                        <Activity className="h-5 w-5 animate-spin" />
                                    ) : (
                                        <>
                                            <Save className="h-5 w-5" />
                                            Update Display Asset
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
