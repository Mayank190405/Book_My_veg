"use client";

import { use, useState, useEffect } from "react";
import {
    Users, Package, TrendingUp, AlertCircle,
    ChevronRight, Calendar, CreditCard, Filter,
    Plus, Upload, Trash2, Globe, Eye, History,
    Search, AlertTriangle
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/services/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import Link from "next/link";

export default function StoreAdminDashboard({ params }: any) {
    const { locationSlug } = use(params) as any;
    const [activeTab, setActiveTab] = useState("overview");
    const [selectedProducts, setSelectedProducts] = useState<string[]>([]);

    // ── Queries ───────────────────────────────────────────────────────
    const { data: storeInfo } = useQuery({
        queryKey: ["store", locationSlug],
        queryFn: async () => {
            const res = await api.get(`/locations/slug/${locationSlug}`);
            return res.data;
        }
    });

    const { data: staff } = useQuery({
        queryKey: ["staff", storeInfo?.id],
        enabled: !!storeInfo?.id,
        queryFn: async () => {
            const res = await api.get(`/hr/staff?locationId=${storeInfo.id}`);
            return res.data;
        }
    });

    const { data: stats } = useQuery({
        queryKey: ["store-stats", storeInfo?.id],
        enabled: !!storeInfo?.id,
        queryFn: async () => {
            const res = await api.get(`/analytics/dashboard?locationId=${storeInfo.id}`);
            return res.data;
        }
    });

    const { data: mortalityLogs } = useQuery({
        queryKey: ["mortality", storeInfo?.id],
        enabled: !!storeInfo?.id,
        queryFn: async () => {
            const res = await api.get(`/mortality/list?locationId=${storeInfo.id}`);
            return res.data;
        }
    });

    const weeklyMortality = mortalityLogs?.reduce((acc: number, l: any) => acc + (l.quantity * (l.product?.basePrice || 0)), 0) || 0;

    return (
        <div className="space-y-8 pb-12">
            {/* Header */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm transition-all duration-500 hover:shadow-xl">
                <div>
                    <h1 className="text-4xl font-black text-gray-900 tracking-tight mb-2">
                        {storeInfo?.name || "Hub Control"}
                    </h1>
                    <div className="flex items-center gap-4 text-gray-500 text-sm font-black uppercase tracking-widest">
                        <div className="flex items-center gap-2">
                            <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                            Live Hub Status • {locationSlug}
                        </div>
                        {storeInfo?.slug && (
                            <Link href={`/pos/${storeInfo.slug}`} className="px-4 py-1.5 bg-gray-900 text-white rounded-xl shadow-sm hover:bg-black transition-all active:scale-95 text-[10px]">
                                Launch POS Station
                            </Link>
                        )}
                    </div>
                </div>
                <div className="flex gap-2 bg-gray-50 p-1.5 rounded-2xl border border-gray-100 overflow-x-auto no-scrollbar">
                    <TabButton active={activeTab === "overview"} onClick={() => setActiveTab("overview")} label="Overview" />
                    <TabButton active={activeTab === "staff"} onClick={() => setActiveTab("staff")} label="Staff" />
                    <TabButton active={activeTab === "inventory"} onClick={() => setActiveTab("inventory")} label="Inventory" />
                    <TabButton active={activeTab === "mortality"} onClick={() => setActiveTab("mortality")} label="Mortality" />
                    <TabButton active={activeTab === "costs"} onClick={() => setActiveTab("costs")} label="Costs" />
                </div>
            </header>

            {/* Quick Summary Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <MiniStatCard
                    title="Revenue Today"
                    value={`₹${(stats?.summary?.totalAmount || 0).toLocaleString()}`}
                    change="+12.5%"
                    icon={<TrendingUp className="h-6 w-6 text-green-600" />}
                    color="bg-green-50"
                />
                <MiniStatCard
                    title="Active Workers"
                    value={`${staff?.filter((s: any) => s.attendances?.length > 0).length || 0}/${staff?.length || 0}`}
                    icon={<Users className="h-6 w-6 text-blue-600" />}
                    color="bg-blue-50"
                />
                <MiniStatCard
                    title="Low Stock"
                    value="4 items"
                    icon={<AlertCircle className="h-6 w-6 text-orange-600" />}
                    color="bg-orange-50"
                />
                <MiniStatCard
                    title="Loss (Wastage)"
                    value={`₹${weeklyMortality.toLocaleString()}`}
                    icon={<AlertTriangle className="h-6 w-6 text-red-600" />}
                    color="bg-red-50"
                />
            </div>

            {/* Tab Content */}
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                {activeTab === "overview" && <StoreOverview stats={stats} />}
                {activeTab === "staff" && <StaffManagement staff={staff} locationId={storeInfo?.id} />}
                {activeTab === "inventory"}
                {activeTab === "inventory" && <StoreInventoryManagement storeId={storeInfo?.id} selectedProducts={selectedProducts} setSelectedProducts={setSelectedProducts} />}
                {activeTab === "mortality" && <MortalityManagement locationId={storeInfo?.id} logs={mortalityLogs} />}
                {activeTab === "costs" && <CostManagement locationId={storeInfo?.id} />}
            </div>
        </div>
    );
}

function TabButton({ active, onClick, label }: any) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "px-8 py-2.5 rounded-xl font-black text-sm transition-all duration-300",
                active
                    ? "bg-white text-gray-900 shadow-md translate-y-[-1px]"
                    : "text-gray-400 hover:text-gray-600"
            )}
        >
            {label}
        </button>
    );
}

function MiniStatCard({ title, value, change, icon, color }: any) {
    return (
        <div className="bg-white p-7 rounded-[2.5rem] border border-gray-100 shadow-sm transition-all hover:shadow-xl group">
            <div className="flex items-center justify-between mb-4">
                <span className={cn("p-3 rounded-2xl shadow-inner transition-transform group-hover:scale-110", color)}>{icon}</span>
                {change && <span className="text-[10px] font-black text-green-600 bg-green-50 px-3 py-1.5 rounded-full">{change}</span>}
            </div>
            <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">{title}</p>
            <p className="text-3xl font-black text-gray-900 tracking-tight">{value}</p>
        </div>
    );
}

function StoreOverview({ stats }: any) {
    const summary = stats?.summary || {};

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-10 h-[400px] flex flex-col justify-center items-center">
                <div className="w-full h-full flex flex-col items-center justify-center space-y-6">
                    <h3 className="font-black text-gray-900 text-2xl">Today's Performance</h3>
                    <div className="grid grid-cols-2 gap-8 w-full max-w-lg">
                        <div className="bg-green-50 rounded-3xl p-6 text-center">
                            <p className="text-xs text-green-600 font-black uppercase tracking-widest mb-2">Total Sales</p>
                            <p className="text-4xl font-black text-green-700">₹{Number(summary.totalAmount || 0).toLocaleString()}</p>
                        </div>
                        <div className="bg-blue-50 rounded-3xl p-6 text-center">
                            <p className="text-xs text-blue-600 font-black uppercase tracking-widest mb-2">Orders Processed</p>
                            <p className="text-4xl font-black text-blue-700">{summary.orderCount || 0}</p>
                        </div>
                    </div>
                </div>
            </div>
            <div className="space-y-8">
                <div className="bg-gray-900 rounded-[2.5rem] p-8 text-white shadow-2xl h-[400px] flex flex-col justify-between">
                    <h3 className="font-black flex items-center gap-2 text-sm opacity-60 uppercase tracking-widest">Hub Analytics</h3>
                    <div className="space-y-6 flex-1 flex flex-col justify-center">
                        <HealthItem label="Sales Cash vs Online" value={`${summary.cashRatio || "50/50"}%`} color="bg-indigo-500" />
                        <HealthItem label="Avg Order Value" value={`₹${summary.averageOrderValue || 0}`} color="bg-green-500" />
                        <HealthItem label="Active Shifts" value={summary.activeShifts || 1} color="bg-orange-500" />
                    </div>
                </div>
            </div>
        </div>
    );
}

function HealthItem({ label, value, color }: any) {
    return (
        <div>
            <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">{label}</p>
                <p className="text-lg font-black">{value}</p>
            </div>
            <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                <div className={cn("h-full rounded-full transition-all duration-1000", color)} style={{ width: value }} />
            </div>
        </div>
    );
}

function StaffManagement({ staff, locationId }: any) {
    const queryClient = useQueryClient();
    const [isAddWorkerOpen, setIsAddWorkerOpen] = useState(false);

    const checkInMutation = useMutation({
        mutationFn: (staffId: string) => api.post("/hr/attendance/check-in", { staffId, locationId }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["store-staff"] });
            toast.success("Worker Checked IN");
        }
    });

    const checkOutMutation = useMutation({
        mutationFn: (staffId: string) => api.post("/hr/attendance/check-out", { staffId }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["store-staff"] });
            toast.success("Worker Checked OUT");
        }
    });

    return (
        <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden p-8 space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-2xl font-black text-gray-900 tracking-tight">Worker Hub</h3>
                    <p className="text-sm text-gray-400 font-medium">Attendance & Salary Management</p>
                </div>
                <button onClick={() => setIsAddWorkerOpen(true)} className="bg-gray-900 text-white px-8 py-3 rounded-2xl font-black text-sm active:scale-95 shadow-lg flex items-center gap-2 hover:bg-black transition-all">
                    <Plus className="h-4 w-4" /> Register Worker
                </button>
            </div>

            <AddWorkerModal isOpen={isAddWorkerOpen} onClose={() => setIsAddWorkerOpen(false)} locationId={locationId} />
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead>
                        <tr className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-50">
                            <th className="pb-6">Personnel</th>
                            <th className="pb-6">Status</th>
                            <th className="pb-6">Compensation</th>
                            <th className="pb-6 text-right">Activity</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {staff?.map((s: any) => (
                            <tr key={s.id} className="group hover:bg-gray-50 transition-colors">
                                <td className="py-6">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center font-black text-gray-400 group-hover:bg-green-100 group-hover:text-green-600 transition-all shadow-inner">
                                            {s.name?.charAt(0) || "U"}
                                        </div>
                                        <div>
                                            <p className="font-black text-gray-900">{s.name}</p>
                                            <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">{s.role}</span>
                                        </div>
                                    </div>
                                </td>
                                <td className="py-6">
                                    {s.attendances?.length > 0 && !s.attendances[0].checkOut ? (
                                        <span className="px-3 py-1.5 bg-green-50 text-green-600 rounded-xl text-[10px] font-black uppercase flex items-center w-fit gap-2">
                                            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                                            Active
                                        </span>
                                    ) : (
                                        <span className="px-3 py-1.5 bg-gray-50 text-gray-400 rounded-xl text-[10px] font-black uppercase flex items-center w-fit gap-2">
                                            <span className="w-1.5 h-1.5 bg-gray-300 rounded-full" />
                                            Offline
                                        </span>
                                    )}
                                </td>
                                <td className="py-6 font-black text-gray-900">₹{Number(s.salary || 0).toLocaleString()}</td>
                                <td className="py-6 text-right">
                                    {s.attendances?.length > 0 && !s.attendances[0].checkOut ? (
                                        <button
                                            onClick={() => checkOutMutation.mutate(s.id)}
                                            disabled={checkOutMutation.isPending}
                                            className="bg-red-50 text-red-600 px-4 py-2 rounded-xl font-black text-xs hover:bg-red-100 transition-all active:scale-95 disabled:opacity-50"
                                        >
                                            Check Out
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => checkInMutation.mutate(s.id)}
                                            disabled={checkInMutation.isPending}
                                            className="bg-green-50 text-green-600 px-4 py-2 rounded-xl font-black text-xs hover:bg-green-100 transition-all active:scale-95 disabled:opacity-50"
                                        >
                                            Check In
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function StoreInventoryManagement({ storeId, selectedProducts, setSelectedProducts }: any) {
    const queryClient = useQueryClient();
    const [isAddProductOpen, setIsAddProductOpen] = useState(false);
    const { data: products, isLoading } = useQuery({
        queryKey: ["store-products", storeId],
        enabled: !!storeId,
        queryFn: async () => {
            const res = await api.get(`/products?locationId=${storeId}&limit=100`);
            return res.data.data;
        }
    });

    const bulkDeleteMutation = useMutation({
        mutationFn: (ids: string[]) => api.post("/maintenance/products/bulk-delete", { productIds: ids }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["store-products"] });
            setSelectedProducts([]);
            toast.success("Selected products deleted");
        }
    });

    const bulkImportMutation = useMutation({
        mutationFn: (file: File) => {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("locationId", storeId);
            return api.post("/maintenance/products/bulk-import", formData);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["store-products"] });
            toast.success("Bulk import successful");
        },
        onError: () => toast.error("Bulk import failed")
    });

    const togglePublishMutation = useMutation({
        mutationFn: (data: { productId: string, isPublished: boolean }) =>
            api.post("/maintenance/products/toggle-publishing", data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["store-products"] });
            toast.success("Visibility updated");
        }
    });

    const handleToggleSelect = (id: string) => {
        setSelectedProducts((prev: string[]) =>
            prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
        );
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) bulkImportMutation.mutate(file);
    };

    return (
        <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-10 space-y-8 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-2xl font-black text-gray-900 tracking-tight">Product Registry</h3>
                    <p className="text-sm text-gray-400 font-medium">Manage stock and catalog for this hub</p>
                </div>
                <div className="flex gap-4">
                    {selectedProducts.length > 0 && (
                        <button
                            onClick={() => bulkDeleteMutation.mutate(selectedProducts)}
                            className="bg-red-50 text-red-600 px-6 py-3 rounded-2xl font-black text-sm active:scale-95 flex items-center gap-2 border border-red-100"
                        >
                            <Trash2 className="h-4 w-4" /> Delete {selectedProducts.length}
                        </button>
                    )}
                    <label className="bg-white border border-gray-200 text-gray-600 px-6 py-3 rounded-2xl font-black text-sm active:scale-95 flex items-center gap-2 cursor-pointer hover:bg-gray-50 transition-all">
                        <Upload className="h-4 w-4" /> Bulk Upload
                        <input type="file" className="hidden" accept=".xlsx,.xls" onChange={handleFileUpload} />
                    </label>
                    <button onClick={() => setIsAddProductOpen(true)} className="bg-green-600 text-white px-8 py-3 rounded-2xl font-black text-sm active:scale-95 shadow-lg flex items-center gap-2 hover:bg-green-700 transition-all">
                        <Plus className="h-4 w-4" /> Add Product
                    </button>
                </div>
            </div>

            <AddProductModal isOpen={isAddProductOpen} onClose={() => setIsAddProductOpen(false)} />

            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead>
                        <tr className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-50">
                            <th className="pb-6 px-4">
                                <input
                                    type="checkbox"
                                    className="rounded border-gray-300"
                                    onChange={(e) => {
                                        if (e.target.checked) setSelectedProducts(products?.map((p: any) => p.id) || []);
                                        else setSelectedProducts([]);
                                    }}
                                />
                            </th>
                            <th className="pb-6">Product</th>
                            <th className="pb-6">SKU</th>
                            <th className="pb-6">Stock</th>
                            <th className="pb-6 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {products?.map((p: any) => (
                            <tr key={p.id} className="group hover:bg-gray-50 transition-colors">
                                <td className="py-6 px-4">
                                    <input
                                        type="checkbox"
                                        checked={selectedProducts.includes(p.id)}
                                        onChange={() => handleToggleSelect(p.id)}
                                        className="rounded border-gray-300"
                                    />
                                </td>
                                <td className="py-6">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center font-black text-gray-400">
                                            <Package className="h-6 w-6" />
                                        </div>
                                        <p className="font-black text-gray-900">{p.name}</p>
                                    </div>
                                </td>
                                <td className="py-6 font-mono text-[10px] font-black">{p.sku || "NO-SKU"}</td>
                                <td className="py-6">
                                    <span className={cn(
                                        "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest",
                                        p.stock > 10 ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
                                    )}>
                                        {p.stock} {p.weightUnit}
                                    </span>
                                </td>
                                <td className="py-6 text-right">
                                    <div className="flex justify-end gap-2">
                                        <button
                                            onClick={() => togglePublishMutation.mutate({ productId: p.id, isPublished: !p.isActive })}
                                            className={cn(
                                                "p-3 rounded-xl border transition-all",
                                                p.isActive ? "bg-green-50 border-green-100 text-green-600" : "bg-gray-50 border-gray-100 text-gray-400"
                                            )}
                                            title={p.isActive ? "Published to Web" : "Hidden from Web"}
                                        >
                                            <Globe className="h-4 w-4" />
                                        </button>
                                        <button className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm text-gray-400 hover:text-gray-900 transition-all">
                                            <Eye className="h-4 w-4" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <AddProductModal isOpen={isAddProductOpen} onClose={() => setIsAddProductOpen(false)} />
        </div>
    );
}

function CostManagement({ locationId }: { locationId: string }) {
    const queryClient = useQueryClient();
    const { data: costs } = useQuery({
        queryKey: ["store-costs", locationId],
        enabled: !!locationId,
        queryFn: async () => {
            const res = await api.get(`/maintenance/costs/${locationId}`);
            return res.data;
        }
    });

    const mutation = useMutation({
        mutationFn: (data: any) => api.post("/maintenance/costs", { ...data, locationId }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["store-costs"] });
            toast.success("Expense Recorded");
        }
    });

    const handleSubmit = (e: any) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target));
        mutation.mutate(data);
        e.target.reset();
    };

    return (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 animate-in fade-in duration-500">
            <div className="bg-white rounded-[2.5rem] border border-gray-100 p-10 shadow-sm space-y-8">
                <div>
                    <h3 className="text-2xl font-black text-gray-900 tracking-tight">Record Expense</h3>
                    <p className="text-sm text-gray-400 font-medium">Log rent, salaries, or utility costs</p>
                </div>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Category</label>
                            <select name="category" required className="w-full px-6 py-4 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-indigo-500 font-black text-sm">
                                <option value="RENT">Rent</option>
                                <option value="SALARY">Staff Salaries</option>
                                <option value="UTILITY">Electricity / Water</option>
                                <option value="MAINTENANCE">Maintenance</option>
                                <option value="MISC">Miscellaneous</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Amount (₹)</label>
                            <input type="number" name="amount" required className="w-full px-6 py-4 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-indigo-500 font-black text-sm" placeholder="0.00" />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Description</label>
                        <input name="description" required className="w-full px-6 py-4 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-indigo-500 font-bold text-sm" placeholder="e.g. January 2024 Rent" />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Billing Date</label>
                        <input type="date" name="date" required className="w-full px-6 py-4 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-indigo-500 font-black text-sm" defaultValue={new Date().toISOString().split('T')[0]} />
                    </div>
                    <button type="submit" disabled={mutation.isPending} className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black text-lg shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50">
                        {mutation.isPending ? "Logging..." : "Confirm Expense Entry"}
                    </button>
                </form>
            </div>

            <div className="bg-white rounded-[2.5rem] border border-gray-100 p-10 shadow-sm space-y-8">
                <h3 className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                    <History className="h-5 w-5 text-gray-400" /> Expense History
                </h3>
                <div className="space-y-4">
                    {costs?.map((cost: any) => (
                        <div key={cost.id} className="p-6 bg-gray-50 rounded-3xl border border-gray-100 flex items-center justify-between">
                            <div>
                                <p className="font-black text-gray-900">{cost.description}</p>
                                <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">
                                    {new Date(cost.date).toLocaleDateString()} • {cost.category}
                                </p>
                            </div>
                            <p className="text-lg font-black text-indigo-600">₹{Number(cost.amount).toLocaleString()}</p>
                        </div>
                    ))}
                    {(!costs || costs.length === 0) && (
                        <div className="py-20 flex flex-col items-center justify-center text-gray-300 gap-4">
                            <CreditCard className="h-12 w-12 opacity-20" />
                            <p className="font-black text-xs uppercase tracking-widest opacity-30">No expenses recorded</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function MortalityManagement({ locationId, logs }: { locationId: string, logs: any[] }) {
    const queryClient = useQueryClient();
    const { data: products } = useQuery({
        queryKey: ["all-products"],
        queryFn: async () => {
            const res = await api.get("/products?limit=100");
            return res.data.data;
        }
    });

    const mutation = useMutation({
        mutationFn: (data: any) => api.post("/mortality/log", { ...data, locationId }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["mortality", locationId] });
            toast.success("Mortality Logged Successfully");
        },
        onError: (err: any) => toast.error(err.response?.data?.message || "Failed to log mortality")
    });

    const handleSubmit = (e: any) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target));
        mutation.mutate({
            productId: data.productId,
            quantity: parseFloat(data.quantity as string),
            reason: data.reason,
            notes: data.notes
        });
        e.target.reset();
    };

    return (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            {/* Logging Form */}
            <div className="bg-white rounded-[2.5rem] border border-gray-100 p-10 shadow-sm space-y-8">
                <div>
                    <h3 className="text-2xl font-black text-gray-900 tracking-tight">Log Wastage</h3>
                    <p className="text-sm text-gray-400 font-medium">Record damage, leakage or expiry</p>
                </div>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Select Product</label>
                            <select name="productId" required className="w-full px-6 py-4 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-red-500 font-black text-sm">
                                {products?.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Quantity (KG/PCS)</label>
                            <input type="number" step="0.01" name="quantity" required className="w-full px-6 py-4 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-red-500 font-black text-sm" placeholder="0.00" />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Reason for Loss</label>
                        <select name="reason" className="w-full px-6 py-4 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-red-500 font-black text-sm">
                            <option value="DAMAGE">Physical Damage</option>
                            <option value="LEAKAGE">Leakage / Spillage</option>
                            <option value="EXPIRY">Product Expiry</option>
                            <option value="QUALITY_ISSUE">Quality Discard</option>
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Operational Notes</label>
                        <textarea name="notes" className="w-full px-6 py-4 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-red-500 font-bold text-sm min-h-[100px]" placeholder="Explain why wastage happened..." />
                    </div>
                    <button type="submit" disabled={mutation.isPending} className="w-full bg-red-600 text-white py-5 rounded-2xl font-black text-lg shadow-xl shadow-red-100 hover:bg-red-700 transition-all active:scale-95 disabled:opacity-50">
                        {mutation.isPending ? "Recording Loss..." : "Confirm Mortality Entry"}
                    </button>
                </form>
            </div>

            {/* Recent Logs Table */}
            <div className="bg-white rounded-[2.5rem] border border-gray-100 p-10 shadow-sm space-y-8">
                <h3 className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                    <History className="h-5 w-5 text-gray-400" /> Recent Mortality History
                </h3>
                <div className="space-y-4">
                    {logs?.map((log: any) => (
                        <div key={log.id} className="p-6 bg-gray-50 rounded-3xl border border-gray-100 flex items-center justify-between group hover:bg-white hover:shadow-xl transition-all">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center text-red-600 shadow-inner">
                                    <Package className="h-6 w-6" />
                                </div>
                                <div>
                                    <p className="font-black text-gray-900">{log.product.name}</p>
                                    <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">
                                        {new Date(log.createdAt).toLocaleDateString()} • {log.reason}
                                    </p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-lg font-black text-red-600">-{log.quantity}</p>
                                <p className="text-[10px] text-gray-400 font-black uppercase">{log.product.weightUnit}</p>
                            </div>
                        </div>
                    ))}
                    {(!logs || logs.length === 0) && (
                        <div className="py-20 flex flex-col items-center justify-center text-gray-300 gap-4">
                            <AlertCircle className="h-12 w-12 opacity-20" />
                            <p className="font-black text-xs uppercase tracking-widest opacity-30">No wastage recorded yet</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Modals ────────────────────────────────────────────────────────────

function AddWorkerModal({ isOpen, onClose, locationId }: any) {
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in duration-300 p-4">
            <div className="bg-white rounded-[2.5rem] p-8 max-w-xl w-full shadow-2xl space-y-8" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-black text-gray-900">Register Worker</h2>
                        <p className="text-sm font-bold text-gray-400">Add staff to this hub</p>
                    </div>
                    <button onClick={onClose} className="p-2 bg-gray-50 text-gray-400 rounded-xl hover:bg-gray-100 hover:text-gray-900 active:scale-90 transition-all">✕</button>
                </div>
                <form className="space-y-6" onSubmit={async (e: any) => {
                    e.preventDefault();
                    if (isSubmitting) return;
                    setIsSubmitting(true);

                    const data = Object.fromEntries(new FormData(e.target));
                    try {
                        await api.post("/user-analytics/create-staff", { ...data, locationId });
                        toast.success("Worker Created!");
                        onClose();
                    } catch (error: any) {
                        toast.error(error.response?.data?.message || "Failed to create user. This phone number might already be registered.");
                    } finally {
                        setIsSubmitting(false);
                    }
                }}>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Full Name</label>
                            <input name="name" required placeholder="John Doe" className="w-full px-6 py-4 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-indigo-500 font-bold text-sm text-gray-900" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Phone Number</label>
                            <input name="phone" required placeholder="91XXXXXXXX" className="w-full px-6 py-4 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-indigo-500 font-bold text-sm text-gray-900" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Access Role</label>
                            <select name="role" className="w-full px-6 py-4 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-indigo-500 font-bold text-sm text-gray-900">
                                <option value="ADMIN">Hub Admin</option>
                                <option value="CASHIER">POS Operator</option>
                                <option value="PACKER">Packer</option>
                                <option value="DRIVER">Driver</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Account Password</label>
                            <input name="password" type="password" required placeholder="••••••••" className="w-full px-6 py-4 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-indigo-500 font-bold text-sm text-gray-900" />
                        </div>
                    </div>
                    <button disabled={isSubmitting} type="submit" className="w-full bg-gray-900 text-white rounded-2xl py-5 font-black text-lg hover:bg-black disabled:opacity-50 active:scale-95 transition-all shadow-xl shadow-gray-200 uppercase tracking-widest">
                        {isSubmitting ? "Registering..." : "Submit Creation"}
                    </button>
                </form>
            </div>
        </div>
    );
}

function AddProductModal({ isOpen, onClose }: any) {
    const queryClient = useQueryClient();
    const { data: categories } = useQuery({
        queryKey: ["categories"],
        queryFn: async () => {
            const res = await api.get("/categories");
            return res.data;
        }
    });

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in duration-300 p-4">
            <div className="bg-white rounded-[2.5rem] p-8 max-w-xl w-full shadow-2xl space-y-8" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-black text-gray-900">Add New Product</h2>
                        <p className="text-sm font-bold text-gray-400">Add item to catalog</p>
                    </div>
                    <button onClick={onClose} className="p-2 bg-gray-50 text-gray-400 rounded-xl hover:bg-gray-100 hover:text-gray-900 active:scale-90 transition-all">✕</button>
                </div>
                <form className="space-y-6" onSubmit={(e: any) => {
                    e.preventDefault();
                    const data = Object.fromEntries(new FormData(e.target));
                    api.post("/products", {
                        ...data,
                        basePrice: parseFloat(data.basePrice as string),
                        discountPrice: parseFloat((data.discountPrice || "0") as string)
                    }).then(() => {
                        toast.success("Product Created!");
                        queryClient.invalidateQueries({ queryKey: ["store-products"] });
                        queryClient.invalidateQueries({ queryKey: ["all-products"] });
                        onClose();
                    }).catch(() => toast.error("Failed to create product"));
                }}>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Product Name</label>
                        <input name="name" required placeholder="Fresh Apples" className="w-full px-6 py-4 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-green-500 font-bold text-sm text-gray-900" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">SKU</label>
                            <input name="sku" required placeholder="SKU-123" className="w-full px-6 py-4 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-green-500 font-bold text-sm text-gray-900" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Category</label>
                            <select name="categoryId" className="w-full px-6 py-4 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-green-500 font-bold text-sm text-gray-900">
                                {categories?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Base Price (₹)</label>
                            <input name="basePrice" type="number" required placeholder="100" className="w-full px-6 py-4 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-green-500 font-bold text-sm text-gray-900" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Discount Price</label>
                            <input name="discountPrice" type="number" placeholder="90" className="w-full px-6 py-4 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-green-500 font-bold text-sm text-gray-900" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Unit</label>
                            <select name="weightUnit" className="w-full px-6 py-4 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-green-500 font-bold text-sm text-gray-900">
                                <option value="KG">KG</option>
                                <option value="G">Gram</option>
                                <option value="PCS">Piece</option>
                                <option value="L">Liter</option>
                            </select>
                        </div>
                    </div>
                    <button type="submit" className="w-full bg-green-600 text-white rounded-2xl py-5 font-black text-lg hover:bg-green-700 active:scale-95 transition-all shadow-xl shadow-green-100 uppercase tracking-widest">Create Product</button>
                </form>
            </div>
        </div>
    );
}