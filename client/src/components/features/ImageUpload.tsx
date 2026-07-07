"use client";

import React, { useState, useRef } from "react";
import { UploadCloud, X, AlertTriangle, CheckCircle2, Image as ImageIcon } from "lucide-react";
import api from "@/services/api";
import { toast } from "sonner";

interface ImageUploadProps {
    initialUrl?: string;
    onUploadComplete: (url: string) => void;
    onImageRemove: () => void;
}

export default function ImageUpload({ initialUrl, onUploadComplete, onImageRemove }: ImageUploadProps) {
    const [dragActive, setDragActive] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [previewUrl, setPreviewUrl] = useState<string | null>(initialUrl || null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [validationStatus, setValidationStatus] = useState<string | null>(null);

    const inputRef = useRef<HTMLInputElement>(null);

    const validateMagicBytes = (arr: Uint8Array, ext: string): boolean => {
        const cleanExt = ext.toLowerCase().replace(".", "");
        
        // JPEG signature: FF D8 FF
        if (cleanExt === "jpg" || cleanExt === "jpeg") {
            return arr.length >= 3 && arr[0] === 0xFF && arr[1] === 0xD8 && arr[2] === 0xFF;
        }
        
        // PNG signature: 89 50 4E 47 0D 0A 1A 0A
        if (cleanExt === "png") {
            const pngSig = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
            return arr.length >= 8 && pngSig.every((byte, idx) => arr[idx] === byte);
        }
        
        // WEBP signature: "RIFF" at 0, "WEBP" at 8
        if (cleanExt === "webp") {
            if (arr.length < 12) return false;
            const riffSig = [0x52, 0x49, 0x46, 0x46]; // "RIFF"
            const isRiff = riffSig.every((byte, idx) => arr[idx] === byte);
            
            // Check offset 8-12 for "WEBP"
            const webpStr = String.fromCharCode(arr[8], arr[9], arr[10], arr[11]);
            return isRiff && webpStr === "WEBP";
        }
        
        return false;
    };

    const processFile = async (file: File) => {
        setErrorMsg(null);
        setValidationStatus("Validating file format...");
        setProgress(0);

        const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
        const allowedExts = [".jpg", ".jpeg", ".png", ".webp"];
        const allowedMimes = ["image/jpeg", "image/png", "image/webp"];

        // 1. Basic frontend extension/mime validation
        if (!allowedExts.includes(ext) || !allowedMimes.includes(file.type)) {
            setErrorMsg("Invalid file type. Only JPG, PNG, and WEBP images are allowed.");
            setValidationStatus(null);
            return;
        }

        // 2. Size validation (<5MB)
        if (file.size > 5 * 1024 * 1024) {
            setErrorMsg("File is too large. Maximum size allowed is 5MB.");
            setValidationStatus(null);
            return;
        }

        // Read magic bytes & scan threat payload asynchronously
        try {
            await new Promise<void>((resolve, reject) => {
                // A. Magic bytes verification
                const headerReader = new FileReader();
                headerReader.onloadend = (e) => {
                    if (!e.target || !e.target.result) {
                        reject(new Error("Could not read file header."));
                        return;
                    }
                    const arr = new Uint8Array(e.target.result as ArrayBuffer);
                    if (!validateMagicBytes(arr, ext)) {
                        reject(new Error("Security warning: File content signature mismatch. Possible spoofed file extension."));
                        return;
                    }
                    
                    // B. Script payload threat scanning (Scan first 100KB)
                    const textReader = new FileReader();
                    textReader.onloadend = (txtEvent) => {
                        const content = (txtEvent.target?.result as string || "").toLowerCase();
                        const dangerousKeywords = [
                            "<?php",
                            "<script",
                            "javascript:",
                            "onload=",
                            "onerror=",
                            "onclick=",
                            "document.cookie",
                            "eval("
                        ];

                        for (const keyword of dangerousKeywords) {
                            if (content.includes(keyword)) {
                                reject(new Error("Security block: Suspicious code signature/scripts detected inside the image payload."));
                                return;
                            }
                        }
                        resolve();
                    };
                    textReader.readAsText(file.slice(0, 100000));
                };
                headerReader.readAsArrayBuffer(file.slice(0, 12));
            });
        } catch (err: any) {
            setErrorMsg(err.message || "Security validation failed.");
            setValidationStatus(null);
            toast.error(err.message || "Security validation block");
            return;
        }

        setValidationStatus("File validation passed. Threat scan complete. Uploading...");
        setUploading(true);

        const formData = new FormData();
        formData.append("image", file);

        try {
            const apiBaseURL = api.defaults.baseURL;
            // Handle relative static assets from server
            const response = await api.post("/products/upload-image", formData, {
                headers: {
                    "Content-Type": "multipart/form-data"
                },
                onUploadProgress: (progressEvent) => {
                    const total = progressEvent.total || file.size;
                    const currentProgress = Math.round((progressEvent.loaded * 100) / total);
                    setProgress(currentProgress);
                }
            });

            const uploadedUrl = response.data.url;
            setPreviewUrl(uploadedUrl);
            onUploadComplete(uploadedUrl);
            setValidationStatus("Upload complete!");
            toast.success("Product image uploaded successfully");
        } catch (error: any) {
            console.error(error);
            const errDetail = error.response?.data?.message || "Failed to upload image to server";
            setErrorMsg(errDetail);
            setValidationStatus(null);
            toast.error(`Upload failed: ${errDetail}`);
        } finally {
            setUploading(false);
        }
    };

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            processFile(e.dataTransfer.files[0]);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            processFile(e.target.files[0]);
        }
    };

    const handleRemove = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        setPreviewUrl(null);
        setErrorMsg(null);
        setValidationStatus(null);
        setProgress(0);
        onImageRemove();
        if (inputRef.current) inputRef.current.value = "";
    };

    return (
        <div className="space-y-3 w-full">
            {previewUrl ? (
                <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 group flex items-center justify-center h-48 w-full transition-all duration-300">
                    <img 
                        src={previewUrl} 
                        alt="Product preview" 
                        className="max-h-full max-w-full object-contain p-2 transition-transform duration-500 group-hover:scale-105" 
                    />
                    
                    {/* Glassmorphic Overlay on Hover */}
                    <div className="absolute inset-0 bg-slate-900/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-3 backdrop-blur-[2px]">
                        <button
                            type="button"
                            onClick={handleRemove}
                            className="bg-rose-500 hover:bg-rose-600 text-white p-3 rounded-xl shadow-lg transition-transform active:scale-95 duration-200 flex items-center gap-2 font-bold text-xs uppercase tracking-wider"
                        >
                            <X className="h-4 w-4" />
                            <span>Remove Image</span>
                        </button>
                    </div>
                </div>
            ) : (
                <div
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => inputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl h-48 flex flex-col items-center justify-center p-6 text-center cursor-pointer transition-all duration-300 ${
                        dragActive
                            ? "border-emerald-500 bg-emerald-50/40"
                            : errorMsg
                            ? "border-rose-300 bg-rose-50/20 hover:border-rose-400"
                            : "border-slate-200 bg-slate-50/50 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                >
                    <input
                        ref={inputRef}
                        type="file"
                        className="hidden"
                        onChange={handleFileChange}
                        accept=".jpg,.jpeg,.png,.webp"
                    />

                    <div className="p-3 bg-white rounded-xl shadow-sm border border-slate-100 mb-3 text-slate-400 group-hover:text-emerald-500 transition-colors">
                        <UploadCloud className="h-6 w-6" />
                    </div>

                    <div className="space-y-1">
                        <p className="text-xs font-bold text-slate-700">
                            Drag & drop your product photo, or <span className="text-emerald-600 hover:text-emerald-700 underline font-extrabold">browse</span>
                        </p>
                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
                            JPEG, PNG, WEBP (Max 5MB)
                        </p>
                    </div>
                </div>
            )}

            {/* Upload Progress Bar */}
            {uploading && (
                <div className="space-y-1.5 w-full bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        <span>Uploading file...</span>
                        <span>{progress}%</span>
                    </div>
                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                        <div 
                            className="bg-emerald-500 h-full rounded-full transition-all duration-300 ease-out" 
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>
            )}

            {/* Validation & Success Status Alerts */}
            {validationStatus && !errorMsg && (
                <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-600 bg-emerald-50/50 border border-emerald-100 rounded-xl px-3.5 py-2 animate-in fade-in slide-in-from-top-1">
                    <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />
                    <span>{validationStatus}</span>
                </div>
            )}

            {/* Error Message Alerts */}
            {errorMsg && (
                <div className="flex items-start gap-2 text-[10px] font-bold text-rose-600 bg-rose-50/50 border border-rose-100 rounded-xl px-3.5 py-2.5 animate-in fade-in slide-in-from-top-1">
                    <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{errorMsg}</span>
                </div>
            )}
        </div>
    );
}
