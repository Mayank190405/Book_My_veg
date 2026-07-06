"use client";

import { useEffect, useRef, useState } from "react";
import { Html5QrcodeScanner, Html5QrcodeScannerState } from "html5-qrcode";
import { X, Camera, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface QRScannerProps {
    onScan: (decodedText: string) => void;
    onClose: () => void;
    title?: string;
}

export default function QRScanner({ onScan, onClose, title = "Scan Barcode/QR" }: QRScannerProps) {
    const scannerRef = useRef<Html5QrcodeScanner | null>(null);
    const [isStarted, setIsStarted] = useState(false);

    useEffect(() => {
        const scanner = new Html5QrcodeScanner(
            "qr-reader",
            { 
                fps: 10, 
                qrbox: { width: 250, height: 250 },
                aspectRatio: 1.0,
                showTorchButtonIfSupported: true,
                rememberLastUsedCamera: true
            },
            /* verbose= */ false
        );

        scanner.render(
            (text) => {
                onScan(text);
                // We keep it running for multiple scans if needed, 
                // but usually inward is one by one or we close manually
            },
            (error) => {
                // Ignore silent errors
            }
        );

        scannerRef.current = scanner;

        return () => {
            if (scannerRef.current) {
                scannerRef.current.clear().catch(err => console.error("Scanner cleanup failed", err));
            }
        };
    }, [onScan]);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/90 backdrop-blur-sm p-4 animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-md rounded-[2.5rem] overflow-hidden shadow-2xl border border-white/20">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white/50 backdrop-blur-md">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
                            <Camera className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">{title}</h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-0.5">Optic Recognition Active</p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="w-10 h-10 bg-slate-50 border border-slate-100 rounded-full flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all active:scale-90"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-8">
                    <div className="relative aspect-square md:aspect-video rounded-[2rem] overflow-hidden bg-slate-100 border-2 border-dashed border-slate-200">
                        <div id="qr-reader" className="w-full h-full" />
                        
                        {/* Overlay frame */}
                        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                            <div className="w-48 h-48 border-2 border-indigo-500 rounded-3xl opacity-20" />
                            
                            {/* Scanning dynamic bar */}
                            <div className="absolute w-48 h-0.5 bg-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.5)] animate-scan-line top-[25%]" />
                        </div>
                    </div>

                    <div className="mt-8 flex flex-col items-center gap-4">
                        <div className="flex items-center gap-2 text-indigo-600">
                            <div className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Awaiting Alignment</span>
                        </div>
                        <p className="text-[9px] font-bold text-slate-400 text-center uppercase tracking-tighter leading-relaxed">
                            Point your camera at the product QR or barcode.<br/>The system will automatically isolate and resolve the identity.
                        </p>
                    </div>
                </div>

                <div className="p-6 bg-slate-50 border-t border-slate-100">
                   <button 
                        onClick={onClose}
                        className="w-full h-14 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-slate-900/20 active:scale-95 transition-all"
                   >
                       Cancel Reconnaissance
                   </button>
                </div>
            </div>

            <style jsx global>{`
                #qr-reader__dashboard {
                    display: none !important;
                }
                #qr-reader__status_span {
                    display: none !important;
                }
                #qr-reader video {
                    width: 100% !important;
                    height: 100% !important;
                    object-fit: cover !important;
                    border-radius: 24px !important;
                }
                #qr-reader img {
                    display: none !important;
                }
                #qr-reader__camera_selection {
                   background: #F8FAFC !important;
                   border: 1px solid #E2E8F0 !important;
                   border-radius: 12px !important;
                   padding: 8px !important;
                   font-family: inherit !important;
                   font-size: 10px !important;
                   font-weight: 900 !important;
                   text-transform: uppercase !important;
                   width: 100% !important;
                   margin-bottom: 12px !important;
                }
                #qr-reader__camera_permission_button {
                   background: #4F46E5 !important;
                   color: white !important;
                   border-radius: 12px !important;
                   padding: 10px 20px !important;
                   font-size: 10px !important;
                   font-weight: 900 !important;
                   text-transform: uppercase !important;
                   border: none !important;
                   cursor: pointer !important;
                }
                @keyframes scan-line {
                   0% { top: 25%; }
                   100% { top: 75%; }
                }
                .animate-scan-line {
                   animation: scan-line 2s ease-in-out infinite alternate;
                }
            `}</style>
        </div>
    );
}
