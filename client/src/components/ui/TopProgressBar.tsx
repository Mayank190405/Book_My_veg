"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export default function TopProgressBar() {
    const pathname = usePathname();
    const [progress, setProgress] = useState(0);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        // Trigger loading bar animation on route change
        setVisible(true);
        setProgress(20);

        const timer1 = setTimeout(() => setProgress(60), 60);
        const timer2 = setTimeout(() => setProgress(85), 200);
        const timer3 = setTimeout(() => {
            setProgress(100);
            setTimeout(() => setVisible(false), 150);
        }, 350);

        return () => {
            clearTimeout(timer1);
            clearTimeout(timer2);
            clearTimeout(timer3);
        };
    }, [pathname]);

    if (!visible) return null;

    return (
        <div className="fixed top-0 left-0 right-0 z-[100000] h-[3px] bg-transparent pointer-events-none">
            <div
                className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-[#bef264] transition-all duration-200 ease-out shadow-[0_1px_10px_rgba(16,185,129,0.5)]"
                style={{ width: `${progress}%` }}
            />
        </div>
    );
}
