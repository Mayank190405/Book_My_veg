"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Calendar, Clock, Zap, CheckCircle2 } from "lucide-react";

interface DeliverySlot {
    id: string;
    label: string;
    available: boolean;
}

interface DeliverySlotPickerProps {
    onSelect: (slot: { date: string; time: string; mode: "INSTANT" | "SCHEDULED" } | null) => void;
}

export default function DeliverySlotPicker({ onSelect }: DeliverySlotPickerProps) {
    const [mode, setMode] = useState<"INSTANT" | "SCHEDULED">("INSTANT");
    const [selectedDate, setSelectedDate] = useState<number>(0); 
    const [selectedTimeId, setSelectedTimeId] = useState<string | null>("09-11");

    const dates = Array.from({ length: 4 }).map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() + i);
        return {
            index: i,
            day: d.toLocaleDateString("en-US", { weekday: "short" }),
            date: d.getDate(),
            month: d.toLocaleDateString("en-US", { month: "short" }),
            fullDate: d.toISOString().split("T")[0],
        };
    });

    const slots: DeliverySlot[] = [
        { id: "09-11", label: "9 AM - 11 AM", available: true },
        { id: "11-13", label: "11 AM - 1 PM", available: true },
        { id: "14-16", label: "2 PM - 4 PM", available: true },
        { id: "17-19", label: "5 PM - 7 PM", available: true },
        { id: "19-21", label: "7 PM - 9 PM", available: true },
    ];

    useEffect(() => {
        if (mode === "INSTANT") {
            const today = new Date().toISOString().split("T")[0];
            onSelect({ date: today, time: "INSTANT", mode: "INSTANT" });
        } else if (selectedTimeId) {
            const date = dates[selectedDate].fullDate;
            const slot = slots.find((s) => s.id === selectedTimeId);
            if (slot) {
                onSelect({ date, time: slot.label, mode: "SCHEDULED" });
            }
        } else {
            onSelect(null);
        }
    }, [mode, selectedDate, selectedTimeId]);

    return (
        <div className="space-y-3">
            {/* Delivery Mode Toggle */}
            <div className="grid grid-cols-2 gap-2.5">
                <button
                    type="button"
                    onClick={() => setMode("INSTANT")}
                    className={cn(
                        "relative p-4 rounded-2xl border transition-all duration-200 flex flex-col items-center justify-center gap-1 overflow-hidden",
                        mode === "INSTANT"
                            ? "bg-[#017649] border-[#017649] text-white shadow-sm"
                            : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50/50"
                    )}
                >
                    <Zap className={cn("h-4.5 w-4.5", mode === "INSTANT" ? "text-white fill-white" : "text-[#017649]")} />
                    <p className={cn("text-xs font-bold leading-none mt-1", mode === "INSTANT" ? "text-white" : "text-slate-900")}>Instant Delivery</p>
                    <p className={cn("text-[10px] font-medium leading-none mt-0.5", mode === "INSTANT" ? "text-emerald-100" : "text-slate-400")}>Delivered within minutes</p>
                    {mode === "INSTANT" && (
                        <div className="absolute top-2.5 right-2.5 w-4 h-4 rounded-full bg-white flex items-center justify-center text-[#017649]">
                            <CheckCircle2 className="w-3.5 h-3.5 fill-[#017649] text-white" />
                        </div>
                    )}
                </button>

                <button
                    type="button"
                    onClick={() => setMode("SCHEDULED")}
                    className={cn(
                        "relative p-4 rounded-2xl border transition-all duration-200 flex flex-col items-center justify-center gap-1 overflow-hidden",
                        mode === "SCHEDULED"
                            ? "bg-[#017649] border-[#017649] text-white shadow-sm"
                            : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50/50"
                    )}
                >
                    <Calendar className={cn("h-4.5 w-4.5", mode === "SCHEDULED" ? "text-white" : "text-[#017649]")} />
                    <p className={cn("text-xs font-bold leading-none mt-1", mode === "SCHEDULED" ? "text-white" : "text-slate-900")}>Schedule for Later</p>
                    <p className={cn("text-[10px] font-medium leading-none mt-0.5", mode === "SCHEDULED" ? "text-emerald-100" : "text-slate-400")}>Pick date & time slot</p>
                    {mode === "SCHEDULED" && (
                        <div className="absolute top-2.5 right-2.5 w-4 h-4 rounded-full bg-white flex items-center justify-center text-[#017649]">
                            <CheckCircle2 className="w-3.5 h-3.5 fill-[#017649] text-white" />
                        </div>
                    )}
                </button>
            </div>

            {/* Expanded Schedule Picker */}
            {mode === "SCHEDULED" && (
                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 space-y-3.5 shadow-2xs animate-in fade-in slide-in-from-top-1 duration-200">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Select Date</p>
                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                        {dates.map((d) => (
                            <button
                                key={d.index}
                                type="button"
                                onClick={() => { setSelectedDate(d.index); }}
                                className={cn(
                                    "flex flex-col items-center justify-center min-w-[70px] py-2.5 px-3 rounded-xl border transition-all duration-200",
                                    selectedDate === d.index
                                        ? "bg-[#017649] border-[#017649] text-white shadow-xs"
                                        : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                                )}
                            >
                                <span className={cn("text-[10px] font-bold uppercase", selectedDate === d.index ? "text-emerald-100" : "text-slate-500")}>
                                    {d.index === 0 ? "Today" : d.day}
                                </span>
                                <span className="text-lg font-black tabular-nums leading-tight">{d.date}</span>
                                <span className={cn("text-[10px] font-semibold", selectedDate === d.index ? "text-emerald-100" : "text-slate-400")}>{d.month}</span>
                            </button>
                        ))}
                    </div>

                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 pt-1">Select Time Slot</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {slots.map((slot) => (
                            <button
                                key={slot.id}
                                type="button"
                                onClick={() => setSelectedTimeId(slot.id)}
                                disabled={!slot.available}
                                className={cn(
                                    "py-2.5 px-3 rounded-xl border text-center transition-all duration-200 text-xs font-bold",
                                    selectedTimeId === slot.id
                                        ? "bg-[#017649] text-white border-[#017649] shadow-xs"
                                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                                )}
                            >
                                <span>{slot.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Active Selection Display Banner */}
            <div className="bg-[#e8f7ef] border border-[#a3e4c4] p-3.5 rounded-2xl flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#017649] flex items-center justify-center text-white shrink-0 shadow-2xs">
                    {mode === "INSTANT" ? <Zap className="h-4.5 w-4.5 fill-current" /> : <Clock className="h-4.5 w-4.5" />}
                </div>
                <div className="min-w-0">
                    <p className="text-[10px] font-bold text-[#017649] uppercase tracking-wider leading-none mb-1">
                        {mode === "INSTANT" ? "Priority Delivery" : "Scheduled Slot"}
                    </p>
                    <p className="text-xs font-black text-slate-900 leading-tight truncate">
                        {mode === "INSTANT"
                            ? "Express Delivery (Guaranteed Fresh)"
                            : (
                                selectedTimeId 
                                    ? `${dates[selectedDate].index === 0 ? "Today" : dates[selectedDate].day}, ${dates[selectedDate].date} ${dates[selectedDate].month} • ${slots.find(s => s.id === selectedTimeId)?.label}`
                                    : "Please choose a time slot"
                            )
                        }
                    </p>
                </div>
            </div>
        </div>
    );
}
