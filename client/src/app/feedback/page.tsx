"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { 
    Star, 
    CheckCircle, 
    Loader2, 
    Building, 
    Send, 
    Award, 
    Heart, 
    Copy, 
    Check, 
    ExternalLink, 
    MessageCircle, 
    Phone, 
    ShieldAlert, 
    ArrowRight,
    Sparkles
} from "lucide-react";
import api from "@/services/api";

const DEFAULT_GOOGLE_REVIEW_URL = process.env.NEXT_PUBLIC_GOOGLE_REVIEW_URL || "https://share.google/AcOZ060z33fcR4OGQ";
const SUPPORT_PHONE = "+91 77968 33633";
const SUPPORT_PHONE_RAW = "917796833633";

function FeedbackContent() {
    const searchParams = useSearchParams();
    const [orderId, setOrderId] = useState("");
    const [rating, setRating] = useState<number>(0);
    const [hoveredRating, setHoveredRating] = useState<number>(0);
    const [feedback, setFeedback] = useState("");
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Stored submitted values for confirmation screen
    const [submittedRating, setSubmittedRating] = useState<number>(0);
    const [submittedFeedback, setSubmittedFeedback] = useState("");
    const [googleReviewUrl, setGoogleReviewUrl] = useState<string>(DEFAULT_GOOGLE_REVIEW_URL);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        const queryOrderId = searchParams.get("orderId") || searchParams.get("orderid") || "";
        if (queryOrderId) {
            setOrderId(queryOrderId);
        }

        // Fetch configured review link from CMS if available
        const fetchReviewLink = async () => {
            try {
                const res = await api.get("/page-content/google-review-link");
                if (res.data?.content && res.data.content.trim()) {
                    setGoogleReviewUrl(res.data.content.trim());
                }
            } catch {
                // Fallback to default configured URL
            }
        };
        fetchReviewLink();
    }, [searchParams]);

    const copyToClipboard = async (text: string): Promise<boolean> => {
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(text);
                return true;
            } else {
                const textArea = document.createElement("textarea");
                textArea.value = text;
                textArea.style.position = "fixed";
                textArea.style.left = "-999999px";
                textArea.style.top = "-999999px";
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                const successful = document.execCommand("copy");
                document.body.removeChild(textArea);
                return successful;
            }
        } catch {
            return false;
        }
    };

    const handleGoogleReviewAction = async () => {
        const textToCopy = submittedFeedback.trim() || `Rated ${submittedRating} stars on Book My Veg! Great quality fresh vegetables and speedy delivery.`;
        
        await copyToClipboard(textToCopy);
        setCopied(true);

        // Open Google review link in a new tab
        const targetUrl = googleReviewUrl || DEFAULT_GOOGLE_REVIEW_URL;
        window.open(targetUrl, "_blank", "noopener,noreferrer");

        setTimeout(() => {
            setCopied(false);
        }, 4000);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!orderId.trim()) {
            setError("Order ID is required to submit feedback.");
            return;
        }

        if (rating === 0) {
            setError("Please select a rating between 1 and 5 stars.");
            return;
        }

        setLoading(true);
        try {
            const res = await api.post("/pay/order-feedback", {
                orderId: orderId.trim(),
                rating,
                feedback: feedback.trim() || undefined
            });

            if (res.data?.googleReviewUrl) {
                setGoogleReviewUrl(res.data.googleReviewUrl);
            }

            setSubmittedRating(rating);
            setSubmittedFeedback(feedback.trim());
            setSuccess(true);
        } catch (err: any) {
            setError(err.response?.data?.message || "Failed to submit feedback. Please check your Order ID and try again.");
        } finally {
            setLoading(false);
        }
    };

    // ─────────────────────────────────────────────────────────────────────────────
    // Post-Submission Confirmation Screen
    // ─────────────────────────────────────────────────────────────────────────────
    if (success) {
        const isPositive = submittedRating >= 4;

        return (
            <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4 sm:p-6 text-center relative overflow-hidden font-sans">
                {/* Background Ambient Glow */}
                <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[350px] ${isPositive ? "bg-emerald-500/10" : "bg-amber-500/10"} blur-[140px] rounded-full pointer-events-none`} />
                
                <div className="max-w-md w-full space-y-6 bg-slate-900/90 backdrop-blur-xl border border-slate-800 p-6 sm:p-8 rounded-[2.5rem] shadow-2xl relative z-10 animate-in zoom-in-95 duration-500">
                    
                    {isPositive ? (
                        /* ─── 4-5 STARS: THANK YOU & GOOGLE REVIEW CTA ─── */
                        <>
                            <div className="relative mx-auto w-20 h-20">
                                <div className="w-20 h-20 bg-gradient-to-tr from-emerald-600 to-teal-500 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-emerald-600/30 ring-8 ring-emerald-500/10">
                                    <CheckCircle className="w-10 h-10 stroke-[2.5]" />
                                </div>
                                <div className="absolute -top-1.5 -right-1.5 bg-amber-400 text-slate-950 p-1.5 rounded-full shadow-lg">
                                    <Sparkles className="w-4 h-4 fill-current" />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white uppercase">
                                    Thank you for your feedback! ❤️
                                </h2>
                                <p className="text-emerald-400 font-semibold text-sm">
                                    Would you also share your experience on Google?
                                </p>
                            </div>

                            {/* Submitted Rating & Feedback Preview */}
                            <div className="bg-slate-950/70 p-4 rounded-2xl border border-slate-800/80 space-y-2.5 text-left">
                                <div className="flex items-center justify-between">
                                    <div className="flex gap-1">
                                        {[1, 2, 3, 4, 5].map((star) => (
                                            <Star 
                                                key={star}
                                                className={`w-5 h-5 stroke-[2] ${
                                                    star <= submittedRating 
                                                        ? "fill-amber-400 stroke-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.4)]" 
                                                        : "stroke-slate-700 fill-none"
                                                }`}
                                            />
                                        ))}
                                    </div>
                                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/20">
                                        {submittedRating === 5 ? "5.0 ★ Excellent" : "4.0 ★ Very Good"}
                                    </span>
                                </div>

                                {submittedFeedback ? (
                                    <div className="text-xs text-slate-300 italic leading-relaxed bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                                        "{submittedFeedback}"
                                    </div>
                                ) : (
                                    <p className="text-[11px] text-slate-400 italic">
                                        Your 5-star rating makes a big difference to our farm team!
                                    </p>
                                )}
                            </div>

                            {/* Google Review CTA Button */}
                            <div className="space-y-3 pt-1">
                                <button
                                    type="button"
                                    onClick={handleGoogleReviewAction}
                                    className={`w-full py-4 px-5 rounded-2xl font-black text-xs sm:text-sm uppercase tracking-wider transition-all duration-200 shadow-xl flex items-center justify-center gap-2.5 cursor-pointer active:scale-[0.98] ${
                                        copied 
                                            ? "bg-emerald-600 text-white shadow-emerald-500/20 ring-2 ring-emerald-400" 
                                            : "bg-white hover:bg-slate-100 text-slate-950 shadow-white/10 hover:shadow-white/20"
                                    }`}
                                >
                                    {copied ? (
                                        <>
                                            <Check className="w-5 h-5 stroke-[3] text-emerald-200 animate-bounce" />
                                            <span>Feedback Copied! Opening Google...</span>
                                        </>
                                    ) : (
                                        <>
                                            {/* Google Multicolor G Icon */}
                                            <svg className="w-5 h-5" viewBox="0 0 24 24">
                                                <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"/>
                                                <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
                                                <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
                                                <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                                            </svg>
                                            <span>Copy Feedback & Review on Google</span>
                                            <ExternalLink className="w-4 h-4 ml-0.5 opacity-70" />
                                        </>
                                    )}
                                </button>

                                {/* Micro Instruction Card */}
                                <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80 text-[11px] text-slate-400 text-left space-y-1.5 leading-snug">
                                    <div className="font-bold text-white flex items-center gap-1.5 text-[10px] uppercase tracking-wider">
                                        <Sparkles className="w-3 h-3 text-amber-400" /> Easy 3-Step Google Review
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="w-4 h-4 rounded-full bg-slate-800 text-slate-300 font-black text-[9px] flex items-center justify-center shrink-0">1</span>
                                        <span>Clicking above copies your written feedback.</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="w-4 h-4 rounded-full bg-slate-800 text-slate-300 font-black text-[9px] flex items-center justify-center shrink-0">2</span>
                                        <span>Google Review opens in a new window/tab.</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="w-4 h-4 rounded-full bg-slate-800 text-slate-300 font-black text-[9px] flex items-center justify-center shrink-0">3</span>
                                        <span>Select stars, paste your copied text, and tap post!</span>
                                    </div>
                                </div>
                            </div>

                            {/* Direct link fallback */}
                            <div className="text-[11px] text-slate-500 pt-1">
                                Link didn't open?{" "}
                                <a 
                                    href={googleReviewUrl || DEFAULT_GOOGLE_REVIEW_URL}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-emerald-400 underline font-medium hover:text-emerald-300"
                                >
                                    Open Google Review directly
                                </a>
                            </div>
                        </>
                    ) : (
                        /* ─── 1-3 STARS: PRIVATE SUPPORT / RESOLUTION ROUTE ─── */
                        <>
                            <div className="w-20 h-20 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-center text-amber-400 mx-auto shadow-xl ring-8 ring-amber-500/5">
                                <ShieldAlert className="w-10 h-10 stroke-[2]" />
                            </div>

                            <div className="space-y-2">
                                <h2 className="text-2xl font-black tracking-tight text-white uppercase">
                                    Thank You For Your Feedback
                                </h2>
                                <p className="text-slate-300 text-xs leading-relaxed">
                                    We're truly sorry your experience didn't meet 5-star expectations. We take this seriously and our customer care team has been notified.
                                </p>
                            </div>

                            {/* Submitted Rating & Feedback Preview */}
                            <div className="bg-slate-950/70 p-4 rounded-2xl border border-slate-800/80 space-y-2.5 text-left">
                                <div className="flex items-center justify-between">
                                    <div className="flex gap-1">
                                        {[1, 2, 3, 4, 5].map((star) => (
                                            <Star 
                                                key={star}
                                                className={`w-5 h-5 stroke-[2] ${
                                                    star <= submittedRating 
                                                        ? "fill-amber-400 stroke-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.3)]" 
                                                        : "stroke-slate-700 fill-none"
                                                }`}
                                            />
                                        ))}
                                    </div>
                                    <span className="text-[10px] font-black uppercase tracking-wider text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
                                        {submittedRating <= 2 ? "Needs Attention" : "Below Expectations"}
                                    </span>
                                </div>

                                {submittedFeedback && (
                                    <div className="text-xs text-slate-300 italic leading-relaxed bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                                        "{submittedFeedback}"
                                    </div>
                                )}
                            </div>

                            {/* Direct Support Assistance CTAs */}
                            <div className="space-y-2.5 pt-1">
                                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                                    Let us resolve this for you right away
                                </p>

                                <a
                                    href={`https://wa.me/${SUPPORT_PHONE_RAW}?text=${encodeURIComponent(
                                        `Hi Book My Veg Team, I submitted feedback for Order #${orderId} with a ${submittedRating}-star rating.\n\nFeedback: "${submittedFeedback || 'Issue with order'}"\n\nPlease look into this.`
                                    )}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-full h-12 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                                >
                                    <MessageCircle className="w-4 h-4 fill-current" /> Chat With Support on WhatsApp
                                </a>

                                <a
                                    href={`tel:${SUPPORT_PHONE_RAW}`}
                                    className="w-full h-11 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs uppercase tracking-wider rounded-xl border border-slate-700 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                                >
                                    <Phone className="w-3.5 h-3.5" /> Call Customer Care ({SUPPORT_PHONE})
                                </a>
                            </div>
                        </>
                    )}

                    <div className="h-px bg-slate-800" />

                    {/* Back to Home CTA */}
                    <div className="flex items-center justify-between pt-1">
                        <Link 
                            href="/"
                            className="text-xs font-bold text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors"
                        >
                            Return to Store <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                        <div className="flex items-center gap-1.5 text-emerald-400 text-[11px] font-black uppercase tracking-wider">
                            <Heart className="w-3.5 h-3.5 fill-emerald-400/20 animate-pulse" /> Book My Veg
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Initial Feedback Form
    // ─────────────────────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between p-4 sm:p-6 lg:p-10 relative overflow-y-auto font-sans">
            {/* Background Ambient Glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-emerald-500/10 blur-[140px] rounded-full pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-[400px] h-[300px] bg-teal-500/10 blur-[120px] rounded-full pointer-events-none" />
            
            <div className="max-w-md mx-auto w-full space-y-6 relative z-10 py-6 my-auto animate-in fade-in-50 duration-500">
                
                {/* Brand Header */}
                <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
                    <div className="flex items-center gap-3.5">
                        <div className="w-11 h-11 rounded-2xl bg-emerald-600 flex items-center justify-center text-white shadow-lg shadow-emerald-600/20 ring-4 ring-emerald-500/10">
                            <Building className="w-6 h-6 stroke-[2.5]" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black tracking-tight text-white uppercase flex items-center gap-2">
                                Book My Veg
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            </h2>
                            <p className="text-[10px] text-slate-400 font-bold tracking-wide uppercase">Customer Feedback</p>
                        </div>
                    </div>
                    <div className="px-3.5 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
                        <Award className="w-3.5 h-3.5 text-emerald-400" /> Share Opinion
                    </div>
                </div>

                {/* Feedback Card */}
                <div className="p-6 sm:p-8 bg-slate-900 border border-slate-800 rounded-[2rem] space-y-6 shadow-xl">
                    <div className="space-y-1">
                        <h3 className="text-xl font-black uppercase tracking-tight text-white">How was your order?</h3>
                        <p className="text-xs text-slate-400 leading-relaxed">
                            Thank you for shopping with us! Let us know how we did. We use your reviews to constantly improve our quality and operations.
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {error && (
                            <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs font-bold leading-relaxed">
                                {error}
                            </div>
                        )}

                        {/* Order ID (Hidden or prefilled) */}
                        <div className="space-y-1.5">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">Order Reference ID *</label>
                            <input 
                                type="text"
                                required
                                value={orderId}
                                onChange={(e) => setOrderId(e.target.value)}
                                placeholder="Enter order transaction reference code"
                                className="w-full h-12 bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-4 text-xs font-bold text-white outline-none transition-all placeholder:text-slate-700"
                            />
                        </div>

                        {/* Star Rating Selector */}
                        <div className="space-y-2 text-center pt-2">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider text-left">Your Overall Rating *</label>
                            <div className="flex justify-center gap-3 py-3 bg-slate-950/50 rounded-2xl border border-slate-800/80">
                                {[1, 2, 3, 4, 5].map((star) => {
                                    const isActive = star <= (hoveredRating || rating);
                                    return (
                                        <button
                                            key={star}
                                            type="button"
                                            onClick={() => setRating(star)}
                                            onMouseEnter={() => setHoveredRating(star)}
                                            onMouseLeave={() => setHoveredRating(0)}
                                            className="focus:outline-none transform hover:scale-125 transition-transform duration-150 active:scale-95 cursor-pointer"
                                        >
                                            <Star 
                                                className={`w-10 h-10 stroke-[2] ${
                                                    isActive 
                                                        ? "fill-amber-400 stroke-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.4)]" 
                                                        : "stroke-slate-600 fill-none"
                                                }`}
                                            />
                                        </button>
                                    );
                                })}
                            </div>
                            {rating > 0 && (
                                <p className="text-[10px] font-black uppercase text-amber-400 tracking-wider">
                                    {rating === 5 ? "Excellent! 😍" : rating === 4 ? "Very Good! 😊" : rating === 3 ? "Good / Average 🙂" : rating === 2 ? "Below Average 😐" : "Poor Experience 😞"}
                                </p>
                            )}
                        </div>

                        {/* Feedback Details Textarea */}
                        <div className="space-y-1.5">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">Review Comments (Optional)</label>
                            <textarea 
                                value={feedback}
                                onChange={(e) => setFeedback(e.target.value)}
                                placeholder="What did you like or what can we improve next time?"
                                rows={4}
                                className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-4 py-3 text-sm font-bold text-white outline-none transition-all placeholder:text-slate-700 resize-none leading-relaxed"
                            />
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full h-14 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-xl shadow-emerald-500/10 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer mt-4"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" /> Submitting...
                                </>
                            ) : (
                                <>
                                    <Send className="w-4 h-4" /> Submit Feedback
                                </>
                            )}
                        </button>
                    </form>
                </div>

                <div className="text-center pt-2 text-[10px] text-slate-600 font-semibold tracking-wide uppercase">
                    Book My Veg • Authenticated Feedback Portal
                </div>
            </div>
        </div>
    );
}

export default function FeedbackPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
            </div>
        }>
            <FeedbackContent />
        </Suspense>
    );
}
