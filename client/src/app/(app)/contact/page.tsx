import Link from "next/link";
import { ArrowRight, MessageCircle, Package, RotateCcw } from "lucide-react";

export default function ContactPage() {
    return (
        <main className="mx-auto min-h-screen max-w-4xl px-4 py-8 pb-32 text-[#17251e] sm:px-6">
            <span className="text-sm font-semibold text-[#087f5b]">Book My Veg support</span>
            <h1 className="mt-2 text-3xl font-semibold">How can we help?</h1>
            <p className="mt-3 max-w-lg text-sm leading-6 text-[#64736b]">Get help with an order, a product or your account.</p>
            <Link href="/chat" className="mt-8 flex items-center gap-4 rounded-2xl bg-[#087f5b] p-6 text-white"><MessageCircle className="h-7 w-7 shrink-0" /><div className="flex-1"><h2 className="text-lg font-semibold">Chat with support</h2><p className="mt-1 text-sm text-white/90">Start a conversation with our team</p></div><ArrowRight className="h-5 w-5" /></Link>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">{[{ title: "Order help", description: "Find your order and its latest status", href: "/orders", icon: Package }, { title: "Returns & exchanges", description: "Get help with your items", href: "/returns", icon: RotateCcw }].map(({ title, description, href, icon: Icon }) => <Link key={href} href={href} className="flex items-center gap-4 rounded-2xl border border-[#e5ebe7] bg-white p-5"><Icon className="h-6 w-6 shrink-0 text-[#087f5b]" /><div><h2 className="font-semibold">{title}</h2><p className="mt-1 text-sm text-[#64736b]">{description}</p></div></Link>)}</div>
        </main>
    );
}
