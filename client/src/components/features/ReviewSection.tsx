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
        <div className="space-y-6 py-8 border-t border-gray-100">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-black text-emerald-950 uppercase tracking-widest">Customer Reviews</h3>
                {user ? (
                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogTrigger asChild>
                            <button className="text-xs font-black text-emerald-600 hover:text-emerald-700 uppercase tracking-widest">
                                Write a Review
                            </button>
                        </DialogTrigger>
                        <DialogContent className="rounded-[2rem] border-white/60 backdrop-blur-3xl shadow-2xl">
                            <DialogHeader>
                                <DialogTitle className="text-center font-black text-emerald-950 uppercase tracking-tight">Rate this Product</DialogTitle>
                            </DialogHeader>
                            <ReviewForm onSubmit={(data) => mutation.mutate(data)} isPending={mutation.isPending} />
                        </DialogContent>
                    </Dialog>
                ) : (
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Login to review</p>
                )}
            </div>

            {/* Rating Summary */}
            {totalReviews > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-emerald-50/50 rounded-[2rem] p-6 border border-emerald-100/50">
                    <div className="text-center md:text-left space-y-2">
                        <div className="text-5xl font-black text-emerald-900 tracking-tighter">{averageRating}</div>
                        <div className="flex justify-center md:justify-start gap-1">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <Star
                                    key={star}
                                    className={cn(
                                        "w-4 h-4",
                                        star <= Math.round(Number(averageRating)) ? "fill-yellow-400 text-yellow-400" : "text-gray-200"
                                    )}
                                />
                            ))}
                        </div>
                        <p className="text-[10px] font-bold text-emerald-900/40 uppercase tracking-widest">Based on {totalReviews} reviews</p>
                    </div>

                    <div className="space-y-2">
                        {[5, 4, 3, 2, 1].map((star) => (
                            <div key={star} className="flex items-center gap-3">
                                <span className="text-[10px] font-black text-emerald-900/40 w-3">{star}</span>
                                <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                                        style={{ width: `${(ratingDist[star] / totalReviews) * 100}%` }}
                                    />
                                </div>
                                <span className="text-[10px] font-black text-emerald-900/60 w-8 text-right">{Math.round((ratingDist[star] / totalReviews) * 100)}%</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {isLoading ? (
                <div className="space-y-4">
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                </div>
            ) : reviews.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 rounded-xl">
                    <p className="text-gray-500">No reviews yet. Be the first!</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {reviews.map((review: Review) => (
                        <div key={review.id} className="flex gap-4">
                            <div className="flex-none">
                                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                                    <User className="w-5 h-5 text-gray-400" />
                                </div>
                            </div>
                            <div className="flex-1 space-y-1">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-sm font-semibold text-gray-900">
                                        {review.user.name || "Anonymous"}
                                    </h4>
                                    <span className="text-xs text-gray-400">
                                        {new Date(review.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <Star
                                            key={star}
                                            className={cn(
                                                "w-3.5 h-3.5",
                                                star <= review.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"
                                            )}
                                        />
                                    ))}
                                    {review.isVerifiedPurchase && (
                                        <span className="ml-2 text-[10px] bg-green-50 text-green-600 px-1.5 py-0.5 rounded-full font-medium">
                                            Verified Purchase
                                        </span>
                                    )}
                                </div>
                                <p className="text-sm text-gray-600 leading-relaxed pt-1">
                                    {review.comment}
                                </p>
                            </div>
                        </div>
                    ))}
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
