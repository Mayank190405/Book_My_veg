"use client";

import { Suspense } from "react";
import PayContent from "../page";

export default function PayLoginPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4">
                <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-slate-400 text-sm font-medium">Loading Pay Login...</p>
            </div>
        }>
            <PayContent forceShowOtpForm={true} />
        </Suspense>
    );
}
