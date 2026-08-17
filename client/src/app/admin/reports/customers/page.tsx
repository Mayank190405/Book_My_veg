"use client";

import { 
    Users, 
    TrendingUp, 
    Calendar, 
    Filter, 
    Download, 
    Search,
    Store,
    CreditCard,
    ArrowUpDown,
    ArrowUpRight,
    ArrowDownRight,
    MoreVertical,
    FileText,
    Activity,
    Clock,
    UserCheck,
    ChevronLeft,
    ChevronRight,
    HelpCircle,
    UserX,
    Coins,
    RefreshCw
} from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import api from "@/services/api";
import { toast } from "sonner";
import { format, subDays, startOfWeek, startOfMonth } from "date-fns";
import Link from "next/link";
import { initSocket } from "@/services/socketService";

export default function CustomerDuesReport() {
    const todayStr = format(new Date(), "yyyy-MM-dd");

    const [customers, setCustomers] = useState<any[]>([]);
    const [summary, setSummary] = useState<any>(null);
    const [stores, setStores] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());

    // Filter states — Default to Current Day (Today)
    const [search, setSearch] = useState("");
    const [locationId, setLocationId] = useState("");
    const [dueFilter, setDueFilter] = useState("ALL");
    const [channel, setChannel] = useState("");
    const [startDate, setStartDate] = useState(todayStr);
    const [endDate, setEndDate] = useState(todayStr);
    
    // Pagination states
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCustomers, setTotalCustomers] = useState(0);

    // Sorting states
    const [sortBy, setSortBy] = useState("totalDue");
    const [sortOrder, setSortOrder] = useState("desc");

    const fetchData = async () => {
        setLoading(true);
        try {
            const queryParams = new URLSearchParams();
            if (search) queryParams.append("search", search);
            if (locationId) queryParams.append("locationId", locationId);
            if (dueFilter !== "ALL") queryParams.append("dueFilter", dueFilter);
            if (channel) queryParams.append("channel", channel);
            if (startDate) queryParams.append("startDate", startDate);
            if (endDate) queryParams.append("endDate", endDate);
            queryParams.append("page", String(page));
            queryParams.append("limit", String(limit));
            queryParams.append("sortBy", sortBy);
            queryParams.append("sortOrder", sortOrder);

            const [reportRes, storesRes] = await Promise.all([
                api.get(`/dashboard/customer-reports?${queryParams.toString()}`),
                api.get("/locations")
            ]);

            setCustomers(reportRes.data.customers);
            setSummary(reportRes.data.summary);
            setStores(storesRes.data);
            setTotalPages(reportRes.data.pagination.totalPages);
            setTotalCustomers(reportRes.data.pagination.totalCustomers);
            setLastRefreshedAt(new Date());
        } catch (error) {
            toast.error("Failed to generate customer due intelligence report");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        setPage(1); // Reset to page 1 on filter changes
    }, [search, locationId, dueFilter, channel, startDate, endDate, sortBy, sortOrder]);

    useEffect(() => {
        fetchData();

        // Auto-refresh every 10s for real-time customer due updates
        const interval = setInterval(() => {
            fetchData();
        }, 10000);

        try {
            const socket = initSocket("customer_report_listener");
            socket.on("OP_NEW_ORDER", () => fetchData());
            socket.on("ORDER_STATUS_CHANGED", () => fetchData());
            socket.on("REALTIME_REPORT_UPDATE", () => fetchData());

            return () => {
                socket.off("OP_NEW_ORDER");
                socket.off("ORDER_STATUS_CHANGED");
                socket.off("REALTIME_REPORT_UPDATE");
                clearInterval(interval);
            };
        } catch {
            return () => clearInterval(interval);
        }
    }, [page, limit, search, locationId, dueFilter, channel, startDate, endDate, sortBy, sortOrder]);

    const handleSort = (field: string) => {
        if (sortBy === field) {
            setSortOrder(sortOrder === "asc" ? "desc" : "asc");
        } else {
            setSortBy(field);
            setSortOrder("desc");
        }
    };

    const [syncingEasebuzz, setSyncingEasebuzz] = useState(false);

    const handleSyncEasebuzz = async () => {
        setSyncingEasebuzz(true);
        try {
            const res = await api.post("/payments/easebuzz/sync", {
                startDate: startDate ? format(new Date(startDate), "dd-MM-yyyy") : undefined,
                endDate: endDate ? format(new Date(endDate), "dd-MM-yyyy") : undefined
            });
            if (res.data?.success) {
                toast.success(`Easebuzz Sync Completed! Fetched: ${res.data.totalFetched || 0}, Settled: ${res.data.totalSettled || 0}`);
                fetchData();
            } else {
                toast.warning(res.data?.message || "Easebuzz sync finished");
            }
        } catch (err: any) {
            toast.error(err.response?.data?.message || "Failed to trigger Easebuzz payment sync");
        } finally {
            setSyncingEasebuzz(false);
        }
    };

    const handleExportCSV = () => {
        if (customers.length === 0) {
            toast.warning("No customer data available to export");
            return;
        }

        const headers = ["Customer Name", "Phone", "Email", "Total Orders", "Total Spent (INR)", "Total Paid (INR)", "Outstanding Due (INR)", "Last Visit", "Registration Date"];
        const rows = customers.map(c => [
            c.name,
            c.phone,
            c.email || "N/A",
            c.orderCount,
            c.totalSpend,
            c.totalPaid,
            c.totalDue,
            c.lastVisit ? format(new Date(c.lastVisit), "yyyy-MM-dd HH:mm") : "N/A",
            format(new Date(c.createdAt), "yyyy-MM-dd")
        ]);

        const csvString = [headers.join(","), ...rows.map(r => r.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))].join("\n");
        const encodedUri = "data:text/csv;charset=utf-8,\uFEFF" + encodeURIComponent(csvString);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `customer_sales_and_dues_${format(new Date(), "yyyyMMdd_HHmmss")}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("CSV file exported successfully");
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-200">
                <div>
                    <div className="flex items-center gap-3">
                        <h2 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
                            <Users className="h-8 w-8 text-emerald-600" />
                            Daily Customer Dues & Sales
                        </h2>
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-full text-emerald-700 text-xs font-black uppercase tracking-wider animate-pulse">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                            Live Realtime
                        </span>
                    </div>
                    <p className="text-sm text-slate-500 mt-1">
                        Real-time daily tracking of customer outstanding balances, purchase history, and chronological sales ledgers across outlets.
                    </p>
                </div>
                
                <div className="flex items-center gap-3 flex-wrap">
                    <button 
                        onClick={handleSyncEasebuzz}
                        disabled={syncingEasebuzz}
                        className="h-11 px-5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all flex items-center gap-2 active:scale-95 shadow-lg shadow-teal-600/20 disabled:opacity-50"
                        title="Fetch & reconcile online payments from Easebuzz gateway"
                    >
                        <RefreshCw className={cn("h-4 w-4", syncingEasebuzz && "animate-spin")} />
                        <span>{syncingEasebuzz ? "Syncing..." : "Sync Online Payments"}</span>
                    </button>

                    <button 
                        onClick={fetchData} 
                        className="h-11 px-5 bg-slate-900 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-emerald-600 transition-all flex items-center gap-2 active:scale-95 shadow-lg shadow-slate-200"
                    >
                        <Activity className="h-4 w-4" />
                        Live Refresh ({format(lastRefreshedAt, "HH:mm:ss")})
                    </button>

                    <button 
                        onClick={handleExportCSV}
                        className="h-11 w-11 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-500 hover:text-emerald-600 hover:border-emerald-500/30 transition-all shadow-sm active:scale-95"
                        title="Export filtered records to CSV"
                    >
                        <Download className="h-5 w-5" />
                    </button>
                </div>
            </div>

            {/* Filter Suite with Date Quick Presets */}
            <div className="bg-white rounded-[2rem] border border-slate-100 p-8 shadow-xl shadow-slate-500/5 space-y-6">
                {/* Date Presets Bar */}
                <div className="flex items-center justify-between flex-wrap gap-3 pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-emerald-600" />
                        <span className="text-xs font-black uppercase tracking-wider text-slate-700">Quick Date Presets:</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            onClick={() => { setStartDate(todayStr); setEndDate(todayStr); }}
                            className={cn("px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all",
                                startDate === todayStr && endDate === todayStr
                                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/20"
                                    : "bg-slate-100 text-slate-600 hover:bg-slate-200")}
                        >
                            Today (Current Day)
                        </button>
                        <button
                            onClick={() => {
                                const yest = format(subDays(new Date(), 1), "yyyy-MM-dd");
                                setStartDate(yest);
                                setEndDate(yest);
                            }}
                            className={cn("px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all",
                                startDate === format(subDays(new Date(), 1), "yyyy-MM-dd") && endDate === format(subDays(new Date(), 1), "yyyy-MM-dd")
                                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/20"
                                    : "bg-slate-100 text-slate-600 hover:bg-slate-200")}
                        >
                            Yesterday
                        </button>
                        <button
                            onClick={() => {
                                const startW = format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
                                setStartDate(startW);
                                setEndDate(todayStr);
                            }}
                            className={cn("px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all",
                                startDate === format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd") && endDate === todayStr
                                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/20"
                                    : "bg-slate-100 text-slate-600 hover:bg-slate-200")}
                        >
                            This Week
                        </button>
                        <button
                            onClick={() => {
                                const startM = format(startOfMonth(new Date()), "yyyy-MM-dd");
                                setStartDate(startM);
                                setEndDate(todayStr);
                            }}
                            className={cn("px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all",
                                startDate === format(startOfMonth(new Date()), "yyyy-MM-dd") && endDate === todayStr
                                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/20"
                                    : "bg-slate-100 text-slate-600 hover:bg-slate-200")}
                        >
                            This Month
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-6">
                    <div className="space-y-2 lg:col-span-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Search Customer</label>
                        <div className="relative">
                            <Search className="absolute left-4 top-3.5 h-4 w-4 text-slate-400" />
                            <input 
                                type="text"
                                placeholder="Search by name, phone number, email..."
                                className="w-full h-12 bg-slate-50 border border-slate-100 rounded-xl pl-11 pr-4 text-xs font-bold text-slate-700 outline-none focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500 transition-all"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Outlet Location</label>
                        <select 
                            className="w-full h-12 bg-slate-50 border border-slate-100 rounded-xl px-4 text-xs font-bold text-slate-700 outline-none focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500 transition-all cursor-pointer"
                            value={locationId}
                            onChange={(e) => setLocationId(e.target.value)}
                        >
                            <option value="">All Locations</option>
                            {stores.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Outstanding Status</label>
                        <select 
                            className="w-full h-12 bg-slate-50 border border-slate-100 rounded-xl px-4 text-xs font-bold text-slate-700 outline-none focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500 transition-all cursor-pointer"
                            value={dueFilter}
                            onChange={(e) => setDueFilter(e.target.value)}
                        >
                            <option value="ALL">Show All Accounts</option>
                            <option value="HAS_DUE">Outstanding Due Balance</option>
                            <option value="NO_DUE">Fully Cleared / Paid</option>
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Sales Channel</label>
                        <select 
                            className="w-full h-12 bg-slate-50 border border-slate-100 rounded-xl px-4 text-xs font-bold text-slate-700 outline-none focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500 transition-all cursor-pointer"
                            value={channel}
                            onChange={(e) => setChannel(e.target.value)}
                        >
                            <option value="">All Channels</option>
                            <option value="POS">Offline (POS)</option>
                            <option value="WEB">Online (Web)</option>
                            <option value="WHATSAPP">WhatsApp</option>
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Order Interval</label>
                        <div className="flex gap-2">
                            <input 
                                type="date"
                                className="w-1/2 h-12 bg-slate-50 border border-slate-100 rounded-xl px-1 text-[9px] font-bold text-slate-700 outline-none focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500 transition-all"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                title="From date"
                            />
                            <input 
                                type="date"
                                className="w-1/2 h-12 bg-slate-50 border border-slate-100 rounded-xl px-1 text-[9px] font-bold text-slate-700 outline-none focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500 transition-all"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                title="To date"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* KPI Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm group hover:border-orange-500/30 transition-all duration-500">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 bg-orange-50 text-orange-600 rounded-xl flex items-center justify-center border border-orange-100 group-hover:bg-orange-600 group-hover:text-white transition-all duration-500">
                            <Coins className="h-6 w-6" />
                        </div>
                        <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded">TOTAL OUTSTANDING</span>
                    </div>
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                        ₹{summary?.totalDue?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || "0.00"}
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-1 font-bold">
                        Awaiting from {summary?.customersWithDue || 0} Customers
                    </p>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm group hover:border-emerald-500/30 transition-all duration-500">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center border border-emerald-100 group-hover:bg-emerald-600 group-hover:text-white transition-all duration-500">
                            <TrendingUp className="h-6 w-6" />
                        </div>
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">GROSS SALES</span>
                    </div>
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                        ₹{summary?.totalSpend?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || "0.00"}
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-1 font-bold">For Filtered Accounts</p>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm group hover:border-blue-500/30 transition-all duration-500">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center border border-blue-100 group-hover:bg-blue-600 group-hover:text-white transition-all duration-500">
                            <CreditCard className="h-6 w-6" />
                        </div>
                        <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded">TOTAL SETTLED</span>
                    </div>
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                        ₹{summary?.totalPaid?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || "0.00"}
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-1 font-bold">Payments Received</p>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm group hover:border-purple-500/30 transition-all duration-500">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center border border-purple-100 group-hover:bg-purple-600 group-hover:text-white transition-all duration-500">
                            <Users className="h-6 w-6" />
                        </div>
                        <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-1 rounded">TOTAL CUSTOMERS</span>
                    </div>
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                        {totalCustomers.toLocaleString()}
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-1 font-bold">Matching Search Query</p>
                </div>
            </div>

            {/* Customers Report Table */}
            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-500/5 overflow-hidden">
                <div className="px-8 py-6 border-b border-slate-50 bg-slate-50/50 flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Customer Balance Ledger</h3>
                        <p className="text-[10px] text-slate-400 font-bold tracking-widest mt-0.5 uppercase">Accounts Audit Summary</p>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50">
                                <th 
                                    className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 cursor-pointer hover:bg-slate-100 transition-colors"
                                    onClick={() => handleSort("name")}
                                >
                                    <div className="flex items-center gap-1.5">
                                        Customer {sortBy === "name" && <ArrowUpDown className="h-3 w-3 text-emerald-600" />}
                                    </div>
                                </th>
                                <th 
                                    className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 cursor-pointer hover:bg-slate-100 transition-colors"
                                    onClick={() => handleSort("orderCount")}
                                >
                                    <div className="flex items-center gap-1.5">
                                        Orders {sortBy === "orderCount" && <ArrowUpDown className="h-3 w-3 text-emerald-600" />}
                                    </div>
                                </th>
                                <th 
                                    className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 cursor-pointer hover:bg-slate-100 transition-colors"
                                    onClick={() => handleSort("totalSpend")}
                                >
                                    <div className="flex items-center gap-1.5 justify-end">
                                        Total Spend {sortBy === "totalSpend" && <ArrowUpDown className="h-3 w-3 text-emerald-600" />}
                                    </div>
                                </th>
                                <th 
                                    className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 cursor-pointer hover:bg-slate-100 transition-colors"
                                    onClick={() => handleSort("totalPaid")}
                                >
                                    <div className="flex items-center gap-1.5 justify-end">
                                        Total Paid {sortBy === "totalPaid" && <ArrowUpDown className="h-3 w-3 text-emerald-600" />}
                                    </div>
                                </th>
                                <th 
                                    className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 cursor-pointer hover:bg-slate-100 transition-colors"
                                    onClick={() => handleSort("totalDue")}
                                >
                                    <div className="flex items-center gap-1.5 justify-end">
                                        Outstanding Due {sortBy === "totalDue" && <ArrowUpDown className="h-3 w-3 text-emerald-600" />}
                                    </div>
                                </th>
                                <th 
                                    className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 cursor-pointer hover:bg-slate-100 transition-colors"
                                    onClick={() => handleSort("lastVisit")}
                                >
                                    <div className="flex items-center gap-1.5">
                                        Last Purchase {sortBy === "lastVisit" && <ArrowUpDown className="h-3 w-3 text-emerald-600" />}
                                    </div>
                                </th>
                                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                [1, 2, 3, 4, 5].map(i => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={7} className="px-8 py-6 h-16 bg-slate-50/30" />
                                    </tr>
                                ))
                            ) : customers.map((c) => (
                                <tr key={c.id} className="hover:bg-slate-50/50 transition-colors group">
                                    <td className="px-8 py-5">
                                        <div className="flex flex-col">
                                            <span className="text-xs font-black text-slate-900">{c.name}</span>
                                            <span className="text-[10px] text-slate-400 font-mono mt-0.5">{c.phone}</span>
                                            {c.email && c.email !== "N/A" && (
                                                <span className="text-[9px] text-slate-400 font-medium truncate max-w-[180px]">{c.email}</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-8 py-5">
                                        <div className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-50 border border-slate-100 rounded-lg text-[10px] font-bold text-slate-600">
                                            {c.orderCount} Orders
                                        </div>
                                    </td>
                                    <td className="px-8 py-5 text-right font-semibold text-slate-700">
                                        ₹{c.totalSpend.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="px-8 py-5 text-right font-semibold text-emerald-600 bg-emerald-50/10">
                                        ₹{c.totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="px-8 py-5 text-right">
                                        {c.totalDue > 0 ? (
                                            <span className="text-xs font-black text-orange-600 bg-orange-50 border border-orange-100/70 px-3 py-1.5 rounded-xl block text-right">
                                                ₹{c.totalDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </span>
                                        ) : (
                                            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-100/70 px-3 py-1.5 rounded-xl block text-right">
                                                Cleared
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-8 py-5 text-xs text-slate-500 font-medium">
                                        {c.lastVisit ? (
                                            <div className="flex items-center gap-1.5">
                                                <Clock className="h-3.5 w-3.5 text-slate-300" />
                                                <span>{format(new Date(c.lastVisit), "dd MMM yyyy")}</span>
                                            </div>
                                        ) : (
                                            <span className="text-slate-300 italic">No purchase</span>
                                        )}
                                    </td>
                                    <td className="px-8 py-5 text-center">
                                        <Link 
                                            href={`/admin/reports/customers/${c.id}${channel ? `?channel=${channel}` : ''}`}
                                            className="inline-flex h-9 px-4 bg-slate-900 text-white rounded-lg font-bold text-[10px] uppercase tracking-widest hover:bg-emerald-600 transition-all items-center gap-1.5 active:scale-95"
                                        >
                                            View Statement
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {!loading && customers.length === 0 && (
                    <div className="py-20 flex flex-col items-center justify-center gap-4 text-center">
                        <div className="w-20 h-20 bg-slate-50 rounded-[2rem] flex items-center justify-center text-slate-200">
                            <UserX className="h-10 w-10" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">No matching customers</p>
                            <p className="text-xs text-slate-400 mt-1">Try adjusting the filter query or location settings</p>
                        </div>
                    </div>
                )}

                {/* Pagination Controls */}
                {totalPages > 1 && (
                    <div className="px-8 py-6 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            Page {page} of {totalPages} ({totalCustomers} Accounts)
                        </span>
                        
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="w-10 h-10 border border-slate-200 rounded-xl flex items-center justify-center bg-white text-slate-600 hover:text-emerald-600 disabled:opacity-50 disabled:pointer-events-none transition-colors active:scale-95 shadow-sm"
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </button>
                            <button
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                                className="w-10 h-10 border border-slate-200 rounded-xl flex items-center justify-center bg-white text-slate-600 hover:text-emerald-600 disabled:opacity-50 disabled:pointer-events-none transition-colors active:scale-95 shadow-sm"
                            >
                                <ChevronRight className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
