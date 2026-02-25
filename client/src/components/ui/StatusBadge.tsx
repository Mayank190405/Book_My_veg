import { cn } from "@/lib/utils";

const STATUS_MAP: Record<string, string> = {
    // Order statuses
    PENDING: "bg-yellow-100 text-yellow-800 border-yellow-200",
    CONFIRMED: "bg-blue-100 text-blue-700 border-blue-200",
    PROCESSING: "bg-indigo-100 text-indigo-700 border-indigo-200",
    SHIPPED: "bg-purple-100 text-purple-700 border-purple-200",
    OUT_FOR_DELIVERY: "bg-orange-100 text-orange-700 border-orange-200",
    DELIVERED: "bg-green-100 text-green-700 border-green-200",
    CANCELLED: "bg-red-100 text-red-700 border-red-200",
    REFUNDED: "bg-gray-100 text-gray-600 border-gray-200",
    COMPLETED: "bg-green-100 text-green-700 border-green-200",
    // Payment statuses
    PAID: "bg-green-100 text-green-700 border-green-200",
    UNPAID: "bg-red-100 text-red-700 border-red-200",
    FAILED: "bg-red-100 text-red-700 border-red-200",
    // Stock
    LOW: "bg-orange-100 text-orange-700 border-orange-200",
    OUT_OF_STOCK: "bg-red-100 text-red-700 border-red-200",
    IN_STOCK: "bg-green-100 text-green-700 border-green-200",
    // Generic
    ACTIVE: "bg-green-100 text-green-700 border-green-200",
    INACTIVE: "bg-gray-100 text-gray-600 border-gray-200",
};

interface StatusBadgeProps {
    status: string;
    className?: string;
    dot?: boolean;
}

export default function StatusBadge({ status, className, dot = false }: StatusBadgeProps) {
    const colors = STATUS_MAP[status?.toUpperCase()] ?? "bg-gray-100 text-gray-600 border-gray-200";
    const label = status?.replace(/_/g, " ");

    return (
        <span className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border uppercase tracking-wide",
            colors,
            className
        )}>
            {dot && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
            {label}
        </span>
    );
}
