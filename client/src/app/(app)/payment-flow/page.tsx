"use client";

import React, { useState } from "react";
import { 
    ChevronLeft, 
    BookOpen, 
    ArrowRight, 
    Lock, 
    MessageSquare, 
    ShieldCheck, 
    Terminal, 
    Info, 
    CheckCircle2, 
    Server,
    ExternalLink
} from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface DocSection {
    id: string;
    title: string;
}

export default function PaymentFlowPage() {
    const router = useRouter();
    const [activeSection, setActiveSection] = useState<string>("overview");

    const sections: DocSection[] = [
        { id: "overview", title: "1. Architecture Overview" },
        { id: "web-flow", title: "2. Web Marketplace Channel" },
        { id: "pos-flow", title: "3. POS Retail Terminal Channel" },
        { id: "notifications", title: "4. Notification & WhatsApp API" },
        { id: "security", title: "5. Security & Compliance Protocol" }
    ];

    const scrollToSection = (id: string) => {
        setActiveSection(id);
        const element = document.getElementById(id);
        if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    };

    return (
        <div className="min-h-screen bg-background text-foreground transition-colors duration-300 pb-32">
            
            {/* Top Fixed Navigation Header */}
            <header className="fixed top-0 left-0 right-0 z-50 px-6 py-4 flex items-center gap-4 bg-background/90 backdrop-blur-md border-b border-border">
                <button
                    onClick={() => router.back()}
                    className="w-10 h-10 flex items-center justify-center bg-secondary rounded-xl border border-border shadow-sm active:scale-95 transition-all hover:bg-secondary/80"
                >
                    <ChevronLeft className="h-5 w-5 text-foreground" strokeWidth={2.5} />
                </button>
                <div className="flex items-center gap-2.5">
                    <BookOpen className="h-5 w-5 text-primary" />
                    <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Compliance Documentation</span>
                </div>
            </header>

            {/* Main Documentation Grid Layout */}
            <main className="pt-28 px-6 max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-10">
                
                {/* Left Sidebar: Table of Contents (Desktop only) */}
                <aside className="hidden lg:block lg:col-span-1 space-y-6 sticky top-28 h-fit">
                    <div className="space-y-2.5">
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-3">Table of Contents</p>
                        <nav className="space-y-1">
                            {sections.map((section) => (
                                <button
                                    key={section.id}
                                    onClick={() => scrollToSection(section.id)}
                                    className={cn(
                                        "w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wide transition-all flex items-center justify-between",
                                        activeSection === section.id 
                                            ? "bg-primary/10 text-primary border-l-2 border-primary pl-4" 
                                            : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                                    )}
                                >
                                    {section.title}
                                </button>
                            ))}
                        </nav>
                    </div>

                    <hr className="border-border" />

                    {/* Operational Status Card */}
                    <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
                        <div className="flex items-center gap-2 text-primary">
                            <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
                            <span className="text-[9px] font-black uppercase tracking-widest text-primary">PG Active</span>
                        </div>
                        <h4 className="text-[10px] font-black uppercase tracking-wider text-foreground">Secure Sandbox Settle</h4>
                        <p className="text-[10px] text-muted-foreground leading-normal">
                            All API interfaces are verified as responsive and live.
                        </p>
                    </div>
                </aside>

                {/* Right Area: Documentation Articles */}
                <article className="col-span-1 lg:col-span-3 space-y-16">
                    
                    {/* Page Header */}
                    <div className="space-y-4 border-b border-border pb-8">
                        <h1 className="text-3xl font-black uppercase tracking-tight text-foreground italic leading-none">
                            Transaction & Payment Verification Protocols
                        </h1>
                        <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                            This document describes the end-to-end payment and checkout mechanisms implemented inside Book My Veg. It covers inventory locking logic, API transactions, and notifications for both Web Marketplace and physical POS registers.
                        </p>
                    </div>

                    {/* Section 1: Architecture Overview */}
                    <section id="overview" className="space-y-6 scroll-mt-28">
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-6 bg-primary rounded-full" />
                            <h2 className="text-xl font-black uppercase tracking-wide text-foreground">1. Architecture Overview</h2>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                            Our transaction topology splits requests into two primary pipelines based on the sales channel. Both pipelines guarantee database integrity, real-time inventory allocation, and automatic meta notifications on commit.
                        </p>

                        {/* Visual Structural Diagram */}
                        <div className="bg-card rounded-[2rem] border border-border p-6 md:p-8 space-y-6">
                            <h3 className="text-xs font-black uppercase tracking-widest text-foreground text-center">System Topology Map</h3>
                            
                            <div className="flex flex-col items-center gap-4">
                                {/* Root Node */}
                                <div className="bg-primary/10 border border-primary/20 rounded-2xl p-4 text-center max-w-xs w-full">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-primary block mb-0.5">Start</span>
                                    <h4 className="text-xs font-black uppercase text-foreground">Checkout Triggered</h4>
                                </div>

                                <div className="h-6 w-0.5 bg-border border-dashed border-l" />

                                {/* Split Channels */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                                    
                                    {/* Left Channel */}
                                    <div className="bg-secondary/40 border border-border rounded-2xl p-5 space-y-4">
                                        <div className="flex items-center gap-2 text-primary">
                                            <Server className="h-4 w-4" />
                                            <h4 className="text-xs font-black uppercase text-foreground">Web Marketplace</h4>
                                        </div>
                                        
                                        <div className="space-y-2">
                                            {/* Branch 1 */}
                                            <div className="bg-background border border-border rounded-xl p-3 text-[11px] space-y-1">
                                                <span className="text-[9px] font-black uppercase tracking-wider text-primary">COD Settle</span>
                                                <p className="font-bold text-foreground">Reserve Stock → Status: CONFIRMED → PENDING PAYMENT</p>
                                            </div>
                                            {/* Branch 2 */}
                                            <div className="bg-background border border-border rounded-xl p-3 text-[11px] space-y-1">
                                                <span className="text-[9px] font-black uppercase tracking-wider text-purple-400">Online Settle</span>
                                                <p className="font-bold text-foreground">Deduct Stock → Redirect to Gateway → Callback Verify → Status: PAID</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right Channel */}
                                    <div className="bg-secondary/40 border border-border rounded-2xl p-5 space-y-4">
                                        <div className="flex items-center gap-2 text-primary">
                                            <Terminal className="h-4 w-4" />
                                            <h4 className="text-xs font-black uppercase text-foreground">POS Terminal</h4>
                                        </div>
                                        
                                        <div className="space-y-2">
                                            {/* Branch 1 */}
                                            <div className="bg-background border border-border rounded-xl p-3 text-[11px] space-y-1">
                                                <span className="text-[9px] font-black uppercase tracking-wider text-primary">Direct Settle</span>
                                                <p className="font-bold text-foreground">Scan Items → Pay Cash/UPI/Card → Status: COMPLETED → Cashier Shift update</p>
                                            </div>
                                            {/* Branch 2 */}
                                            <div className="bg-background border border-border rounded-xl p-3 text-[11px] space-y-1">
                                                <span className="text-[9px] font-black uppercase tracking-wider text-red-400">Ledger Credit</span>
                                                <p className="font-bold text-foreground">Account Credit Settle → Add to Outstanding ledger debt → Status: PENDING</p>
                                            </div>
                                        </div>
                                    </div>

                                </div>

                                <div className="h-6 w-0.5 bg-border border-dashed border-l" />

                                {/* Final Notification Node */}
                                <div className="bg-primary/15 border border-primary/30 rounded-2xl p-4 text-center max-w-xs w-full shadow-lg">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-primary block mb-0.5">Commit Endpoint</span>
                                    <h4 className="text-xs font-black uppercase text-foreground">WhatsApp API Receipt</h4>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Section 2: Web Marketplace Channel */}
                    <section id="web-flow" className="space-y-6 scroll-mt-28">
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-6 bg-primary rounded-full" />
                            <h2 className="text-xl font-black uppercase tracking-wide text-foreground">2. Web Marketplace Channel</h2>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                            Web marketplace orders are initiated via the client interface. The backend processes the request using two payment pathways:
                        </p>

                        {/* Path A */}
                        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-primary" />
                                <h3 className="text-sm font-black uppercase text-foreground">Path A: Cash on Delivery (COD)</h3>
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                COD orders bypass immediate gateway redirects and commit transactions directly to database records.
                            </p>
                            <div className="bg-secondary/40 border border-border rounded-xl p-4 font-mono text-[11px] text-foreground space-y-2">
                                <p className="text-primary font-bold"># Step-by-Step Flow:</p>
                                <p>1. Client initiates <span className="text-primary">POST /api/v1/orders</span> with paymentMethod = "COD"</p>
                                <p>2. Inventory is reserved in DB transaction block via <span className="text-primary">InventoryService.reserveStock()</span></p>
                                <p>3. Order is created in state <span className="text-primary">status: "CONFIRMED"</span> and <span className="text-primary">paymentStatus: "PENDING"</span></p>
                                <p>4. In-App Notification is written to database, and WhatsApp confirmation is dispatched.</p>
                            </div>
                        </div>

                        {/* Path B */}
                        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-purple-400" />
                                <h3 className="text-sm font-black uppercase text-foreground">Path B: Online Gateway Settle</h3>
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                Online payments redirect requests to a secure third-party gateway interface (Juspay / Secure Sandbox).
                            </p>
                            <div className="bg-secondary/40 border border-border rounded-xl p-4 font-mono text-[11px] text-foreground space-y-2">
                                <p className="text-primary font-bold"># Step-by-Step Flow:</p>
                                <p>1. Client initiates <span className="text-primary">POST /api/v1/orders</span> with paymentMethod = "ONLINE"</p>
                                <p>2. Inventory is deducted immediately via <span className="text-primary">InventoryService.deductStock()</span> to guarantee product allocation</p>
                                <p>3. Order is saved with state <span className="text-primary">status: "PAYMENT_PENDING"</span></p>
                                <p>4. Handoff occurs to gateway redirect URL. On completion, client verifies via <span className="text-primary">POST /api/v1/payments/verify</span></p>
                                <p>5. If verified successfully: Order updates to <span className="text-primary">status: "CONFIRMED"</span> and <span className="text-primary">paymentStatus: "PAID"</span></p>
                                <p>6. Warehouse packaging queue is updated in real-time using Socket.io event <span className="text-primary">"OP_NEW_ORDER"</span>.</p>
                            </div>
                        </div>
                    </section>

                    {/* Section 3: POS Retail Terminal Channel */}
                    <section id="pos-flow" className="space-y-6 scroll-mt-28">
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-6 bg-primary rounded-full" />
                            <h2 className="text-xl font-black uppercase tracking-wide text-foreground">3. POS Retail Terminal Channel</h2>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                            Physical retail checkouts are handled by cashiers at store counters via the POS endpoint.
                        </p>

                        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-primary" />
                                <h3 className="text-sm font-black uppercase text-foreground">Path A: Immediate Settlement (Cash / Card / UPI)</h3>
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                Direct payments record transaction values immediately and reconcile drawer accounts.
                            </p>
                            <div className="bg-secondary/40 border border-border rounded-xl p-4 font-mono text-[11px] text-foreground space-y-2">
                                <p className="text-primary font-bold"># Step-by-Step Flow:</p>
                                <p>1. Cashier calls <span className="text-primary">POST /api/v1/pos/orders/process</span> with payment details</p>
                                <p>2. Inventory is deducted immediately via active transaction blocks</p>
                                <p>3. Order is created with status <span className="text-primary">"CONFIRMED"</span> and paymentStatus <span className="text-primary">"COMPLETED"</span></p>
                                <p>4. Settle payment creates a Payment object in database with status <span className="text-primary">"SUCCESS"</span></p>
                                <p>5. If CASH, recorded denominations reconcile with cashier's active drawer shift balance.</p>
                            </div>
                        </div>

                        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-red-400" />
                                <h3 className="text-sm font-black uppercase text-foreground">Path B: Account Ledger Credit</h3>
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                Allows registered business customers to purchase items on ledger credit terms.
                            </p>
                            <div className="bg-secondary/40 border border-border rounded-xl p-4 font-mono text-[11px] text-foreground space-y-2">
                                <p className="text-primary font-bold"># Step-by-Step Flow:</p>
                                <p>1. Cashier identifies customer in CRM database and processes checkout with paymentMethod = "CREDIT"</p>
                                <p>2. Order status commits as <span className="text-primary">"CONFIRMED"</span> and paymentStatus as <span className="text-primary">"PENDING"</span></p>
                                <p>3. The net total order cost is automatically added to customer's account ledger outstanding due.</p>
                            </div>
                        </div>
                    </section>

                    {/* Section 4: Notification & WhatsApp API */}
                    <section id="notifications" className="space-y-6 scroll-mt-28">
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-6 bg-primary rounded-full" />
                            <h2 className="text-xl font-black uppercase tracking-wide text-foreground">4. Notification & WhatsApp API</h2>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                            Once checkout transactions successfully commit to the database, automated customer receipt templates are dispatched.
                        </p>

                        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
                            <div className="flex items-center gap-2 text-primary">
                                <MessageSquare className="h-5 w-5" />
                                <h3 className="text-sm font-black uppercase text-foreground">WhatsApp API Service</h3>
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                We utilize the Meta Business API via the Digital MBG Card chatbot router.
                            </p>
                            <div className="space-y-3 pt-2 text-xs text-muted-foreground">
                                <div className="flex gap-2 items-start bg-secondary/30 p-4 rounded-xl border border-border">
                                    <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                                    <p>
                                        <strong>Isolation:</strong> WhatsApp api calls are handled outside primary database transactions using async callbacks. If the template api endpoint fails or times out, the transaction successfully completes without rollbacks.
                                    </p>
                                </div>
                                <div className="flex gap-2 items-start bg-secondary/30 p-4 rounded-xl border border-border">
                                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                                    <p>
                                        <strong>Resilience:</strong> Implements retry limits and backoff increments to safeguard against brief network timeouts. Falls back gracefully to log summaries when key tokens are missing.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Section 5: Security & Compliance */}
                    <section id="security" className="space-y-6 scroll-mt-28">
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-6 bg-primary rounded-full" />
                            <h2 className="text-xl font-black uppercase tracking-wide text-foreground">5. Security & Compliance Protocol</h2>
                        </div>
                        
                        <div className="grid md:grid-cols-2 gap-6">
                            
                            <div className="bg-card border border-border rounded-2xl p-6 space-y-3">
                                <div className="flex items-center gap-2 text-primary">
                                    <Lock className="h-4 w-4" />
                                    <h3 className="text-xs font-black uppercase text-foreground">Data Encryption</h3>
                                </div>
                                <p className="text-[11px] text-muted-foreground leading-relaxed">
                                    Payment credentials (card numbers, pin values, CVVs) never pass through our backend. Handshakes redirect to PCI-DSS Level 1 compliant gateway servers using secure iframe elements.
                                </p>
                            </div>

                            <div className="bg-card border border-border rounded-2xl p-6 space-y-3">
                                <div className="flex items-center gap-2 text-primary">
                                    <ShieldCheck className="h-4 w-4" />
                                    <h3 className="text-xs font-black uppercase text-foreground">Denominations Reconcile</h3>
                                </div>
                                <p className="text-[11px] text-muted-foreground leading-relaxed">
                                    POS cashier sessions enforce active shift balances. Direct ledger edits and denominations logs ensure accurate cash reconciliation and operational audit controls.
                                </p>
                            </div>

                        </div>
                    </section>

                </article>
            </main>
        </div>
    );
}
