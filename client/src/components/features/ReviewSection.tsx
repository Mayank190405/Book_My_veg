"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Star, User, ThumbsUp } from "lucide-react";
import api from "@/services/api";
import { Button } from "@/components/ui/button"; // Assuming these exist or use standard HTML
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useUserStore } from "@/store/useUserStore";
import { toast } from "sonner";

interface Review {
    id: string;
    user: { name: string | null };
    rating: number;
    comment: string | null;
    createdAt: string;
    isVerifiedPurchase: boolean;
}

export default function ReviewSection({ productId }: { productId: string }) {
    const { user } = useUserStore();
    const queryClient = useQueryClient();
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    // Fetch reviews
    const { data, isLoading } = useQuery({
        queryKey: ["reviews", productId],
        queryFn: async () => {
            const res = await api.get(`/reviews/product/${productId}`);
            return res.data; // { reviews: [], total: 0 }
        },
    });

    const reviews = data?.reviews || [];
    const totalReviews = reviews.length;

    const ratingDist = [0, 0, 0, 0, 0, 0]; // Index 1-5
    reviews.forEach((r: any) => {
        if (r.rating >= 1 && r.rating <= 5) ratingDist[r.rating]++;
    });

    const averageRating = totalReviews > 0
        ? (reviews.reduce((acc: number, r: any) => acc + r.rating, 0) / totalReviews).toFixed(1)
        : "0.0";

    // Submit review mutation
    const mutation = useMutation({
        mutationFn: async (payload: { rating: number; comment: string }) => {
            return api.post("/reviews", { productId, ...payload });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["reviews", productId] });
            setIsDialogOpen(false);
            toast.success("Review submitted successfully!");
        },
        onError: () => {
            toast.error("Failed to submit review. Try again.");
        },
    });

    return (
        <div className="space-y-6 p-6 bg-white">
            {/* Header Row */}
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-slate-850 uppercase tracking-wider">
                    Verified Stories
                </h3>
                {user ? (
                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogTrigger asChild>
                            <button className="text-[10px] font-black text-[#0B7A53] hover:text-[#096645] border border-[#0B7A53] hover:bg-emerald-50/50 px-4 py-2 rounded-full uppercase tracking-wider transition-all active:scale-95 cursor-pointer bg-white">
                                Write a Review
                            </button>
                        </DialogTrigger>
                        <DialogContent className="rounded-[2.5rem] bg-white border border-slate-100 shadow-2xl p-8 max-w-[90vw] mx-auto overflow-hidden">
                            <DialogHeader>
                                <DialogTitle className="text-2xl font-black text-slate-800 uppercase tracking-tight text-center">Write a Review</DialogTitle>
                            </DialogHeader>
                            <ReviewForm onSubmit={(data) => mutation.mutate(data)} isPending={mutation.isPending} />
                        </DialogContent>
                    </Dialog>
                ) : (
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Login to contribute</p>
                )}
            </div>

            {/* Rating Summary Box */}
            {totalReviews > 0 ? (
                <div className="flex items-center gap-6 bg-slate-50/40 border border-slate-100 rounded-3xl p-5 relative overflow-hidden">
                    <div className="flex flex-col items-center gap-1 group shrink-0">
                        <div className="text-5xl font-black text-slate-800 tracking-tight leading-none">
                            {averageRating}
                        </div>
                        <div className="flex gap-0.5 mt-1.5">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <Star
                                    key={star}
                                    className={cn(
                                        "w-3.5 h-3.5 transition-all",
                                        star <= Math.round(Number(averageRating)) ? "fill-[#0B7A53] text-[#0B7A53]" : "text-slate-200"
                                    )}
                                />
                            ))}
                        </div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-2.5 whitespace-nowrap">
                            ({totalReviews} {totalReviews === 1 ? "Review" : "Reviews"})
                        </p>
                    </div>

                    <div className="flex-1 space-y-2">
                        {[5, 4, 3, 2, 1].map((star) => (
                            <div key={star} className="flex items-center gap-3.5">
                                <span className="text-[9px] font-black text-slate-400 w-2.5 flex items-center gap-0.5">
                                    {star}
                                    <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                                </span>
                                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-[#0B7A53] rounded-full transition-all duration-1000"
                                        style={{ width: `${(ratingDist[star] / totalReviews) * 100}%` }}
                                    />
                                </div>
                                <span className="text-[9px] font-black text-slate-450 w-8 text-right tabular-nums">
                                    {Math.round((ratingDist[star] / totalReviews) * 100)}%
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="text-center py-8 bg-slate-50/50 rounded-3xl border border-slate-100 space-y-2">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">No reviews yet</p>
                </div>
            )}

            {/* Customer Reviews Section */}
            {reviews.length > 0 && (
                <div className="space-y-4 pt-2">
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider text-left">
                        Customer Reviews
                    </h4>
                    
                    <div className="space-y-4">
                        {reviews.map((review: Review) => {
                            const initial = (review.user.name || "G")[0].toUpperCase();
                            const dateStr = new Date(review.createdAt).toLocaleDateString("en-IN", { 
                                day: "numeric", 
                                month: "short", 
                                year: "numeric" 
                            });
                            
                            return (
                                <div key={review.id} className="flex gap-4 p-4.5 rounded-3xl border border-slate-100 bg-white shadow-sm hover:shadow-md transition-all group">
                                    <div className="flex-none">
                                        <div className="w-10 h-10 rounded-full bg-emerald-50 text-[#0B7A53] flex items-center justify-center font-black text-sm shadow-inner group-hover:scale-105 transition-all">
                                            {initial}
                                        </div>
                                    </div>
                                    <div className="flex-1 space-y-1 text-left">
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2">
                                                <h4 className="text-xs font-bold text-slate-800">
                                                    {review.user.name || "Boutique Guest"}
                                                </h4>
                                                {review.isVerifiedPurchase && (
                                                    <span className="text-[8px] font-black bg-[#edfcf6] text-[#0B7A53] px-2 py-0.5 rounded-full border border-emerald-500/10 uppercase tracking-wider">
                                                        Verified Purchase
                                                    </span>
                                                )}
                                            </div>
                                            <span className="text-[9px] font-bold text-slate-400">
                                                {dateStr}
                                            </span>
                                        </div>
                                        
                                        <div className="flex gap-0.5 py-0.5">
                                            {[1, 2, 3, 4, 5].map((star) => (
                                                <Star
                                                    key={star}
                                                    className={cn(
                                                        "w-3 h-3",
                                                        star <= review.rating ? "fill-[#0B7A53] text-[#0B7A53]" : "text-slate-200"
                                                    )}
                                                />
                                            ))}
                                        </div>
                                        <p className="text-[11.5px] font-medium text-slate-600 leading-relaxed pt-1">
                                            &ldquo;{review.comment}&rdquo;
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

function ReviewForm({ onSubmit, isPending }: { onSubmit: (data: any) => void; isPending: boolean }) {
    const [rating, setRating] = useState(5);
    const [comment, setComment] = useState("");

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit({ rating, comment });
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
            <div className="flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                    <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        className="p-1 transition-transform hover:scale-110 focus:outline-none"
                    >
                        <Star
                            className={cn(
                                "w-8 h-8",
                                star <= rating ? "fill-yellow-400 text-yellow-400" : "text-gray-200"
                            )}
                        />
                    </button>
                ))}
            </div>
            <Textarea
                placeholder="Share your experience..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                required
                className="min-h-[100px]"
            />
            <Button type="submit" className="w-full" disabled={isPending}>
                {isPending ? "Submitting..." : "Submit Review"}
            </Button>
        </form>
    );
}
