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
    EyeOff
} from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import api from "@/services/api";
import { toast } from "sonner";

export default function AdminStores() {
    const [stores, setStores] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [editingStore, setEditingStore] = useState<any>(null);
    const [search, setSearch] = useState("");

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
        upiId: ""
    });
    const [showPassword, setShowPassword] = useState(false);

    const fetchStores = async () => {
        setLoading(true);
        try {
            const res = await api.get("/locations");
            setStores(res.data);
        } catch (error) {
            toast.error("Failed to fetch store locations");
        } finally {
            setLoading(false);
        }
    };

    const fetchUsers = async () => {
        try {
            const res = await api.get("/users/admin/all");
            setUsers(res.data);
        } catch (error) {
            console.error("Failed to fetch user management profiles");
        }
    };

    useEffect(() => {
        fetchStores();
        fetchUsers();
    }, []);

    const handleSave = async () => {
        try {
            if (editingStore) {
                await api.put(`/locations/${editingStore.id}`, formData);
                toast.success("Store configuration refined successfully");
            } else {
                await api.post("/locations", formData);
                toast.success("New store location added successfully");
            }
            setIsAddOpen(false);
            setFormData({ name: "", slug: "", address: "", contactNumber: "", gstNumber: "", password: "", latitude: "", longitude: "", deliveryRadius: "10.0", upiId: "" });
            setEditingStore(null);
            fetchStores();
        } catch (error) {
            toast.error("Failed to synchronize store registry");
        }
    };

    const handleDelete = async (id: string) => {
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

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-200">
                <div className="px-1 md:px-0">
                    <h2 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Store Network</h2>
                    <p className="text-sm text-slate-500 mt-1">Manage physical locations, logistics hubs, and assigned managers.</p>
                </div>
                
                <Dialog open={isAddOpen} onOpenChange={(open) => {
                    setIsAddOpen(open);
                    if (!open) {
                        setEditingStore(null);
                        setFormData({ name: "", slug: "", address: "", contactNumber: "", gstNumber: "", password: "", latitude: "", longitude: "", deliveryRadius: "10.0", upiId: "" });
                    }
                }}>
                    <DialogTrigger asChild>
                        <button className="h-12 bg-emerald-600 hover:bg-emerald-700 text-white px-6 rounded-xl flex items-center justify-center gap-3 shadow-lg shadow-emerald-100 transition-all active:scale-95 font-bold text-sm w-full md:w-auto">
                            <Plus className="h-5 w-5" />
                            <span>Add New Store</span>
                        </button>
                    </DialogTrigger>
                    <DialogContent className="bg-white border-slate-200 border rounded-2xl w-[95vw] md:w-full max-w-4xl p-0 overflow-y-auto max-h-[90vh] shadow-2xl animate-in zoom-in-95 duration-300">
                        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 border border-emerald-100">
                                    {editingStore ? <Edit2 className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-slate-900 uppercase tracking-tight">{editingStore ? "Refine Store Config" : "Add New Store Location"}</h3>
                                    <p className="text-xs text-slate-500 mt-0.5 text-balance">{editingStore ? "Update institutional parameters for this logistics hub" : "Register a new physical hub to the logistics network"}</p>
                                </div>
                            </div>
                            <button onClick={() => setIsAddOpen(false)} className="w-10 h-10 rounded-xl hover:bg-white flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all border border-transparent hover:border-slate-200">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        
                        <div className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                            <div className="space-y-6">
                                <div className="space-y-2 group">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2 group-focus-within:text-emerald-600 transition-colors">
                                        <Store className="h-3 w-3" /> Store Name
                                    </label>
                                    <input 
                                        className="w-full h-12 bg-white rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-900 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 transition-all placeholder:text-slate-300" 
                                        placeholder="E.g. South Delhi Hub"
                                        value={formData.name}
                                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                                    />
                                </div>
                                <div className="space-y-2 group">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2 group-focus-within:text-emerald-600 transition-colors">
                                        <ExternalLink className="h-3 w-3" /> URL Identifier (Slug)
                                    </label>
                                    <input 
                                        className="w-full h-12 bg-white rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-900 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 transition-all placeholder:text-slate-300 font-mono" 
                                        placeholder="south-delhi-hub"
                                        value={formData.slug}
                                        onChange={(e) => setFormData({...formData, slug: e.target.value.toLowerCase().replace(/\s+/g, '-')})}
                                    />
                                </div>
                                <div className="space-y-2 group">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2 group-focus-within:text-emerald-600 transition-colors">
                                        <FileText className="h-3 w-3" /> GSTIN / Tax ID
                                    </label>
                                    <input 
                                        className="w-full h-12 bg-white rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-900 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 transition-all placeholder:text-slate-300" 
                                        placeholder="07AAAAA0000A1Z5"
                                        value={formData.gstNumber}
                                        onChange={(e) => setFormData({...formData, gstNumber: e.target.value})}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2 group">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2 group-focus-within:text-emerald-600 transition-colors">
                                            <Globe className="h-3 w-3" /> Latitude
                                        </label>
                                        <input 
                                            className="w-full h-12 bg-white rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-900 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 transition-all placeholder:text-slate-300" 
                                            placeholder="28.7041"
                                            value={formData.latitude}
                                            onChange={(e) => setFormData({...formData, latitude: e.target.value})}
                                        />
                                    </div>
                                    <div className="space-y-2 group">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2 group-focus-within:text-emerald-600 transition-colors">
                                            <Globe className="h-3 w-3" /> Longitude
                                        </label>
                                        <input 
                                            className="w-full h-12 bg-white rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-900 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 transition-all placeholder:text-slate-300" 
                                            placeholder="77.1025"
                                            value={formData.longitude}
                                            onChange={(e) => setFormData({...formData, longitude: e.target.value})}
                                        />
                                    </div>
                                    <div className="space-y-2 group col-span-2">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2 group-focus-within:text-emerald-600 transition-colors">
                                            <Activity className="h-3 w-3" /> Delivery Radius (Unit: KM)
                                        </label>
                                        <input 
                                            type="number"
                                            className="w-full h-12 bg-white rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-900 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 transition-all placeholder:text-slate-300" 
                                            placeholder="10.0"
                                            value={formData.deliveryRadius}
                                            onChange={(e) => setFormData({...formData, deliveryRadius: e.target.value})}
                                        />
                                    </div>
                                    <div className="space-y-2 group col-span-2">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2 group-focus-within:text-emerald-600 transition-colors">
                                            <Globe className="h-3 w-3" /> Digital Payment UPI ID
                                        </label>
                                        <input 
                                            className="w-full h-12 bg-white rounded-xl border border-slate-200 px-4 text-sm font-black text-slate-900 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 transition-all placeholder:text-slate-300 font-mono" 
                                            placeholder="merchant@okupi"
                                            value={formData.upiId}
                                            onChange={(e) => setFormData({...formData, upiId: e.target.value})}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div className="space-y-2 group">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2 group-focus-within:text-emerald-600 transition-colors">
                                        <MapPin className="h-3 w-3" /> Full Physical Address
                                    </label>
                                    <textarea 
                                        className="w-full h-[9rem] bg-white rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-900 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 transition-all placeholder:text-slate-300 resize-none" 
                                        placeholder="Enter full physical address..."
                                        value={formData.address}
                                        onChange={(e) => setFormData({...formData, address: e.target.value})}
                                    />
                                </div>
                                <div className="space-y-2 group">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2 group-focus-within:text-emerald-600 transition-colors">
                                        <Phone className="h-3 w-3" /> Contact Number
                                    </label>
                                    <input 
                                        className="w-full h-12 bg-white rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-900 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 transition-all placeholder:text-slate-300" 
                                        placeholder="+91 XXXXX XXXXX"
                                        value={formData.contactNumber}
                                        onChange={(e) => setFormData({...formData, contactNumber: e.target.value})}
                                    />
                                </div>
                                <div className="space-y-2 group relative">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2 group-focus-within:text-emerald-600 transition-colors">
                                        <Key className="h-3 w-3" /> Security Access Key
                                    </label>
                                    <div className="relative">
                                        <input 
                                            type={showPassword ? "text" : "password"}
                                            className="w-full h-12 bg-white rounded-xl border border-slate-200 px-4 pr-12 text-sm font-bold text-slate-900 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 transition-all placeholder:text-slate-300 tracking-widest" 
                                            placeholder="••••••••"
                                            value={formData.password}
                                            onChange={(e) => setFormData({...formData, password: e.target.value})}
                                        />
                                        <button 
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-emerald-600 transition-colors"
                                        >
                                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </button>
                                    </div>
                                    <p className="text-[9px] text-slate-400 font-medium px-1 mt-1 font-mono uppercase tracking-tight">Minimum 8 characters highly recommended.</p>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 md:p-8 border-t border-slate-100 bg-slate-50/50 flex flex-col md:flex-row items-center justify-end gap-4">
                            <button onClick={() => { setIsAddOpen(false); setEditingStore(null); }} className="px-6 py-2 rounded-xl text-sm font-bold text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all w-full md:w-auto">Cancel</button>
                            <button 
                                onClick={handleSave}
                                className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm shadow-lg shadow-emerald-100 flex items-center justify-center gap-2 active:scale-95 transition-all w-full md:w-auto">
                                <Save className="h-4 w-4" />
                                {editingStore ? "Synchronize Changes" : "Commit New Hub"}
                            </button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Network Grid View */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="md:col-span-2 relative group flex items-center">
                    <Search className="absolute left-4 h-5 w-5 text-slate-400 group-focus-within/input:text-emerald-600 transition-colors" />
                    <input 
                        className="w-full h-12 bg-white border border-slate-200 rounded-xl pl-12 pr-4 text-sm font-medium text-slate-900 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 transition-all outline-none placeholder:text-slate-400"
                        placeholder="Search Network Locations..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            {/* Registry Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 pb-12">
                {loading ? (
                    [1, 2, 3, 4].map(i => (
                        <div key={i} className="h-80 bg-white rounded-2xl border border-slate-200 animate-pulse flex flex-col p-8 space-y-6">
                             <div className="h-12 w-64 bg-slate-100 rounded-lg" />
                             <div className="h-24 w-full bg-slate-50 rounded-xl" />
                             <div className="h-12 w-full bg-slate-100 rounded-lg mt-auto" />
                        </div>
                    ))
                ) : (
                    stores.filter(s => s.name.toLowerCase().includes(search.toLowerCase())).map((store) => {
                        const manager = getManager(store.id);
                        return (
                            <div key={store.id} className="bg-white rounded-2xl border border-slate-100 p-8 hover:border-emerald-200 hover:shadow-xl hover:shadow-emerald-500/5 transition-all duration-500 group flex flex-col min-h-[420px]">
                                <div className="flex items-start justify-between mb-8">
                                    <div className="flex items-center gap-4">
                                        <div className="w-16 h-16 bg-slate-50 rounded-xl flex items-center justify-center border border-slate-100 text-slate-400 group-hover:bg-emerald-600 group-hover:text-white transition-all duration-500">
                                            <Store className="h-8 w-8" />
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-bold text-slate-900 leading-tight group-hover:text-emerald-700 transition-colors uppercase tracking-tight">{store.name}</h3>
                                            <div className="flex items-center gap-3 mt-2">
                                                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-md uppercase tracking-wider border border-emerald-100">Active Location</span>
                                                <span className="text-[10px] font-medium text-slate-400 font-mono">/{store.slug}</span>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="flex gap-2">
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
                                                    upiId: store.upiId || ""
                                                });
                                                setIsAddOpen(true);
                                            }}
                                            className="w-10 h-10 rounded-xl bg-blue-50 text-blue-400 hover:text-blue-600 hover:bg-blue-100 transition-all border border-blue-100 flex items-center justify-center"
                                        >
                                            <Edit2 className="h-4 w-4" />
                                        </button>
                                        <button onClick={() => handleDelete(store.id)} className="w-10 h-10 rounded-xl bg-red-50 text-red-400 hover:text-red-600 hover:bg-red-100 transition-all border border-red-100 flex items-center justify-center">
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                                
                                <div className="space-y-4 mb-8">
                                    <div className="flex gap-4 items-start">
                                        <div className="p-2.5 bg-slate-50 text-slate-400 rounded-lg border border-slate-100">
                                            <MapPin className="h-4 w-4" />
                                        </div>
                                        <p className="text-xs font-semibold text-slate-500 leading-relaxed uppercase tracking-wide">{store.address || "No address recorded on file."}</p>
                                    </div>
                                    <div className="flex gap-4 items-center">
                                        <div className="p-2.5 bg-slate-50 text-slate-400 rounded-lg border border-slate-100">
                                            <Phone className="h-4 w-4" />
                                        </div>
                                        <p className="text-sm font-bold text-slate-700 tracking-wider font-mono">{store.contactNumber || "UNREGISTERED HUB"}</p>
                                    </div>
                                </div>

                                <div className="mt-auto pt-6 border-t border-slate-50">
                                    <div className="bg-slate-50/80 rounded-xl p-4 flex items-center justify-between border border-slate-100">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-slate-400 border border-slate-200">
                                                {manager?.name ? (
                                                    <span className="text-sm font-bold">{manager.name[0]}</span>
                                                ) : (
                                                    <UserCircle className="h-6 w-6" />
                                                )}
                                            </div>
                                            <div>
                                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Store Manager</p>
                                                <h4 className="text-xs font-bold text-slate-900 uppercase">
                                                    {manager?.name || "VACANT POSITION"}
                                                </h4>
                                            </div>
                                        </div>
                                        {manager ? (
                                            <div className="flex items-center gap-2 px-2 py-1 bg-emerald-50 rounded-md border border-emerald-100">
                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                                <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Authorized</span>
                                            </div>
                                        ) : (
                                            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">Unmanaged</span>
                                        )}
                                    </div>
                                </div>

                                <div className="mt-6 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Network Online</p>
                                    </div>
                                    <button className="h-10 px-4 bg-slate-900 text-white text-[10px] font-bold uppercase tracking-widest rounded-xl hover:bg-emerald-600 transition-all flex items-center gap-2 shadow-sm">
                                        <Shield className="h-3.5 w-3.5" />
                                        Audit Access
                                    </button>
                                </div>
                            </div>
                        );
                    })
                )}
                {!loading && stores.length === 0 && (
                     <div className="col-span-full h-80 bg-white border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center gap-4 text-center p-8">
                        <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-200 shadow-inner">
                            <Store className="h-8 w-8" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Network Grid Offline</p>
                            <p className="text-xs text-slate-400 mt-1">Register a new store node to establish connection.</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
