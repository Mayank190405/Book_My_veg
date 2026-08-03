"use client";

import { useEffect, useState, use } from "react";
import { 
    Printer, Building, Smartphone, CheckCircle2, XCircle, Loader2, ArrowLeft, CreditCard 
} from "lucide-react";
import Link from "next/link";
import api from "@/services/api";

interface InvoicePageProps {
    params: Promise<{ id: string }>;
}

export default function InvoicePage({ params }: InvoicePageProps) {
    const { id } = use(params);
    const [loading, setLoading] = useState(true);
    const [order, setOrder] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchInvoice = async () => {
            try {
                // Fetch public order details using pay-info
                const res = await api.get(`/pay/pay-info?billid=${id}`);
                if (res.data.bill) {
                    setOrder(res.data.bill);
                } else {
                    setError("Invoice details could not be found.");
                }
            } catch (err: any) {
                setError(err.response?.data?.message || "Failed to load invoice. Please verify the URL.");
            } finally {
                setLoading(false);
            }
        };

        if (id) {
            fetchInvoice();
        }
    }, [id]);

    const handlePrint = () => {
        window.print();
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6">
                <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mb-4" />
                <p className="text-sm text-slate-400 font-bold uppercase tracking-wider">Loading Customer Invoice...</p>
            </div>
        );
    }

    if (error || !order) {
        return (
            <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center">
                <div className="max-w-md bg-slate-900 border border-red-500/20 p-8 rounded-3xl space-y-4">
                    <XCircle className="w-16 h-16 text-red-500 mx-auto" />
                    <h2 className="text-xl font-bold uppercase">Invoice Error</h2>
                    <p className="text-sm text-slate-400 leading-relaxed">{error || "Could not retrieve invoice details."}</p>
                    <Link href="/" className="inline-block px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider">
                        Return Home
                    </Link>
                </div>
            </div>
        );
    }

    const formattedDate = new Date(order.createdAt).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });

    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between font-sans print:bg-white print:text-black">
            
            {/* Header Controls (hidden on print) */}
            <div className="w-full bg-slate-950/80 border-b border-slate-800/60 p-4 sticky top-0 backdrop-blur-md z-50 print:hidden">
                <div className="max-w-3xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-bold">
                            <Building className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-white uppercase leading-none">Invoice Portal</h2>
                            <p className="text-[9px] text-slate-500 font-black uppercase mt-1">Invoice #{order.id.slice(-5).toUpperCase()}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button 
                            onClick={handlePrint}
                            className="h-10 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/10"
                        >
                            <Printer className="w-4 h-4" /> Print / Save PDF
                        </button>
                        {order.dueAmount > 0 && (
                            <Link 
                                href={`/pay?billid=${order.id}`}
                                className="h-10 px-4 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center gap-2"
                            >
                                <CreditCard className="w-4 h-4 text-emerald-400" /> Pay Outstanding
                            </Link>
                        )}
                    </div>
                </div>
            </div>

            {/* Printable Invoice Page */}
            <div className="flex-1 flex justify-center p-4 sm:p-8 print:p-0 print:m-0">
                <div className="max-w-3xl w-full bg-slate-950 border border-slate-800 rounded-[2rem] p-6 sm:p-10 shadow-2xl space-y-8 print:border-none print:shadow-none print:bg-white print:text-black print:p-0 print:m-0">
                    
                    {/* Header Row */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 pb-6 border-b border-slate-800 print:border-black">
                        <div className="space-y-1">
                            <h1 className="text-3xl font-black uppercase tracking-tight text-white print:text-black">Book My Veg</h1>
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider print:text-slate-600">Fresh Organic Produce directly to you</p>
                            <p className="text-[10px] text-slate-500 font-medium">GSTIN: 27AAGCB3287K1Z3 • Ph: 8208363287</p>
                        </div>
                        <div className="text-left sm:text-right space-y-1">
                            <div className="text-xs text-slate-500 uppercase font-black tracking-widest">Retail Bill Invoice</div>
                            <div className="text-xl font-bold tracking-tight text-white print:text-black font-mono">#{order.id.slice(-5).toUpperCase()}</div>
                            <div className="text-[10px] text-slate-400 font-medium print:text-slate-600">{formattedDate}</div>
                        </div>
                    </div>

                    {/* Meta/Client/Payment Details */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pb-6 border-b border-slate-800 print:border-black text-xs">
                        <div className="space-y-1">
                            <p className="text-[9px] font-black uppercase text-slate-500 tracking-wider">Billed To (Customer)</p>
                            <p className="font-bold text-white print:text-black text-sm">{order.user?.name || "Walk-In Customer"}</p>
                            {order.user?.phone && <p className="font-medium text-slate-400 print:text-slate-700">Phone: {order.user.phone}</p>}
                            {order.user?.email && <p className="font-medium text-slate-400 print:text-slate-700">Email: {order.user.email}</p>}
                        </div>

                        <div className="space-y-2 text-left sm:text-right">
                            <p className="text-[9px] font-black uppercase text-slate-500 tracking-wider sm:text-right">Invoice / Payment Status</p>
                            <div className="flex sm:justify-end gap-2 items-center">
                                <span className={`px-3 py-1 text-[9px] font-black uppercase tracking-widest rounded-full border ${
                                    order.isPaid
                                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 print:bg-none print:border-black print:text-black"
                                        : "bg-amber-500/10 border-amber-500/30 text-amber-400 print:bg-none print:border-black print:text-black"
                                }`}>
                                    {order.isPaid ? "PAID" : `DUE: ₹${order.dueAmount.toFixed(2)}`}
                                </span>
                            </div>
                            <p className="text-[10px] text-slate-400 print:text-slate-700">
                                <strong>Payment Method:</strong> {order.paymentStatus === "CASH" ? "CASH" : (order.paymentStatus === "CREDIT" ? "ON ACCOUNT (CREDIT)" : "DIGITAL PAY")}
                            </p>
                            <p className="text-[10px] text-slate-400 print:text-slate-700">
                                <strong>Reference ID:</strong> <span className="font-mono text-[9px]">{order.id}</span>
                            </p>
                        </div>
                    </div>

                    {/* Table of Items */}
                    <div className="space-y-3">
                        <p className="text-[9px] font-black uppercase text-slate-500 tracking-wider">Order Items List</p>
                        <div className="w-full overflow-hidden border border-slate-800 rounded-xl print:border-black">
                            <table className="w-full text-xs text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-900 border-b border-slate-800 print:bg-slate-200 print:border-black print:text-black">
                                        <th className="p-3 font-bold uppercase tracking-wider w-12 text-center">Sr.</th>
                                        <th className="p-3 font-bold uppercase tracking-wider">Product / Item</th>
                                        <th className="p-3 font-bold uppercase tracking-wider text-center w-24">Unit Price</th>
                                        <th className="p-3 font-bold uppercase tracking-wider text-center w-20">Qty</th>
                                        <th className="p-3 font-bold uppercase tracking-wider text-right w-28">Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {order.items?.map((item: any, idx: number) => (
                                        <tr key={item.id} className="border-b border-slate-800/80 last:border-none print:border-black print:text-black">
                                            <td className="p-3 text-center text-slate-400 font-mono print:text-black">{idx + 1}</td>
                                            <td className="p-3 font-bold text-white print:text-black">{item.name}</td>
                                            <td className="p-3 text-center font-mono">₹{item.sellingPrice.toFixed(2)}</td>
                                            <td className="p-3 text-center font-bold font-mono">{item.quantity}</td>
                                            <td className="p-3 text-right font-bold font-mono text-white print:text-black">₹{(item.sellingPrice * item.quantity).toFixed(2)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Totals Section */}
                    <div className="flex justify-end pt-4">
                        <div className="w-full sm:w-80 space-y-2 bg-slate-950 p-4 border border-slate-800 rounded-2xl print:border-black print:text-black print:bg-white text-xs">
                            <div className="flex justify-between text-slate-400 print:text-slate-600 font-medium">
                                <span>Subtotal:</span>
                                <span className="font-mono">₹{order.totalAmount.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-slate-400 print:text-slate-600 font-medium">
                                <span>Paid Amount:</span>
                                <span className="font-mono">₹{order.paidAmount.toFixed(2)}</span>
                            </div>
                            <div className="h-px bg-slate-800 print:bg-black my-1" />
                            <div className="flex justify-between text-white print:text-black text-sm font-black uppercase">
                                <span>Balance Due:</span>
                                <span className="font-mono text-emerald-400 print:text-black">₹{order.dueAmount.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Footnotes */}
                    <div className="text-center pt-8 border-t border-slate-800/60 print:border-black text-[9px] text-slate-500 print:text-slate-600 font-medium space-y-1">
                        <p>This is a computer-generated invoice and requires no physical signature.</p>
                        <p>Thank you for choosing <strong>Book My Veg</strong>! We look forward to serving you again.</p>
                        <p className="text-[8px] text-slate-600 italic">Authenticated POS System — BMV Systems</p>
                    </div>
                </div>
            </div>

            {/* Bottom Footer (hidden on print) */}
            <div className="bg-slate-950 border-t border-slate-800 p-4 text-center text-xs text-slate-600 font-semibold uppercase tracking-wider print:hidden">
                Book My Veg • Organic Intelligence
            </div>
        </div>
    );
}
