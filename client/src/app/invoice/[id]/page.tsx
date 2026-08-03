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
            <div className="min-h-screen bg-[#fbfdfc] dark:bg-[#061512] flex flex-col items-center justify-center p-6">
                <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mb-4" />
                <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Loading Invoice...</p>
            </div>
        );
    }

    if (error || !order) {
        return (
            <div className="min-h-screen bg-[#fbfdfc] dark:bg-[#061512] flex flex-col items-center justify-center p-6 text-center">
                <div className="max-w-md bg-white dark:bg-[#0b1c19] border border-slate-200 dark:border-red-500/20 p-8 rounded-[2.5rem] shadow-xl space-y-4">
                    <XCircle className="w-16 h-16 text-red-500 mx-auto" />
                    <h2 className="text-xl font-bold uppercase text-slate-900 dark:text-white">Invoice Error</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{error || "Could not retrieve invoice details."}</p>
                    <Link href="/" className="inline-block px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider">
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

    const isPaidOrder = order.isPaid || order.paymentStatus === "COMPLETED" || order.paymentStatus === "PAID";

    return (
        <div className="min-h-screen bg-[#fbfdfc] dark:bg-[#061512] text-slate-900 dark:text-slate-100 flex flex-col justify-between relative overflow-y-auto font-sans print:bg-white print:text-black">
            
            {/* Ambient Website Theme Background Glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-emerald-500/10 dark:bg-emerald-500/15 blur-[140px] rounded-full pointer-events-none print:hidden" />
            <div className="absolute bottom-0 right-0 w-[400px] h-[300px] bg-teal-500/10 dark:bg-teal-500/15 blur-[120px] rounded-full pointer-events-none print:hidden" />

            {/* Header Controls (hidden on print) */}
            <div className="w-full bg-[#fbfdfc]/80 dark:bg-[#061512]/80 border-b border-slate-200/80 dark:border-slate-800/80 p-4 sticky top-0 backdrop-blur-md z-50 print:hidden">
                <div className="max-w-xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-bold shadow-lg shadow-emerald-500/20">
                            <Building className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase leading-none">Book My Veg</h2>
                            <p className="text-[9px] text-slate-400 font-black uppercase mt-1">Invoice #{order.id.slice(-5).toUpperCase()}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button 
                            onClick={handlePrint}
                            className="h-9 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-500/10"
                        >
                            <Printer className="w-3.5 h-3.5" /> Print Receipt
                        </button>
                        {!isPaidOrder && (
                            <Link 
                                href={`/pay?billid=${order.id}`}
                                className="h-9 px-3 bg-slate-800 dark:bg-emerald-500/10 hover:bg-slate-700 dark:hover:bg-emerald-500/20 text-white dark:text-emerald-400 border border-slate-700 dark:border-emerald-500/20 font-bold text-[10px] uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5"
                            >
                                <CreditCard className="w-3.5 h-3.5 text-emerald-400" /> Pay Due
                            </Link>
                        )}
                    </div>
                </div>
            </div>

            {/* Screen Receipt Wrapper */}
            <div className="flex-1 flex justify-center p-4 sm:p-8 z-10 relative print:p-0 print:m-0 print:block">
                
                {/* Visual Digital Receipt Card (formatted like thermal slip on screen, and forced 58mm on print) */}
                <div className="max-w-md w-full bg-white dark:bg-[#0b1c19] text-slate-900 dark:text-slate-100 rounded-[2.5rem] border border-slate-200/90 dark:border-emerald-500/20 p-6 shadow-2xl space-y-6 print:border-none print:shadow-none print:bg-white print:text-black print:p-2 print:m-0 print:w-[58mm] print:rounded-none">
                    
                    {/* Thermal Style Header */}
                    <div className="text-center space-y-1 pb-4 border-b border-dashed border-slate-300 dark:border-emerald-500/20 print:border-black print:pb-2">
                        <h1 className="text-2xl font-black uppercase tracking-tight text-slate-950 dark:text-white print:text-black print:text-[13px] print:m-0">Book My Veg</h1>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider print:text-[7.5px] print:text-slate-600 print:m-0">Primary Distribution Center</p>
                        <div className="text-[9px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-tight print:text-[8px] print:m-0">
                            PH: 8208363287 • GSTIN: 27AAGCB3287K1Z3
                        </div>
                    </div>

                    {/* Metadata Rows */}
                    <div className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300 font-medium print:text-[8px] print:text-black print:leading-normal print:space-y-0.5">
                        <div className="flex justify-between">
                            <span className="text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider print:text-black">Date:</span>
                            <span className="font-semibold text-slate-900 dark:text-slate-200 print:text-black">{formattedDate}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider print:text-black">Invoice No:</span>
                            <span className="font-mono font-bold text-slate-950 dark:text-white print:text-black">#{order.id.slice(-5).toUpperCase()}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider print:text-black">Reference No:</span>
                            <span className="font-mono text-slate-600 dark:text-slate-400 text-[10px] print:text-[8px]">{order.id}</span>
                        </div>
                        <div className="h-px border-b border-dashed border-slate-200 dark:border-emerald-500/20 my-2 print:border-black" />
                        <div className="space-y-0.5">
                            <div className="flex justify-between">
                                <span className="text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider print:text-black">Customer:</span>
                                <span className="font-bold text-slate-950 dark:text-white print:text-black">{order.user?.name || "Walk-In"}</span>
                            </div>
                            {order.user?.phone && (
                                <div className="flex justify-between">
                                    <span className="text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider print:text-black">Phone:</span>
                                    <span className="font-semibold text-slate-800 dark:text-slate-300 print:text-black">{order.user.phone}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Itemized Table */}
                    <div className="space-y-2">
                        <p className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider print:text-black print:text-[8px] print:m-0">Item Breakdown</p>
                        <table className="w-full text-xs text-slate-800 dark:text-slate-300 border-collapse print:text-[7.5px] print:text-black">
                            <thead>
                                <tr className="border-t border-b border-slate-300 dark:border-emerald-500/20 font-bold text-slate-950 dark:text-white print:border-black print:text-black">
                                    <th className="py-2 text-left w-8 print:py-1">Sr.No</th>
                                    <th className="py-2 text-left print:py-1">Name</th>
                                    <th className="py-2 text-center w-16 print:py-1">Price</th>
                                    <th className="py-2 text-center w-16 print:py-1">Discount</th>
                                    <th className="py-2 text-center w-12 print:py-1">QTY</th>
                                    <th className="py-2 text-right w-20 print:py-1">Amt</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 print:divide-black">
                                {order.items?.map((item: any, idx: number) => (
                                    <tr key={item.id} className="text-slate-700 dark:text-slate-300 print:text-black">
                                        <td className="py-2 text-slate-400 dark:text-slate-500 print:py-1 print:text-black font-mono">{idx + 1}</td>
                                        <td className="py-2 font-bold text-slate-950 dark:text-white print:py-1 print:text-black">{item.name}</td>
                                        <td className="py-2 text-center print:py-1 font-mono">Rs.{item.sellingPrice.toFixed(2)}</td>
                                        <td className="py-2 text-center print:py-1 font-mono text-amber-600 dark:text-amber-400 print:text-black">Rs.{Number(item.discount || 0).toFixed(2)}</td>
                                        <td className="py-2 text-center font-bold print:py-1 font-mono">{Number(item.quantity).toFixed(3)}</td>
                                        <td className="py-2 text-right font-bold print:py-1 font-mono text-slate-950 dark:text-white print:text-black">Rs.{(item.sellingPrice * item.quantity).toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Totals Block */}
                    <div className="border-t border-dashed border-slate-300 dark:border-emerald-500/20 pt-4 space-y-2 text-xs font-semibold print:border-black print:pt-2 print:text-[8px] print:space-y-1">
                        <div className="flex justify-between text-slate-500 dark:text-slate-400 print:text-black">
                            <span>Subtotal:</span>
                            <span className="font-mono">Rs.{order.totalAmount.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-slate-500 dark:text-slate-400 print:text-black">
                            <span>Paid Amount:</span>
                            <span className="font-mono">Rs.{order.paidAmount.toFixed(2)}</span>
                        </div>
                        <div className="h-px border-b border-dashed border-slate-200 dark:border-emerald-500/20 print:border-black my-1" />
                        <div className="flex justify-between text-lg font-black text-slate-950 dark:text-white print:text-[10px] print:text-black">
                            <span>Grand Total:</span>
                            <span className="font-mono">Rs.{order.totalAmount.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm font-black text-emerald-600 dark:text-emerald-400 print:text-[9px] print:text-black">
                            <span>Balance Due:</span>
                            <span className="font-mono text-emerald-600 dark:text-emerald-400 print:text-black">Rs.{order.dueAmount.toFixed(2)}</span>
                        </div>
                    </div>

                    {/* Thermal Footer */}
                    <div className="border border-slate-200 dark:border-emerald-500/20 rounded-2xl p-4 text-center text-[10px] text-slate-500 dark:text-slate-400 font-bold leading-relaxed bg-slate-50 dark:bg-emerald-500/5 print:border-black print:bg-white print:p-2 print:text-[7.5px] print:text-black print:rounded-none">
                        Thank you for shopping with us. Please visit again.<br/>
                        Products you purchase can only be replaced within 12 hours of the bill being generated.
                    </div>
                </div>
            </div>

            {/* Bottom Footer (hidden on print) */}
            <div className="bg-[#fbfdfc] dark:bg-[#061512] border-t border-slate-200/80 dark:border-slate-800/80 p-4 text-center text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider print:hidden z-10 relative">
                Book My Veg • Organic Distribution Hub
            </div>

            {/* Strict 58mm Thermal Print CSS Stylesheet override */}
            <style jsx global>{`
                @media print {
                    /* Reset everything for 58mm thermal print */
                    body, html, #__next, main, div, section {
                        background: white !important;
                        color: #000 !important;
                        padding: 0 !important;
                        margin: 0 !important;
                        width: 58mm !important;
                    }
                    body {
                        font-family: 'Poppins', Arial, sans-serif !important;
                        width: 58mm !important;
                        margin: 0 auto !important;
                        padding: 2mm !important;
                        font-size: 8.5px !important;
                        line-height: 1.3 !important;
                        font-weight: 600 !important;
                    }
                    @page {
                        size: 58mm auto;
                        margin: 0;
                    }
                    .print\\:hidden {
                        display: none !important;
                    }
                    /* Override border rules to solid black print lines */
                    .border-dashed {
                        border-style: dashed !important;
                        border-color: #000 !important;
                    }
                    .border-b {
                        border-bottom: 1px solid #000 !important;
                    }
                    .border-t {
                        border-top: 1px solid #000 !important;
                    }
                    table {
                        border-collapse: collapse !important;
                        width: 100% !important;
                    }
                    table th, table td {
                        border: 1px solid #000 !important;
                        padding: 3px 4px !important;
                        font-size: 7.5px !important;
                        font-weight: 600 !important;
                    }
                    table th {
                        font-weight: 800 !important;
                    }
                }
            `}</style>
        </div>
    );
}
