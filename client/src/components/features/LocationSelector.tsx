"use client";

import { useState } from "react";
import { toast } from "sonner";
import { MapPin, Navigation, ChevronDown } from "lucide-react";
import { useUserStore } from "@/store/useUserStore";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { getReverseGeocode } from "@/services/geocodingService";

export default function LocationSelector() {
    const { location, setLocation } = useUserStore();
    const [open, setOpen] = useState(false);
    const [pincode, setPincode] = useState("");
    const [loading, setLoading] = useState(false);

    const handleAutoDetect = () => {
        setLoading(true);
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const { latitude, longitude } = position.coords;
                    try {
                        const geoResult = await getReverseGeocode(latitude, longitude);

                        if (geoResult) {
                            // Try to get area and pincode from the context provided by our server
                            const context = (geoResult as any).context || [];
                            const serverArea = context.find((c: any) => c.id === "area")?.text;
                            const serverPincode = context.find((c: any) => c.id === "pincode")?.text;

                            const parts = geoResult.place_name.split(",");
                            const area = serverArea || parts[0].trim();
                            const pincodeMatch = geoResult.place_name.match(/\b\d{6}\b/);
                            const foundPincode = serverPincode || (pincodeMatch ? pincodeMatch[0] : "");

                            setLocation({
                                address: area,
                                pincode: foundPincode,
                                coords: { lat: latitude, lng: longitude },
                            });
                            toast.success(`Welcome to ${area}!`);
                        } else {
                            setLocation({
                                address: "Detected Location",
                                pincode: "",
                                coords: { lat: latitude, lng: longitude },
                            });
                        }
                    } catch (error) {
                        console.error("Geocoding failed:", error);
                        setLocation({
                            address: "Detected Location",
                            pincode: "",
                            coords: { lat: latitude, lng: longitude },
                        });
                    }
                    setLoading(false);
                    setOpen(false);
                },
                (error) => {
                    console.error("Error detecting location:", error);
                    setLoading(false);
                    toast.error("Could not detect location.");
                }
            );
        }
    };

    const handleManualSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (pincode.length === 6) {
            setLocation({
                address: `Area ${pincode}`,
                pincode: pincode,
            });
            setOpen(false);
            toast.success("Location updated!");
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <div className="flex flex-col cursor-pointer active:scale-95 transition-transform">
                    <div className="flex items-center gap-1 leading-none">
                        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-950/40">DELIVERING TO</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                        <h2 className="text-2xl font-black text-emerald-950 leading-none tracking-tighter">
                            {location?.address === "Select Location" ? "Set Location" : location?.address || "Set Location"}
                        </h2>
                    </div>
                    <div className="flex items-center gap-1 mt-1 opacity-90 group text-emerald-950/30">
                        <span className="text-[10px] font-black tracking-widest uppercase flex items-center gap-1">
                            <span className="text-emerald-950/20">HOME -</span>
                            {location?.pincode || "SELECT AREA"}
                        </span>
                        <ChevronDown className="h-3 w-3 group-hover:text-emerald-900 transition-colors" />
                    </div>
                </div>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md top-[20%] translate-y-0 rounded-[2rem] border-0 overflow-hidden p-6">
                <DialogHeader>
                    <DialogTitle className="text-xl font-black">Choose your location</DialogTitle>
                </DialogHeader>
                <div className="flex flex-col gap-4 py-4">
                    <Button
                        variant="outline"
                        className="flex items-center gap-2 justify-center py-7 text-green-600 border-green-100 bg-green-50 rounded-2xl font-black text-lg"
                        onClick={handleAutoDetect}
                        disabled={loading}
                    >
                        <Navigation className="h-5 w-5" />
                        {loading ? "Detecting..." : "Use Current Location"}
                    </Button>

                    <div className="relative my-2">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t" />
                        </div>
                        <div className="relative flex justify-center text-[10px] uppercase font-black tracking-widest">
                            <span className="bg-white px-3 text-gray-400">Or enter pincode</span>
                        </div>
                    </div>

                    <form onSubmit={handleManualSubmit} className="flex gap-3">
                        <Input
                            placeholder="6-digit Pincode"
                            value={pincode}
                            onChange={(e) => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            maxLength={6}
                            className="h-14 rounded-2xl border-2 border-gray-100 focus:border-green-500 font-bold text-lg px-5 shadow-inner bg-gray-50"
                        />
                        <Button type="submit" disabled={pincode.length !== 6} className="h-14 px-8 rounded-2xl bg-gray-900 font-black">
                            Update
                        </Button>
                    </form>
                </div>
            </DialogContent>
        </Dialog>
    );
}
