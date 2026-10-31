"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Link2, Copy, MessageCircle, FileText, Send, Share2, Sparkles } from "lucide-react";
import { useShareStore } from "@/store/useShareStore";
import { copyToClipboard, launchNativeScheme } from "@/lib/share";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function ShareModal() {
    const [mounted, setMounted] = useState(false);
    const { isOpen, item, closeShare } = useShareStore();

    useEffect(() => {
        setMounted(true);
    }, []);

    // Close on Escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") closeShare();
        };
        if (isOpen) {
            window.addEventListener("keydown", handleKeyDown);
            document.body.style.overflow = "hidden";
        }
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            document.body.style.overflow = "";
        };
    }, [isOpen, closeShare]);

    if (!mounted || !isOpen || !item) return null;

    const fullUrl = item.url
        ? (item.url.startsWith("http") ? item.url : `${window.location.origin}${item.url.startsWith("/") ? "" : "/"}${item.url}`)
        : `${window.location.origin}/products/${item.id}`;

    const productName = item.name.trim();
    const priceText = item.price ? `₹${item.price}` : "";
    const shareMessage = `Hey! Check out fresh ${productName} on BookMyVeg 🥬${priceText ? ` (only ${priceText})` : ""}:\n${fullUrl}`;

    // 1. WhatsApp: Direct native app launch (zero new tabs)
    const handleWhatsApp = () => {
        closeShare();
        launchNativeScheme(`whatsapp://send?text=${encodeURIComponent(shareMessage)}`);
    };

    // 2. Instagram: Copy text with product name, then direct native app launch (zero new tabs)
    const handleInstagram = async () => {
        await copyToClipboard(shareMessage);
        toast.success(`Message for "${productName}" copied! 📋`, {
            description: "Opening Instagram — paste into DMs, Stories, or Post.",
            duration: 3500,
        });
        closeShare();
        launchNativeScheme("instagram://");
    };

    // 3. Snapchat: Copy text with product name, then direct native app launch (zero new tabs)
    const handleSnapchat = async () => {
        await copyToClipboard(shareMessage);
        toast.success(`Message for "${productName}" copied! 👻`, {
            description: "Opening Snapchat — paste into Chats or Snaps.",
            duration: 3500,
        });
        closeShare();
        launchNativeScheme("snapchat://");
    };

    // 4. Notepad / Notes: Copy structured note with product name, then launch Notes (zero new tabs)
    const handleNotepad = async () => {
        const noteContent = `📝 ${productName} - BookMyVeg\n${priceText ? `Price: ${priceText}\n` : ""}Order Link: ${fullUrl}\nFresh farm-direct produce.`;
        await copyToClipboard(noteContent);
        toast.success(`Note for "${productName}" copied! 📝`, {
            description: "Ready to paste into your Notes or Keep app.",
            duration: 3500,
        });
        closeShare();

        const isIOS = typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent);
        if (isIOS) {
            launchNativeScheme("mobilenotes://");
        } else {
            launchNativeScheme("intent://keep.google.com/#Intent;package=com.google.android.keep;action=android.intent.action.VIEW;end");
        }
    };

    // 5. SMS / Text Message: Native phone messaging app (works 100% on every phone, zero new tabs)
    const handleSMS = () => {
        closeShare();
        const isIOS = typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent);
        const smsUrl = isIOS
            ? `sms:&body=${encodeURIComponent(shareMessage)}`
            : `sms:?body=${encodeURIComponent(shareMessage)}`;
        launchNativeScheme(smsUrl);
    };

    // 6. Copy Link Handler
    const handleCopyLink = async () => {
        const copied = await copyToClipboard(fullUrl);
        if (copied) {
            toast.success("Product link copied! 🔗", {
                description: `Link for "${productName}" ready to paste.`,
                duration: 2500,
            });
        }
        closeShare();
    };

    // 7. System Share Sheet (More Apps / Phone Default Sheet)
    const handleSystemShare = async () => {
        closeShare();
        if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
            try {
                await navigator.share({
                    title: productName,
                    text: `Fresh ${productName} on BookMyVeg 🥬${priceText ? ` (${priceText})` : ""}`,
                    url: fullUrl,
                });
                return;
            } catch (err: any) {
                if (err?.name === "AbortError") return;
            }
        }

        // Safe fallback without opening new browser tabs or broken intents
        await copyToClipboard(shareMessage);
        toast.success(`Share details copied! 📋`, {
            description: `Paste and share "${productName}" in any app.`,
            duration: 3000,
        });
    };


    const modalContent = (
        <div className="fixed inset-0 z-[400] flex flex-col justify-end">
            {/* Backdrop */}
            <div
                onClick={closeShare}
                className="fixed inset-0 bg-black/75 backdrop-blur-xs transition-opacity duration-300 animate-in fade-in"
            />

            {/* Bottom Drawer Container */}
            <div
                className="relative z-[410] w-full max-w-md mx-auto bg-[#18191e] text-white rounded-t-[2.2rem] shadow-[0_-20px_80px_rgba(0,0,0,0.6)] border-t border-white/10 p-5 pb-8 space-y-4 animate-in slide-in-from-bottom duration-300 ease-out"
            >
                {/* Pull Bar */}
                <div className="w-full flex justify-center pb-1">
                    <div className="w-12 h-1.5 bg-white/20 rounded-full" />
                </div>

                {/* Header Title & Close */}
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-base font-bold text-white tracking-tight">
                            Share with friends & family
                        </h2>
                        <p className="text-[11px] text-slate-400">
                            Choose an app to share this product
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={closeShare}
                        className="w-8 h-8 rounded-full bg-[#252830] text-slate-400 hover:text-white flex items-center justify-center active:scale-90 transition-all cursor-pointer border border-white/5"
                    >
                        <X className="w-4 h-4 stroke-[2.5]" />
                    </button>
                </div>

                {/* Product Summary Preview Card */}
                <div className="flex items-center gap-3 p-3 rounded-2xl bg-[#22242b] border border-white/5">
                    {item.image ? (
                        <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-[#18191e] shrink-0 border border-white/5">
                            <Image
                                src={item.image}
                                alt={productName}
                                fill
                                unoptimized
                                className="object-contain p-1"
                            />
                        </div>
                    ) : (
                        <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0 border border-emerald-500/20 text-[#bef264]">
                            <Sparkles className="w-5 h-5" />
                        </div>
                    )}
                    <div className="flex-1 min-w-0">
                        <h3 className="text-xs font-bold text-white truncate">
                            {productName}
                        </h3>
                        <p className="text-[11px] text-[#bef264] font-black mt-0.5">
                            {priceText || "Farm Fresh Produce"}
                        </p>
                    </div>
                </div>

                {/* Share Options Grid */}
                <div className="grid grid-cols-4 gap-2 pt-2">
                    {/* 1. WhatsApp */}
                    <button
                        type="button"
                        onClick={handleWhatsApp}
                        className="flex flex-col items-center gap-1.5 p-2.5 rounded-2xl bg-[#202228] hover:bg-[#252830] active:scale-95 transition-all group cursor-pointer border border-white/5"
                    >
                        <div className="w-12 h-12 rounded-2xl bg-[#25D366] text-white flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
                            {/* WhatsApp SVG Icon */}
                            <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
                                <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.662.591 1.221.774 1.394.86s.275.072.376-.043c.101-.116.433-.506.549-.68.116-.173.231-.145.39-.087s1.011.477 1.184.564.289.13.332.202c.043.073.043.419-.101.824z" />
                            </svg>
                        </div>
                        <span className="text-[10px] font-bold text-slate-200">
                            WhatsApp
                        </span>
                    </button>

                    {/* 2. Instagram */}
                    <button
                        type="button"
                        onClick={handleInstagram}
                        className="flex flex-col items-center gap-1.5 p-2.5 rounded-2xl bg-[#202228] hover:bg-[#252830] active:scale-95 transition-all group cursor-pointer border border-white/5"
                    >
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] text-white flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
                            {/* Instagram SVG Icon */}
                            <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
                                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                            </svg>
                        </div>
                        <span className="text-[10px] font-bold text-slate-200">
                            Instagram
                        </span>
                    </button>

                    {/* 3. Snapchat */}
                    <button
                        type="button"
                        onClick={handleSnapchat}
                        className="flex flex-col items-center gap-1.5 p-2.5 rounded-2xl bg-[#202228] hover:bg-[#252830] active:scale-95 transition-all group cursor-pointer border border-white/5"
                    >
                        <div className="w-12 h-12 rounded-2xl bg-[#FFFC00] text-black flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
                            {/* Snapchat SVG Icon */}
                            <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
                                <path d="M12.012 2.25c-3.72 0-6.012 2.67-6.012 5.58 0 .87.24 1.74.45 2.22.12.27.09.45-.06.63-.3.33-.78.54-1.23.63-.48.09-.72.39-.69.72.03.36.39.63.99.78.78.18 1.44.75 1.71 1.47.12.33.09.6-.12.87-.57.72-1.41 1.26-1.59 1.83-.15.48.15.84.69.96.96.21 2.25-.18 3.09-.6.24-.12.45-.12.63.03.81.63 1.83.99 2.13 1.23.36.3.75.27 1.02.03.33-.27 1.35-.63 2.16-1.26.18-.15.39-.15.63-.03.84.42 2.13.81 3.09.6.54-.12.84-.48.69-.96-.18-.57-1.02-1.11-1.59-1.83-.21-.27-.24-.54-.12-.87.27-.72.93-1.29 1.71-1.47.6-.15.96-.42.99-.78.03-.33-.21-.63-.69-.72-.45-.09-.93-.3-1.23-.63-.15-.18-.18-.36-.06-.63.21-.48.45-1.35.45-2.22 0-2.91-2.292-5.58-6.012-5.58z" />
                            </svg>
                        </div>
                        <span className="text-[10px] font-bold text-slate-200">
                            Snapchat
                        </span>
                    </button>

                    {/* 4. Notepad / Notes */}
                    <button
                        type="button"
                        onClick={handleNotepad}
                        className="flex flex-col items-center gap-1.5 p-2.5 rounded-2xl bg-[#202228] hover:bg-[#252830] active:scale-95 transition-all group cursor-pointer border border-white/5"
                    >
                        <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
                            <FileText className="w-6 h-6 stroke-[2.2]" />
                        </div>
                        <span className="text-[10px] font-bold text-slate-200">
                            Notepad
                        </span>
                    </button>
                </div>

                {/* Additional Quick Actions: SMS, Copy Link & More Options */}
                <div className="grid grid-cols-3 gap-2 pt-1">
                    <button
                        type="button"
                        onClick={handleSMS}
                        className="h-11 rounded-xl bg-[#22242b] hover:bg-[#282a33] active:scale-95 transition-all text-[11px] font-bold text-slate-200 flex items-center justify-center gap-1.5 border border-white/5 cursor-pointer"
                    >
                        <Send className="w-3.5 h-3.5 text-sky-400" />
                        <span>SMS</span>
                    </button>

                    <button
                        type="button"
                        onClick={handleCopyLink}
                        className="h-11 rounded-xl bg-[#22242b] hover:bg-[#282a33] active:scale-95 transition-all text-[11px] font-bold text-slate-200 flex items-center justify-center gap-1.5 border border-white/5 cursor-pointer"
                    >
                        <Link2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Copy Link</span>
                    </button>

                    <button
                        type="button"
                        onClick={handleSystemShare}
                        className="h-11 rounded-xl bg-[#22242b] hover:bg-[#282a33] active:scale-95 transition-all text-[11px] font-bold text-slate-200 flex items-center justify-center gap-1.5 border border-white/5 cursor-pointer"
                    >
                        <Share2 className="w-3.5 h-3.5 text-[#bef264]" />
                        <span>More Apps</span>
                    </button>
                </div>

                {/* Cancel Button */}
                <button
                    type="button"
                    onClick={closeShare}
                    className="w-full h-11 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 transition-all text-xs font-bold text-slate-400 hover:text-white cursor-pointer"
                >
                    Cancel
                </button>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
}
