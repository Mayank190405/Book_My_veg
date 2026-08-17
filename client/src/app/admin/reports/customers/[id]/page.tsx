"use client";

import { 
    ArrowLeft,
    Clock,
    Download,
    Printer,
    Coins,
    TrendingUp,
    CheckCircle,
    FileText,
    Calendar,
    ChevronDown,
    Building,
    User,
    CreditCard,
    DollarSign,
    Lock,
    Unlock,
    HelpCircle,
    Store,
    X,
    Briefcase,
    RefreshCw
} from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import api from "@/services/api";
import { toast } from "sonner";
import { format } from "date-fns";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";

export default function CustomerStatement() {
    const router = useRouter();
    const params = useParams();
    const searchParams = useSearchParams();
    const customerId = params.id as string;

    const [channel, setChannel] = useState(searchParams.get("channel") || "");
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<"ledger" | "bills">("ledger");

    // Modal state for settling general balance
    const [settleModalOpen, setSettleModalOpen] = useState(false);
    const [settleAmount, setSettleAmount] = useState("");
    const [settleMethod, setSettleMethod] = useState("CASH");
    const [settleTxId, setSettleTxId] = useState("");
    const [settleLoading, setSettleLoading] = useState(false);

    // Modal state for collecting specific bill due
    const [billModalOpen, setBillModalOpen] = useState(false);
    const [selectedBill, setSelectedBill] = useState<any>(null);
    const [billAmount, setBillAmount] = useState("");
    const [billMethod, setBillMethod] = useState("CASH");
    const [billLoading, setBillLoading] = useState(false);

    const fetchDetails = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/dashboard/customer-reports/${customerId}?channel=${channel}`);
            setData(res.data);
        } catch (error) {
            toast.error("Failed to load customer statement details");
            router.push("/admin/reports/customers");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (customerId) {
            fetchDetails();
        }
    }, [customerId, channel]);

    const handleSettleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!settleAmount || parseFloat(settleAmount) <= 0) {
            toast.warning("Please enter a valid amount");
            return;
        }

        setSettleLoading(true);
        try {
            await api.post(`/pos/customers/${customerId}/settle`, {
                amount: parseFloat(settleAmount),
                method: settleMethod,
                transactionId: settleTxId || `SETTLE_DASH_${Date.now()}`
            });
            toast.success("Dues settled and recorded successfully");
            setSettleModalOpen(false);
            setSettleAmount("");
            setSettleTxId("");
            fetchDetails(); // Refresh ledger
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Failed to settle dues");
        } finally {
            setSettleLoading(false);
        }
    };

    const handleBillSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!billAmount || parseFloat(billAmount) <= 0) {
            toast.warning("Please enter a valid amount");
            return;
        }

        setBillLoading(true);
        try {
            await api.post(`/pos/orders/${selectedBill.id}/collect-due`, {
                amount: parseFloat(billAmount),
                method: billMethod
            });
            toast.success("Bill payment recorded successfully");
            setBillModalOpen(false);
            setSelectedBill(null);
            setBillAmount("");
            fetchDetails(); // Refresh ledger
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Failed to collect due");
        } finally {
            setBillLoading(false);
        }
    };

    const openBillModal = (bill: any) => {
        setSelectedBill(bill);
        setBillAmount(String(bill.remainingDue));
        setBillModalOpen(true);
    };

    const handleExportLedgerCSV = () => {
        if (!data?.ledger || data.ledger.length === 0) {
            toast.warning("No transactions to export");
            return;
        }

        const headers = ["Date", "Transaction Type", "Reference Bill ID", "Description", "Debit/Charge (INR)", "Credit/Payment (INR)", "Outstanding Balance (INR)"];
        const rows = data.ledger.map((item: any) => [
            format(new Date(item.date), "yyyy-MM-dd HH:mm"),
            item.type,
            item.referenceId,
            item.description,
            item.type === "CHARGE" ? item.amount : "",
            item.type === "PAYMENT" ? item.amount : "",
            item.runningBalance
        ]);

        const csvString = [headers.join(","), ...rows.map((r: any) => r.map((val: any) => `"${String(val).replace(/"/g, '""')}"`).join(","))].join("\n");
        const encodedUri = "data:text/csv;charset=utf-8,\uFEFF" + encodeURIComponent(csvString);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `${(data.customer.name || "Guest").replace(/\s+/g, '_')}_ledger_${format(new Date(), "yyyyMMdd")}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleExportBillsCSV = () => {
        if (!data?.billWiseDues || data.billWiseDues.length === 0) {
            toast.warning("No outstanding bills to export");
            return;
        }

        const headers = ["Bill/Order ID", "Date", "Store Location", "Cashier/Staff", "Total Bill (INR)", "Amount Paid (INR)", "Pending Due (INR)", "Status"];
        const rows = data.billWiseDues.map((b: any) => [
            b.id,
            format(new Date(b.createdAt), "yyyy-MM-dd HH:mm"),
            b.locationName,
            b.staffName,
            b.totalAmount,
            b.paidAmount,
            b.remainingDue,
            b.paymentStatus
        ]);

        const csvString = [headers.join(","), ...rows.map((r: any) => r.map((val: any) => `"${String(val).replace(/"/g, '""')}"`).join(","))].join("\n");
        const encodedUri = "data:text/csv;charset=utf-8,\uFEFF" + encodeURIComponent(csvString);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `${(data.customer.name || "Guest").replace(/\s+/g, '_')}_outstanding_bills_${format(new Date(), "yyyyMMdd")}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handlePrintThermal = () => {
        window.print();
    };

    if (loading && !data) {
        return (
            <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
                <div className="w-12 h-12 border-4 border-slate-200 border-t-emerald-600 rounded-full animate-spin" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest animate-pulse">
                    Generating statement sheet...
                </span>
            </div>
        );
    }

    if (!data || !data.customer) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 bg-white rounded-3xl p-8 border border-slate-100 shadow-sm my-8">
                <div className="w-12 h-12 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center font-bold text-lg">!</div>
                <h3 className="text-base font-bold text-slate-900">Customer Statement Not Found</h3>
                <p className="text-xs text-slate-500 text-center max-w-sm">
                    The requested customer account statement could not be retrieved or does not exist.
                </p>
                <Link
                    href="/admin/reports/customers"
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-600/20 transition-all"
                >
                    Back to Customer Reports
                </Link>
            </div>
        );
    }

    const { customer = {}, summary = {}, ledger = [], billWiseDues = [] } = data;

    return (
        <>
            <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                    aside, header, .print\\:hidden {
                        display: none !important;
                    }
                    main {
                        padding-left: 0 !important;
                        margin: 0 !important;
                    }
                    #admin-scroll-container {
                        padding: 0 !important;
                        overflow: visible !important;
                        max-height: none !important;
                    }
                    body {
                        background: white !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }
                }
            `}} />

            <div className="space-y-8 animate-in fade-in duration-500 max-w-[1600px] mx-auto print:space-y-4">
            {/* Top Navigation & Actions Bar */}
            <div className="flex items-center gap-4 print:hidden">
                <Link 
                    href="/admin/reports/customers"
                    className="w-10 h-10 border border-slate-200 bg-white rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-900 transition-colors shadow-sm active:scale-95"
                >
                    <ArrowLeft className="h-4 w-4" />
                </Link>
                <div>
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full uppercase tracking-wider">
                        Customer Statements
                    </span>
                    <h2 className="text-xl font-bold text-slate-950 mt-1">Audit Ledger Statement</h2>
                </div>
            </div>

            {/* Statement Header Card */}
            <div className="bg-white rounded-[2rem] border border-slate-100 p-8 shadow-xl shadow-slate-500/5 print:border-none print:shadow-none print:p-0">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 pb-8 border-b border-slate-100">
                    <div className="space-y-3">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center text-slate-400 font-bold text-lg">
                                {customer.name ? customer.name[0] : "?"}
                            </div>
                            <div>
                                <h1 className="text-2xl font-black text-slate-900 tracking-tight">{customer.name || "Walk-in Guest"}</h1>
                                <p className="text-xs text-slate-400 font-bold tracking-widest uppercase mt-0.5">Account ID: {customer.id ? customer.id.slice(0, 13).toUpperCase() : "N/A"}</p>
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-y-2 gap-x-6 pt-2 text-xs text-slate-500 font-medium">
                            <div className="flex items-center gap-2">
                                <Briefcase className="h-4 w-4 text-slate-300" />
                                <span className="font-mono">{customer.phone}</span>
                            </div>
                            {customer.email && customer.email !== "N/A" && (
                                <div className="flex items-center gap-2">
                                    <Clock className="h-4 w-4 text-slate-300" />
                                    <span className="truncate max-w-[200px]">{customer.email}</span>
                                </div>
                            )}
                            <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-slate-300" />
                                <span>Joined: {customer.createdAt ? format(new Date(customer.createdAt), "dd MMM yyyy") : "N/A"}</span>
                            </div>
                        </div>
                        
                        <div className="text-xs text-slate-400 pt-1">
                            <span className="font-bold text-slate-500">Billing Address: </span>
                            {customer.address || "N/A"}
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 print:hidden">
                        <select
                            value={channel}
                            onChange={(e) => setChannel(e.target.value)}
                            className="h-11 px-4 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-xs uppercase tracking-wider outline-none focus:border-emerald-500 transition-all cursor-pointer shadow-sm"
                        >
                            <option value="">All Channels</option>
                            <option value="POS">Offline (POS)</option>
                            <option value="WEB">Online (Web)</option>
                            <option value="WHATSAPP">WhatsApp</option>
                        </select>
                        <button 
                            onClick={handleExportLedgerCSV}
                            className="h-11 px-5 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-xs uppercase tracking-widest hover:text-emerald-600 hover:border-emerald-500/20 transition-all flex items-center gap-2 active:scale-95 shadow-sm"
                        >
                            <Download className="h-4 w-4" />
                            CSV Ledger
                        </button>
                        <button 
                            onClick={handlePrintThermal}
                            className="h-11 px-5 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-xs uppercase tracking-widest hover:text-emerald-600 hover:border-emerald-500/20 transition-all flex items-center gap-2 active:scale-95 shadow-sm"
                        >
                            <Printer className="h-4 w-4" />
                            Print Statement
                        </button>
                        <button 
                            onClick={handleCleanDuplicates}
                            disabled={cleaningDuplicates}
                            className="h-11 px-5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all flex items-center gap-2 active:scale-95 shadow-sm disabled:opacity-50"
                            title="Clean duplicate payment entries and recalculate ledger"
                        >
                            <RefreshCw className={cn("h-4 w-4", cleaningDuplicates && "animate-spin")} />
                            <span>{cleaningDuplicates ? "Cleaning..." : "Remove Duplicates"}</span>
                        </button>
                        {summary.outstandingDue > 0 && (
                            <button 
                                onClick={() => {
                                    setSettleAmount(String(summary.outstandingDue));
                                    setSettleModalOpen(true);
                                }}
                                className="h-11 px-6 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all flex items-center gap-2 active:scale-95 shadow-lg shadow-orange-500/10"
                            >
                                <Coins className="h-4 w-4 animate-bounce" />
                                Settle Account
                            </button>
                        )}
                    </div>
                </div>

                {/* Account Summary Stats */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 pt-8">
                    <div className="space-y-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Gross Purchases</span>
                        <p className="text-xl font-black text-slate-900">
                            ₹{summary.totalSpend.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </p>
                        <span className="text-[9px] text-slate-400 font-bold block">{summary.totalOrders} Orders Placed</span>
                    </div>
                    <div className="space-y-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Settled</span>
                        <p className="text-xl font-black text-emerald-600">
                            ₹{summary.totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </p>
                        <span className="text-[9px] text-slate-400 font-bold block">Receipts Received</span>
                    </div>
                    <div className="space-y-1 bg-orange-50/40 p-4 rounded-xl border border-orange-100/50">
                        <span className="text-[10px] font-bold text-orange-600 uppercase tracking-widest">Outstanding Balance</span>
                        <p className="text-2xl font-black text-orange-600">
                            ₹{summary.outstandingDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </p>
                        <span className="text-[9px] text-orange-400 font-bold block">Total Pending Due</span>
                    </div>
                    <div className="space-y-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Last Activity</span>
                        <p className="text-xl font-black text-slate-900">
                            {summary.lastVisit ? format(new Date(summary.lastVisit), "dd MMM yyyy") : "N/A"}
                        </p>
                        <span className="text-[9px] text-slate-400 font-bold block">Purchase timestamp</span>
                    </div>
                </div>
            </div>

            {/* TAB Navigation */}
            <div className="flex border-b border-slate-200 print:hidden">
                <button
                    onClick={() => setActiveTab("ledger")}
                    className={cn(
                        "px-6 py-3 border-b-2 text-xs font-black uppercase tracking-widest transition-all",
                        activeTab === "ledger" 
                            ? "border-emerald-600 text-emerald-600 font-black" 
                            : "border-transparent text-slate-400 hover:text-slate-900"
                    )}
                >
                    Ledger Statement ({ledger.length})
                </button>
                <button
                    onClick={() => setActiveTab("bills")}
                    className={cn(
                        "px-6 py-3 border-b-2 text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2",
                        activeTab === "bills" 
                            ? "border-emerald-600 text-emerald-600 font-black" 
                            : "border-transparent text-slate-400 hover:text-slate-900"
                    )}
                >
                    Bill-wise Dues ({billWiseDues.length})
                </button>
            </div>

            {/* Tab 1: Chronological Ledger */}
            {activeTab === "ledger" && (
                <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-500/5 overflow-hidden print:shadow-none print:border-none print:bg-transparent">
                    <div className="px-8 py-6 border-b border-slate-50 bg-slate-50/50 flex items-center justify-between print:hidden">
                        <div>
                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Audit Statement</h3>
                            <p className="text-[9px] text-slate-400 font-bold tracking-widest mt-0.5 uppercase">Double-entry chronological view</p>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/50 print:bg-slate-100">
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 print:text-slate-900">Timestamp</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 print:text-slate-900">Type</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 print:text-slate-900">Transaction Details</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-right print:text-slate-900">Debit / Charge (+)</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-right print:text-slate-900">Credit / Paid (-)</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-right print:text-slate-900">Running Balance</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 print:divide-slate-200">
                                {ledger.map((item: any) => (
                                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-8 py-4 text-[10px] font-bold text-slate-500 font-mono">
                                            {format(new Date(item.date), "dd MMM yyyy, hh:mm a")}
                                        </td>
                                        <td className="px-8 py-4">
                                            {item.type === "CHARGE" ? (
                                                <span className="text-[9px] font-black text-blue-600 bg-blue-50 border border-blue-100/70 px-2 py-0.5 rounded uppercase tracking-wider">
                                                    DEBIT / BILL
                                                </span>
                                            ) : (
                                                <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 border border-emerald-100/70 px-2 py-0.5 rounded uppercase tracking-wider">
                                                    CREDIT / PAY
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-8 py-4 text-xs font-semibold text-slate-700">
                                            {item.description}
                                            {item.details?.staffName && (
                                                <span className="text-[10px] text-slate-400 block font-normal mt-0.5">Cashier: {item.details.staffName}</span>
                                            )}
                                        </td>
                                        <td className="px-8 py-4 text-right font-semibold text-slate-800">
                                            {item.type === "CHARGE" ? `₹${item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "-"}
                                        </td>
                                        <td className="px-8 py-4 text-right font-semibold text-emerald-600">
                                            {item.type === "PAYMENT" ? `₹${item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "-"}
                                        </td>
                                        <td className="px-8 py-4 text-right font-bold text-slate-900 font-mono">
                                            ₹{item.runningBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {ledger.length === 0 && (
                        <div className="py-20 flex flex-col items-center justify-center gap-4 text-center">
                            <div className="w-16 h-16 bg-slate-50 rounded-[1.5rem] flex items-center justify-center text-slate-200">
                                <FileText className="h-8 w-8" />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">No transaction ledger history</p>
                                <p className="text-xs text-slate-400 mt-1">This user hasn't made any purchases or payments yet.</p>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Tab 2: Bill-wise Outstanding Dues */}
            {activeTab === "bills" && (
                <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-500/5 overflow-hidden">
                    <div className="px-8 py-6 border-b border-slate-50 bg-slate-50/50 flex items-center justify-between">
                        <div>
                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Unpaid / Outstanding Invoices</h3>
                            <p className="text-[9px] text-slate-400 font-bold tracking-widest mt-0.5 uppercase">Bill-by-bill outstanding dues list</p>
                        </div>
                        <button 
                            onClick={handleExportBillsCSV}
                            className="h-9 px-4 bg-white border border-slate-200 text-slate-500 rounded-lg font-bold text-[10px] uppercase tracking-widest hover:text-emerald-600 hover:border-emerald-500/20 transition-all flex items-center gap-1.5 active:scale-95 shadow-sm"
                        >
                            <Download className="h-3.5 w-3.5" />
                            CSV Export
                        </button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/50">
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Bill Date</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Invoice Reference</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Store / Operator</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-right">Bill Total</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-right">Settled Amount</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-right">Remaining Due</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {billWiseDues.map((bill: any) => (
                                    <tr key={bill.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-8 py-5 text-[10px] font-bold text-slate-500 font-mono">
                                            {format(new Date(bill.createdAt), "dd MMM yyyy, hh:mm a")}
                                        </td>
                                        <td className="px-8 py-5">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-mono font-black text-slate-900">
                                                    #{bill.id.toUpperCase()}
                                                </span>
                                                <span className="inline-flex max-w-fit mt-1 text-[8px] font-black uppercase tracking-widest bg-orange-50 text-orange-600 border border-orange-100 px-1.5 py-0.5 rounded">
                                                    {bill.paymentStatus}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <div className="flex flex-col gap-0.5">
                                                <span className="text-[10px] font-bold text-slate-700 uppercase tracking-tight flex items-center gap-1">
                                                    <Store className="h-3 w-3 text-slate-400" />
                                                    {bill.locationName}
                                                </span>
                                                <span className="text-[9px] text-slate-400 font-medium">Cashier: {bill.staffName}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5 text-right font-semibold text-slate-700">
                                            ₹{bill.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-8 py-5 text-right font-semibold text-emerald-600">
                                            ₹{bill.paidAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-8 py-5 text-right bg-orange-50/20">
                                            <span className="text-xs font-black text-orange-600">
                                                ₹{bill.remainingDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </span>
                                        </td>
                                        <td className="px-8 py-5 text-center">
                                            <button 
                                                onClick={() => openBillModal(bill)}
                                                className="inline-flex h-8 px-3 bg-slate-950 text-white rounded-lg font-bold text-[9px] uppercase tracking-widest hover:bg-emerald-600 transition-all items-center gap-1 active:scale-95 shadow-sm"
                                            >
                                                <Coins className="h-3 w-3" />
                                                Settle Invoice
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {billWiseDues.length === 0 && (
                        <div className="py-20 flex flex-col items-center justify-center gap-4 text-center">
                            <div className="w-16 h-16 bg-emerald-50 rounded-[1.5rem] flex items-center justify-center text-emerald-600 border border-emerald-100">
                                <CheckCircle className="h-8 w-8" />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-emerald-600 uppercase tracking-widest">No outstanding bills!</p>
                                <p className="text-xs text-slate-400 mt-1">This customer's bills are 100% settled and paid up.</p>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* General Account Settlement Modal */}
            {settleModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm p-4 animate-in fade-in duration-300">
                    <div 
                        className="bg-white w-full max-w-md rounded-[2rem] border border-slate-100 shadow-2xl p-8 relative animate-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button 
                            onClick={() => setSettleModalOpen(false)}
                            className="absolute top-6 right-6 w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-900 transition-colors"
                        >
                            <X className="h-4 w-4" />
                        </button>

                        <div className="mb-6">
                            <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full uppercase tracking-wider">
                                Account Reconciliation
                            </span>
                            <h3 className="text-lg font-black text-slate-950 uppercase tracking-tight mt-2">
                                Settle Customer Dues
                            </h3>
                            <p className="text-xs text-slate-400 font-medium mt-1">
                                Record a payment. Dues will be settled against the oldest outstanding bills first.
                            </p>
                        </div>

                        <form onSubmit={handleSettleSubmit} className="space-y-5">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Customer Account</label>
                                <div className="w-full h-11 px-4 bg-slate-50 border border-slate-100 rounded-xl flex items-center text-xs font-bold text-slate-600">
                                    {customer.name || "Walk-in Guest"} ({customer.phone})
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Payment Amount (INR)</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-3 text-xs font-bold text-slate-400">₹</span>
                                    <input 
                                        type="number"
                                        step="0.01"
                                        placeholder="0.00"
                                        className="w-full h-12 bg-slate-50 border border-slate-100 rounded-xl pl-8 pr-4 text-xs font-bold text-slate-800 outline-none focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500 transition-all"
                                        value={settleAmount}
                                        onChange={(e) => setSettleAmount(e.target.value)}
                                        max={summary.outstandingDue}
                                        required
                                    />
                                </div>
                                <span className="text-[9px] text-slate-400 font-bold block px-1">
                                    Max outstanding due: ₹{summary.outstandingDue}
                                </span>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Payment Method</label>
                                <select 
                                    className="w-full h-12 bg-slate-50 border border-slate-100 rounded-xl px-4 text-xs font-bold text-slate-700 outline-none focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500 transition-all cursor-pointer"
                                    value={settleMethod}
                                    onChange={(e) => setSettleMethod(e.target.value)}
                                >
                                    <option value="CASH">Liquid Cash</option>
                                    <option value="UPI">UPI Transfer</option>
                                    <option value="CARD">Debit / Credit Card</option>
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Transaction Ref ID (Optional)</label>
                                <input 
                                    type="text"
                                    placeholder="UPI Ref ID, Tx Hash, or notes..."
                                    className="w-full h-12 bg-slate-50 border border-slate-100 rounded-xl px-4 text-xs font-bold text-slate-700 outline-none focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500 transition-all"
                                    value={settleTxId}
                                    onChange={(e) => setSettleTxId(e.target.value)}
                                />
                            </div>

                            <div className="flex gap-3 pt-3">
                                <button
                                    type="button"
                                    onClick={() => setSettleModalOpen(false)}
                                    className="w-1/2 h-11 border border-slate-200 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors uppercase tracking-wider"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={settleLoading}
                                    className="w-1/2 h-11 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                                >
                                    {settleLoading ? "Recording..." : "Record Payment"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Bill-Specific Settlement Modal */}
            {billModalOpen && selectedBill && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm p-4 animate-in fade-in duration-300">
                    <div 
                        className="bg-white w-full max-w-md rounded-[2rem] border border-slate-100 shadow-2xl p-8 relative animate-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button 
                            onClick={() => {
                                setBillModalOpen(false);
                                setSelectedBill(null);
                            }}
                            className="absolute top-6 right-6 w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-900 transition-colors"
                        >
                            <X className="h-4 w-4" />
                        </button>

                        <div className="mb-6">
                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full uppercase tracking-wider">
                                Invoice Settlement
                            </span>
                            <h3 className="text-lg font-black text-slate-950 uppercase tracking-tight mt-2">
                                Settle Bill #{selectedBill.id.slice(0, 8).toUpperCase()}
                            </h3>
                            <p className="text-xs text-slate-400 font-medium mt-1">
                                Record a payment directly applied to this specific invoice.
                            </p>
                        </div>

                        <form onSubmit={handleBillSubmit} className="space-y-5">
                            <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-1.5 text-xs">
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Total Bill Amount:</span>
                                    <span className="font-bold text-slate-700">₹{selectedBill.totalAmount}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Already Settled:</span>
                                    <span className="font-bold text-emerald-600">₹{selectedBill.paidAmount}</span>
                                </div>
                                <div className="flex justify-between border-t border-slate-200/60 pt-1.5 mt-1.5 font-bold">
                                    <span className="text-slate-500">Remaining Due:</span>
                                    <span className="text-orange-600">₹{selectedBill.remainingDue}</span>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Payment Amount (INR)</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-3 text-xs font-bold text-slate-400">₹</span>
                                    <input 
                                        type="number"
                                        step="0.01"
                                        placeholder="0.00"
                                        className="w-full h-12 bg-slate-50 border border-slate-100 rounded-xl pl-8 pr-4 text-xs font-bold text-slate-800 outline-none focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500 transition-all"
                                        value={billAmount}
                                        onChange={(e) => setBillAmount(e.target.value)}
                                        max={selectedBill.remainingDue}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Payment Method</label>
                                <select 
                                    className="w-full h-12 bg-slate-50 border border-slate-100 rounded-xl px-4 text-xs font-bold text-slate-700 outline-none focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500 transition-all cursor-pointer"
                                    value={billMethod}
                                    onChange={(e) => setBillMethod(e.target.value)}
                                >
                                    <option value="CASH">Liquid Cash</option>
                                    <option value="UPI">UPI Transfer</option>
                                    <option value="CARD">Debit / Credit Card</option>
                                </select>
                            </div>

                            <div className="flex gap-3 pt-3">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setBillModalOpen(false);
                                        setSelectedBill(null);
                                    }}
                                    className="w-1/2 h-11 border border-slate-200 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors uppercase tracking-wider"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={billLoading}
                                    className="w-1/2 h-11 bg-slate-950 hover:bg-slate-900 text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                                >
                                    {billLoading ? "Recording..." : "Record Payment"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            </div>

            {/* Thermal Print Receipt (only shown during printing) */}
            <div id="thermal-print-section" className="hidden print:block w-[58mm] mx-auto p-2 font-sans text-[10px] text-black bg-white leading-normal">
                {/* Header */}
                <div className="text-center">
                    <h1 className="font-black uppercase text-sm leading-tight">BOOK MY VEG</h1>
                    <p className="font-bold text-[7px] uppercase text-slate-500 tracking-wider mt-0.5">Customer Ledger Statement</p>
                </div>
                
                <div className="border-t border-black my-1.5" />
                
                {/* Customer Meta */}
                <div className="space-y-0.5 text-[8px]">
                    <div className="flex justify-between">
                        <span className="text-slate-500">Customer:</span>
                        <span className="font-bold">{customer.name || "Walk-in Guest"}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-500">Phone:</span>
                        <span className="font-bold font-mono">{customer.phone}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-500">Printed:</span>
                        <span className="font-bold">{format(new Date(), "dd-MM-yyyy HH:mm")}</span>
                    </div>
                </div>

                <div className="border-t border-dashed border-slate-300 my-1.5" />

                {/* Summary */}
                <div className="bg-slate-50 border border-slate-100 p-1.5 rounded space-y-1 text-[8px]">
                    <div className="flex justify-between">
                        <span>Gross Purchases:</span>
                        <span className="font-bold">₹{Number(summary.totalSpend).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Total Paid:</span>
                        <span className="font-bold text-emerald-600">₹{Number(summary.totalPaid).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between border-t border-dashed border-slate-200 pt-1 mt-1 font-bold text-orange-600">
                        <span>OUTSTANDING:</span>
                        <span>₹{Number(summary.outstandingDue).toFixed(2)}</span>
                    </div>
                </div>

                <div className="border-t border-black my-1.5" />

                {/* Ledger Items */}
                <div className="text-center font-bold text-[7px] uppercase tracking-wider mb-1">Recent Activity (DR/CR)</div>
                <table className="w-full text-left text-[8px] border-collapse">
                    <thead>
                        <tr className="border-b border-black">
                            <th className="py-0.5 font-bold" style={{ width: "55%" }}>Date / Trans</th>
                            <th className="py-0.5 font-bold text-right" style={{ width: "45%" }}>Amt / Bal</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {ledger.slice(0, 30).map((item: any) => {
                            const shortId = item.referenceId ? `#${item.referenceId.slice(-6).toUpperCase()}` : '';
                            const amountPrefix = item.type === "CHARGE" ? "+" : "-";
                            return (
                                <tr key={item.id} className="align-top">
                                    <td className="py-1 font-mono">
                                        {format(new Date(item.date), "dd-MM HH:mm")}
                                        <span className="block text-[6px] text-slate-500 uppercase">
                                            {item.type === "CHARGE" ? 'DEBIT' : 'PAYMENT'} {shortId}
                                        </span>
                                    </td>
                                    <td className="py-1 text-right">
                                        <span className={item.type === "CHARGE" ? "font-bold text-slate-800" : "font-bold text-emerald-600"}>
                                            {amountPrefix}₹{Number(item.amount).toFixed(0)}
                                        </span>
                                        <span className="block text-[6px] text-slate-500 font-mono">
                                            Bal: ₹{Number(item.runningBalance).toFixed(0)}
                                        </span>
                                    </td>
                                </tr>
                            );
                        })}
                        {ledger.length === 0 && (
                            <tr>
                                <td colSpan={2} className="text-center py-4 text-slate-400">No transactions</td>
                            </tr>
                        )}
                    </tbody>
                </table>

                <div className="border-t border-black my-1.5" />

                {/* Footer */}
                <div className="text-center space-y-1">
                    <p className="font-extrabold uppercase text-[8px]">Outstanding Balance</p>
                    <p className="font-black text-xs text-orange-600">₹{Number(summary.outstandingDue).toFixed(2)}</p>
                    <p className="text-[7px] text-slate-500 leading-tight">
                        Please reconcile this balance.<br/>Thank you for your business!
                    </p>
                </div>
            </div>
        </>
    );
}
