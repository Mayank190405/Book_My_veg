"use client";

import { useState } from "react";
import { Coffee, Pizza, Heart, Plus, Sliders } from "lucide-react";
import { cn } from "@/lib/utils";

const TIP_OPTIONS = [
    { amount: 10, icon: Coffee, label: "Tea" },
    { amount: 35, icon: Pizza, label: "Samosa" },
    { amount: 50, icon: Heart, label: "Love" },
];

interface TippingSectionProps {
    selectedTip: number;
    onTipChange: (amount: number) => void;
}

export default function TippingSection({ selectedTip, onTipChange }: TippingSectionProps) {
    const [isCustomMode, setIsCustomMode] = useState(false);
    const [customAmount, setCustomAmount] = useState(100);

    const handleSelectOption = (amount: number) => {
        setIsCustomMode(false);
        if (selectedTip === amount) {
            onTipChange(0);
        } else {
            onTipChange(amount);
        }
    };

    const handleCustomClick = () => {
        setIsCustomMode(true);
        onTipChange(customAmount);
    };

    const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const amount = Number(e.target.value);
        setCustomAmount(amount);
        onTipChange(amount);
    };

    const isOptionActive = (amount: number) => {
        return !isCustomMode && selectedTip === amount;
    };

    return (
        <section className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
            <div className="p-4 space-y-4">
                <div className="flex justify-between items-start">
                    <div className="space-y-1">
                        <h3 className="text-sm font-black text-foreground uppercase tracking-tight leading-none italic">Tip Delivery Partner</h3>
                        <p className="text-[9px] font-bold text-foreground/60 leading-relaxed max-w-[150px]">
                            Help them earn a little extra for their effort.
                        </p>
                    </div>
                    {/* Simplified Illustration */}
                    <div className="relative w-16 h-16 bg-secondary/50 rounded-full flex items-center justify-center overflow-hidden">
                         <div className="absolute inset-0 bg-emerald-500/5" />
                         <div className="relative z-10 text-4xl">🛵</div>
                    </div>
                </div>

                <div className="grid grid-cols-4 gap-2">
                    {TIP_OPTIONS.map((tip) => {
                        const Icon = tip.icon;
                        const active = isOptionActive(tip.amount);
                        return (
                            <button
                                key={tip.amount}
                                type="button"
                                onClick={() => handleSelectOption(tip.amount)}
                                className={cn(
                                    "flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all active:scale-95",
                                    active 
                                        ? "bg-emerald-500 border-emerald-400 text-white shadow-lg shadow-emerald-500/20" 
                                        : "bg-background border-border text-foreground hover:bg-secondary"
                                )}
                            >
                                <Icon className={cn("h-4 w-4", active ? "text-white" : "text-emerald-500")} />
                                <span className="text-[10px] font-black tracking-tight">₹{tip.amount}</span>
                            </button>
                        );
                    })}
                    <button
                        type="button"
                        onClick={handleCustomClick}
                        className={cn(
                            "flex flex-col items-center justify-center gap-1 p-3 rounded-2xl border transition-all active:scale-95",
                            isCustomMode
                                ? "bg-emerald-500 border-emerald-400 text-white shadow-lg shadow-emerald-500/20"
                                : "bg-background border-border text-foreground hover:bg-secondary"
                        )}
                    >
                        <Plus className={cn("h-4 w-4", isCustomMode ? "text-white" : "text-foreground/60")} />
                        <span className={cn("text-[10px] font-black tracking-tight", isCustomMode ? "text-white" : "text-foreground/60")}>Custom</span>
                    </button>
                </div>

                {/* Interactive Slider Section */}
                {isCustomMode && (
                    <div className="p-4 bg-secondary/30 rounded-2xl border border-border animate-in slide-in-from-top-2 duration-500 space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Sliders className="h-4 w-4 text-emerald-500" />
                                <span className="text-[10px] font-black text-foreground uppercase tracking-widest">Adjust Custom Tip</span>
                            </div>
                            <span className="text-lg font-black text-emerald-600 italic">₹{customAmount}</span>
                        </div>
                        <div className="space-y-1">
                            <input
                                type="range"
                                min="0"
                                max="200"
                                step="5"
                                value={customAmount}
                                onChange={handleSliderChange}
                                className="w-full h-2 bg-border rounded-lg appearance-none cursor-pointer accent-emerald-500 focus:outline-none"
                            />
                            <div className="flex justify-between text-[8px] font-black text-foreground/20 uppercase tracking-widest px-1">
                                <span>₹0</span>
                                <span>₹100</span>
                                <span>₹200</span>
                            </div>
                        </div>
                    </div>
                )}

                <p className="text-[9px] font-black text-foreground/40 uppercase tracking-[0.2em] text-center">
                    {selectedTip > 0 ? `₹${selectedTip} Tip will be added to order` : "100% of the tip goes to the partner"}
                </p>
            </div>
        </section>
    );
}
