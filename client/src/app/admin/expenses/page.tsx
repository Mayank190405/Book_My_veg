
"use client";

import { useState, useEffect } from "react";
import api from "@/services/api";
import { toast } from "sonner";
import { 
    Receipt, Wallet, Calendar, Filter, Download, 
    Search, Plus, ArrowUpRight, ArrowDownRight,
    Coffee, Wrench, Zap, Eraser, PenTool, MoreHorizontal,
    Store
} from "lucide-react";
import { useUserStore } from "@/store/useUserStore";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const CATEGORY_ICONS: Record<string, any> = {
    TEA: Coffee,
    MAINTENANCE: Wrench,
    ELECTRICITY: Zap,
    CLEANING: Eraser,
    STATIONERY: PenTool,
    MISC: Wallet
};

const CATEGORY_COLORS: Record<string, string> = {
    TEA: "text-amber-600 bg-amber-50",
    MAINTENANCE: "text-blue-600 bg-blue-50",
    ELECTRICITY: "text-yellow-600 bg-yellow-50",
    CLEANING: "text-emerald-600 bg-emerald-50",
    STATIONERY: "text-slate-600 bg-slate-50",
    MISC: "text-rose-600 bg-rose-50"
};

export default function ExpensesPage() {
    const { user } = useUserStore();
    const [expenses, setExpenses] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [locations, setLocations] = useState<any[]>([]);
    const [selectedLocation, setSelectedLocation] = useState(user?.locationId || "ALL");
    const [showAddModal, setShowAddModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [newExpense, setNewExpense] = useState({
        amount: "",
        category: "MISC",
        description: ""
    });
    const isStoreAdmin = user?.role === "STORE_ADMIN";

    useEffect(() => {
        fetchLocations();
    }, []);

    useEffect(() => {
        if (selectedLocation !== "ALL") {
            fetchExpenses();
        }
    }, [selectedLocation]);

    const fetchLocations = async () => {
        try {
            const res = await api.get("/locations");
            setLocations(res.data);
            if (isStoreAdmin && user?.locationId) {
                setSelectedLocation(user.locationId);
            } else if (!user?.locationId && res.data.length > 0) {
                setSelectedLocation(res.data[0].id);
            }
        } catch { toast.error("Failed to load locations"); }
    };

    const fetchExpenses = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/expenses/store/${selectedLocation}`);
            setExpenses(res.data);
        } catch { toast.error("Failed to load expenses"); }
        finally { setLoading(false); }
    };

    const handleAddExpense = async () => {
        if (!newExpense.amount || !newExpense.description) return toast.error("Please fill all required fields");
        setSubmitting(true);
        try {
            await api.post("/expenses/add", {
                ...newExpense,
                locationId: isStoreAdmin ? user?.locationId : selectedLocation,
                staffId: user?.id
            });
            toast.success("Expense recorded successfully");
            setNewExpense({ amount: "", category: "MISC", description: "" });
            setShowAddModal(false);
            fetchExpenses();
        } catch { toast.error("Failed to record expense"); }
        finally { setSubmitting(false); }
    };

    const totalSpent = expenses.reduce((sum, exp) => sum + Number(exp.amount), 0);

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <Receipt className="h-8 w-8 text-rose-500" />
                        Store Expenditure
                    </h1>
                    <p className="text-slate-500 font-medium mt-1">Audit and track petty cash outflows across Hub nodes</p>
                </div>
                <div className="flex items-center gap-3">
                    <select 
                        disabled={isStoreAdmin}
                        value={selectedLocation} 
                        onChange={(e) => setSelectedLocation(e.target.value)}
                        className={cn(
                            "h-11 bg-white border border-slate-200 rounded-xl px-4 font-bold text-slate-900 outline-none focus:ring-2 ring-rose-500/20",
                            isStoreAdmin && "opacity-50 cursor-not-allowed bg-slate-50"
                        )}
                    >
                        {!isStoreAdmin && <option value="ALL">All Hubs</option>}
                        {locations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
                    </select>
                    <Button 
                        onClick={() => setShowAddModal(true)}
                        disabled={selectedLocation === "ALL" && !isStoreAdmin}
                        className="h-11 bg-rose-600 hover:bg-rose-700 text-white font-black text-[10px] uppercase rounded-xl shadow-lg shadow-rose-500/20"
                    >
                        <Plus className="h-4 w-4 mr-2" /> Record Expense
                    </Button>
                    <Button variant="outline" className="h-11 rounded-xl gap-2 font-bold group">
                        <Download className="h-4 w-4 group-hover:translate-y-0.5 transition-transform" /> Export Audit
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white border border-slate-100 rounded-3xl p-8 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <Wallet className="h-24 w-24" />
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Operational Spend</p>
                    <p className="text-4xl font-black text-slate-900 tabular-nums">₹{totalSpent.toLocaleString()}</p>
                    <div className="flex items-center gap-2 mt-4 text-rose-500 font-bold text-xs">
                        <ArrowUpRight className="h-4 w-4" />
                        <span>Aggregated from {expenses.length} entries</span>
                    </div>
                </div>

                <div className="bg-rose-50 border border-rose-100 rounded-3xl p-8 flex flex-col justify-center">
                    <div className="flex justify-between items-center mb-4">
                        <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest">Top Category</p>
                        <Coffee className="h-5 w-5 text-rose-400" />
                    </div>
                    <p className="text-2xl font-black text-rose-900 uppercase">Tea & Refreshments</p>
                    <p className="text-sm font-bold text-rose-600/60 mt-1">₹{(totalSpent * 0.4).toLocaleString()} Estimated</p>
                </div>

                <div className="bg-slate-900 text-white border border-slate-800 rounded-3xl p-8 flex flex-col justify-center">
                    <div className="flex justify-between items-center mb-4">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Counter Status</p>
                        <Plus className="h-4 w-4 text-emerald-400" />
                    </div>
                    <p className="text-lg font-bold leading-tight">All expenses automatically deducted from active cashier shifts.</p>
                </div>
            </div>

            <div className="bg-white border border-slate-100 rounded-3xl shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-slate-50/30 flex items-center justify-between">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input 
                            placeholder="Find expense by description or staff..." 
                            className="w-full h-11 bg-white border border-slate-200 rounded-xl pl-11 pr-4 text-sm font-medium outline-none focus:ring-2 ring-rose-500/10 focus:border-rose-300 transition-all"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" className="h-10 px-4 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-rose-600">
                             Latest First
                        </Button>
                    </div>
                </div>

                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50/50 border-b border-slate-100">
                            <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Entry Date</th>
                            <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Category</th>
                            <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Description</th>
                            <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Recorded By</th>
                            <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Amount</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? (
                            <tr><td colSpan={5} className="px-8 py-24 text-center text-slate-400 font-bold uppercase tracking-widest">Auditing Expenditures...</td></tr>
                        ) : expenses.length === 0 ? (
                            <tr><td colSpan={5} className="px-8 py-24 text-center text-slate-400 font-bold uppercase tracking-widest">No expenses found for this hub</td></tr>
                        ) : (
                            expenses.map((expense) => {
                                const Icon = CATEGORY_ICONS[expense.category] || Wallet;
                                return (
                                    <tr key={expense.id} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="px-8 py-6">
                                            <div className="flex flex-col">
                                                <span className="font-black text-slate-900 text-sm">
                                                    {format(new Date(expense.createdAt), "dd MMM yyyy")}
                                                </span>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                    {format(new Date(expense.createdAt), "HH:mm")}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className={cn(
                                                "inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap",
                                                CATEGORY_COLORS[expense.category] || CATEGORY_COLORS.MISC
                                            )}>
                                                <Icon className="h-3.5 w-3.5" />
                                                {expense.category}
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <p className="text-sm font-bold text-slate-600 max-w-md truncate group-hover:text-slate-900 transition-colors">
                                                {expense.description}
                                            </p>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center font-black text-slate-500 text-xs">
                                                    {expense.staff?.name?.[0]}
                                                </div>
                                                <span className="text-xs font-bold text-slate-600">{expense.staff?.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            <span className="text-lg font-black text-rose-600 tabular-nums">
                                                ₹{Number(expense.amount).toLocaleString()}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
                <div className="p-8 bg-slate-50 border-t border-slate-100 text-center">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-center gap-2">
                        <Store className="h-3 w-3" />
                         End of Audit Trail
                    </p>
                </div>
            </div>

            {/* Manual Record Modal */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm">
                    <div className="absolute inset-0" onClick={() => !submitting && setShowAddModal(false)} />
                    <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl relative z-60 overflow-hidden border border-slate-200">
                        <div className="p-8 border-b border-slate-100 bg-slate-50/50">
                            <h3 className="text-xl font-black text-slate-900 uppercase flex items-center gap-2">
                                <Receipt className="h-6 w-6 text-rose-500" />
                                Record Petty Cash Outflow
                            </h3>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Manual Audit Entry</p>
                        </div>

                        <div className="p-8 space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest block px-1">Amount (₹)</label>
                                    <input 
                                        type="number"
                                        placeholder="0.00"
                                        className="w-full h-12 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-bold outline-none focus:bg-white focus:border-rose-500 transition-all shadow-inner"
                                        value={newExpense.amount}
                                        onChange={e => setNewExpense({...newExpense, amount: e.target.value})}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest block px-1">Category</label>
                                    <input 
                                        type="text"
                                        placeholder="e.g. TEA"
                                        className="w-full h-12 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-bold outline-none focus:bg-white focus:border-rose-500 transition-all uppercase shadow-inner"
                                        value={newExpense.category}
                                        onChange={e => setNewExpense({...newExpense, category: e.target.value.toUpperCase()})}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest block px-1">Description / Reason</label>
                                <textarea 
                                    placeholder="e.g. 5 Cups of Tea for Staff Meeting"
                                    className="w-full h-24 bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-bold outline-none focus:bg-white focus:border-rose-500 transition-all resize-none shadow-inner"
                                    value={newExpense.description}
                                    onChange={e => setNewExpense({...newExpense, description: e.target.value})}
                                />
                            </div>

                            <div className="flex gap-4 pt-4">
                                <Button 
                                    variant="outline" 
                                    disabled={submitting}
                                    onClick={() => setShowAddModal(false)} 
                                    className="flex-1 h-12 rounded-xl uppercase text-[10px] font-black"
                                >
                                    Cancel
                                </Button>
                                <Button 
                                    onClick={handleAddExpense}
                                    disabled={submitting}
                                    className="flex-[2] h-12 bg-slate-900 text-white rounded-xl uppercase text-[10px] font-black hover:bg-rose-600 transition-colors shadow-lg"
                                >
                                    {submitting ? "Processing..." : "Log Expenditure"}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

