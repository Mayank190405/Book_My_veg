import { LucideIcon, PackageOpen } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
    icon?: LucideIcon;
    title: string;
    description?: string;
    actionLabel?: string;
    actionHref?: string;
    onAction?: () => void;
    className?: string;
}

export default function EmptyState({
    icon: Icon = PackageOpen,
    title,
    description,
    actionLabel,
    actionHref,
    onAction,
    className,
}: EmptyStateProps) {
    return (
        <div className={cn("flex flex-col items-center justify-center py-20 text-center gap-4", className)}>
            {/* Icon bubble */}
            <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center">
                <Icon className="h-10 w-10 text-gray-300" />
            </div>

            <div className="space-y-1 max-w-xs">
                <p className="text-lg font-bold text-gray-700">{title}</p>
                {description && <p className="text-sm text-gray-400">{description}</p>}
            </div>

            {(actionLabel && actionHref) && (
                <Link
                    href={actionHref}
                    className="mt-1 inline-flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow-md shadow-green-100 transition-all active:scale-95"
                >
                    {actionLabel}
                </Link>
            )}
            {(actionLabel && onAction && !actionHref) && (
                <button
                    onClick={onAction}
                    className="mt-1 inline-flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow-md shadow-green-100 transition-all active:scale-95"
                >
                    {actionLabel}
                </button>
            )}
        </div>
    );
}
