"use client";

import React, { useState, useEffect } from "react";
import { 
    ChevronLeft, 
    BookOpen, 
    ShieldCheck, 
    Loader2, 
    MapPin
} from "lucide-react";
import { useRouter, useParams } from "next/navigation";
import { getPageBySlug, PageContent } from "@/services/pageContentService";
import MarkdownRenderer from "@/components/ui/MarkdownRenderer";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface DocSection {
    id: string;
    title: string;
    href: string;
}

export default function CustomDynamicPage() {
    const router = useRouter();
    const params = useParams();
    const slug = params?.slug as string;

    const [page, setPage] = useState<PageContent | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const docSections: DocSection[] = [
        { id: "overview", title: "1. Payment Flow", href: "/payment-flow" },
        { id: "privacy", title: "2. Privacy Policy", href: "/privacy" },
        { id: "terms", title: "3. Terms of Service", href: "/terms" },
        { id: "refund-policy", title: "4. Exchange Policy", href: "/exchange-policy" },
        { id: "returns", title: "5. Returns & Exchanges", href: "/returns" },
        { id: "contact", title: "6. Contact Us", href: "/contact" }
    ];

    useEffect(() => {
        if (!slug) return;

        const loadContent = async () => {
            try {
                setLoading(true);
                setError(null);
                const data = await getPageBySlug(slug);
                setPage(data);
            } catch (err: any) {
                console.error(`Failed to load page for slug: ${slug}`, err);
                setError(err.response?.data?.message || "Page not found");
            } finally {
                setLoading(false);
            }
        };

        loadContent();
    }, [slug]);

    if (loading) {
        return (
            <div className="min-h-screen bg-[#f8faf9] flex flex-col items-center justify-center gap-4 text-slate-800">
                <Loader2 className="w-8 h-8 text-[#0b5c3e] animate-spin" />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest animate-pulse">Loading Document...</span>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f8faf9] text-slate-800 transition-colors duration-300 pb-32">
            
            {/* Top Fixed Navigation Header */}
            <header className="fixed top-0 left-0 right-0 z-50 px-6 py-4 flex items-center gap-4 bg-white border-b border-slate-100 shadow-sm">
                <button
                    onClick={() => router.back()}
                    className="w-10 h-10 flex items-center justify-center bg-slate-50 rounded-full border border-slate-200 shadow-sm active:scale-95 transition-all hover:bg-slate-100"
                >
                    <ChevronLeft className="h-5 w-5 text-slate-700" strokeWidth={2.5} />
                </button>
                <div className="flex items-center gap-2.5">
                    <BookOpen className="h-4.5 w-4.5 text-[#0b5c3e]" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Compliance Documentation</span>
                </div>
            </header>

            {/* Main Documentation Grid Layout */}
            <main className="pt-28 px-6 max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-10">
                
                {/* Left Sidebar: Table of Contents (Desktop only) */}
                <aside className="hidden lg:block lg:col-span-1 space-y-6 sticky top-28 h-fit">
                    <div className="space-y-2.5">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-3">Policy Directory</p>
                        <nav className="space-y-1">
                            {docSections.map((section) => (
                                <Link
                                    key={section.id}
                                    href={section.href}
                                    className={cn(
                                        "w-full text-left px-3.5 py-3 rounded-2xl text-xs font-black uppercase tracking-wide transition-all flex items-center justify-between border border-transparent",
                                        section.href.includes(slug)
                                            ? "bg-[#0b5c3e] text-white shadow-[0_4px_12px_rgba(11,92,62,0.15)]" 
                                            : "text-slate-500 bg-white border-slate-100 hover:bg-slate-50 hover:text-slate-800"
                                    )}
                                >
                                    {section.title}
                                </Link>
                            ))}
                        </nav>
                    </div>

                    <hr className="border-slate-200/60" />

                    {/* Support card */}
                    <div className="bg-white rounded-[2rem] border border-slate-100 p-5 space-y-3 shadow-sm">
                        <div className="flex items-center gap-2 text-[#0b5c3e]">
                            <ShieldCheck className="h-4.5 w-4.5" />
                            <span className="text-[9px] font-black uppercase tracking-widest text-[#0b5c3e]">Verified Legal</span>
                        </div>
                        <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-800">Operational Protocol</h4>
                        <p className="text-[10px] text-slate-400 leading-normal font-bold">
                            Book My Veg compliance guarantees secure handling of all records.
                        </p>
                    </div>
                </aside>

                {/* Right Area: Document Content */}
                <article className="col-span-1 lg:col-span-3 space-y-8">
                    
                    {/* Page Header */}
                    <div className="space-y-2 pb-2">
                        <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900 italic leading-none">
                            {page?.title || "Legal Document"}
                        </h1>
                        <p className="text-[10px] text-slate-400 leading-relaxed font-bold uppercase tracking-wider">
                            Last Updated: {page ? new Date(page.updatedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }).toUpperCase() : "JUNE 25, 2026"}
                        </p>
                    </div>

                    {/* Markdown Renderer Card */}
                    <div className="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm space-y-6">
                        {error ? (
                            <div className="text-center py-10 space-y-4">
                                <p className="text-xs text-red-500 font-bold uppercase tracking-wider">{error}</p>
                                <button 
                                    onClick={() => router.push("/")} 
                                    className="px-6 py-2.5 bg-[#0b5c3e] text-white text-xs font-black uppercase tracking-widest rounded-xl hover:bg-[#094d34] transition-all"
                                >
                                    Return Home
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-4 max-w-none text-xs text-slate-600 leading-relaxed">
                                <MarkdownRenderer content={page?.content || ""} light={true} />
                            </div>
                        )}
                    </div>



                </article>
            </main>
        </div>
    );
}
