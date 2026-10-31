"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, MessageCircle, Package, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";

export default function ReturnsPage() {
    const router = useRouter();
    return (
        <div className="min-h-screen bg-[#f8faf8] px-4 pb-32 text-[#17251e] sm:px-6">
            <header className="mx-auto flex max-w-3xl items-center gap-3 border-b border-[#e5ebe7] py-4">
                <button onClick={() => router.back()} aria-label="Go back" className="flex h-11 w-11 items-center justify-center rounded-full bg-white"><ArrowLeft className="h-5 w-5" /></button>
                <h1 className="text-xl font-semibold">Returns & exchanges</h1>
            </header>
            <main className="mx-auto max-w-3xl py-8">
                <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e8f7ef] text-[#087f5b]"><RotateCcw className="h-7 w-7" /></div>
                <h2 className="text-2xl font-semibold">Let’s help with your order</h2>
                <p className="mt-3 max-w-lg text-sm leading-6 text-[#64736b]">If something is wrong with your items, contact our support team with your order reference and details of the issue.</p>
                <div className="mt-8 grid gap-4 sm:grid-cols-2">
                    <Link href="/orders" className="flex items-center gap-4 rounded-2xl border border-[#e5ebe7] bg-white p-5"><Package className="h-6 w-6 shrink-0 text-[#087f5b]" /><div className="flex-1"><h3 className="font-semibold">Find your order</h3><p className="mt-1 text-sm text-[#64736b]">View items and order details</p></div><ArrowRight className="h-4 w-4" /></Link>
                    <Link href="/chat" className="flex items-center gap-4 rounded-2xl border border-[#e5ebe7] bg-white p-5"><MessageCircle className="h-6 w-6 shrink-0 text-[#087f5b]" /><div className="flex-1"><h3 className="font-semibold">Chat with support</h3><p className="mt-1 text-sm text-[#64736b]">Tell us what happened</p></div><ArrowRight className="h-4 w-4" /></Link>
                </div>
                <section className="mt-6 rounded-2xl border border-[#e5ebe7] bg-white p-6"><h3 className="text-lg font-semibold">Before you contact us</h3><ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-6 text-[#64736b]"><li>Keep your order reference handy.</li><li>Tell us which items need attention.</li><li>Share photos in chat if they help explain the issue.</li></ol><Link href="/exchange-policy" className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#087f5b]">Read the exchange policy <ArrowRight className="h-4 w-4" /></Link></section>
            </main>
        </div>
    );
}
