"use client";

import { useState, useEffect } from "react";
import api from "@/services/api";
import { toast } from "sonner";
import {
    BarChart3, Calendar, Store, Download, Search, ArrowUpDown,
    TrendingUp, Package, AlertTriangle, RefreshCw, Sparkles, Filter
} from "lucide-react";
import { useUserStore } from "@/store/useUserStore";
import { cn } from "@/lib/utils";

export default function DailyProductReportPage() {
    const { user } = useUserStore();
    const [reportData, setReportData] = useState<any[]>([]);
    const [totals, setTotals] = useState<any>({
        totalProducts: 0,
        totalRevenue: 0,
        totalSoldUnits: 0,
        totalInwardedUnits: 0,
        totalMortalityLoss: 0
    });
    const [locations, setLocations] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [selectedLocation, setSelectedLocation] = useState<string>("ALL");
    const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
    const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
    const [searchQuery, setSearchQuery] = useState("");
    const [sortBy, setSortBy] = useState<string>("revenue");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
    const [loading, setLoading] = useState(true);

    const isStoreAdmin = user?.role === "STORE_ADMIN";

    useEffect(() => {
        fetchLocations();
        fetchCategories();
    }, []);

    useEffect(() => {
        fetchDailyReport();
    }, [date, selectedLocation, selectedCategory]);

    const fetchLocations = async () => {
        try {
            const res = await api.get("/locations");
            setLocations(res.data || []);
            if (isStoreAdmin && user?.locationId) {
                setSelectedLocation(user.locationId);
            }
        } catch { /* Silent */ }
    };

    const fetchCategories = async () => {
        try {
            const res = await api.get("/categories");
            setCategories(res.data || []);
        } catch { /* Silent */ }
    };

    const fetchDailyReport = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.set("date", date);
            if (selectedLocation !== "ALL") params.set("locationId", selectedLocation);
            if (selectedCategory !== "ALL") params.set("categoryId", selectedCategory);
            if (searchQuery) params.set("search", searchQuery);

            const res = await api.get(`/dashboard/daily-product-reports?${params.toString()}`);
            setReportData(res.data?.report || []);
            setTotals(res.data?.totals || {
                totalProducts: 0,
                totalRevenue: 0,
                totalSoldUnits: 0,
                totalInwardedUnits: 0,
                totalMortalityLoss: 0
            });
        } catch (err: any) {
            toast.error("Failed to load daily product report");
        } finally {
            setLoading(false);
        }
    };

    const handleSort = (field: string) => {
        if (sortBy === field) {
            setSortOrder(sortOrder === "asc" ? "desc" : "asc");
        } else {
            setSortBy(field);
            setSortOrder("desc");
        }
    };

    const sortedReport = [...reportData].sort((a, b) => {
        let valA = a[sortBy];
        let valB = b[sortBy];
        if (typeof valA === "string") valA = valA.toLowerCase();
        if (typeof valB === "string") valB = valB.toLowerCase();
        if (valA < valB) return sortOrder === "asc" ? -1 : 1;
        if (valA > valB) return sortOrder === "asc" ? 1 : -1;
        return 0;
    });

    const exportToCSV = () => {
        if (reportData.length === 0) return toast.error("No data to export");
        const headers = ["Product Name", "SKU", "Category", "Unit", "Opening Stock", "Inwarded Qty", "Sold Qty", "Revenue (INR)", "Mortality Qty", "Mortality Loss (INR)", "Closing Stock", "Avg Selling Price (INR)"];
        const rows = sortedReport.map(r => [
            `"${r.name}"`,
            `"${r.sku}"`,
            `"${r.category}"`,
            r.weightUnit,
            r.openingStock,
            r.inwardedQty,
            r.soldQty,
            r.revenue,
            r.mortalityQty,
            r.mortalityLoss,
            r.closingStock,
            r.avgSellingPrice
        ]);

        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `daily_product_report_${date}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-full text-emerald-700 dark:text-emerald-300 text-xs font-bold mb-2">
                        <Sparkles className="w-3.5 h-3.5" /> Item-Level Retail Intelligence
                    </div>
                    <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
                        <BarChart3 className="h-8 w-8 text-emerald-500" />
                        Daily Product Sales & Stock Report
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">
                        Daily inventory movements, sales revenue, inwarded PO stock, and mortality breakdown for every item.
                    </p>
                </div>

                <button
                    onClick={exportToCSV}
                    className="px-5 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-950 hover:bg-slate-800 font-bold rounded-xl text-sm transition-all shadow-md flex items-center gap-2 cursor-pointer"
                >
                    <Download className="w-4 h-4" /> Export CSV Report
                </button>
            </div>

            {/* Summary KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/80 rounded-2xl shadow-xs space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Sales Revenue</span>
                    <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">₹{Number(totals.totalRevenue || 0).toLocaleString("en-IN")}</p>
                </div>
                <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/80 rounded-2xl shadow-xs space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Units Sold</span>
                    <p className="text-2xl font-black text-slate-900 dark:text-white">{Number(totals.totalSoldUnits || 0).toLocaleString("en-IN")}</p>
                </div>
                <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/80 rounded-2xl shadow-xs space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Inwarded from POs</span>
                    <p className="text-2xl font-black text-teal-600 dark:text-teal-400">{Number(totals.totalInwardedUnits || 0).toLocaleString("en-IN")}</p>
                </div>
                <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/80 rounded-2xl shadow-xs space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Wastage / Mortality Loss</span>
                    <p className="text-2xl font-black text-rose-600 dark:text-rose-400">₹{Number(totals.totalMortalityLoss || 0).toLocaleString("en-IN")}</p>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/80 rounded-2xl shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
                <div className="flex-1 relative w-full">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && fetchDailyReport()}
                        placeholder="Search product by name or SKU..."
                        className="w-full h-10 pl-9 pr-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none"
                    />
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                    <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="h-10 px-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none cursor-pointer"
                    />

                    <select
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="h-10 px-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
                    >
                        <option value="ALL">All Categories</option>
                        {categories.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>

                    <select
                        value={selectedLocation}
                        onChange={(e) => setSelectedLocation(e.target.value)}
                        disabled={isStoreAdmin}
                        className="h-10 px-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
                    >
                        <option value="ALL">🌐 All Stores</option>
                        {locations.map(loc => (
                            <option key={loc.id} value={loc.id}>🏬 {loc.name}</option>
                        ))}
                    </select>

                    <button
                        onClick={fetchDailyReport}
                        className="h-10 px-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                        <RefreshCw className="w-3.5 h-3.5" /> Filter
                    </button>
                </div>
            </div>

            {/* Product Table */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/80 rounded-3xl overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                            <tr>
                                <th onClick={() => handleSort("name")} className="py-3.5 px-4 cursor-pointer hover:text-slate-700">Product & Category</th>
                                <th onClick={() => handleSort("openingStock")} className="py-3.5 px-3 cursor-pointer text-right hover:text-slate-700">Opening</th>
                                <th onClick={() => handleSort("inwardedQty")} className="py-3.5 px-3 cursor-pointer text-right text-teal-600 dark:text-teal-400 hover:text-teal-700">+ Inward (PO)</th>
                                <th onClick={() => handleSort("soldQty")} className="py-3.5 px-3 cursor-pointer text-right text-emerald-600 dark:text-emerald-400 hover:text-emerald-700">- Sold Qty</th>
                                <th onClick={() => handleSort("revenue")} className="py-3.5 px-3 cursor-pointer text-right font-black text-emerald-600 dark:text-emerald-400 hover:text-emerald-700">Revenue (₹)</th>
                                <th onClick={() => handleSort("mortalityQty")} className="py-3.5 px-3 cursor-pointer text-right text-rose-500 hover:text-rose-600">- Spoilage</th>
                                <th onClick={() => handleSort("closingStock")} className="py-3.5 px-3 cursor-pointer text-right font-bold text-slate-900 dark:text-white hover:text-emerald-500">Closing Stock</th>
                                <th onClick={() => handleSort("avgSellingPrice")} className="py-3.5 px-4 cursor-pointer text-right hover:text-slate-700">Avg Price (₹)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                            {loading ? (
                                <tr>
                                    <td colSpan={8} className="py-16 text-center text-slate-400">Loading daily product metrics...</td>
                                </tr>
                            ) : sortedReport.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="py-16 text-center text-slate-400">No product sales or stock movement found for this date.</td>
                                </tr>
                            ) : (
                                sortedReport.map((p) => (
                                    <tr key={p.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                                        <td className="py-3.5 px-4">
                                            <p className="font-bold text-slate-900 dark:text-white">{p.name}</p>
                                            <p className="text-[10px] text-slate-400 font-mono">{p.sku} • {p.category} ({p.weightUnit})</p>
                                        </td>
                                        <td className="py-3.5 px-3 text-right font-mono text-slate-600 dark:text-slate-400">{p.openingStock}</td>
                                        <td className="py-3.5 px-3 text-right font-mono font-bold text-teal-600 dark:text-teal-400">
                                            {p.inwardedQty > 0 ? `+${p.inwardedQty}` : "0"}
                                        </td>
                                        <td className="py-3.5 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                            {p.soldQty > 0 ? `${p.soldQty}` : "0"}
                                        </td>
                                        <td className="py-3.5 px-3 text-right font-mono font-black text-emerald-600 dark:text-emerald-400">
                                            ₹{p.revenue.toLocaleString("en-IN")}
                                        </td>
                                        <td className="py-3.5 px-3 text-right font-mono text-rose-500">
                                            {p.mortalityQty > 0 ? `${p.mortalityQty} (₹${p.mortalityLoss})` : "0"}
                                        </td>
                                        <td className="py-3.5 px-3 text-right font-mono font-black text-slate-900 dark:text-white">
                                            <span className={cn(
                                                "px-2 py-0.5 rounded-md",
                                                p.closingStock <= 5 ? "bg-rose-50 text-rose-600 dark:bg-rose-950/50" : "bg-slate-100 dark:bg-slate-800"
                                            )}>
                                                {p.closingStock} {p.weightUnit}
                                            </span>
                                        </td>
                                        <td className="py-3.5 px-4 text-right font-mono text-slate-600 dark:text-slate-400">
                                            ₹{p.avgSellingPrice.toFixed(2)}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
