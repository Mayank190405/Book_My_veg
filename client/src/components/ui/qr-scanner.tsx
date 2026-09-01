"use client";

import { useEffect, useRef, useState, useId } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { X, Camera, RefreshCw, AlertCircle, Keyboard, SwitchCamera, Zap, ZapOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface QRScannerProps {
    onScan: (decodedText: string) => void;
    onClose?: () => void;
    title?: string;
    isModal?: boolean;
}

export default function QRScanner({ 
    onScan, 
    onClose, 
    title = "Scan QR Code / Bill",
    isModal = true 
}: QRScannerProps) {
    const rawId = useId();
    const readerId = useRef(`qr-reader-${rawId.replace(/[:]/g, "")}`).current;
    
    const [status, setStatus] = useState<"INITIALIZING" | "SCANNING" | "PERMISSION_DENIED" | "ERROR">("INITIALIZING");
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [manualCode, setManualCode] = useState("");
    const [showManualInput, setShowManualInput] = useState(false);
    const [availableCameras, setAvailableCameras] = useState<Array<{ id: string; label: string }>>([]);
    const [currentCameraIndex, setCurrentCameraIndex] = useState(0);
    const [torchOn, setTorchOn] = useState(false);
    const [torchSupported, setTorchSupported] = useState(false);
    
    const qrInstanceRef = useRef<Html5Qrcode | null>(null);
    const hasScannedRef = useRef(false);

    useEffect(() => {
        let mounted = true;
        hasScannedRef.current = false;

        const startScanner = async () => {
            try {
                // Ensure DOM element is present
                await new Promise((resolve) => setTimeout(resolve, 150));
                if (!mounted) return;

                const element = document.getElementById(readerId);
                if (!element) return;

                // Instantiate with all supported formats
                const html5QrCode = new Html5Qrcode(readerId, {
                    formatsToSupport: [
                        Html5QrcodeSupportedFormats.QR_CODE,
                        Html5QrcodeSupportedFormats.CODE_128,
                        Html5QrcodeSupportedFormats.CODE_39,
                        Html5QrcodeSupportedFormats.EAN_13,
                        Html5QrcodeSupportedFormats.EAN_8,
                        Html5QrcodeSupportedFormats.UPC_A,
                        Html5QrcodeSupportedFormats.UPC_E,
                        Html5QrcodeSupportedFormats.DATA_MATRIX
                    ],
                    verbose: false
                });
                qrInstanceRef.current = html5QrCode;

                // High-performance full-frame scanning (no restrictive qrbox cropping)
                const config = { 
                    fps: 20,
                    disableFlip: false,
                    aspectRatio: 1.0,
                };

                const onScanSuccess = (decodedText: string) => {
                    if (hasScannedRef.current) return;
                    hasScannedRef.current = true;
                    if (navigator.vibrate) {
                        try { navigator.vibrate(120); } catch (_) {}
                    }
                    onScan(decodedText);
                };

                // Query available camera devices for multi-camera support
                try {
                    const cameras = await Html5Qrcode.getCameras();
                    if (mounted && cameras && cameras.length > 0) {
                        setAvailableCameras(cameras);
                    }
                } catch (e) {
                    console.warn("Unable to query camera list", e);
                }

                // Start environment/back camera first
                try {
                    await html5QrCode.start(
                        { facingMode: "environment" },
                        config,
                        onScanSuccess,
                        () => {} // silent frame scan ignore
                    );
                    if (mounted) setStatus("SCANNING");
                } catch (envError) {
                    console.warn("FacingMode environment failed, attempting device ID fallback...", envError);
                    const cameras = await Html5Qrcode.getCameras();
                    if (cameras && cameras.length > 0) {
                        // Pick back camera if labeled, or primary device
                        const backCam = cameras.find(c => c.label.toLowerCase().includes("back") || c.label.toLowerCase().includes("rear")) || cameras[0];
                        await html5QrCode.start(
                            backCam.id,
                            config,
                            onScanSuccess,
                            () => {}
                        );
                        if (mounted) setStatus("SCANNING");
                    } else {
                        throw new Error("No camera device found or permission was rejected.");
                    }
                }

                // Check Torch / Flashlight capabilities
                try {
                    const capabilities = (html5QrCode as any).getRunningTrackCapabilities?.();
                    if (capabilities && capabilities.torch) {
                        if (mounted) setTorchSupported(true);
                    }
                } catch (_) {}

            } catch (err: any) {
                console.error("Camera scanner init error:", err);
                if (mounted) {
                    const isPermission = err?.name === "NotAllowedError" || String(err).includes("Permission") || String(err).includes("NotAllowed");
                    setStatus(isPermission ? "PERMISSION_DENIED" : "ERROR");
                    setErrorMessage(err?.message || "Camera access failed. Please ensure camera permissions are granted.");
                }
            }
        };

        startScanner();

        return () => {
            mounted = false;
            if (qrInstanceRef.current) {
                try {
                    if (qrInstanceRef.current.isScanning) {
                        qrInstanceRef.current.stop().then(() => {
                            qrInstanceRef.current?.clear();
                        }).catch(() => {});
                    } else {
                        qrInstanceRef.current.clear();
                    }
                } catch (err) {
                    console.warn("QR cleanup catch", err);
                }
            }
        };
    }, [readerId, onScan]);

    const handleSwitchCamera = async () => {
        if (!qrInstanceRef.current || availableCameras.length < 2) return;
        try {
            const nextIndex = (currentCameraIndex + 1) % availableCameras.length;
            const nextCam = availableCameras[nextIndex];
            
            if (qrInstanceRef.current.isScanning) {
                await qrInstanceRef.current.stop();
            }

            const config = { fps: 20, aspectRatio: 1.0, disableFlip: false };
            await qrInstanceRef.current.start(
                nextCam.id,
                config,
                (decodedText) => {
                    if (hasScannedRef.current) return;
                    hasScannedRef.current = true;
                    onScan(decodedText);
                },
                () => {}
            );

            setCurrentCameraIndex(nextIndex);
        } catch (err) {
            console.error("Failed to switch camera:", err);
        }
    };

    const handleToggleTorch = async () => {
        if (!qrInstanceRef.current) return;
        try {
            const nextState = !torchOn;
            await (qrInstanceRef.current as any).applyVideoConstraints({
                advanced: [{ torch: nextState }]
            });
            setTorchOn(nextState);
        } catch (err) {
            console.warn("Torch not supported on this track", err);
        }
    };

    const handleManualSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const clean = manualCode.trim();
        if (clean) {
            onScan(clean);
        }
    };

    const scannerContent = (
        <div className="flex flex-col items-center w-full relative">
            {/* Scoped CSS to eliminate duplicate html5-qrcode boxes & letterboxing */}
            <style jsx global>{`
                #${readerId} {
                    width: 100% !important;
                    height: 100% !important;
                    border: none !important;
                    padding: 0 !important;
                    overflow: hidden !important;
                    position: relative !important;
                }
                #${readerId} video {
                    width: 100% !important;
                    height: 100% !important;
                    object-fit: cover !important;
                    border-radius: 1.5rem !important;
                }
                #${readerId} #qr-shaded-region {
                    display: none !important;
                }
                #${readerId} img {
                    display: none !important;
                }
                #${readerId} canvas {
                    display: none !important;
                }
            `}</style>

            {/* Viewfinder Frame Container */}
            <div className="relative w-full aspect-square max-w-xs rounded-3xl overflow-hidden bg-slate-950 border-2 border-slate-700/80 shadow-2xl flex items-center justify-center">
                <div id={readerId} className="w-full h-full object-cover" />

                {/* Single Clean Target Viewfinder Overlay */}
                {status === "SCANNING" && (
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                        <div className="w-48 h-48 sm:w-52 sm:h-52 relative rounded-2xl border border-white/20">
                            {/* 4 Crisp Corner Brackets */}
                            <div className="absolute top-0 left-0 w-7 h-7 border-t-[3.5px] border-l-[3.5px] border-blue-500 rounded-tl-xl" />
                            <div className="absolute top-0 right-0 w-7 h-7 border-t-[3.5px] border-r-[3.5px] border-blue-500 rounded-tr-xl" />
                            <div className="absolute bottom-0 left-0 w-7 h-7 border-b-[3.5px] border-l-[3.5px] border-blue-500 rounded-bl-xl" />
                            <div className="absolute bottom-0 right-0 w-7 h-7 border-b-[3.5px] border-r-[3.5px] border-blue-500 rounded-br-xl" />
                            
                            {/* Animated Scanning Laser Line */}
                            <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-blue-400 to-transparent shadow-[0_0_12px_rgba(59,130,246,0.9)] animate-pulse absolute top-1/2 -translate-y-1/2" />
                        </div>

                        {/* Top quick controls inside viewfinder */}
                        <div className="absolute top-3 right-3 flex items-center gap-2 pointer-events-auto">
                            {availableCameras.length > 1 && (
                                <button
                                    onClick={handleSwitchCamera}
                                    className="w-9 h-9 rounded-full bg-black/60 backdrop-blur-md text-white flex items-center justify-center hover:bg-black/80 transition-all active:scale-95 shadow-md"
                                    title="Switch Camera"
                                >
                                    <SwitchCamera className="h-4 w-4" />
                                </button>
                            )}
                            {torchSupported && (
                                <button
                                    onClick={handleToggleTorch}
                                    className="w-9 h-9 rounded-full bg-black/60 backdrop-blur-md text-white flex items-center justify-center hover:bg-black/80 transition-all active:scale-95 shadow-md"
                                    title="Flashlight"
                                >
                                    {torchOn ? <ZapOff className="h-4 w-4 text-amber-400" /> : <Zap className="h-4 w-4" />}
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* Status Overlays */}
                {status === "INITIALIZING" && (
                    <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center text-white p-4 text-center space-y-3">
                        <Camera className="h-8 w-8 animate-pulse text-blue-400" />
                        <p className="text-xs font-bold">Connecting to optical sensor...</p>
                        <p className="text-[10px] text-slate-400 font-medium">Point at bill QR code</p>
                    </div>
                )}

                {status === "PERMISSION_DENIED" && (
                    <div className="absolute inset-0 bg-slate-900/95 flex flex-col items-center justify-center text-white p-5 text-center space-y-3">
                        <AlertCircle className="h-9 w-9 text-amber-400" />
                        <h4 className="text-sm font-bold">Camera Permission Required</h4>
                        <p className="text-xs text-slate-400 font-medium leading-relaxed">
                            Please enable camera access in your browser settings to scan bills.
                        </p>
                        <Button
                            size="sm"
                            onClick={() => setShowManualInput(true)}
                            className="h-10 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-bold"
                        >
                            Enter Code Manually
                        </Button>
                    </div>
                )}

                {status === "ERROR" && (
                    <div className="absolute inset-0 bg-slate-900/95 flex flex-col items-center justify-center text-white p-5 text-center space-y-3">
                        <AlertCircle className="h-9 w-9 text-rose-400" />
                        <h4 className="text-sm font-bold">Camera Unavailable</h4>
                        <p className="text-xs text-slate-400 font-medium">
                            {errorMessage || "Unable to start video feed on this browser."}
                        </p>
                        <Button
                            size="sm"
                            onClick={() => setShowManualInput(true)}
                            className="h-10 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-bold"
                        >
                            Enter Code Manually
                        </Button>
                    </div>
                )}
            </div>

            {/* Manual Code Input Option / Toggle */}
            <div className="w-full max-w-xs mt-4">
                {showManualInput ? (
                    <form onSubmit={handleManualSubmit} className="space-y-2 animate-in fade-in">
                        <div className="flex gap-2">
                            <Input
                                type="text"
                                placeholder="e.g. BMV9VYZB6YMT2AP or Order ID"
                                value={manualCode}
                                onChange={(e) => setManualCode(e.target.value)}
                                className="h-11 rounded-xl bg-white/10 text-white placeholder:text-slate-500 border-white/20 text-xs font-bold focus:bg-white/20"
                                autoFocus
                            />
                            <Button 
                                type="submit" 
                                disabled={!manualCode.trim()}
                                className="h-11 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shrink-0"
                            >
                                Submit
                            </Button>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowManualInput(false)}
                            className="text-[11px] text-slate-400 hover:text-white underline w-full text-center"
                        >
                            Back to Camera
                        </button>
                    </form>
                ) : (
                    <button
                        type="button"
                        onClick={() => setShowManualInput(true)}
                        className="w-full py-2 text-center text-xs font-bold text-slate-400 hover:text-white flex items-center justify-center gap-1.5 transition-colors"
                    >
                        <Keyboard className="h-3.5 w-3.5" />
                        Enter Order ID / Bill Code manually
                    </button>
                )}
            </div>
        </div>
    );

    if (!isModal) {
        return scannerContent;
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4 animate-in fade-in duration-300">
            <div className="bg-slate-900 border border-white/10 w-full max-w-sm rounded-[2.5rem] p-6 shadow-2xl flex flex-col items-center relative text-white">
                {/* Header */}
                <div className="w-full flex items-center justify-between pb-4 mb-2 border-b border-white/10">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
                            <Camera className="h-4 w-4" />
                        </div>
                        <h3 className="text-sm font-bold text-white">{title}</h3>
                    </div>

                    {onClose && (
                        <button 
                            onClick={onClose}
                            className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/20 transition-all"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    )}
                </div>

                {scannerContent}
            </div>
        </div>
    );
}
