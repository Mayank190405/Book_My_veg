"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
    ChevronLeft, Send, ShieldCheck, Zap, Paperclip, X,
    Package, Image as ImageIcon, Video, CheckCheck, Clock,
    PhoneOff, AlertCircle, Camera
} from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useUserStore } from "@/store/useUserStore";
import { initSocket, getSocket, disconnectSocket } from "@/services/socketService";
import { toast } from "sonner";
import api from "@/services/api";

// ── Types ───────────────────────────────────────────────────────────────────
interface Attachment {
    type: "IMAGE" | "VIDEO";
    dataUrl: string;
}

interface ChatMessage {
    id: string;
    senderId: string;
    isAdmin: boolean;
    message: string;
    orderId?: string | null;
    hasAttachment: boolean;
    attachmentType?: string | null;
    attachment?: string | null; // base64 data URL (client-side only)
    senderName?: string;
    createdAt: string | Date;
    pending?: boolean;
}

interface Order {
    id: string;
    createdAt: string;
    status: string;
    totalAmount: number;
    items: Array<{ productName: string; quantity: number }>;
}

// ── LocalStorage Helpers ────────────────────────────────────────────────────
const LS_KEY = (userId: string) => `bmv_chat_media_${userId}`;

function saveMediaToLS(userId: string, messageId: string, dataUrl: string) {
    try {
        const store = JSON.parse(localStorage.getItem(LS_KEY(userId)) || "{}");
        store[messageId] = dataUrl;
        localStorage.setItem(LS_KEY(userId), JSON.stringify(store));
    } catch { /* quota exceeded – silently skip */ }
}

function getMediaFromLS(userId: string, messageId: string): string | null {
    try {
        const store = JSON.parse(localStorage.getItem(LS_KEY(userId)) || "{}");
        return store[messageId] || null;
    } catch { return null; }
}

function clearChatStorage(userId: string) {
    try {
        localStorage.removeItem(LS_KEY(userId));
        // Also clear session messages key
        localStorage.removeItem(`bmv_chat_session_${userId}`);
    } catch { /* ignore */ }
}

// ── API Helpers ──────────────────────────────────────────────────────────────
// Uses the project's axios instance which auto-injects Bearer tokens
async function apiFetch(path: string, opts: { method?: string; body?: string } = {}) {
    const method = (opts.method || "GET").toLowerCase() as "get" | "post" | "patch" | "delete";
    const data = opts.body ? JSON.parse(opts.body) : undefined;
    const res = await api[method](path, data);
    return res.data;
}

// ── Merge DB messages with local media ──────────────────────────────────────
function mergeWithLocalMedia(messages: ChatMessage[], userId: string): ChatMessage[] {
    return messages.map(msg => {
        if (msg.hasAttachment && !msg.attachment) {
            const local = getMediaFromLS(userId, msg.id);
            return local ? { ...msg, attachment: local } : msg;
        }
        return msg;
    });
}

// ════════════════════════════════════════════════════════════════════════════
export default function ChatPage() {
    const router = useRouter();
    const { user } = useUserStore();
    const userId = user?.id || "";

    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState("");
    const [attachment, setAttachment] = useState<Attachment | null>(null);
    const [isTyping, setIsTyping] = useState(false);
    const [sessionEnded, setSessionEnded] = useState(false);
    const [loading, setLoading] = useState(true);
    const [showOrderSelector, setShowOrderSelector] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [orders, setOrders] = useState<Order[]>([]);
    const [ordersLoading, setOrdersLoading] = useState(false);

    const scrollRef = useRef<HTMLDivElement>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const typingTimeout = useRef<NodeJS.Timeout | null>(null);
    const lastTypingSent = useRef<number>(0);
    const socketRef = useRef(getSocket());

    // ── Auto-scroll ──────────────────────────────────────────────────────────
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isTyping]);

    // ── Load history ─────────────────────────────────────────────────────────
    useEffect(() => {
        if (!userId) return;
        setLoading(true);
        apiFetch("/chat/history")
            .then(data => {
                const merged = mergeWithLocalMedia(data.messages || [], userId);
                setMessages(merged);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [userId]);

    // ── Socket setup ─────────────────────────────────────────────────────────
    useEffect(() => {
        if (!userId) return;
        const socket = initSocket(userId);
        socketRef.current = socket;

        const handleChatMessage = (msg: ChatMessage) => {
            // Persist incoming admin media to localStorage
            if (msg.hasAttachment && msg.attachment) {
                saveMediaToLS(userId, msg.id, msg.attachment);
            }
            setMessages(prev => {
                // Avoid duplicates
                if (prev.find(m => m.id === msg.id)) return prev;
                return [...prev, msg];
            });
            setIsTyping(false);
        };

        const handleChatTyping = () => {
            setIsTyping(true);
            setTimeout(() => setIsTyping(false), 3000);
        };

        const handleChatSessionEnded = ({ userId: endedUserId }: { userId: string }) => {
            if (endedUserId === userId) {
                clearChatStorage(userId);
                setSessionEnded(true);
                setMessages([]);
                toast.success("Chat session ended. All media cleared.");
            }
        };

        socket.on("chat_message", handleChatMessage);
        socket.on("chat_typing", handleChatTyping);
        socket.on("chat_session_ended", handleChatSessionEnded);

        return () => {
            socket.off("chat_message", handleChatMessage);
            socket.off("chat_typing", handleChatTyping);
            socket.off("chat_session_ended", handleChatSessionEnded);
        };
    }, [userId]);

    // ── Load recent orders for quick selector ─────────────────────────────────
    const loadOrders = useCallback(async () => {
        setOrdersLoading(true);
        try {
            const data = await apiFetch("/orders?limit=5");
            setOrders(data.orders || []);
        } catch { /* ignore */ }
        finally { setOrdersLoading(false); }
    }, []);

    useEffect(() => {
        if (showOrderSelector && orders.length === 0) loadOrders();
    }, [showOrderSelector, loadOrders, orders.length]);

    // ── File picker ───────────────────────────────────────────────────────────
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const isVideo = file.type.startsWith("video/");
        const reader = new FileReader();
        reader.onload = ev => {
            setAttachment({
                type: isVideo ? "VIDEO" : "IMAGE",
                dataUrl: ev.target?.result as string,
            });
        };
        reader.readAsDataURL(file);
        // Reset input so same file can be re-selected
        e.target.value = "";
    };

    // ── Typing indicator ──────────────────────────────────────────────────────
    const handleTyping = () => {
        const socket = socketRef.current;
        if (!socket) return;
        const now = Date.now();
        if (now - lastTypingSent.current > 2000) {
            socket.emit("chat_typing", { senderId: userId, isAdmin: false });
            lastTypingSent.current = now;
        }
    };

    // ── Send message ──────────────────────────────────────────────────────────
    const handleSend = async () => {
        if (!input.trim() && !attachment) return;
        if (sessionEnded) return;

        const tempId = `temp_${Date.now()}`;
        const optimistic: ChatMessage = {
            id: tempId,
            senderId: userId,
            isAdmin: false,
            message: input,
            orderId: selectedOrder?.id || null,
            hasAttachment: !!attachment,
            attachmentType: attachment?.type || null,
            attachment: attachment?.dataUrl || null,
            senderName: user?.name,
            createdAt: new Date().toISOString(),
            pending: true,
        };

        setMessages(prev => [...prev, optimistic]);
        const msgText = input;
        const msgAttachment = attachment;
        const msgOrder = selectedOrder;
        setInput("");
        setAttachment(null);
        setSelectedOrder(null);
        setShowOrderSelector(false);

        try {
            const res = await apiFetch("/chat/send", {
                method: "POST",
                body: JSON.stringify({
                    message: msgText,
                    orderId: msgOrder?.id,
                    hasAttachment: !!msgAttachment,
                    attachmentType: msgAttachment?.type,
                    attachment: msgAttachment?.dataUrl,
                    senderName: user?.name,
                }),
            });

            const saved: ChatMessage = res.message;

            // Persist media to localStorage under the real DB id
            if (msgAttachment) {
                saveMediaToLS(userId, saved.id, msgAttachment.dataUrl);
            }

            // Replace optimistic entry
            setMessages(prev =>
                prev.map(m => m.id === tempId ? { ...saved, attachment: msgAttachment?.dataUrl || null } : m)
            );

            // Also relay via socket for instant delivery
            socketRef.current?.emit("chat_message_relay", {
                ...saved,
                attachment: msgAttachment?.dataUrl || null,
                senderId: userId,
                isAdmin: false,
            });
        } catch {
            toast.error("Failed to send message. Please try again.");
            // Remove optimistic on error
            setMessages(prev => prev.filter(m => m.id !== tempId));
        }
    };

    // ── End session ───────────────────────────────────────────────────────────
    const handleEndSession = async () => {
        if (!confirm("End this chat session? All media attachments will be cleared from your device.")) return;
        try {
            await apiFetch("/chat/end-session", { method: "POST", body: JSON.stringify({}) });
            clearChatStorage(userId);
            setSessionEnded(true);
            setMessages([]);
        } catch {
            toast.error("Failed to end session");
        }
    };

    // ── Render attachment bubble ──────────────────────────────────────────────
    const renderAttachmentBubble = (msg: ChatMessage) => {
        if (!msg.hasAttachment) return null;
        const src = msg.attachment || getMediaFromLS(userId, msg.id);
        if (!src) {
            return (
                <div className="mt-2 flex items-center gap-2 text-xs opacity-60">
                    <AlertCircle className="h-3 w-3" />
                    <span>Media not available on this device</span>
                </div>
            );
        }
        if (msg.attachmentType === "VIDEO") {
            return (
                <video
                    src={src}
                    controls
                    className="mt-2 rounded-2xl max-w-[220px] max-h-[180px] object-cover"
                />
            );
        }
        return (
            <img
                src={src}
                alt="attachment"
                className="mt-2 rounded-2xl max-w-[220px] max-h-[220px] object-cover cursor-pointer"
                onClick={() => window.open(src, "_blank")}
            />
        );
    };

    // ────────────────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-background flex flex-col">
            {/* Header */}
            <header className="px-6 py-5 flex items-center gap-4 bg-background/95 backdrop-blur-3xl border-b border-border sticky top-0 z-50">
                <button
                    onClick={() => router.back()}
                    className="w-11 h-11 flex items-center justify-center bg-card rounded-2xl border border-border shadow-sm active:scale-90 transition-all"
                >
                    <ChevronLeft className="h-5 w-5 text-foreground" strokeWidth={2.5} />
                </button>

                <div className="flex-1">
                    <h1 className="text-lg font-black text-foreground uppercase tracking-widest italic leading-none">
                        Concierge
                    </h1>
                    <div className="flex items-center gap-2 mt-1.5">
                        <span className={cn(
                            "w-2 h-2 rounded-full",
                            sessionEnded ? "bg-red-500" : "bg-emerald-500 animate-pulse"
                        )} />
                        <p className={cn(
                            "text-[9px] font-black uppercase tracking-[0.2em]",
                            sessionEnded ? "text-red-500" : "text-emerald-600"
                        )}>
                            {sessionEnded ? "SESSION ENDED" : "EXECUTIVE ONLINE"}
                        </p>
                    </div>
                </div>

                {!sessionEnded && (
                    <button
                        onClick={handleEndSession}
                        className="w-11 h-11 bg-red-50 border border-red-100 rounded-2xl flex items-center justify-center text-red-400 hover:bg-red-100 hover:text-red-600 transition-all active:scale-90"
                        title="End Chat Session"
                    >
                        <PhoneOff className="h-4 w-4" />
                    </button>
                )}

                <div className="w-11 h-11 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20">
                    <Zap className="h-5 w-5 text-primary" />
                </div>
            </header>

            {/* Watermark */}
            <div className="flex flex-col items-center justify-center pt-8 pb-2 opacity-20 text-center space-y-2">
                <div className="w-14 h-14 bg-card rounded-[1.75rem] border border-border flex items-center justify-center">
                    <ShieldCheck className="h-7 w-7 text-primary" />
                </div>
                <p className="text-[8px] font-black uppercase tracking-[0.3em] max-w-[180px]">
                    End-to-End Secure · Media Stays on Device
                </p>
            </div>

            {/* Session ended state */}
            {sessionEnded && (
                <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-8">
                    <div className="w-16 h-16 bg-red-50 rounded-3xl flex items-center justify-center">
                        <PhoneOff className="h-8 w-8 text-red-400" />
                    </div>
                    <div>
                        <p className="font-black text-foreground uppercase tracking-widest text-sm">Chat Ended</p>
                        <p className="text-xs text-foreground/40 mt-1 font-medium">All media has been cleared from your device.</p>
                    </div>
                    <button
                        onClick={() => { setSessionEnded(false); window.location.reload(); }}
                        className="px-8 py-3 bg-primary text-primary-foreground rounded-2xl text-xs font-black uppercase tracking-widest"
                    >
                        Start New Session
                    </button>
                </div>
            )}

            {/* Chat messages */}
            {!sessionEnded && (
                <main
                    ref={scrollRef}
                    className="flex-1 overflow-y-auto px-5 py-4 space-y-5 scroll-smooth"
                >
                    {loading && (
                        <div className="flex justify-center py-8">
                            <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                        </div>
                    )}

                    {!loading && messages.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-16 gap-3 opacity-40">
                            <Zap className="h-8 w-8 text-primary" />
                            <p className="text-xs font-black uppercase tracking-widest text-center">
                                Send a message to connect<br />with our executive
                            </p>
                        </div>
                    )}

                    {messages.map((msg) => {
                        const isMine = !msg.isAdmin;
                        return (
                            <div
                                key={msg.id}
                                className={cn(
                                    "flex flex-col gap-1 max-w-[85%] animate-in fade-in slide-in-from-bottom-2 duration-400",
                                    isMine ? "ml-auto items-end" : "mr-auto items-start"
                                )}
                            >
                                {/* Sender label */}
                                <span className="text-[9px] font-black uppercase tracking-wider opacity-30 px-2">
                                    {msg.isAdmin ? "BookMyVeg Support" : (msg.senderName || "You")}
                                </span>

                                {/* Order badge */}
                                {msg.orderId && (
                                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/5 border border-primary/10 rounded-xl text-[9px] font-black uppercase tracking-widest text-primary/70">
                                        <Package className="h-3 w-3" />
                                        Order #{msg.orderId.slice(-8).toUpperCase()}
                                    </div>
                                )}

                                {/* Bubble */}
                                <div className={cn(
                                    "px-5 py-3.5 rounded-[1.75rem] text-sm font-semibold shadow-lg relative",
                                    isMine
                                        ? "bg-primary text-primary-foreground rounded-tr-md shadow-primary/15"
                                        : "bg-card text-foreground border border-border rounded-tl-md shadow-black/5",
                                    msg.pending && "opacity-70"
                                )}>
                                    {msg.message && <p className="leading-relaxed">{msg.message}</p>}
                                    {renderAttachmentBubble(msg)}
                                </div>

                                {/* Timestamp + status */}
                                <div className="flex items-center gap-1 px-2">
                                    <span className="text-[8px] font-bold text-foreground/20 uppercase tracking-widest">
                                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                    </span>
                                    {isMine && (
                                        msg.pending
                                            ? <Clock className="h-2.5 w-2.5 text-foreground/20" />
                                            : <CheckCheck className="h-2.5 w-2.5 text-primary/40" />
                                    )}
                                </div>
                            </div>
                        );
                    })}

                    {/* Typing indicator */}
                    {isTyping && (
                        <div className="flex items-end gap-2 mr-auto">
                            <div className="px-5 py-3.5 bg-card border border-border rounded-[1.75rem] rounded-tl-md flex items-center gap-1.5">
                                {[0, 150, 300].map(delay => (
                                    <span
                                        key={delay}
                                        className="w-1.5 h-1.5 rounded-full bg-foreground/30 animate-bounce"
                                        style={{ animationDelay: `${delay}ms` }}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </main>
            )}

            {/* ── Quick Order Selector Panel ───────────────────────── */}
            {showOrderSelector && !sessionEnded && (
                <div className="border-t border-border bg-background/98 backdrop-blur-xl px-5 py-4 space-y-3 max-h-60 overflow-y-auto">
                    <div className="flex items-center justify-between">
                        <span className="text-[9px] font-black uppercase tracking-widest text-foreground/40">
                            Select Recent Order
                        </span>
                        <button onClick={() => setShowOrderSelector(false)}>
                            <X className="h-4 w-4 text-foreground/30" />
                        </button>
                    </div>

                    {ordersLoading && (
                        <div className="flex justify-center py-4">
                            <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                        </div>
                    )}

                    {!ordersLoading && orders.map(order => (
                        <button
                            key={order.id}
                            onClick={() => { setSelectedOrder(order); setShowOrderSelector(false); }}
                            className={cn(
                                "w-full flex items-center gap-3 p-4 rounded-2xl border text-left transition-all",
                                selectedOrder?.id === order.id
                                    ? "border-primary/40 bg-primary/5"
                                    : "border-border bg-card hover:border-primary/20"
                            )}
                        >
                            <div className="w-8 h-8 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                                <Package className="h-4 w-4 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-black text-foreground truncate">
                                    #{order.id.slice(-8).toUpperCase()}
                                </p>
                                <p className="text-[9px] text-foreground/40 font-medium uppercase tracking-widest mt-0.5">
                                    {order.status} · ₹{order.totalAmount}
                                </p>
                            </div>
                            <span className={cn(
                                "text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-lg",
                                order.status === "DELIVERED" ? "bg-emerald-50 text-emerald-600" :
                                order.status === "CANCELLED" ? "bg-red-50 text-red-500" :
                                "bg-amber-50 text-amber-600"
                            )}>
                                {order.status}
                            </span>
                        </button>
                    ))}

                    {!ordersLoading && orders.length === 0 && (
                        <p className="text-center text-xs text-foreground/30 py-4 font-medium">No recent orders found</p>
                    )}
                </div>
            )}

            {/* ── Attachment Preview ───────────────────────────────── */}
            {attachment && !sessionEnded && (
                <div className="border-t border-border bg-background/98 px-5 py-3 flex items-center gap-3">
                    <div className="relative flex-shrink-0">
                        {attachment.type === "IMAGE" ? (
                            <img src={attachment.dataUrl} alt="preview" className="w-16 h-16 rounded-2xl object-cover" />
                        ) : (
                            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                                <Video className="h-6 w-6 text-primary" />
                            </div>
                        )}
                        <button
                            onClick={() => setAttachment(null)}
                            className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center"
                        >
                            <X className="h-3 w-3 text-white" />
                        </button>
                    </div>
                    <div>
                        <p className="text-xs font-black text-foreground">{attachment.type} attached</p>
                        <p className="text-[9px] text-foreground/40 mt-0.5">Stored on your device only</p>
                    </div>
                </div>
            )}

            {/* Selected order preview */}
            {selectedOrder && !sessionEnded && (
                <div className="px-5 py-2 border-t border-border bg-primary/3 flex items-center gap-2">
                    <Package className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                    <span className="text-[9px] font-black text-primary/70 uppercase tracking-widest flex-1">
                        Order #{selectedOrder.id.slice(-8).toUpperCase()} selected
                    </span>
                    <button onClick={() => setSelectedOrder(null)}>
                        <X className="h-3.5 w-3.5 text-foreground/30" />
                    </button>
                </div>
            )}

            {/* ── Input Bar ────────────────────────────────────────── */}
            {!sessionEnded && (
                <div className="p-5 bg-background/90 backdrop-blur-3xl border-t border-border sticky bottom-0">
                    <input
                        ref={fileRef}
                        type="file"
                        accept="image/*,video/*"
                        className="hidden"
                        onChange={handleFileSelect}
                        capture="environment"
                    />

                    <div className="flex gap-3 items-end">
                        {/* Attachment & Order buttons */}
                        <div className="flex flex-col gap-2 flex-shrink-0">
                            <button
                                onClick={() => fileRef.current?.click()}
                                className={cn(
                                    "w-10 h-10 rounded-2xl border flex items-center justify-center transition-all active:scale-90",
                                    attachment
                                        ? "bg-primary/10 border-primary/20 text-primary"
                                        : "bg-card border-border text-foreground/40 hover:text-primary hover:border-primary/20"
                                )}
                                title="Attach photo/video"
                            >
                                <Camera className="h-4 w-4" />
                            </button>
                            <button
                                onClick={() => setShowOrderSelector(v => !v)}
                                className={cn(
                                    "w-10 h-10 rounded-2xl border flex items-center justify-center transition-all active:scale-90",
                                    showOrderSelector || selectedOrder
                                        ? "bg-primary/10 border-primary/20 text-primary"
                                        : "bg-card border-border text-foreground/40 hover:text-primary hover:border-primary/20"
                                )}
                                title="Select order"
                            >
                                <Package className="h-4 w-4" />
                            </button>
                        </div>

                        {/* Text input */}
                        <div className="flex-1 relative">
                            <textarea
                                rows={1}
                                value={input}
                                onChange={(e) => { setInput(e.target.value); handleTyping(); }}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSend();
                                    }
                                }}
                                placeholder="Type a message..."
                                className="w-full bg-card border border-border rounded-3xl px-6 py-3.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-foreground/25 resize-none leading-relaxed pr-14"
                                style={{ minHeight: "52px", maxHeight: "120px" }}
                            />
                            <button
                                onClick={handleSend}
                                disabled={!input.trim() && !attachment}
                                className="absolute right-3 bottom-3 w-9 h-9 bg-primary rounded-2xl flex items-center justify-center text-primary-foreground shadow-md shadow-primary/20 hover:scale-110 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100"
                            >
                                <Send className="h-4 w-4" />
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center justify-center gap-6 mt-3 opacity-20">
                        <div className="flex items-center gap-1.5">
                            <ImageIcon className="h-3 w-3" />
                            <span className="text-[8px] font-black uppercase tracking-widest">Photo</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <Video className="h-3 w-3" />
                            <span className="text-[8px] font-black uppercase tracking-widest">Video</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <Package className="h-3 w-3" />
                            <span className="text-[8px] font-black uppercase tracking-widest">Order</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
