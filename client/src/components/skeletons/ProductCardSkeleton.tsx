import { Skeleton } from "@/components/ui/skeleton";

export const ProductCardSkeleton = () => {
    return (
        <div className="flex flex-col gap-3 p-4 border rounded-xl">
            <Skeleton className="h-32 w-full rounded-lg" />
            <div className="space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
            </div>
            <div className="flex justify-between items-center mt-2">
                <Skeleton className="h-6 w-16" />
                <Skeleton className="h-8 w-8 rounded-full" />
            </div>
        </div>
    );
};
