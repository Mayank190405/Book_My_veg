"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import jsQR from "jsqr";
import { 
    Camera, 
    AlertCircle, 
    Keyboard, 
    SwitchCamera, 
    Upload, 
    X, 
    Check, 
    RefreshCw,
    Sparkles
} from "lucide-react";
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
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const animFrameRef = useRef<number | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const hasScannedRef = useRef(false);

    const [status, setStatus] = useState<"INITIALIZING" | "SCANNING" | "PERMISSION_DENIED" | "ERROR">("INITIALIZING");
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [manualCode, setManualCode] = useState("");
    const [showManualInput, setShowManualInput] = useState(false);
    const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
    const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);

    // Stop all active camera tracks
    const stopStream = useCallback(() => {
        if (animFrameRef.current) {
            cancelAnimationFrame(animFrameRef.current);
            animFrameRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
    }, []);

    // Frame-by-frame live QR decoding loop using jsQR + BarcodeDetector
    const startScanningLoop = useCallback(() => {
        let barcodeDetector: any = null;
        if (typeof window !== "undefined" && "BarcodeDetector" in window) {
            try {
                barcodeDetector = new (window as any).BarcodeDetector({ formats: ["qr_code", "code_128", "ean_13"] });
            } catch (e) {
                barcodeDetector = null;
            }
        }

        const scanFrame = async () => {
            if (hasScannedRef.current) return;

            const video = videoRef.current;
            const canvas = canvasRef.current;

            if (video && video.readyState === video.HAVE_ENOUGH_DATA && canvas) {
                const width = video.videoWidth;
                const height = video.videoHeight;

                if (width > 0 && height > 0) {
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext("2d", { willReadFrequently: true });

                    if (ctx) {
                        ctx.drawImage(video, 0, 0, width, height);

                        // 1. Try Hardware BarcodeDetector if available
                        if (barcodeDetector) {
                            try {
                                const barcodes = await barcodeDetector.detect(video);
                                if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
                                    const codeText = barcodes[0].rawValue.trim();
                                    if (codeText && !hasScannedRef.current) {
                                        hasScannedRef.current = true;
                                        if (navigator.vibrate) {
                                            try { navigator.vibrate(100); } catch (_) {}
                                        }
                                        onScan(codeText);
                                        return;
                                    }
                                }
                            } catch (_) {}
                        }

                        // 2. jsQR Pixel Matrix Engine
                        const imageData = ctx.getImageData(0, 0, width, height);
                        const code = jsQR(imageData.data, imageData.width, imageData.height, {
                            inversionAttempts: "dontInvert",
                        });

                        if (code && code.data && code.data.trim()) {
                            if (!hasScannedRef.current) {
                                hasScannedRef.current = true;
                                if (navigator.vibrate) {
                                    try { navigator.vibrate(100); } catch (_) {}
                                }
                                onScan(code.data.trim());
                                return;
                            }
                        }
                    }
                }
            }

            animFrameRef.current = requestAnimationFrame(scanFrame);
        };

        animFrameRef.current = requestAnimationFrame(scanFrame);
    }, [onScan]);

    // Start user camera stream
    const startCamera = useCallback(async () => {
        stopStream();
        hasScannedRef.current = false;
        setStatus("INITIALIZING");
        setErrorMessage(null);

        try {
            if (!navigator?.mediaDevices?.getUserMedia) {
                throw new Error("Live camera stream is not supported in this browser context. Please use Photo Upload or Manual ID.");
            }

            const constraints: MediaStreamConstraints = {
                video: {
                    facingMode: { ideal: facingMode },
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                },
                audio: false,
            };

            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            streamRef.current = stream;

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.setAttribute("playsinline", "true");
                videoRef.current.muted = true;
                await videoRef.current.play();
                setStatus("SCANNING");
                startScanningLoop();
            }
        } catch (err: any) {
            console.warn("Direct getUserMedia failed:", err);
            const isDenied = err?.name === "NotAllowedError" || String(err).includes("Permission");
            setStatus(isDenied ? "PERMISSION_DENIED" : "ERROR");
            setErrorMessage(err?.message || "Camera access not available on this network connection.");
        }
    }, [facingMode, startScanningLoop, stopStream]);

    useEffect(() => {
        startCamera();
        return () => {
            stopStream();
        };
    }, [startCamera, stopStream]);

    // Handle Photo Upload / Snapshot decoding (Works 100% on ANY browser/network without HTTPS constraints)
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsProcessingPhoto(true);
        const reader = new FileReader();

        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement("canvas");
                const ctx = canvas.getContext("2d");
                canvas.width = img.width;
                canvas.height = img.height;

                if (ctx) {
                    ctx.drawImage(img, 0, 0);
                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    
                    // Decode with jsQR
                    const code = jsQR(imageData.data, imageData.width, imageData.height, {
                        inversionAttempts: "attemptBoth",
                    });

                    setIsProcessingPhoto(false);

                    if (code && code.data) {
                        hasScannedRef.current = true;
                        if (navigator.vibrate) {
                            try { navigator.vibrate(120); } catch (_) {}
                        }
                        onScan(code.data.trim());
                    } else {
                        alert("Could not detect a clear QR code in this image. Please ensure good lighting or enter the order ID manually.");
                    }
                } else {
                    setIsProcessingPhoto(false);
                }
            };
            img.src = event.target?.result as string;
        };

        reader.readAsDataURL(file);
    };

    const handleManualSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const clean = manualCode.trim();
        if (clean) {
            hasScannedRef.current = true;
            onScan(clean);
        }
    };

    const toggleFacingMode = () => {
        setFacingMode(prev => prev === "environment" ? "user" : "environment");
    };

    const scannerContent = (
        <div className="flex flex-col items-center w-full relative">
            {/* Hidden canvas used for pixel analysis */}
            <canvas ref={canvasRef} className="hidden" />

            {/* Hidden File Input for Snap/Upload fallback */}
            <input 
                ref={fileInputRef}
                type="file" 
                accept="image/*" 
                capture="environment"
                onChange={handleFileUpload} 
                className="hidden" 
            />

            {/* Viewfinder Frame Container */}
            <div className="relative w-full aspect-square max-w-xs rounded-3xl overflow-hidden bg-slate-950 border-2 border-slate-700/80 shadow-2xl flex items-center justify-center">
                {/* Live Video Feed */}
                <video
                    ref={videoRef}
                    className="w-full h-full object-cover rounded-3xl"
                    autoPlay
                    playsInline
                    muted
                />

                {/* Animated Target Viewfinder Overlay */}
                {status === "SCANNING" && (
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                        <div className="w-52 h-52 relative rounded-2xl border border-white/20">
                            {/* 4 Corner Brackets */}
                            <div className="absolute top-0 left-0 w-7 h-7 border-t-[3.5px] border-l-[3.5px] border-blue-500 rounded-tl-xl" />
                            <div className="absolute top-0 right-0 w-7 h-7 border-t-[3.5px] border-r-[3.5px] border-blue-500 rounded-tr-xl" />
                            <div className="absolute bottom-0 left-0 w-7 h-7 border-b-[3.5px] border-l-[3.5px] border-blue-500 rounded-bl-xl" />
                            <div className="absolute bottom-0 right-0 w-7 h-7 border-b-[3.5px] border-r-[3.5px] border-blue-500 rounded-br-xl" />
                            
                            {/* Scanning Laser Line */}
                            <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-blue-400 to-transparent shadow-[0_0_12px_rgba(59,130,246,0.9)] animate-pulse absolute top-1/2 -translate-y-1/2" />
                        </div>

                        {/* Camera Flip Button */}
                        <div className="absolute top-3 right-3 pointer-events-auto">
                            <button
                                onClick={toggleFacingMode}
                                className="w-9 h-9 rounded-full bg-black/60 backdrop-blur-md text-white flex items-center justify-center hover:bg-black/80 transition-all active:scale-95 shadow-md"
                                title="Switch Camera"
                            >
                                <SwitchCamera className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                )}

                {/* Status Overlays */}
                {status === "INITIALIZING" && (
                    <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center text-white p-4 text-center space-y-3">
                        <Camera className="h-8 w-8 animate-pulse text-blue-400" />
                        <p className="text-xs font-bold">Connecting to optical sensor...</p>
                        <p className="text-[10px] text-slate-400 font-medium">Position bill QR inside frame</p>
                    </div>
                )}

                {status === "PERMISSION_DENIED" && (
                    <div className="absolute inset-0 bg-slate-900/95 flex flex-col items-center justify-center text-white p-5 text-center space-y-3">
                        <AlertCircle className="h-9 w-9 text-amber-400" />
                        <h4 className="text-sm font-bold">Camera Permission Required</h4>
                        <p className="text-xs text-slate-400 font-medium leading-relaxed">
                            Live video blocked by browser sandbox on non-HTTPS network.
                        </p>
                        <Button
                            size="sm"
                            onClick={() => fileInputRef.current?.click()}
                            className="h-10 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-bold flex items-center gap-2"
                        >
                            <Upload className="h-4 w-4" />
                            Take Photo to Scan
                        </Button>
                    </div>
                )}

                {status === "ERROR" && (
                    <div className="absolute inset-0 bg-slate-900/95 flex flex-col items-center justify-center text-white p-5 text-center space-y-3">
                        <AlertCircle className="h-9 w-9 text-rose-400" />
                        <h4 className="text-sm font-bold">Camera Stream Unavailable</h4>
                        <p className="text-xs text-slate-400 font-medium">
                            {errorMessage || "Use Photo Snap or enter the Order ID directly."}
                        </p>
                        <Button
                            size="sm"
                            onClick={() => fileInputRef.current?.click()}
                            className="h-10 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-bold flex items-center gap-2"
                        >
                            <Upload className="h-4 w-4" />
                            Snap Photo to Decode
                        </Button>
                    </div>
                )}

                {isProcessingPhoto && (
                    <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center text-white p-4 text-center space-y-2 z-20">
                        <RefreshCw className="h-8 w-8 animate-spin text-blue-400" />
                        <p className="text-xs font-bold">Analyzing image pixels...</p>
                    </div>
                )}
            </div>

            {/* Snap Photo Action Button (Always works on all phones) */}
            <div className="w-full max-w-xs mt-3 flex items-center gap-2">
                <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 h-11 rounded-2xl bg-white/5 hover:bg-white/10 text-white border-white/20 text-xs font-bold flex items-center justify-center gap-2 active:scale-95 transition-all"
                >
                    <Upload className="h-4 w-4 text-blue-400" />
                    Snap / Upload Photo
                </Button>
            </div>

            {/* Manual Code Input Option / Toggle */}
            <div className="w-full max-w-xs mt-2">
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
                            Back to Scanner
                        </button>
                    </form>
                ) : (
                    <button
                        type="button"
                        onClick={() => setShowManualInput(true)}
                        className="w-full py-1.5 text-center text-xs font-bold text-slate-400 hover:text-white flex items-center justify-center gap-1.5 transition-colors"
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
