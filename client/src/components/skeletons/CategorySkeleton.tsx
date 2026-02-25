import { Skeleton } from "@/components/ui/skeleton";

export const CategorySkeleton = () => {
    return (
        <div className="grid grid-cols-4 gap-4 p-4">
            {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex flex-col items-center gap-2">
                    <Skeleton className="h-16 w-16 rounded-full" />
                    <Skeleton className="h-4 w-12" />
                </div>
            ))}
        </div>
    );
};
