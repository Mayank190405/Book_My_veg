"use client";

import React, { useState, useEffect } from "react";
import { 
    Plus, 
    Trash2, 
    Save, 
    FileText, 
    Eye, 
    Edit2, 
    Lock, 
    Globe, 
    Search,
    Loader2,
    AlertCircle,
    CheckCircle
} from "lucide-react";
import { toast } from "sonner";
import { 
    listPages, 
    getPageBySlug, 
    updatePageContent, 
    deletePageContent, 
    PageContent 
} from "@/services/pageContentService";
import MarkdownRenderer from "@/components/ui/MarkdownRenderer";

const SYSTEM_SLUGS = ["privacy", "terms", "refund-policy"];

export default function AdminPoliciesPage() {
    const [pages, setPages] = useState<PageContent[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [saving, setSaving] = useState<boolean>(false);
    const [searchQuery, setSearchQuery] = useState<string>("");
    
    // Editor State
    const [selectedPage, setSelectedPage] = useState<PageContent | null>(null);
    const [editTitle, setEditTitle] = useState<string>("");
    const [editContent, setEditContent] = useState<string>("");
    const [activeTab, setActiveTab] = useState<"edit" | "preview">("edit");

    // Modal State for new page
    const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
    const [newTitle, setNewTitle] = useState<string>("");
    const [newSlug, setNewSlug] = useState<string>("");
    const [creating, setCreating] = useState<boolean>(false);

    const fetchPages = async (selectSlug?: string) => {
        try {
            setLoading(true);
            const data = await listPages();
            setPages(data);
            
            if (data.length > 0) {
                const preSelect = selectSlug 
                    ? data.find(p => p.slug === selectSlug) 
                    : data[0];
                handleSelectPage(preSelect || data[0]);
            } else {
                setSelectedPage(null);
            }
        } catch (error: any) {
            console.error("Failed to load pages:", error);
            toast.error("Error loading policies and pages");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPages();
    }, []);

    const handleSelectPage = (page: PageContent) => {
        setSelectedPage(page);
        setEditTitle(page.title);
        setEditContent(page.content);
        setActiveTab("edit");
    };

    // Auto-generate slug from title
    const handleTitleChange = (val: string) => {
        setNewTitle(val);
        // Simple slug generation: replace spaces/special chars with hyphens, lowercase
        const generated = val
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/(^-|-$)+/g, "");
        setNewSlug(generated);
    };

    const handleCreatePage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTitle.trim() || !newSlug.trim()) {
            toast.error("Title and slug are required");
            return;
        }

        if (SYSTEM_SLUGS.includes(newSlug)) {
            toast.error("Cannot use system slugs for custom pages");
            return;
        }

        try {
            setCreating(true);
            const initialContent = `# ${newTitle}\nLast Updated: ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}\n\nStart writing page content here...`;
            
            const response = await updatePageContent(newSlug, newTitle, initialContent);
            toast.success(`Page "${newTitle}" created successfully`);
            setIsCreateModalOpen(false);
            setNewTitle("");
            setNewSlug("");
            
            // Reload and select newly created page
            await fetchPages(newSlug);
        } catch (error: any) {
            console.error("Failed to create page:", error);
            toast.error(error.response?.data?.message || "Failed to create page");
        } finally {
            setCreating(false);
        }
    };

    const handleSaveContent = async () => {
        if (!selectedPage) return;
        if (!editTitle.trim()) {
            toast.error("Title cannot be empty");
            return;
        }
        if (!editContent.trim()) {
            toast.error("Content cannot be empty");
            return;
        }

        try {
            setSaving(true);
            const response = await updatePageContent(selectedPage.slug, editTitle, editContent);
            toast.success("Page content updated successfully");
            
            // Refresh local list but keep selected
            setPages(prev => prev.map(p => p.slug === selectedPage.slug ? { ...p, title: editTitle, content: editContent } : p));
            setSelectedPage(prev => prev ? { ...prev, title: editTitle, content: editContent } : null);
        } catch (error: any) {
            console.error("Failed to save page:", error);
            toast.error(error.response?.data?.message || "Failed to save page");
        } finally {
            setSaving(false);
        }
    };

    const handleDeletePage = async () => {
        if (!selectedPage) return;
        if (SYSTEM_SLUGS.includes(selectedPage.slug)) {
            toast.error("Core policy pages cannot be deleted");
            return;
        }

        if (!confirm(`Are you sure you want to delete the custom page "${selectedPage.title}"? This action cannot be undone.`)) {
            return;
        }

        try {
            await deletePageContent(selectedPage.slug);
            toast.success("Page deleted successfully");
            await fetchPages();
        } catch (error: any) {
            console.error("Failed to delete page:", error);
            toast.error(error.response?.data?.message || "Failed to delete page");
        }
    };

    const filteredPages = pages.filter(p => 
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.slug.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (loading && pages.length === 0) {
        return (
            <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
                <Loader2 className="w-10 h-10 text-emerald-600 animate-spin" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest animate-pulse">Loading Policy Engine...</span>
            </div>
        );
    }

    return (
        <div className="space-y-8 pb-10">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 leading-tight uppercase tracking-tight">Legal & Policy Pages</h1>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">Configure user-facing legal covenants, disclosures, and custom content</p>
                </div>
                
                <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-widest shadow-md transition-all active:scale-95 shrink-0"
                >
                    <Plus className="w-4 h-4" />
                    Add Custom Page
                </button>
            </div>

            {/* Main Content Workspace */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                
                {/* Left Sidebar - Page Selector */}
                <div className="lg:col-span-4 bg-white rounded-3xl border border-slate-200 shadow-sm p-5 space-y-4">
                    <div className="relative">
                        <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Filter pages..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold placeholder:text-slate-400 text-slate-900 focus:outline-none focus:border-emerald-500/40 focus:bg-white transition-all"
                        />
                    </div>

                    <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                        {filteredPages.map(page => {
                            const isSelected = selectedPage?.slug === page.slug;
                            const isSystem = SYSTEM_SLUGS.includes(page.slug);
                            
                            return (
                                <button
                                    key={page.slug}
                                    onClick={() => handleSelectPage(page)}
                                    className={`w-full flex flex-col text-left p-4 rounded-xl border transition-all active:scale-[0.98] ${
                                        isSelected 
                                            ? "bg-slate-900 border-slate-900 text-white shadow-md" 
                                            : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700"
                                    }`}
                                >
                                    <div className="flex items-center justify-between w-full gap-2">
                                        <span className="text-xs font-black uppercase tracking-tight line-clamp-1">
                                            {page.title}
                                        </span>
                                        {isSystem ? (
                                            <span className={`text-[8px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest ${
                                                isSelected ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-200 text-slate-600"
                                            }`}>
                                                System
                                            </span>
                                        ) : (
                                            <span className={`text-[8px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest ${
                                                isSelected ? "bg-amber-500/20 text-amber-400" : "bg-amber-50 text-amber-600 border border-amber-200/50"
                                            }`}>
                                                Custom
                                            </span>
                                        )}
                                    </div>
                                    <span className={`text-[10px] font-mono mt-1 ${isSelected ? "text-slate-400" : "text-slate-400"}`}>
                                        /{isSystem ? page.slug : `pages/${page.slug}`}
                                    </span>
                                </button>
                            );
                        })}

                        {filteredPages.length === 0 && (
                            <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-2xl">
                                <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">No matching pages found</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Workspace - Editor / Previewer */}
                <div className="lg:col-span-8 space-y-6">
                    {selectedPage ? (
                        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                            {/* Editor Header */}
                            <div className="bg-slate-50 border-b border-slate-200 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-sm font-black text-slate-800 uppercase tracking-tight">
                                            Editing Page content
                                        </h2>
                                        {SYSTEM_SLUGS.includes(selectedPage.slug) ? (
                                            <Lock className="w-3.5 h-3.5 text-slate-400" />
                                        ) : (
                                            <Globe className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
                                        )}
                                    </div>
                                    <p className="text-[10px] font-mono text-slate-400">
                                        Slug: {selectedPage.slug} (Public URL: {SYSTEM_SLUGS.includes(selectedPage.slug) ? `/${selectedPage.slug}` : `/pages/${selectedPage.slug}`})
                                    </p>
                                </div>

                                {/* Editor / Previewer Toggle Tabs */}
                                <div className="flex bg-slate-200/60 p-1 rounded-xl border border-slate-300/30 w-fit">
                                    <button
                                        onClick={() => setActiveTab("edit")}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                                            activeTab === "edit"
                                                ? "bg-white text-slate-800 shadow-sm font-bold"
                                                : "text-slate-500 hover:text-slate-800"
                                        }`}
                                    >
                                        <Edit2 className="w-3 h-3" />
                                        Compose
                                    </button>
                                    <button
                                        onClick={() => setActiveTab("preview")}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                                            activeTab === "preview"
                                                ? "bg-white text-slate-800 shadow-sm font-bold"
                                                : "text-slate-500 hover:text-slate-800"
                                        }`}
                                    >
                                        <Eye className="w-3 h-3" />
                                        Preview
                                    </button>
                                </div>
                            </div>

                            {/* Editor Body */}
                            <div className="p-6 space-y-5">
                                {/* Title Field (System page title is read-only to avoid breaking structure, Custom page titles can be edited) */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Page Display Title</label>
                                    <input
                                        type="text"
                                        value={editTitle}
                                        onChange={(e) => setEditTitle(e.target.value)}
                                        disabled={SYSTEM_SLUGS.includes(selectedPage.slug)}
                                        placeholder="Enter page title..."
                                        className="w-full px-4 py-3 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed focus:outline-none focus:border-emerald-500/40 focus:bg-white transition-all"
                                    />
                                    {SYSTEM_SLUGS.includes(selectedPage.slug) && (
                                        <p className="text-[9px] text-slate-400 font-bold italic mt-1 flex items-center gap-1">
                                            <Lock className="w-2.5 h-2.5 inline" /> Core system page title cannot be changed.
                                        </p>
                                    )}
                                </div>

                                {/* Content Tabs Container */}
                                {activeTab === "edit" ? (
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Page Body (Markdown Format)</label>
                                            <span className="text-[9px] font-bold text-slate-400 uppercase">Markdown syntax supported</span>
                                        </div>
                                        <textarea
                                            rows={18}
                                            value={editContent}
                                            onChange={(e) => setEditContent(e.target.value)}
                                            placeholder="Write your policy or page details using markdown syntax...

Use:
# H1 Title
## H2 Heading
### H3 Sub-heading
**Bold text**
- Bullet list item
[Link Label](https://url)
--- (Horizontal Rule)"
                                            className="w-full p-4 border border-slate-200 rounded-2xl text-xs font-semibold font-mono text-slate-800 focus:outline-none focus:border-emerald-500/40 focus:bg-white transition-all resize-none shadow-inner bg-slate-50/50"
                                        />
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mobile App Live Preview</label>
                                        
                                        {/* Mock Mobile Viewport with Book My Veg styling */}
                                        <div className="rounded-[2.5rem] border-[8px] border-slate-900 bg-[#061512] shadow-2xl overflow-hidden max-w-lg mx-auto aspect-[9/16] relative flex flex-col text-white">
                                            {/* Status bar mock */}
                                            <div className="h-6 bg-[#061512] flex items-center justify-between px-6 text-[10px] font-bold text-white/40">
                                                <span>9:41 AM</span>
                                                <div className="flex gap-1.5 items-center">
                                                    <span>5G</span>
                                                    <div className="w-5 h-2.5 border border-white/30 rounded-sm p-0.5">
                                                        <div className="bg-white/70 h-full w-full rounded-[1px]" />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Mock Mobile Header */}
                                            <header className="px-6 py-4 flex items-center gap-3 border-b border-white/5 bg-[#061512]">
                                                <div className="w-8 h-8 flex items-center justify-center bg-white/5 rounded-xl border border-white/10">
                                                    <span className="text-white text-xs font-black">&lt;</span>
                                                </div>
                                                <div className="flex-1 text-left">
                                                    <span className="text-[8px] font-black text-primary uppercase tracking-widest">LEGAL PROTOCOL</span>
                                                    <h3 className="text-xs font-black uppercase text-white leading-none tracking-tight">{editTitle || selectedPage.title}</h3>
                                                </div>
                                            </header>

                                            {/* Mock Viewport Content */}
                                            <div className="flex-1 overflow-y-auto p-6 space-y-6 text-left" id="mock-preview-viewport">
                                                <div className="bg-white/5 backdrop-blur-3xl rounded-3xl border border-white/10 p-5 shadow-xl space-y-4">
                                                    <MarkdownRenderer content={editContent} />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Editor Actions Footer */}
                            <div className="bg-slate-50 border-t border-slate-200 p-6 flex items-center justify-between gap-4">
                                <div>
                                    {!SYSTEM_SLUGS.includes(selectedPage.slug) && (
                                        <button
                                            onClick={handleDeletePage}
                                            className="flex items-center gap-2 px-4 py-3 rounded-xl border border-red-200 text-red-500 hover:bg-red-50 font-bold text-[10px] uppercase tracking-widest transition-all active:scale-95"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                            Delete Custom Page
                                        </button>
                                    )}
                                </div>

                                <button
                                    onClick={handleSaveContent}
                                    disabled={saving}
                                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-widest shadow-md transition-all active:scale-95 disabled:opacity-70 disabled:scale-100"
                                >
                                    {saving ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Save className="w-4 h-4" />
                                    )}
                                    Publish Updates
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-16 text-center">
                            <FileText className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                            <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">No page selected</h3>
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-1">Select a page from the sidebar to inspect or modify its contents</p>
                        </div>
                    )}
                </div>

            </div>

            {/* Create Custom Page Modal */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div 
                        className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200"
                        role="dialog"
                    >
                        <div className="bg-slate-50 border-b border-slate-200 px-6 py-5">
                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Create Custom Page</h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Establish a new user-facing dynamic landing page</p>
                        </div>

                        <form onSubmit={handleCreatePage}>
                            <div className="p-6 space-y-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Page Display Title</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. About Us"
                                        value={newTitle}
                                        onChange={(e) => handleTitleChange(e.target.value)}
                                        className="w-full px-4 py-3 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-500/40 focus:bg-white transition-all"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Custom Slug (Public URL path)</label>
                                    <div className="relative flex items-center">
                                        <span className="absolute left-4 text-xs font-bold text-slate-400 font-mono">pages/</span>
                                        <input
                                            type="text"
                                            required
                                            placeholder="about-us"
                                            value={newSlug}
                                            onChange={(e) => setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, ""))}
                                            className="w-full pl-16 pr-4 py-3 border border-slate-200 rounded-xl text-xs font-mono font-bold text-emerald-700 bg-slate-50 focus:outline-none focus:border-emerald-500/40 focus:bg-white transition-all"
                                        />
                                    </div>
                                    <p className="text-[9px] text-slate-400 font-bold italic">
                                        This path will lock after creation and map to your website.
                                    </p>
                                </div>
                            </div>

                            <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsCreateModalOpen(false)}
                                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-100 font-bold text-[10px] uppercase tracking-widest transition-all active:scale-95"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={creating}
                                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] uppercase tracking-widest shadow-md transition-all active:scale-95 disabled:opacity-75"
                                >
                                    {creating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                    Create Page
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
