"use client";

import { useState, useEffect } from "react";
import api from "@/services/api";
import { Toaster, toast } from "sonner";
import { 
    Package, 
    CheckCircle2, 
    Camera, 
    ClipboardList, 
    History, 
    AlertCircle, 
    ChevronDown, 
    ChevronUp, 
    Image as ImageIcon,
    FileText,
    Send
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { initSocket, getSocket } from "@/services/socketService";
import { useUserStore } from "@/store/useUserStore";
import { Volume2, VolumeX } from "lucide-react";

export default function PackerDashboard() {
    const { user } = useUserStore();
    const [assignments, setAssignments] = useState<any[]>([]);
    const [packedCount, setPackedCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [updatingId, setUpdatingId] = useState<string | null>(null);
    const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
    
    // Form states for individual order
    const [photoUrl, setPhotoUrl] = useState<string>("");
    const [notes, setNotes] = useState<string>("");
    const [verifiedItems, setVerifiedItems] = useState<Record<string, boolean>>({});

    const fetchData = async () => {
        setLoading(true);
        try {
            const [ordersRes, countRes] = await Promise.all([
                api.get("/orders/packing/assignments"),
                api.get("/orders/packing/count")
            ]);
            setAssignments(ordersRes.data.data || []);
            setPackedCount(countRes.data.count || 0);
        } catch (error) {
            toast.error("Cloud synchronization failed");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const toggleItem = (itemId: string) => {
        setVerifiedItems(prev => ({
            ...prev,
            [itemId]: !prev[itemId]
        }));
    };

    const submitPacking = async (orderId: string) => {
        const order = assignments.find(a => a.id === orderId);
        const allVerified = order.items.every((item: any) => verifiedItems[item.id]);
        
        if (!allVerified && !notes) {
            toast.error("Please provide a reason why some items are not packed");
            return;
        }

        setUpdatingId(orderId);
        try {
            await api.patch(`/orders/packing/${orderId}/details`, {
                packerPhoto: photoUrl,
                packerNotes: notes,
                status: "PACKED"
            });
            toast.success("Order verified and packed");
            
            // Reset local states
            setPhotoUrl("");
            setNotes("");
            setVerifiedItems({});
            setExpandedOrder(null);
            
            fetchData();
        } catch (error) {
            toast.error("Protocol submission failed");
        } finally {
            setUpdatingId(null);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-12 gap-4">
                <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest animate-pulse">Accessing Warehouse Logs...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-10">
            {/* Stats Header */}
            <div className="grid grid-cols-2 gap-3">
                <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-4">
                    <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shadow-inner">
                        <ClipboardList className="h-5 w-5" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Backlog</p>
                        <p className="text-lg font-bold text-slate-900 leading-none">{assignments.length}</p>
                    </div>
                </div>
                <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-4">
                    <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shadow-inner">
                        <History className="h-5 w-5" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Log Cycle</p>
                        <p className="text-lg font-bold text-slate-900 leading-none">{packedCount}</p>
                    </div>
                </div>
            </div>

            {assignments.length === 0 ? (
                <div className="text-center p-12 bg-white rounded-3xl shadow-sm border border-slate-100">
                    <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <CheckCircle2 className="h-8 w-8" />
                    </div>
                    <h3 className="text-xl font-bold tracking-tight text-slate-900">Queue Empty</h3>
                    <p className="text-slate-500 text-sm mt-2">All inventory reconciliations are current.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="flex items-center justify-between px-2">
                        <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                            <Send className="h-3 w-3" /> Active Logistics Registry
                        </h2>
                    </div>
                    {assignments.map((order) => {
                        const isExpanded = expandedOrder === order.id;
                        return (
                            <div key={order.id} className={cn(
                                "bg-white rounded-[2rem] overflow-hidden transition-all duration-500",
                                isExpanded ? "shadow-2xl ring-1 ring-blue-500/20 translate-y-[-4px]" : "shadow-sm border border-slate-100"
                            )}>
                                <div 
                                    className={cn("p-5 cursor-pointer flex items-center gap-4 transition-colors", isExpanded ? "bg-slate-50/50" : "hover:bg-slate-50/30")}
                                    onClick={() => {
                                        setExpandedOrder(isExpanded ? null : order.id);
                                        setVerificationFor(order.id);
                                    }}
                                >
                                    <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">
                                        <Package className="h-6 w-6" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-bold text-slate-900 truncate">#{order.id.split('-')[0].toUpperCase()}</h3>
                                            <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-black uppercase tracking-widest rounded-full">
                                                {order.status}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-500 mt-1">{order.items?.length || 0} Logistic Units</p>
                                    </div>
                                    <div className="p-2 text-slate-300">
                                        {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div className="p-6 border-t border-slate-100 bg-white space-y-8 animate-in slide-in-from-top-4 duration-500">
                                        {/* Verification Registry */}
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between">
                                                <h4 className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Verification Registry</h4>
                                                <p className="text-[10px] font-bold text-blue-600">
                                                    {Object.values(verifiedItems).filter(Boolean).length} / {order.items.length} Checked
                                                </p>
                                            </div>
                                            <div className="space-y-2">
                                                {order.items.map((item: any) => (
                                                    <div 
                                                        key={item.id} 
                                                        onClick={() => toggleItem(item.id)}
                                                        className={cn(
                                                            "p-4 rounded-2xl flex items-center justify-between transition-all cursor-pointer border",
                                                            verifiedItems[item.id] 
                                                                ? "bg-emerald-50 border-emerald-100 text-emerald-900" 
                                                                : "bg-slate-50 border-slate-100 text-slate-700"
                                                        )}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className={cn(
                                                                "w-6 h-6 rounded-lg flex items-center justify-center transition-colors",
                                                                verifiedItems[item.id] ? "bg-emerald-500 text-white" : "bg-white border-2 border-slate-200"
                                                            )}>
                                                                {verifiedItems[item.id] && <CheckCircle2 className="h-4 w-4" />}
                                                            </div>
                                                            <div className="font-bold text-sm">
                                                                {item.quantity}x {item.product?.name}
                                                            </div>
                                                        </div>
                                                        <div className="text-[10px] font-black uppercase tracking-widest opacity-50">
                                                            {item.product?.sku || 'GENERIC'}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Photo Capture Mock */}
                                        <div className="space-y-4">
                                            <h4 className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Visual Evidence Protocol</h4>
                                            <div 
                                                className={cn(
                                                    "h-48 rounded-3xl border-2 border-dashed flex flex-col items-center justify-center gap-3 transition-all cursor-pointer group hover:bg-slate-50",
                                                    photoUrl ? "border-emerald-500 bg-emerald-50/10" : "border-slate-200"
                                                )}
                                                onClick={() => {
                                                    // Simulated camera logic
                                                    const fakeLink = "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?q=80&w=2070&auto=format&fit=crop";
                                                    setPhotoUrl(fakeLink);
                                                    toast.info("Image captured successfully");
                                                }}
                                            >
                                                {photoUrl ? (
                                                    <div className="relative w-full h-full p-2">
                                                        <img src={photoUrl} className="w-full h-full object-cover rounded-2xl" alt="Registry evidence" />
                                                        <div className="absolute inset-0 bg-emerald-600/20 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <Camera className="h-8 w-8 text-white" />
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div className="p-4 bg-white rounded-2xl shadow-sm border border-slate-100 group-hover:scale-110 transition-transform">
                                                            <Camera className="h-6 w-6 text-slate-400 group-hover:text-blue-600" />
                                                        </div>
                                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-slate-600">Initialize Camera Module</p>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        {/* Exceptional Notes */}
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between">
                                                <h4 className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Logistical Variance Notes</h4>
                                                <AlertCircle className="h-4 w-4 text-orange-400" />
                                            </div>
                                            <div className="relative group">
                                                <div className="absolute top-4 left-4">
                                                    <FileText className="h-4 w-4 text-slate-300 group-focus-within:text-blue-500 transition-colors" />
                                                </div>
                                                <textarea 
                                                    value={notes}
                                                    onChange={(e) => setNotes(e.target.value)}
                                                    placeholder="Document why items were excluded from shipment container..."
                                                    className="w-full bg-slate-50 rounded-2xl border-none p-4 pl-12 text-sm text-slate-900 placeholder:text-slate-300 focus:ring-2 focus:ring-blue-500/20 min-h-[100px] resize-none transition-all"
                                                />
                                            </div>
                                        </div>

                                        <Button 
                                            disabled={updatingId === order.id}
                                            onClick={() => submitPacking(order.id)}
                                            className="w-full h-16 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest shadow-xl shadow-blue-200 active:scale-95 transition-all"
                                        >
                                            {updatingId === order.id ? (
                                                <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                            ) : (
                                                "Finalize Reconciled Shipment"
                                            )}
                                        </Button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );

    function setVerificationFor(orderId: string) {
        setVerifiedItems({});
        setPhotoUrl("");
        setNotes("");
    }
}
