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
    const [selectedTimeId, setSelectedTimeId] = useState<string | null>(null);

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
        <div className="space-y-4">
            {/* Delivery Mode Toggle */}
            <div className="grid grid-cols-2 gap-3">
                <button
                    onClick={() => setMode("INSTANT")}
                    className={cn(
                        "relative p-5 rounded-[2rem] border-2 transition-all duration-500 flex flex-col items-center justify-center gap-1.5 overflow-hidden",
                        mode === "INSTANT"
                            ? "bg-[#00a76f] border-[#00a76f] text-white shadow-lg shadow-[#00a76f]/20"
                            : "bg-white border-gray-100 text-gray-300 hover:bg-gray-50"
                    )}
                >
                    <Zap className={cn("h-5 w-5 absolute top-4 left-4", mode === "INSTANT" ? "text-white fill-white" : "text-gray-300")} />
                    <div className="text-center pt-2">
                        <p className={cn("text-xs font-black uppercase tracking-widest leading-none", mode === "INSTANT" ? "text-white" : "text-gray-400")}>Instant</p>
                        <p className={cn("text-[10px] font-black mt-1 uppercase tracking-widest italic", mode === "INSTANT" ? "text-white" : "text-gray-400")}>Priority</p>
                    </div>
                    {mode === "INSTANT" && (
                        <div className="absolute top-4 right-4">
                            <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center text-[#00a76f]">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={4} stroke="currentColor" className="w-3 h-3">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                </svg>
                            </div>
                        </div>
                    )}
                </button>

                <button
                    onClick={() => setMode("SCHEDULED")}
                    className={cn(
                        "relative p-5 rounded-[2rem] border-2 transition-all duration-500 flex flex-col items-center justify-center gap-1.5 overflow-hidden",
                        mode === "SCHEDULED"
                            ? "bg-[#00a76f] border-[#00a76f] text-white shadow-lg shadow-[#00a76f]/20"
                            : "bg-white border-gray-100 text-gray-300 hover:bg-gray-50"
                    )}
                >
                    <Calendar className={cn("h-5 w-5 absolute top-4 left-4", mode === "SCHEDULED" ? "text-white" : "text-gray-300")} />
                    <div className="text-center pt-2">
                        <p className={cn("text-xs font-black uppercase tracking-widest leading-none", mode === "SCHEDULED" ? "text-white" : "text-gray-400")}>Schedule</p>
                        <p className={cn("text-[10px] font-black mt-1 uppercase tracking-widest", mode === "SCHEDULED" ? "text-white" : "text-gray-400")}>Later</p>
                    </div>
                    {mode === "SCHEDULED" && (
                        <div className="absolute top-4 right-4">
                            <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center text-[#00a76f]">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={4} stroke="currentColor" className="w-3 h-3">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                </svg>
                            </div>
                        </div>
                    )}
                </button>
            </div>

            {/* Expanded Schedule Picker */}
            {mode === "SCHEDULED" && (
                <div className="animate-in slide-in-from-top-2 fade-in duration-500 bg-white p-5 rounded-[2rem] border border-gray-100 space-y-4 shadow-sm">
                    <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-hide">
                        {dates.map((d) => (
                            <button
                                key={d.index}
                                onClick={() => { setSelectedDate(d.index); setSelectedTimeId(null); }}
                                className={cn(
                                    "flex flex-col items-center justify-center min-w-[65px] py-3 rounded-2xl border transition-all duration-500",
                                    selectedDate === d.index
                                        ? "bg-[#00a76f] border-[#00a76f] text-white shadow-md scale-105"
                                        : "bg-gray-50 border-gray-100 text-gray-400 hover:bg-gray-100/50"
                                )}
                            >
                                <span className="text-[8px] font-black uppercase tracking-widest mb-1">
                                    {d.index === 0 ? "Today" : d.day}
                                </span>
                                <span className="text-xl font-black tabular-nums leading-none">{d.date}</span>
                                <span className="text-[8px] font-bold uppercase mt-1 opacity-60">{d.month}</span>
                            </button>
                        ))}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        {slots.map((slot) => (
                            <button
                                key={slot.id}
                                onClick={() => setSelectedTimeId(slot.id)}
                                disabled={!slot.available}
                                className={cn(
                                    "py-3 px-3 rounded-2xl border text-center transition-all duration-500 relative",
                                    selectedTimeId === slot.id
                                        ? "bg-[#00a76f] text-white border-[#00a76f] shadow-lg"
                                        : "bg-gray-50 text-gray-500 border-gray-100 hover:border-gray-200"
                                )}
                            >
                                <span className="font-black tracking-tight text-[9px] uppercase">{slot.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Active Selection Display */}
            <div className="bg-[#dffcf0] border border-[#bef4d9] p-4 rounded-[2rem] flex items-center gap-4 shadow-sm">
                <div className="w-11 h-11 rounded-full bg-white flex items-center justify-center text-[#00df89] border border-[#bef4d9]">
                    {mode === "INSTANT" ? <Zap className="h-5 w-5 text-[#00df89] fill-current" /> : <Calendar className="h-5 w-5 text-[#00df89]" />}
                </div>
                <div>
                    <p className="text-[9px] font-black text-[#00a76f] uppercase tracking-widest leading-none mb-1">Arriving {mode === "INSTANT" ? "asap" : "Scheduled"}</p>
                    <p className="text-xs font-black text-gray-900 leading-none">
                        {mode === "INSTANT" ? "Instant Arrival" : (
                            selectedTimeId 
                                ? `${dates[selectedDate].index === 0 ? "Today" : dates[selectedDate].day}, ${dates[selectedDate].date} ${dates[selectedDate].month} • ${slots.find(s => s.id === selectedTimeId)?.label}`
                                : "Select a time slot"
                        )}
                    </p>
                </div>
            </div>
        </div>
    );
}
