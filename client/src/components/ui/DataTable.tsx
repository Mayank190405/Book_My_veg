import { cn } from "@/lib/utils";
import { ReactNode } from "react";
import EmptyState from "./EmptyState";

interface Column<T> {
    key: keyof T | string;
    header: string;
    className?: string;
    render?: (row: T) => ReactNode;
}

interface DataTableProps<T extends { id: string | number }> {
    columns: Column<T>[];
    rows: T[];
    onRowClick?: (row: T) => void;
    emptyTitle?: string;
    emptyDescription?: string;
    isLoading?: boolean;
    className?: string;
}

function SkeletonRow({ cols }: { cols: number }) {
    return (
        <tr>
            {Array.from({ length: cols }).map((_, i) => (
                <td key={i} className="px-4 py-3">
                    <div className="h-4 bg-gray-100 rounded animate-pulse" />
                </td>
            ))}
        </tr>
    );
}

export default function DataTable<T extends { id: string | number }>({
    columns,
    rows,
    onRowClick,
    emptyTitle = "No data found",
    emptyDescription,
    isLoading = false,
    className,
}: DataTableProps<T>) {
    return (
        <div className={cn("rounded-2xl border border-gray-100 overflow-hidden shadow-sm bg-white", className)}>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    {/* Sticky header */}
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                            {columns.map((col) => (
                                <th
                                    key={String(col.key)}
                                    className={cn(
                                        "px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide whitespace-nowrap",
                                        col.className
                                    )}
                                >
                                    {col.header}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {isLoading
                            ? Array.from({ length: 5 }).map((_, i) => (
                                <SkeletonRow key={i} cols={columns.length} />
                            ))
                            : (Array.isArray(rows) ? rows : []).map((row) => (
                                <tr
                                    key={row.id}
                                    onClick={() => onRowClick?.(row)}
                                    className={cn(
                                        "hover:bg-gray-50/80 transition-colors",
                                        onRowClick && "cursor-pointer hover:bg-green-50/30"
                                    )}
                                >
                                    {columns.map((col) => (
                                        <td
                                            key={String(col.key)}
                                            className={cn("px-4 py-3 text-gray-700 whitespace-nowrap", col.className)}
                                        >
                                            {col.render
                                                ? col.render(row)
                                                : String((row as any)[col.key] ?? "—")}
                                        </td>
                                    ))}
                                </tr>
                            ))
                        }
                    </tbody>
                </table>
            </div>

            {!isLoading && (!Array.isArray(rows) || rows.length === 0) && (
                <EmptyState
                    title={emptyTitle}
                    description={emptyDescription}
                    className="py-12"
                />
            )}
        </div>
    );
}
