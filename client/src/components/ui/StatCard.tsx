import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
    label: string;
    value: string | number;
    icon: LucideIcon;
    iconBg?: string;    // Tailwind bg gradient, e.g. "from-green-400 to-green-600"
    trend?: number;     // % change vs previous period, positive = up
    trendLabel?: string;
}

export default function StatCard({
    label,
    value,
    icon: Icon,
    iconBg = "from-green-400 to-green-600",
    trend,
    trendLabel = "vs last month",
}: StatCardProps) {
    const isPositive = (trend ?? 0) >= 0;

    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 p-5 flex items-start gap-4">
            {/* Icon */}
            <div className={cn("flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br shrink-0", iconBg)}>
                <Icon className="h-6 w-6 text-white" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</p>
                <p className="text-2xl font-extrabold text-gray-900 mt-0.5 leading-none">{value}</p>

                {trend !== undefined && (
                    <div className={cn(
                        "flex items-center gap-1 mt-1.5 text-xs font-semibold",
                        isPositive ? "text-green-600" : "text-red-500"
                    )}>
                        {isPositive
                            ? <TrendingUp className="h-3.5 w-3.5" />
                            : <TrendingDown className="h-3.5 w-3.5" />
                        }
                        <span>{isPositive ? "+" : ""}{trend}%</span>
                        <span className="text-gray-400 font-normal">{trendLabel}</span>
                    </div>
                )}
            </div>
        </div>
    );
}
