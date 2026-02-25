import { cn } from "@/lib/utils";

interface PageContainerProps {
    children: React.ReactNode;
    className?: string;
    /** Remove horizontal padding — e.g. for full-bleed banners */
    noPadding?: boolean;
}

export default function PageContainer({ children, className, noPadding = false }: PageContainerProps) {
    return (
        <div
            className={cn(
                "max-w-screen-xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-300",
                !noPadding && "px-4",
                className
            )}
        >
            {children}
        </div>
    );
}
