"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Star, CheckCircle, Loader2, Building, Send, Award, Heart } from "lucide-react";
import api from "@/services/api";

function FeedbackContent() {
    const searchParams = useSearchParams();
    const [orderId, setOrderId] = useState("");
    const [rating, setRating] = useState<number>(0);
    const [hoveredRating, setHoveredRating] = useState<number>(0);
    const [feedback, setFeedback] = useState("");
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const queryOrderId = searchParams.get("orderId") || searchParams.get("orderid") || "";
        if (queryOrderId) {
            setOrderId(queryOrderId);
        }
    }, [searchParams]);

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
            await api.post("/pay/order-feedback", {
                orderId: orderId.trim(),
                rating,
                feedback: feedback.trim() || undefined
            });
            setSuccess(true);
        } catch (err: any) {
            setError(err.response?.data?.message || "Failed to submit feedback. Please check your Order ID and try again.");
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-emerald-500/10 blur-[140px] rounded-full pointer-events-none" />
                
                <div className="max-w-md w-full space-y-6 bg-slate-900 border border-emerald-500/20 p-8 rounded-[2.5rem] shadow-2xl relative z-10 animate-in zoom-in-95 duration-500">
                    <div className="w-20 h-20 bg-emerald-600 rounded-2xl flex items-center justify-center text-white mx-auto shadow-xl shadow-emerald-600/30 ring-8 ring-emerald-500/10">
                        <CheckCircle className="w-10 h-10 stroke-[3]" />
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-2xl font-black tracking-tight text-white uppercase">Thank You!</h2>
                        <p className="text-slate-400 text-sm leading-relaxed">
                            Your feedback has been successfully recorded. We appreciate you taking the time to share your experience with us!
                        </p>
                    </div>

                    <div className="h-px bg-slate-800" />

                    <div className="flex justify-center gap-1.5 py-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                            <Star 
                                key={star}
                                className={`w-7 h-7 stroke-[2.5] ${
                                    star <= rating 
                                        ? "fill-amber-400 stroke-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.3)]" 
                                        : "stroke-slate-700 fill-none"
                                }`}
                            />
                        ))}
                    </div>

                    {feedback.trim() && (
                        <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 text-xs italic text-slate-300 leading-relaxed max-h-24 overflow-y-auto">
                            "{feedback}"
                        </div>
                    )}

                    <div className="flex items-center justify-center gap-2 text-emerald-400 text-xs font-black uppercase tracking-wider bg-emerald-500/5 py-2.5 rounded-xl border border-emerald-500/10">
                        <Heart className="w-4 h-4 fill-emerald-400/20 animate-pulse" /> Team Book My Veg
                    </div>
                </div>
            </div>
        );
    }

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
