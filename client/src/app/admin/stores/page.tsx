"use client";

import { 
    Store, 
    Plus, 
    Search, 
    Filter, 
    Edit2,
    Trash2,
    MapPin,
    Phone,
    FileText,
    Globe,
    ExternalLink,
    X,
    Save,
    UserCircle,
    Activity,
    Shield,
    Key,
    Eye,
    EyeOff,
    UserCheck,
    Layers,
    Boxes,
    GripVertical,
    ArrowUp,
    ArrowDown,
    Check,
    AlertTriangle,
    RefreshCw,
    Sparkles,
    Scale,
    Package,
    Tag,
    ChevronDown,
    PlusCircle,
    MinusCircle
} from "lucide-react";
import { useState, useEffect, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import api from "@/services/api";
import { toast } from "sonner";
import Image from "next/image";

const WEIGHT_UNITS = ["GM", "KG", "PIECE", "PACK", "LITRE", "ML"];

export default function AdminStores() {
    // Primary Tab: "network" (Hubs) or "variants_stock" (Store Variants, Stock & Ordering)
    const [activeTab, setActiveTab] = useState<"network" | "variants_stock">("network");

    // Stores & Users State
    const [stores, setStores] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [editingStore, setEditingStore] = useState<any>(null);
    const [search, setSearch] = useState("");

    // Selected Store for Variants & Stock Management
    const [selectedStoreId, setSelectedStoreId] = useState<string>("");

    // Store Variants & Products Data
    const [products, setProducts] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [storeInventory, setStoreInventory] = useState<any[]>([]);
    const [inventoryLoading, setInventoryLoading] = useState(false);
    const [productSearch, setProductSearch] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("ALL");
    const [stockFilter, setStockFilter] = useState<"ALL" | "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK">("ALL");

    // Position Reordering State
    const [hasUnsavedPositions, setHasUnsavedPositions] = useState(false);
    const [savingPositions, setSavingPositions] = useState(false);
    const [draggedProductIndex, setDraggedProductIndex] = useState<number | null>(null);

    // Direct Stock Edit State map: `${productId}_${variantId || 'base'}` -> number
    const [stockDrafts, setStockDrafts] = useState<Record<string, string>>({});
    const [savingStockKey, setSavingStockKey] = useState<string | null>(null);

    // Add Variant Modal State
    const [isVariantModalOpen, setIsVariantModalOpen] = useState(false);
    const [selectedProductForVariant, setSelectedProductForVariant] = useState<any>(null);
    const [variantSubmitting, setVariantSubmitting] = useState(false);
    const [variantForm, setVariantForm] = useState({
        productId: "",
        name: "",
        price: "",
        weight: "",
        weightUnit: "GM",
        initialStock: "10",
        thresholdStock: "5",
        isActive: true
    });

    const [formData, setFormData] = useState({
        name: "",
        slug: "",
        address: "",
        contactNumber: "",
        gstNumber: "",
        password: "",
        latitude: "",
        longitude: "",
        deliveryRadius: "10.0",
        upiId: "",
        purchaseManagerId: ""
    });
    const [showPassword, setShowPassword] = useState(false);

    // Fetch Stores
    const fetchStores = async () => {
        setLoading(true);
        try {
            const res = await api.get("/locations");
            const data = Array.isArray(res.data) ? res.data : [];
            setStores(data);
            if (data.length > 0 && !selectedStoreId) {
                setSelectedStoreId(data[0].id);
            }
        } catch (error) {
            toast.error("Failed to fetch store locations");
        } finally {
            setLoading(false);
        }
    };

    // Fetch Users (for store managers)
    const fetchUsers = async () => {
        try {
            const res = await api.get("/users/admin/all");
            setUsers(Array.isArray(res.data) ? res.data : []);
        } catch (error) {
            console.error("Failed to fetch user management profiles");
        }
    };

    // Fetch Categories
    const fetchCategories = async () => {
        try {
            const res = await api.get("/categories");
            setCategories(Array.isArray(res.data) ? res.data : []);
        } catch (error) {
            console.error("Failed to fetch categories");
        }
    };

    // Fetch Products Catalog
    const fetchProducts = async () => {
        try {
            const res = await api.get("/products/admin");
            const prods = Array.isArray(res.data) ? res.data : (res.data?.products || res.data?.data || []);
            // Sort by specifications.sortOrder ascending
            const sorted = [...prods].sort((a: any, b: any) => {
                const orderA = typeof a.specifications?.sortOrder === "number" ? a.specifications.sortOrder : 99999;
                const orderB = typeof b.specifications?.sortOrder === "number" ? b.specifications.sortOrder : 99999;
                return orderA - orderB;
            });
            setProducts(sorted);
        } catch (error) {
            console.error("Failed to fetch products");
        }
    };

    // Fetch Store Inventory for the selected store
    const fetchStoreInventory = async (locId: string) => {
        if (!locId) return;
        setInventoryLoading(true);
        try {
            const res = await api.get(`/inventory/store/${locId}`);
            const inv = Array.isArray(res.data) ? res.data : [];
            setStoreInventory(inv);

            // Prepopulate stock drafts
            const drafts: Record<string, string> = {};
            inv.forEach((item: any) => {
                const key = `${item.productId}_${item.variantId || "base"}`;
                drafts[key] = String(Number(item.currentStock || 0));
            });
            setStockDrafts(drafts);
        } catch (error) {
            console.error("Failed to fetch store inventory");
        } finally {
            setInventoryLoading(false);
        }
    };

    useEffect(() => {
        fetchStores();
        fetchUsers();
        fetchCategories();
        fetchProducts();
    }, []);

    useEffect(() => {
        if (selectedStoreId) {
            fetchStoreInventory(selectedStoreId);
        }
    }, [selectedStoreId]);

    // Handle Store Creation / Update
    const handleSaveStore = async () => {
        try {
            if (editingStore) {
                await api.put(`/locations/${editingStore.id}`, formData);
                toast.success("Store configuration refined successfully");
            } else {
                await api.post("/locations", formData);
                toast.success("New store location added successfully");
            }
            setIsAddOpen(false);
            setFormData({ 
                name: "", 
                slug: "", 
                address: "", 
                contactNumber: "", 
                gstNumber: "", 
                password: "", 
                latitude: "", 
                longitude: "", 
                deliveryRadius: "10.0", 
                upiId: "", 
                purchaseManagerId: "" 
            });
            setEditingStore(null);
            fetchStores();
        } catch (error) {
            toast.error("Failed to synchronize store registry");
        }
    };

    const handleDeleteStore = async (id: string) => {
        if (!confirm("Are you sure you want to delete this store location? This will affect all linked inventory history.")) return;
        try {
            await api.delete(`/locations/${id}`);
            toast.success("Store deleted from system");
            fetchStores();
        } catch (error) {
            toast.error("Failed to delete store");
        }
    };

    const getManager = (locationId: string) => {
        return users.find(u => u.locationId === locationId && u.role === "STORE_ADMIN");
    };

    const currentStore = useMemo(() => {
        return stores.find(s => s.id === selectedStoreId) || stores[0] || null;
    }, [stores, selectedStoreId]);

    // Helper: get current stock for product or variant in selected store
    const getVariantStock = (productId: string, variantId?: string | null) => {
        const key = `${productId}_${variantId || "base"}`;
        if (stockDrafts[key] !== undefined) {
            return Number(stockDrafts[key]) || 0;
        }
        const record = storeInventory.find(i => 
            i.productId === productId && 
            (variantId ? i.variantId === variantId : !i.variantId)
        );
        return Number(record?.currentStock || 0);
    };

    // Inline Stock Quantity Save
    const handleSaveStock = async (productId: string, variantId?: string | null) => {
        if (!selectedStoreId) {
            toast.error("Please select a store first");
            return;
        }
        const key = `${productId}_${variantId || "base"}`;
        const newQty = Number(stockDrafts[key] ?? 0);
        setSavingStockKey(key);
        try {
            await api.post("/inventory/set-stock", {
                productId,
                variantId: variantId || null,
                locationId: selectedStoreId,
                currentStock: newQty,
                thresholdStock: 5
            });
            toast.success(`Stock updated to ${newQty} for ${currentStore?.name || "Store"}`);
            fetchStoreInventory(selectedStoreId);
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Failed to update stock");
        } finally {
            setSavingStockKey(null);
        }
    };

    // Quick Stock Delta button (+10, +25, +50, -10)
    const handleStockDelta = (productId: string, variantId: string | null, delta: number) => {
        const key = `${productId}_${variantId || "base"}`;
        const currentVal = Number(stockDrafts[key] ?? getVariantStock(productId, variantId));
        const nextVal = Math.max(0, currentVal + delta);
        setStockDrafts(prev => ({ ...prev, [key]: String(nextVal) }));
    };

    // Open Add Variant Modal
    const handleOpenAddVariant = (product?: any) => {
        const targetProd = product || products[0];
        setSelectedProductForVariant(targetProd);
        setVariantForm({
            productId: targetProd?.id || "",
            name: "",
            price: targetProd?.basePrice ? String(targetProd.basePrice) : "",
            weight: "500",
            weightUnit: "GM",
            initialStock: "25",
            thresholdStock: "5",
            isActive: true
        });
        setIsVariantModalOpen(true);
    };

    // Save Variant for this Store
    const handleSaveVariant = async () => {
        if (!variantForm.productId || !variantForm.name || !variantForm.price) {
            toast.error("Please fill in variant name and price");
            return;
        }
        setVariantSubmitting(true);
        try {
            const res = await api.post("/variants", {
                ...variantForm,
                locationId: selectedStoreId,
                initialStock: Number(variantForm.initialStock || 0),
                thresholdStock: Number(variantForm.thresholdStock || 5)
            });

            if (res.data?.success || res.status === 201) {
                toast.success(`Variant "${variantForm.name}" created with ${variantForm.initialStock} units in ${currentStore?.name}!`);
                setIsVariantModalOpen(false);
                fetchProducts();
                if (selectedStoreId) fetchStoreInventory(selectedStoreId);
            }
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Failed to create variant");
        } finally {
            setVariantSubmitting(false);
        }
    };

    // Product Position Reordering: Move Up / Down
    const handleMoveProduct = (index: number, direction: "up" | "down") => {
        const newProducts = [...products];
        const targetIndex = direction === "up" ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= newProducts.length) return;

        // Swap elements
        const temp = newProducts[index];
        newProducts[index] = newProducts[targetIndex];
        newProducts[targetIndex] = temp;

        setProducts(newProducts);
        setHasUnsavedPositions(true);
    };

    // Product Position: Direct numerical position change
    const handleDirectPositionChange = (productIndex: number, newPositionStr: string) => {
        const newPos = parseInt(newPositionStr, 10);
        if (isNaN(newPos) || newPos < 1) return;

        const targetIndex = Math.min(Math.max(0, newPos - 1), products.length - 1);
        if (targetIndex === productIndex) return;

        const newProducts = [...products];
        const [movedItem] = newProducts.splice(productIndex, 1);
        newProducts.splice(targetIndex, 0, movedItem);

        setProducts(newProducts);
        setHasUnsavedPositions(true);
    };

    // HTML5 Drag and Drop handlers
    const handleDragStart = (index: number) => {
        setDraggedProductIndex(index);
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
    };

    const handleDrop = (e: React.DragEvent, targetIndex: number) => {
        e.preventDefault();
        if (draggedProductIndex === null || draggedProductIndex === targetIndex) return;

        const newProducts = [...products];
        const [draggedItem] = newProducts.splice(draggedProductIndex, 1);
        newProducts.splice(targetIndex, 0, draggedItem);

        setProducts(newProducts);
        setDraggedProductIndex(null);
        setHasUnsavedPositions(true);
    };

    // Save Reordered Positions to Server
    const handleSavePositions = async () => {
        setSavingPositions(true);
        try {
            const items = products.map((prod, idx) => ({
                id: prod.id,
                sortOrder: idx + 1
            }));
            await api.put("/products/reorder", { items });
            toast.success("Product display order saved successfully!");
            setHasUnsavedPositions(false);
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Failed to save product ordering");
        } finally {
            setSavingPositions(false);
        }
    };

    // Filtered Products for Display in Tab 2
    const filteredProducts = useMemo(() => {
        return products.filter((p) => {
            const matchesSearch = 
                !productSearch || 
                p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
                (p.sku && p.sku.toLowerCase().includes(productSearch.toLowerCase())) ||
                (p.barcode && p.barcode.toLowerCase().includes(productSearch.toLowerCase()));

            const matchesCategory = 
                categoryFilter === "ALL" || 
                p.categoryId === categoryFilter;

            if (!matchesSearch || !matchesCategory) return false;

            // Stock status check for current store
            if (stockFilter === "ALL") return true;

            const hasVariants = Array.isArray(p.variants) && p.variants.length > 0;
            const totalStock = hasVariants
                ? p.variants.reduce((sum: number, v: any) => sum + getVariantStock(p.id, v.id), 0)
                : getVariantStock(p.id, null);

            if (stockFilter === "IN_STOCK") return totalStock > 5;
            if (stockFilter === "LOW_STOCK") return totalStock > 0 && totalStock <= 5;
            if (stockFilter === "OUT_OF_STOCK") return totalStock === 0;

            return true;
        });
    }, [products, productSearch, categoryFilter, stockFilter, stockDrafts, storeInventory]);

    // Store KPI Metrics
    const storeKpis = useMemo(() => {
        let totalItems = products.length;
        let totalVariants = 0;
        let inStockCount = 0;
        let lowOrOutStockCount = 0;

        products.forEach(p => {
            const vars = p.variants || [];
            totalVariants += vars.length;

            const hasVariants = vars.length > 0;
            const stock = hasVariants
                ? vars.reduce((acc: number, v: any) => acc + getVariantStock(p.id, v.id), 0)
                : getVariantStock(p.id, null);

            if (stock > 5) inStockCount++;
            else lowOrOutStockCount++;
        });

        return { totalItems, totalVariants, inStockCount, lowOrOutStockCount };
    }, [products, storeInventory, stockDrafts]);

    return (
        <div className="space-y-8 animate-in fade-in duration-500 max-w-[1600px] mx-auto pb-20">
            {/* Header & Primary Navigation Tabs */}
            <div className="flex flex-col gap-6 pb-6 border-b border-slate-200">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
                            Store Operations & Network
                        </h2>
                        <p className="text-sm text-slate-500 mt-1">
                            Configure physical store hubs, allocate product variants with stock, and organize product catalog positions.
                        </p>
                    </div>

                    {/* Tab Navigation Pill Buttons */}
                    <div className="flex items-center gap-2 p-1.5 bg-slate-100 rounded-2xl border border-slate-200/80 shadow-xs">
                        <button
                            type="button"
                            onClick={() => setActiveTab("network")}
                            className={cn(
                                "flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                                activeTab === "network"
                                    ? "bg-white text-slate-900 shadow-md shadow-slate-200/50"
                                    : "text-slate-500 hover:text-slate-800 hover:bg-white/50"
                            )}
                        >
                            <Store className="w-4 h-4 text-emerald-600" />
                            <span>Store Network</span>
                            <span className="px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-black">
                                {stores.length}
                            </span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveTab("variants_stock")}
                            className={cn(
                                "flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                                activeTab === "variants_stock"
                                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
                                    : "text-slate-500 hover:text-slate-800 hover:bg-white/50"
                            )}
                        >
                            <Boxes className="w-4 h-4" />
                            <span>Store Variants, Stock & Ordering</span>
                            <span className={cn(
                                "px-1.5 py-0.5 rounded-md text-[10px] font-black",
                                activeTab === "variants_stock" ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
                            )}>
                                Live
                            </span>
                        </button>
                    </div>
                </div>
            </div>

            {/* TAB 1: STORE NETWORK HUBS */}
            {activeTab === "network" && (
                <div className="space-y-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="relative group flex-1 max-w-md">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-emerald-600 transition-colors" />
                            <input 
                                className="w-full h-11 bg-white border border-slate-200 rounded-xl pl-11 pr-4 text-sm font-medium text-slate-900 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 transition-all outline-none placeholder:text-slate-400"
                                placeholder="Search store hubs by name or slug..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>

                        <Dialog open={isAddOpen} onOpenChange={(open) => {
                            setIsAddOpen(open);
                            if (!open) {
                                setEditingStore(null);
                                setFormData({ 
                                    name: "", 
                                    slug: "", 
                                    address: "", 
                                    contactNumber: "", 
                                    gstNumber: "", 
                                    password: "", 
                                    latitude: "", 
                                    longitude: "", 
                                    deliveryRadius: "10.0", 
                                    upiId: "", 
                                    purchaseManagerId: "" 
                                });
                            }
                        }}>
                            <DialogTrigger asChild>
                                <button className="h-11 bg-emerald-600 hover:bg-emerald-700 text-white px-5 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-100 transition-all active:scale-95 font-bold text-xs cursor-pointer">
                                    <Plus className="h-4 w-4" />
                                    <span>Add New Store Hub</span>
                                </button>
                            </DialogTrigger>
                            <DialogContent className="bg-white border-slate-200 border rounded-2xl w-[95vw] md:w-full max-w-4xl p-0 overflow-y-auto max-h-[90vh] shadow-2xl animate-in zoom-in-95 duration-300">
                                <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 border border-emerald-100">
                                            {editingStore ? <Edit2 className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-bold text-slate-900 uppercase tracking-tight">
                                                {editingStore ? "Refine Store Config" : "Add New Store Location"}
                                            </h3>
                                            <p className="text-xs text-slate-500 mt-0.5">
                                                {editingStore ? "Update parameters for this logistics hub" : "Register a new physical hub to the logistics network"}
                                            </p>
                                        </div>
                                    </div>
                                    <button onClick={() => setIsAddOpen(false)} className="w-10 h-10 rounded-xl hover:bg-white flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all border border-transparent hover:border-slate-200 cursor-pointer">
                                        <X className="h-5 w-5" />
                                    </button>
                                </div>
                                
                                <div className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                                    <div className="space-y-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
                                                <Store className="h-3 w-3" /> Store Name
                                            </label>
                                            <input 
                                                className="w-full h-11 bg-white rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-900 outline-none focus:border-emerald-500" 
                                                placeholder="E.g. South Delhi Hub"
                                                value={formData.name}
                                                onChange={(e) => setFormData({...formData, name: e.target.value})}
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
                                                <ExternalLink className="h-3 w-3" /> URL Identifier (Slug)
                                            </label>
                                            <input 
                                                className="w-full h-11 bg-white rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-900 outline-none focus:border-emerald-500 font-mono" 
                                                placeholder="south-delhi-hub"
                                                value={formData.slug}
                                                onChange={(e) => setFormData({...formData, slug: e.target.value.toLowerCase().replace(/\s+/g, '-')})}
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
                                                <FileText className="h-3 w-3" /> GSTIN / Tax ID
                                            </label>
                                            <input 
                                                className="w-full h-11 bg-white rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-900 outline-none focus:border-emerald-500" 
                                                placeholder="07AAAAA0000A1Z5"
                                                value={formData.gstNumber}
                                                onChange={(e) => setFormData({...formData, gstNumber: e.target.value})}
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">
                                                    Latitude
                                                </label>
                                                <input 
                                                    className="w-full h-11 bg-white rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-900 outline-none focus:border-emerald-500" 
                                                    placeholder="28.7041"
                                                    value={formData.latitude}
                                                    onChange={(e) => setFormData({...formData, latitude: e.target.value})}
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">
                                                    Longitude
                                                </label>
                                                <input 
                                                    className="w-full h-11 bg-white rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-900 outline-none focus:border-emerald-500" 
                                                    placeholder="77.1025"
                                                    value={formData.longitude}
                                                    onChange={(e) => setFormData({...formData, longitude: e.target.value})}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
                                                <MapPin className="h-3 w-3" /> Address
                                            </label>
                                            <input 
                                                className="w-full h-11 bg-white rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-900 outline-none focus:border-emerald-500" 
                                                placeholder="Physical address"
                                                value={formData.address}
                                                onChange={(e) => setFormData({...formData, address: e.target.value})}
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
                                                <Phone className="h-3 w-3" /> Contact Number
                                            </label>
                                            <input 
                                                className="w-full h-11 bg-white rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-900 outline-none focus:border-emerald-500" 
                                                placeholder="+91 98765 43210"
                                                value={formData.contactNumber}
                                                onChange={(e) => setFormData({...formData, contactNumber: e.target.value})}
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-teal-600 uppercase tracking-widest px-1 flex items-center gap-2">
                                                <UserCheck className="h-3 w-3" /> Assigned Store Manager
                                            </label>
                                            <select
                                                className="w-full h-11 bg-teal-50/50 rounded-xl border border-teal-200 px-4 text-sm font-bold text-slate-900 outline-none focus:border-teal-500 cursor-pointer"
                                                value={formData.purchaseManagerId || ""}
                                                onChange={(e) => setFormData({...formData, purchaseManagerId: e.target.value})}
                                            >
                                                <option value="">Unassigned</option>
                                                {users.map(u => (
                                                    <option key={u.id} value={u.id}>{u.name || u.phone} ({u.role?.replace('_', ' ')})</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="space-y-1.5 relative">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
                                                <Key className="h-3 w-3" /> Store Access Key
                                            </label>
                                            <div className="relative">
                                                <input 
                                                    type={showPassword ? "text" : "password"}
                                                    className="w-full h-11 bg-white rounded-xl border border-slate-200 px-4 pr-12 text-sm font-bold text-slate-900 outline-none focus:border-emerald-500 tracking-wider" 
                                                    placeholder="••••••••"
                                                    value={formData.password}
                                                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                                                />
                                                <button 
                                                    type="button"
                                                    onClick={() => setShowPassword(!showPassword)}
                                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-emerald-600"
                                                >
                                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-6 md:p-8 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-3">
                                    <button onClick={() => { setIsAddOpen(false); setEditingStore(null); }} className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 cursor-pointer">
                                        Cancel
                                    </button>
                                    <button 
                                        onClick={handleSaveStore}
                                        className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-lg shadow-emerald-100 flex items-center gap-2 active:scale-95 cursor-pointer"
                                    >
                                        <Save className="h-4 w-4" />
                                        {editingStore ? "Save Hub Changes" : "Commit New Hub"}
                                    </button>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>

                    {/* Stores Grid View */}
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {loading ? (
                            [1, 2, 3].map(i => (
                                <div key={i} className="h-72 bg-white rounded-2xl border border-slate-200 animate-pulse p-6" />
                            ))
                        ) : stores.filter(s => s.name.toLowerCase().includes(search.toLowerCase())).map((store) => {
                            const manager = getManager(store.id);
                            return (
                                <div 
                                    key={store.id} 
                                    className="bg-white rounded-2xl border border-slate-200 p-6 hover:border-emerald-300 hover:shadow-xl hover:shadow-emerald-500/5 transition-all flex flex-col justify-between group"
                                >
                                    <div>
                                        <div className="flex items-start justify-between gap-3 mb-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center border border-slate-100 text-slate-500 group-hover:bg-emerald-600 group-hover:text-white transition-all">
                                                    <Store className="h-6 w-6" />
                                                </div>
                                                <div>
                                                    <h3 className="text-base font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
                                                        {store.name}
                                                    </h3>
                                                    <span className="text-[10px] font-mono text-slate-400">
                                                        /{store.slug}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-1">
                                                <button 
                                                    onClick={() => {
                                                        setEditingStore(store);
                                                        setFormData({
                                                            name: store.name,
                                                            slug: store.slug,
                                                            address: store.address || "",
                                                            contactNumber: store.contactNumber || "",
                                                            gstNumber: store.gstNumber || "",
                                                            password: "",
                                                            latitude: store.latitude || "",
                                                            longitude: store.longitude || "",
                                                            deliveryRadius: store.deliveryRadius || "10.0",
                                                            upiId: store.upiId || "",
                                                            purchaseManagerId: store.purchaseManagerId || ""
                                                        });
                                                        setIsAddOpen(true);
                                                    }}
                                                    className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 flex items-center justify-center cursor-pointer"
                                                >
                                                    <Edit2 className="h-3.5 w-3.5" />
                                                </button>
                                                <button 
                                                    onClick={() => handleDeleteStore(store.id)}
                                                    className="w-8 h-8 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 flex items-center justify-center cursor-pointer"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        </div>

                                        <div className="space-y-2 text-xs text-slate-600 mb-4">
                                            <div className="flex items-start gap-2">
                                                <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                                                <span className="truncate">{store.address || "No address specified"}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                                <span className="font-mono text-slate-700">{store.contactNumber || "N/A"}</span>
                                            </div>
                                            <div className="flex items-center gap-2 pt-1">
                                                <UserCircle className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                                <span className="text-[11px] font-semibold text-slate-800">
                                                    Manager: {manager?.name || "Unassigned"}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Primary CTA: Jump into Store Variants & Stock */}
                                    <div className="pt-4 border-t border-slate-100 flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSelectedStoreId(store.id);
                                                setActiveTab("variants_stock");
                                            }}
                                            className="w-full h-10 rounded-xl bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs group-hover:bg-emerald-600 group-hover:text-white"
                                        >
                                            <Boxes className="w-4 h-4" />
                                            <span>Manage Variants & Stock →</span>
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* TAB 2: STORE VARIANTS, STOCK & CATALOG ORDERING */}
            {activeTab === "variants_stock" && (
                <div className="space-y-6">
                    {/* Top Store Selector & Live Metrics Banner */}
                    <div className="bg-gradient-to-r from-slate-900 via-[#18231c] to-[#0f2818] rounded-3xl p-6 text-white shadow-xl border border-white/10 space-y-6">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-widest">
                                    <Store className="w-4 h-4" />
                                    <span>Active Store Inventory & Ordering Console</span>
                                </div>
                                <h3 className="text-2xl font-black tracking-tight text-white flex items-center gap-3">
                                    <span>{currentStore?.name || "Select Store"}</span>
                                    <span className="text-xs font-mono font-medium px-2.5 py-0.5 rounded-full bg-white/10 text-emerald-300">
                                        /{currentStore?.slug || "hub"}
                                    </span>
                                </h3>
                                <p className="text-xs text-slate-300 max-w-xl">
                                    {currentStore?.address || "Configure variants, allocate stock, and adjust customer catalog display position for this store."}
                                </p>
                            </div>

                            {/* Store Switcher Dropdown */}
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                        Switch Active Store:
                                    </label>
                                    <div className="relative">
                                        <select
                                            value={selectedStoreId}
                                            onChange={(e) => setSelectedStoreId(e.target.value)}
                                            className="h-11 bg-white/10 hover:bg-white/15 text-white font-bold text-xs rounded-xl px-4 pr-10 border border-white/20 outline-none focus:ring-2 focus:ring-emerald-400 cursor-pointer appearance-none min-w-[220px]"
                                        >
                                            {stores.map(s => (
                                                <option key={s.id} value={s.id} className="text-slate-900 bg-white font-semibold">
                                                    {s.name}
                                                </option>
                                            ))}
                                        </select>
                                        <ChevronDown className="w-4 h-4 text-slate-300 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => handleOpenAddVariant()}
                                    className="h-11 sm:mt-5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-5 rounded-xl font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer"
                                >
                                    <Plus className="w-4 h-4 stroke-[3]" />
                                    <span>Create Variant</span>
                                </button>
                            </div>
                        </div>

                        {/* Store KPIs */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-white/10">
                            <div className="bg-white/5 rounded-2xl p-3 border border-white/5">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Products</p>
                                <p className="text-xl font-black text-white mt-0.5">{storeKpis.totalItems}</p>
                            </div>
                            <div className="bg-white/5 rounded-2xl p-3 border border-white/5">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Active Variants</p>
                                <p className="text-xl font-black text-emerald-400 mt-0.5">{storeKpis.totalVariants}</p>
                            </div>
                            <div className="bg-white/5 rounded-2xl p-3 border border-white/5">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Well Stocked Items</p>
                                <p className="text-xl font-black text-[#bef264] mt-0.5">{storeKpis.inStockCount}</p>
                            </div>
                            <div className="bg-white/5 rounded-2xl p-3 border border-white/5">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Low / Out of Stock</p>
                                <p className="text-xl font-black text-rose-400 mt-0.5">{storeKpis.lowOrOutStockCount}</p>
                            </div>
                        </div>
                    </div>

                    {/* Filter & Positioning Action Bar */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-xs">
                        <div className="flex flex-wrap items-center gap-3 flex-1">
                            {/* Search */}
                            <div className="relative flex-1 min-w-[200px] max-w-sm">
                                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    placeholder="Search products, SKU or barcode..."
                                    value={productSearch}
                                    onChange={(e) => setProductSearch(e.target.value)}
                                    className="w-full h-10 pl-9 pr-4 text-xs font-medium rounded-xl border border-slate-200 outline-none focus:border-emerald-500 bg-slate-50/50"
                                />
                            </div>

                            {/* Category Filter */}
                            <select
                                value={categoryFilter}
                                onChange={(e) => setCategoryFilter(e.target.value)}
                                className="h-10 px-3 text-xs font-bold rounded-xl border border-slate-200 bg-white text-slate-700 outline-none focus:border-emerald-500 cursor-pointer"
                            >
                                <option value="ALL">All Categories</option>
                                {categories.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>

                            {/* Stock Filter */}
                            <select
                                value={stockFilter}
                                onChange={(e: any) => setStockFilter(e.target.value)}
                                className="h-10 px-3 text-xs font-bold rounded-xl border border-slate-200 bg-white text-slate-700 outline-none focus:border-emerald-500 cursor-pointer"
                            >
                                <option value="ALL">All Stock Statuses</option>
                                <option value="IN_STOCK">In Stock (&gt; 5)</option>
                                <option value="LOW_STOCK">Low Stock (1 - 5)</option>
                                <option value="OUT_OF_STOCK">Out of Stock (0)</option>
                            </select>
                        </div>

                        {/* Save Positions CTA */}
                        <div className="flex items-center gap-2">
                            {hasUnsavedPositions && (
                                <span className="text-[11px] font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 animate-pulse">
                                    Unsaved Order Changes
                                </span>
                            )}
                            <button
                                type="button"
                                disabled={!hasUnsavedPositions || savingPositions}
                                onClick={handleSavePositions}
                                className={cn(
                                    "h-10 px-4 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-xs",
                                    hasUnsavedPositions
                                        ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200"
                                        : "bg-slate-100 text-slate-400 cursor-not-allowed"
                                )}
                            >
                                {savingPositions ? (
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                    <Save className="w-3.5 h-3.5" />
                                )}
                                <span>Save Product Positions</span>
                            </button>
                        </div>
                    </div>

                    {/* Products & Variants List with Dual Reordering Controls */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between text-xs text-slate-500 px-2">
                            <span className="font-bold">
                                Showing {filteredProducts.length} Products for {currentStore?.name}
                            </span>
                            <span className="text-[11px] text-slate-400 hidden sm:inline">
                                💡 Tip: Drag products by the grip handle, use ▲/▼ buttons, or type position numbers directly.
                            </span>
                        </div>

                        {inventoryLoading ? (
                            <div className="p-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
                                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-emerald-600 mb-2" />
                                <p className="text-xs font-bold">Synchronizing store inventory...</p>
                            </div>
                        ) : filteredProducts.length === 0 ? (
                            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
                                <Package className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                                <h4 className="text-sm font-bold text-slate-700">No products matching filters</h4>
                                <p className="text-xs text-slate-400 mt-1">Try resetting the search or category filters.</p>
                            </div>
                        ) : (
                            filteredProducts.map((product, productIndex) => {
                                const variants: any[] = product.variants || [];
                                const hasVariants = variants.length > 0;
                                const baseStockKey = `${product.id}_base`;
                                const baseStock = getVariantStock(product.id, null);
                                const currentPos = productIndex + 1;

                                return (
                                    <div
                                        key={product.id}
                                        draggable={true}
                                        onDragStart={() => handleDragStart(productIndex)}
                                        onDragOver={(e) => handleDragOver(e, productIndex)}
                                        onDrop={(e) => handleDrop(e, productIndex)}
                                        className={cn(
                                            "bg-white rounded-2xl border transition-all p-5 shadow-xs space-y-4",
                                            draggedProductIndex === productIndex 
                                                ? "opacity-50 border-emerald-400 scale-[0.99]" 
                                                : "border-slate-200 hover:border-emerald-300 hover:shadow-md"
                                        )}
                                    >
                                        {/* Product Row Header */}
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                            <div className="flex items-center gap-3">
                                                {/* Reordering Controls: Grip, Position Input, Up/Down */}
                                                <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200 shrink-0">
                                                    <div 
                                                        title="Drag to reorder" 
                                                        className="p-1 text-slate-400 hover:text-slate-700 cursor-grab active:cursor-grabbing"
                                                    >
                                                        <GripVertical className="w-4 h-4" />
                                                    </div>

                                                    {/* Direct Position Number Input */}
                                                    <div className="flex items-center gap-1 px-1">
                                                        <span className="text-[10px] font-black text-slate-400">#</span>
                                                        <input
                                                            type="number"
                                                            min={1}
                                                            max={products.length}
                                                            value={currentPos}
                                                            onChange={(e) => handleDirectPositionChange(productIndex, e.target.value)}
                                                            className="w-10 h-7 text-center font-black text-xs rounded-md bg-white border border-slate-200 text-slate-800 outline-none focus:border-emerald-500"
                                                            title="Type position number (e.g., 1, 2, 5...)"
                                                        />
                                                    </div>

                                                    {/* Move Up / Down Buttons */}
                                                    <div className="flex flex-col gap-0.5">
                                                        <button
                                                            type="button"
                                                            disabled={productIndex === 0}
                                                            onClick={() => handleMoveProduct(productIndex, "up")}
                                                            className="p-0.5 rounded text-slate-500 hover:bg-slate-200 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                                                            title="Move Up"
                                                        >
                                                            <ArrowUp className="w-3 h-3 stroke-[2.5]" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            disabled={productIndex === products.length - 1}
                                                            onClick={() => handleMoveProduct(productIndex, "down")}
                                                            className="p-0.5 rounded text-slate-500 hover:bg-slate-200 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                                                            title="Move Down"
                                                        >
                                                            <ArrowDown className="w-3 h-3 stroke-[2.5]" />
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Product Thumbnail & Details */}
                                                <div className="relative w-12 h-12 rounded-xl bg-slate-100 overflow-hidden shrink-0 border border-slate-200">
                                                    {product.images?.[0] ? (
                                                        <Image
                                                            src={product.images[0]}
                                                            alt={product.name}
                                                            fill
                                                            unoptimized
                                                            className="object-contain p-1"
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-slate-400">
                                                            <Package className="w-5 h-5" />
                                                        </div>
                                                    )}
                                                </div>

                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <h4 className="text-sm font-bold text-slate-900">
                                                            {product.name}
                                                        </h4>
                                                        {product.category?.name && (
                                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                                                                {product.category.name}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
                                                        SKU: {product.sku || product.barcode || "N/A"} • Base Price: ₹{product.basePrice || "0"}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Action: Add Variant specifically for this product */}
                                            <div className="flex items-center gap-2 self-end sm:self-center">
                                                <button
                                                    type="button"
                                                    onClick={() => handleOpenAddVariant(product)}
                                                    className="h-8 px-3 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer border border-emerald-200/60"
                                                >
                                                    <Plus className="w-3.5 h-3.5" />
                                                    <span>Add Variant</span>
                                                </button>
                                            </div>
                                        </div>

                                        {/* If Product has NO variants: direct base product stock manager */}
                                        {!hasVariants && (
                                            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                                <div>
                                                    <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                                        <span>Standard / Single Unit Stock in {currentStore?.name}</span>
                                                        <span className={cn(
                                                            "text-[10px] font-bold px-2 py-0.5 rounded-md",
                                                            baseStock > 5 ? "bg-emerald-100 text-emerald-800" : baseStock > 0 ? "bg-amber-100 text-amber-800" : "bg-rose-100 text-rose-800"
                                                        )}>
                                                            {baseStock > 5 ? "In Stock" : baseStock > 0 ? "Low Stock" : "Out of Stock"}
                                                        </span>
                                                    </p>
                                                    <p className="text-[11px] text-slate-400">Unit: {product.weightUnit || "kg"}</p>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    {/* Quick Delta Increment Pills */}
                                                    <div className="flex items-center gap-1">
                                                        {[-10, 10, 25, 50].map((d) => (
                                                            <button
                                                                key={d}
                                                                type="button"
                                                                onClick={() => handleStockDelta(product.id, null, d)}
                                                                className="px-2 py-1 rounded-md text-[10px] font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 cursor-pointer"
                                                            >
                                                                {d > 0 ? `+${d}` : d}
                                                            </button>
                                                        ))}
                                                    </div>

                                                    {/* Stock Input */}
                                                    <input
                                                        type="number"
                                                        value={stockDrafts[baseStockKey] ?? baseStock}
                                                        onChange={(e) => setStockDrafts(prev => ({ ...prev, [baseStockKey]: e.target.value }))}
                                                        className="w-16 h-8 text-center text-xs font-black rounded-lg border border-slate-200 bg-white text-slate-800 outline-none focus:border-emerald-500"
                                                    />

                                                    {/* Save Button */}
                                                    <button
                                                        type="button"
                                                        disabled={savingStockKey === baseStockKey}
                                                        onClick={() => handleSaveStock(product.id, null)}
                                                        className="h-8 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1 shadow-xs cursor-pointer active:scale-95"
                                                    >
                                                        {savingStockKey === baseStockKey ? (
                                                            <RefreshCw className="w-3 h-3 animate-spin" />
                                                        ) : (
                                                            <Check className="w-3 h-3" />
                                                        )}
                                                        <span>Save</span>
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {/* Product Variants Table / Grid */}
                                        {hasVariants && (
                                            <div className="border border-slate-100 rounded-xl overflow-hidden bg-slate-50/50">
                                                <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                                    <div className="col-span-4 sm:col-span-3">Variant</div>
                                                    <div className="col-span-2 hidden sm:block">Weight / Unit</div>
                                                    <div className="col-span-3 sm:col-span-2">Price</div>
                                                    <div className="col-span-5 sm:col-span-5 text-right">Store Stock Qty</div>
                                                </div>

                                                <div className="divide-y divide-slate-100 bg-white">
                                                    {variants.map((v: any) => {
                                                        const varStockKey = `${product.id}_${v.id}`;
                                                        const curVarStock = getVariantStock(product.id, v.id);

                                                        return (
                                                            <div key={v.id} className="grid grid-cols-12 gap-2 px-4 py-3 items-center text-xs">
                                                                <div className="col-span-4 sm:col-span-3 font-bold text-slate-800 flex items-center gap-2">
                                                                    <Tag className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                                                    <span className="truncate">{v.name}</span>
                                                                </div>

                                                                <div className="col-span-2 hidden sm:block text-slate-500 font-medium">
                                                                    {v.weight || "-"} {v.weightUnit}
                                                                </div>

                                                                <div className="col-span-3 sm:col-span-2 font-bold text-emerald-700">
                                                                    ₹{v.price}
                                                                </div>

                                                                {/* Stock Allocation & Adjust Controls */}
                                                                <div className="col-span-5 sm:col-span-5 flex items-center justify-end gap-1.5">
                                                                    {/* Quick Increment Pills */}
                                                                    <div className="hidden md:flex items-center gap-1">
                                                                        {[-10, 10, 25, 50].map((d) => (
                                                                            <button
                                                                                key={d}
                                                                                type="button"
                                                                                onClick={() => handleStockDelta(product.id, v.id, d)}
                                                                                className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                                                                            >
                                                                                {d > 0 ? `+${d}` : d}
                                                                            </button>
                                                                        ))}
                                                                    </div>

                                                                    {/* Stock Quantity Input */}
                                                                    <input
                                                                        type="number"
                                                                        value={stockDrafts[varStockKey] ?? curVarStock}
                                                                        onChange={(e) => setStockDrafts(prev => ({ ...prev, [varStockKey]: e.target.value }))}
                                                                        className={cn(
                                                                            "w-14 h-7 text-center text-xs font-black rounded-md border outline-none focus:border-emerald-500",
                                                                            curVarStock > 5 
                                                                                ? "bg-emerald-50/50 border-emerald-200 text-emerald-900" 
                                                                                : curVarStock > 0 
                                                                                    ? "bg-amber-50/50 border-amber-200 text-amber-900" 
                                                                                    : "bg-rose-50/50 border-rose-200 text-rose-900"
                                                                        )}
                                                                    />

                                                                    {/* Save Stock Button */}
                                                                    <button
                                                                        type="button"
                                                                        disabled={savingStockKey === varStockKey}
                                                                        onClick={() => handleSaveStock(product.id, v.id)}
                                                                        className="h-7 px-2.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold flex items-center gap-1 shadow-xs cursor-pointer active:scale-95"
                                                                    >
                                                                        {savingStockKey === varStockKey ? (
                                                                            <RefreshCw className="w-3 h-3 animate-spin" />
                                                                        ) : (
                                                                            <Check className="w-3 h-3" />
                                                                        )}
                                                                        <span>Save</span>
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}

            {/* CREATE VARIANT DIALOG MODAL */}
            <Dialog open={isVariantModalOpen} onOpenChange={setIsVariantModalOpen}>
                <DialogContent className="bg-white border-slate-200 border rounded-2xl w-[95vw] md:w-full max-w-lg p-0 overflow-y-auto max-h-[90vh] shadow-2xl animate-in zoom-in-95 duration-200">
                    <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-100/80 text-emerald-800 flex items-center justify-center font-bold">
                                <Plus className="w-5 h-5 stroke-[2.5]" />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-slate-900">
                                    Create Product Variant
                                </h3>
                                <p className="text-xs text-slate-500">
                                    Store: <span className="font-bold text-emerald-700">{currentStore?.name}</span>
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setIsVariantModalOpen(false)}
                            className="w-8 h-8 rounded-lg hover:bg-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-800 transition-all cursor-pointer"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="p-6 space-y-4">
                        {/* Target Product */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                Target Product
                            </label>
                            <select
                                value={variantForm.productId}
                                onChange={(e) => {
                                    const p = products.find(prod => prod.id === e.target.value);
                                    setSelectedProductForVariant(p);
                                    setVariantForm(prev => ({ 
                                        ...prev, 
                                        productId: e.target.value,
                                        price: p?.basePrice ? String(p.basePrice) : prev.price
                                    }));
                                }}
                                className="w-full h-11 bg-slate-50 rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-800 outline-none focus:border-emerald-500 cursor-pointer"
                            >
                                {products.map(p => (
                                    <option key={p.id} value={p.id}>{p.name} ({p.sku || "No SKU"})</option>
                                ))}
                            </select>
                        </div>

                        {/* Variant Name */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                Variant Name (e.g. 500 gm, 1 Kg, Pack of 2)
                            </label>
                            <input
                                type="text"
                                placeholder="E.g. 500 gm"
                                value={variantForm.name}
                                onChange={(e) => setVariantForm(prev => ({ ...prev, name: e.target.value }))}
                                className="w-full h-11 rounded-xl border border-slate-200 px-4 text-xs font-bold text-slate-800 outline-none focus:border-emerald-500"
                            />
                        </div>

                        {/* Weight & Weight Unit */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                    Weight Value
                                </label>
                                <input
                                    type="number"
                                    placeholder="500"
                                    value={variantForm.weight}
                                    onChange={(e) => setVariantForm(prev => ({ ...prev, weight: e.target.value }))}
                                    className="w-full h-11 rounded-xl border border-slate-200 px-4 text-xs font-bold text-slate-800 outline-none focus:border-emerald-500"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                    Weight Unit
                                </label>
                                <select
                                    value={variantForm.weightUnit}
                                    onChange={(e) => setVariantForm(prev => ({ ...prev, weightUnit: e.target.value }))}
                                    className="w-full h-11 bg-white rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-800 outline-none focus:border-emerald-500 cursor-pointer"
                                >
                                    {WEIGHT_UNITS.map(u => (
                                        <option key={u} value={u}>{u}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Selling Price & Initial Store Stock */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest">
                                    Selling Price (₹)
                                </label>
                                <input
                                    type="number"
                                    placeholder="49.00"
                                    value={variantForm.price}
                                    onChange={(e) => setVariantForm(prev => ({ ...prev, price: e.target.value }))}
                                    className="w-full h-11 rounded-xl border border-emerald-300 bg-emerald-50/20 px-4 text-xs font-black text-emerald-900 outline-none focus:border-emerald-500"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-blue-700 uppercase tracking-widest">
                                    Stock Qty for {currentStore?.name}
                                </label>
                                <input
                                    type="number"
                                    placeholder="50"
                                    value={variantForm.initialStock}
                                    onChange={(e) => setVariantForm(prev => ({ ...prev, initialStock: e.target.value }))}
                                    className="w-full h-11 rounded-xl border border-blue-300 bg-blue-50/20 px-4 text-xs font-black text-blue-900 outline-none focus:border-blue-500"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="p-5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-3">
                        <button
                            type="button"
                            onClick={() => setIsVariantModalOpen(false)}
                            className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-200 cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            disabled={variantSubmitting}
                            onClick={handleSaveVariant}
                            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md shadow-emerald-200 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                        >
                            {variantSubmitting ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                                <Save className="w-3.5 h-3.5" />
                            )}
                            <span>Create & Stock Variant</span>
                        </button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
