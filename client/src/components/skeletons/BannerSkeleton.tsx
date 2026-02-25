import { Skeleton } from "@/components/ui/skeleton";

export const BannerSkeleton = () => {
    return (
        <div className="w-full h-48 md:h-64 rounded-xl overflow-hidden relative">
            <Skeleton className="w-full h-full" />
        </div>
    );
};
