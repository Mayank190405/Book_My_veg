"use client";

import { useMemo } from "react";
import { Printer, X } from "lucide-react";

interface BillItem {
    id: string;
    name: string;
    quantity: number;
    price: number;
    unit: string;
}

interface BillPreviewProps {
    items: BillItem[];
    subtotal: number;
    tax: number;
    discount: number;
    total: number;
    customerName?: string;
    customerPhone?: string;
    onClose: () => void;
}

export default function BillPreview({
    items, subtotal, tax, discount, total, customerName, customerPhone, onClose
}: BillPreviewProps) {
    const today = useMemo(() => new Date().toLocaleString(), []);

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50/50">
                    <div className="flex items-center gap-2">
                        <Printer className="w-5 h-5 text-cyan-600" />
                        <h2 className="text-xl font-black text-slate-800 italic">Bill Preview</h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                {/* Bill Content (The Thermal Receipt) */}
                <div className="flex-1 overflow-y-auto p-8 bg-slate-100 flex justify-center">
                    <div className="bg-white w-full max-w-[80mm] shadow-md p-6 font-mono text-[11px] text-slate-800 print-area leading-relaxed border-t-4 border-cyan-500">
                        <div className="text-center mb-4">
                            <h1 className="text-lg font-black uppercase tracking-tighter mb-1">BOOK MY VEG</h1>
                            <p className="opacity-70 text-[9px]">Quality Farm Fresh Produce</p>
                            <p className="opacity-70 text-[9px]">Store ID: SYSTEM-POS-01</p>
                            <div className="border-b border-dashed border-slate-300 my-4" />
                        </div>

                        <div className="flex justify-between mb-1">
                            <span>Date:</span>
                            <span className="font-bold">{today}</span>
                        </div>
                        {customerName && (
                            <div className="mb-1">
                                <p>Customer: <span className="font-bold uppercase">{customerName}</span></p>
                                <p>Phone: <span className="font-bold">{customerPhone}</span></p>
                            </div>
                        )}
                        <div className="border-b border-dashed border-slate-300 my-3" />

                        {/* Items Table */}
                        <div className="mb-4">
                            <div className="flex font-black uppercase mb-2 border-b border-slate-100 pb-1">
                                <span className="flex-1">Item</span>
                                <span className="w-10 text-right">Qty</span>
                                <span className="w-16 text-right">Amt</span>
                            </div>
                            {items.map(item => (
                                <div key={item.id} className="flex mb-1">
                                    <span className="flex-1 truncate">{item.name}</span>
                                    <span className="w-10 text-right">{item.quantity} {item.unit}</span>
                                    <span className="w-16 text-right font-bold">₹{(item.price * item.quantity).toFixed(2)}</span>
                                </div>
                            ))}
                        </div>

                        <div className="border-b border-dashed border-slate-300 my-4" />

                        {/* Summary */}
                        <div className="space-y-1">
                            <div className="flex justify-between">
                                <span>Subtotal:</span>
                                <span>₹{subtotal.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Tax (5%):</span>
                                <span>₹{tax.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-rose-500">
                                <span>Discount:</span>
                                <span>-₹{discount.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-base font-black border-t border-slate-900 pt-2 mt-2">
                                <span className="uppercase italic">Grand Total</span>
                                <span>₹{total.toFixed(2)}</span>
                            </div>
                        </div>

                        <div className="text-center mt-10 opacity-60">
                            <p className="font-black italic text-xs mb-2">Thank You!</p>
                            <p className="text-[8px]">Visit us again at www.bookmyveg.com</p>
                            <p className="text-[8px]">*** Customer Copy ***</p>
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-6 bg-white border-t border-slate-100 flex gap-4">
                    <button
                        onClick={handlePrint}
                        className="flex-1 bg-cyan-600 hover:bg-cyan-700 text-white font-black py-4 rounded-2xl shadow-xl shadow-cyan-100 transition-all flex items-center justify-center gap-3"
                    >
                        <Printer className="w-5 h-5" /> PRINT BILL
                    </button>
                    <button
                        onClick={onClose}
                        className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-500 font-black py-4 rounded-2xl transition-all"
                    >
                        CLOSE
                    </button>
                </div>
            </div>

            <style jsx global>{`
                @media print {
                    @page { size: 80mm auto; margin: 0; }
                    body * { display: none !important; }
                    .print-area, .print-area * { display: block !important; visibility: visible !important; }
                    .print-area { 
                        position: absolute; 
                        left: 0; 
                        top: 0; 
                        width: 80mm; 
                        padding: 10px;
                        background: white !important;
                    }
                }
            `}</style>
        </div>
    );
}
