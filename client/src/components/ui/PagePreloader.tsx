"use client";

import { useEffect, useState } from "react";
import { Apple, Carrot, Droplet, Milk } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
    {
        icon: Apple,
        color: "text-rose-500",
        text: "Harvesting Fresh Fruits..."
    },
    {
        icon: Carrot,
        color: "text-orange-500",
        text: "Gathering Farm Vegetables..."
    },
    {
        icon: Droplet,
        color: "text-amber-500",
        text: "Pressing Premium Oils..."
    },
    {
        icon: Milk,
        color: "text-sky-500",
        text: "Churning Pure Dairy..."
    }
];

export default function PagePreloader() {
    const [mounted, setMounted] = useState(false);
    const [step, setStep] = useState(0);
    const [fade, setFade] = useState(false);
    const [visible, setVisible] = useState(true);

    useEffect(() => {
        setMounted(true);

        // Cycle through steps
        const stepInterval = setInterval(() => {
            setStep((prev) => (prev + 1) % STEPS.length);
        }, 500);

        // Total duration before fadeout: 2.6 seconds
        const fadeTimer = setTimeout(() => {
            setFade(true);
            clearInterval(stepInterval);
        }, 2600);

        const removeTimer = setTimeout(() => {
            setVisible(false);
        }, 3200);

        return () => {
            clearInterval(stepInterval);
            clearTimeout(fadeTimer);
            clearTimeout(removeTimer);
        };
    }, []);

    if (!mounted || !visible) return null;

    const activeStep = STEPS[step];
    const ActiveIcon = activeStep.icon;

    return (
        <div
            className={cn(
                "fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-[#fbfdfc] select-none transition-all duration-700 ease-in-out",
                fade ? "opacity-0 scale-95 pointer-events-none" : "opacity-100 scale-100"
            )}
        >
            {/* Center Loader Group */}
            <div className="flex flex-col items-center justify-center z-10 px-6 max-w-sm text-center">
                {/* SVG Category Icon */}
                <div className="relative w-16 h-16 flex items-center justify-center">
                    {/* Animated Icon Frame */}
                    <div key={step} className="animate-in zoom-in-75 fade-in duration-300 flex items-center justify-center">
                        <ActiveIcon className={cn("w-14 h-14 stroke-[2.2] drop-shadow-sm", activeStep.color)} />
                    </div>
                </div>

                {/* Status Shifting Text */}
                <div key={`text-${step}`} className="animate-in slide-in-from-bottom-2 fade-in duration-300 mt-8 h-6">
                    <p className="text-[10px] font-black text-slate-400 tracking-widest uppercase">
                        {activeStep.text}
                    </p>
                </div>
            </div>
        </div>
    );
}
