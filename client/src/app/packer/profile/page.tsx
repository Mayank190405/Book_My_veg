"use client";

import { useRouter } from "next/navigation";
import { useUserStore } from "@/store/useUserStore";
import { logout } from "@/services/authService";
import { 
    User, 
    Shield, 
    Warehouse, 
    LogOut, 
    ChevronRight, 
    CheckCircle2, 
    PackageCheck,
    ArrowLeft
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PackerProfilePage() {
    const router = useRouter();
    const { user } = useUserStore();

    const handleLogout = async () => {
        await logout();
        router.push("/packer/login");
    };

    return (
        <div className="p-5 space-y-5 animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex items-center gap-2 pt-2">
                <button onClick={() => router.push("/packer")} className="p-1.5 -ml-1 rounded-full hover:bg-slate-100 text-slate-600">
                    <ArrowLeft className="h-5 w-5" />
                </button>
                <h2 className="text-xl font-black text-slate-900 tracking-tight">Packer Profile</h2>
            </div>

            {/* Profile Avatar Card */}
            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-purple-700 text-white flex items-center justify-center font-black text-xl shadow-md shadow-purple-200">
                    {user?.name?.charAt(0) || "P"}
                </div>
                <div className="space-y-0.5">
                    <h3 className="text-base font-black text-slate-900">{user?.name || "Warehouse Packer"}</h3>
                    <p className="text-xs font-bold text-slate-400">{user?.phone || "No phone linked"}</p>
                    <span className="inline-block px-2 py-0.5 bg-purple-50 text-purple-700 text-[9px] font-black rounded-full uppercase tracking-wider">
                        {user?.role || "PACKING"} OPERATOR
                    </span>
                </div>
            </div>

            {/* Station Details */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-4 space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">Terminal Station</h4>
                
                <div className="flex items-center justify-between py-2 border-b border-slate-100 text-xs">
                    <div className="flex items-center gap-2.5 text-slate-600 font-semibold">
                        <Warehouse className="h-4 w-4 text-purple-600" />
                        <span>Assigned Hub</span>
                    </div>
                    <span className="font-bold text-slate-900">{user?.location?.name || "Main Hub Node"}</span>
                </div>

                <div className="flex items-center justify-between py-2 border-b border-slate-100 text-xs">
                    <div className="flex items-center gap-2.5 text-slate-600 font-semibold">
                        <Shield className="h-4 w-4 text-purple-600" />
                        <span>Terminal ID</span>
                    </div>
                    <span className="font-bold text-purple-700 font-mono">
                        PKR-{user?.id?.slice(-4).toUpperCase() || "1024"}
                    </span>
                </div>

                <div className="flex items-center justify-between py-2 text-xs">
                    <div className="flex items-center gap-2.5 text-slate-600 font-semibold">
                        <PackageCheck className="h-4 w-4 text-emerald-600" />
                        <span>Scanner Engine</span>
                    </div>
                    <span className="font-bold text-emerald-600">Optic v2 Active</span>
                </div>
            </div>

            {/* Logout Action */}
            <div className="pt-4 pb-16">
                <Button 
                    onClick={handleLogout}
                    variant="outline"
                    className="w-full h-13 rounded-2xl border-red-100 bg-red-50/50 hover:bg-red-100 text-red-600 font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-98"
                >
                    <LogOut className="h-4 w-4" />
                    Sign Out of Station
                </Button>
            </div>
        </div>
    );
}
