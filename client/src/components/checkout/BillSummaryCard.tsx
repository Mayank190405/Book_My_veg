"use client";

import { FileText, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface BillSummaryCardProps {
    totalPrice: number;
    deliveryFee: number;
    discount: number;
    grandTotal: number;
    tip?: number;
}

export default function BillSummaryCard({ totalPrice, deliveryFee, discount, grandTotal, tip = 0 }: BillSummaryCardProps) {
    const handlingFee = 10; // Sample handling fee as seen in Zepto
    const totalWithFees = grandTotal + handlingFee;

    return (
        <section className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-border bg-secondary/30 flex items-center gap-3">
                <div className="w-7 h-7 bg-background rounded-lg flex items-center justify-center border border-border shadow-sm">
                    <FileText className="h-3.5 w-3.5 text-foreground/60" />
                </div>
                <h3 className="text-[11px] font-black text-foreground uppercase tracking-widest">Bill Summary</h3>
            </div>
            
            <div className="p-4 space-y-3">
                {/* Item Total */}
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-foreground/60 uppercase tracking-widest">Item Total</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-foreground/30 line-through">₹{(totalPrice + discount).toFixed(0)}</span>
                        <span className="text-sm font-black text-foreground">₹{totalPrice.toFixed(0)}</span>
                    </div>
                </div>

                {/* Delivery Fee */}
                <div className="flex justify-between items-center">
                    <span className="text-[11px] font-bold text-foreground/60 uppercase tracking-widest">Delivery Fee</span>
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-foreground/30 line-through">₹30</span>
                        <span className={cn("text-sm font-black uppercase tracking-widest", deliveryFee === 0 ? "text-emerald-600" : "text-foreground")}>
                            {deliveryFee === 0 ? "FREE" : `₹${deliveryFee}`}
                        </span>
                    </div>
                </div>

                {/* Handling Fee */}
                <div className="flex justify-between items-center">
                    <span className="text-[11px] font-bold text-foreground/60 uppercase tracking-widest">Handling Fee</span>
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-foreground/30 line-through">₹{handlingFee}</span>
                        <span className="text-sm font-black text-emerald-600 uppercase tracking-widest">FREE</span>
                    </div>
                </div>

                {/* Driver Tip */}
                {tip > 0 && (
                    <div className="flex justify-between items-center animate-in fade-in duration-300">
                        <span className="text-[11px] font-bold text-foreground/60 uppercase tracking-widest">Driver Tip</span>
                        <span className="text-sm font-black text-foreground">₹{tip}</span>
                    </div>
                )}

                {/* Grand Total */}
                <div className="pt-4 border-t border-dashed border-border flex justify-between items-end">
                    <div className="flex flex-col">
                        <span className="text-[11px] font-black text-foreground uppercase tracking-[0.2em]">To Pay</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-foreground/30 line-through mb-1">₹{(totalPrice + 30 + handlingFee).toFixed(0)}</span>
                        <span className="text-2xl font-black text-foreground tabular-nums tracking-tighter italic">₹{grandTotal.toFixed(0)}</span>
                    </div>
                </div>
            </div>

            {/* Savings Footer */}
            {(discount > 0 || deliveryFee === 0) && (
                <div className="bg-emerald-500/5 px-5 py-3 border-t border-emerald-500/10 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Total Savings</span>
                    </div>
                    <span className="text-xs font-black text-emerald-600">₹{(discount + (deliveryFee === 0 ? 30 : 0) + handlingFee).toFixed(0)}</span>
                </div>
            )}
        </section>
    );
}
