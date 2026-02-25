"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Calendar, Clock, ChevronRight } from "lucide-react";

interface DeliverySlot {
    id: string;
    label: string;
    available: boolean;
}

interface DeliverySlotPickerProps {
    onSelect: (slot: { date: string; time: string } | null) => void;
}

export default function DeliverySlotPicker({ onSelect }: DeliverySlotPickerProps) {
    const [selectedDate, setSelectedDate] = useState<number>(0); // 0 = today, 1 = tomorrow
    const [selectedTimeId, setSelectedTimeId] = useState<string | null>(null);

    // Generate dates
    const dates = Array.from({ length: 5 }).map((_, i) => {
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

    // Slots
    const slots: DeliverySlot[] = [
        { id: "09-11", label: "9 AM - 11 AM", available: true },
        { id: "11-13", label: "11 AM - 1 PM", available: true },
        { id: "14-16", label: "2 PM - 4 PM", available: true },
        { id: "17-19", label: "5 PM - 7 PM", available: true },
        { id: "19-21", label: "7 PM - 9 PM", available: false }, // Mock unavailable
    ];

    useEffect(() => {
        if (selectedTimeId) {
            const date = dates[selectedDate].fullDate;
            const slot = slots.find((s) => s.id === selectedTimeId);
            if (slot) {
                onSelect({ date, time: slot.label });
            }
        } else {
            onSelect(null);
        }
    }, [selectedDate, selectedTimeId]);

    return (
        <div className="bg-white/80 backdrop-blur-xl p-6 rounded-[2rem] shadow-xl shadow-gray-200/40 border border-white space-y-6">
            <div className="flex items-center gap-3 mb-2">
                <div className="bg-blue-100 p-2 rounded-xl text-blue-600">
                    <Clock className="h-6 w-6" />
                </div>
                <h2 className="text-xl font-black text-gray-900 tracking-tight">Delivery Slot</h2>
            </div>

            {/* Premium Date Scroller */}
            <div className="flex overflow-x-auto gap-4 pb-2 scrollbar-none">
                {dates.map((d) => (
                    <button
                        key={d.index}
                        onClick={() => { setSelectedDate(d.index); setSelectedTimeId(null); }}
                        className={cn(
                            "flex flex-col items-center justify-center min-w-[85px] p-4 rounded-2xl border-2 transition-all duration-300",
                            selectedDate === d.index
                                ? "bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-200 scale-105"
                                : "bg-gray-50 border-gray-100 text-gray-400 hover:border-gray-200 hover:bg-white"
                        )}
                    >
                        <span className={cn("text-[10px] font-black uppercase tracking-widest mb-1", selectedDate === d.index ? "text-blue-100" : "text-gray-400")}>
                            {d.index === 0 ? "Today" : d.index === 1 ? "Tmrw" : d.day}
                        </span>
                        <span className="text-2xl font-black tracking-tighter tabular-nums">
                            {d.date}
                        </span>
                        <span className={cn("text-[10px] font-bold uppercase", selectedDate === d.index ? "text-blue-100" : "text-gray-400")}>
                            {d.month}
                        </span>
                    </button>
                ))}
            </div>

            {/* Time Grid with Premium States */}
            <div className="grid grid-cols-2 gap-4">
                {slots.map((slot) => (
                    <button
                        key={slot.id}
                        onClick={() => setSelectedTimeId(slot.id)}
                        disabled={!slot.available}
                        className={cn(
                            "group py-4 px-4 rounded-2xl border-2 text-center transition-all duration-300 relative overflow-hidden",
                            selectedTimeId === slot.id
                                ? "bg-gray-900 text-white border-gray-900 shadow-xl"
                                : slot.available
                                    ? "bg-white text-gray-800 border-gray-100 hover:border-blue-400 hover:bg-blue-50/30"
                                    : "bg-gray-50 text-gray-300 border-transparent cursor-not-allowed grayscale"
                        )}
                    >
                        <span className="relative z-10 font-black tracking-tight text-sm uppercase">{slot.label}</span>
                        {selectedTimeId === slot.id && (
                            <div className="absolute top-0 right-0 p-1">
                                <CheckCircle className="h-4 w-4 text-green-400" />
                            </div>
                        )}
                    </button>
                ))}
            </div>

            {/* Selection Feedback Island */}
            {selectedTimeId && (
                <div className="animate-in slide-in-from-top-2 fade-in duration-500 bg-blue-50/50 backdrop-blur border border-blue-100 p-4 rounded-2xl flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                        <div className="bg-white p-2 rounded-xl shadow-sm text-blue-600">
                            <Calendar className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-px">Arriving On</p>
                            <p className="text-sm font-black text-blue-900">
                                {dates[selectedDate].index === 0 ? "Today" : dates[selectedDate].day}, {dates[selectedDate].date} {dates[selectedDate].month} • {slots.find(s => s.id === selectedTimeId)?.label}
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function CheckCircle({ className }: { className?: string }) {
    return (
        <svg fill="currentColor" viewBox="0 0 20 20" className={className}>
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
    );
}
