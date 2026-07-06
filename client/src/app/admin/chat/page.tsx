"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import {
    MessageSquare, Send, Search, X, Package, User,
    Image as ImageIcon, Video, Clock, CheckCheck,
    AlertCircle, PhoneOff, RefreshCw, Circle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUserStore } from "@/store/useUserStore";
import { initSocket, getSocket } from "@/services/socketService";
import { toast } from "sonner";
import api from "@/services/api";
import { useSearchParams } from "next/navigation";

// ── Types ───────────────────────────────────────────────────────────────────
interface Conversation {
    userId: string;
    userName: string;
    userPhone: string;
    lastMessage: string;
    lastMessageTime: string;
    hasAttachment: boolean;
    isRead: boolean;
    unreadCount?: number;
}

interface ChatMessage {
    id: string;
    senderId: string;
    isAdmin: boolean;
    message: string;
    orderId?: string | null;
    hasAttachment: boolean;
    attachmentType?: string | null;
    attachment?: string | null;
    senderName?: string;
    createdAt: string | Date;
    pending?: boolean;
}

interface Attachment {
    type: "IMAGE" | "VIDEO";
    dataUrl: string;
}

// ── LocalStorage Helpers ────────────────────────────────────────────────────
const LS_ADMIN_KEY = (userId: string) => `bmv_admin_chat_media_${userId}`;

function saveAdminMedia(userId: string, messageId: string, dataUrl: string) {
    try {
        const store = JSON.parse(localStorage.getItem(LS_ADMIN_KEY(userId)) || "{}");
        store[messageId] = dataUrl;
        localStorage.setItem(LS_ADMIN_KEY(userId), JSON.stringify(store));
    } catch { /* quota */ }
}

function getAdminMedia(userId: string, messageId: string): string | null {
    try {
        const store = JSON.parse(localStorage.getItem(LS_ADMIN_KEY(userId)) || "{}");
        return store[messageId] || null;
    } catch { return null; }
}

function clearAdminChatStorage(userId: string) {
    try {
        localStorage.removeItem(LS_ADMIN_KEY(userId));
    } catch { /* ignore */ }
}

// ── API helpers ──────────────────────────────────────────────────────────────
// Uses the project's axios instance which auto-injects Bearer tokens
async function apiFetch(path: string, opts: { method?: string; body?: string } = {}) {
    const method = (opts.method || "GET").toLowerCase() as "get" | "post" | "patch" | "delete";
    const data = opts.body ? JSON.parse(opts.body) : undefined;
    const res = await api[method](path, data);
    return res.data;
}

// ════════════════════════════════════════════════════════════════════════════
function AdminChatContent() {
    const { user } = useUserStore();
    const adminId = user?.id || "admin";
    
    const searchParams = useSearchParams();
    const queryUserId = searchParams.get("userId");
    const queryOrderId = searchParams.get("orderId");

    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState("");
    const [attachment, setAttachment] = useState<Attachment | null>(null);
    const [search, setSearch] = useState("");
    const [loadingConvs, setLoadingConvs] = useState(true);
    const [loadingMsgs, setLoadingMsgs] = useState(false);
    const [isTyping, setIsTyping] = useState(false);
    const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

    const scrollRef = useRef<HTMLDivElement>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const socketRef = useRef(getSocket());

    // ── Auto-scroll ──────────────────────────────────────────────────────────
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isTyping]);

    // ── Load conversations ───────────────────────────────────────────────────
    const loadConversations = useCallback(async () => {
        setLoadingConvs(true);
        try {
            const data = await apiFetch("/chat/conversations");
            setConversations(data.conversations || []);
        } catch { /* ignore */ }
        finally { setLoadingConvs(false); }
    }, []);

    useEffect(() => { loadConversations(); }, [loadConversations]);

    useEffect(() => {
        if (queryUserId) {
            openConversation(queryUserId);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [queryUserId]);

    // ── Socket setup ─────────────────────────────────────────────────────────
    useEffect(() => {
        if (!adminId) return;
        const socket = initSocket(adminId);
        socketRef.current = socket;

        // Admin joins support hub
        socket.emit("join_admin_support");

        const onChatMessage = (msg: ChatMessage) => {
            // Save incoming media from customers to admin localStorage
            if (msg.hasAttachment && msg.attachment) {
                saveAdminMedia(msg.senderId, msg.id, msg.attachment);
            }

            // If this belongs to the currently open conversation, append it
            if (msg.senderId === selectedUserId || (msg.isAdmin && selectedUserId)) {
                setMessages(prev => {
                    if (prev.find(m => m.id === msg.id)) return prev;
                    return [...prev, msg];
                });
                setIsTyping(false);
            } else if (!msg.isAdmin) {
                // Increment unread for background conversations
                setUnreadCounts(prev => ({
                    ...prev,
                    [msg.senderId]: (prev[msg.senderId] || 0) + 1,
                }));
            }

            // Refresh conversation list
            loadConversations();
        };

        const onChatTyping = (data: { senderId: string }) => {
            if (data.senderId === selectedUserId) {
                setIsTyping(true);
                setTimeout(() => setIsTyping(false), 3000);
            }
        };

        const onChatSessionEnded = ({ userId }: { userId: string }) => {
            clearAdminChatStorage(userId);
            if (userId === selectedUserId) {
                setMessages([]);
                setSelectedUserId(null);
                toast.info(`Customer ended the chat session. Media cleared.`);
            }
            loadConversations();
        };

        socket.on("chat_message", onChatMessage);
        socket.on("chat_typing", onChatTyping);
        socket.on("chat_session_ended", onChatSessionEnded);

        return () => {
            socket.off("chat_message", onChatMessage);
            socket.off("chat_typing", onChatTyping);
            socket.off("chat_session_ended", onChatSessionEnded);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [adminId, selectedUserId]);

    // ── Open a conversation ───────────────────────────────────────────────────
    const openConversation = async (userId: string) => {
        setSelectedUserId(userId);
        setMessages([]);
        setLoadingMsgs(true);
        setIsTyping(false);

        // Clear unread count
        setUnreadCounts(prev => ({ ...prev, [userId]: 0 }));

        try {
            // Mark as read on server
            apiFetch("/chat/mark-read", {
                method: "PATCH",
                body: JSON.stringify({ targetUserId: userId }),
            }).catch(() => {});

            const data = await apiFetch(`/chat/history?userId=${userId}`);
            const msgs: ChatMessage[] = (data.messages || []).map((m: ChatMessage) => ({
                ...m,
                attachment: m.hasAttachment ? getAdminMedia(userId, m.id) : null,
            }));
            setMessages(msgs);
        } catch {
            toast.error("Failed to load messages");
        } finally {
            setLoadingMsgs(false);
        }
    };

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
        e.target.value = "";
    };

    // ── Send message ──────────────────────────────────────────────────────────
    const handleSend = async () => {
        if (!selectedUserId) return;
        if (!input.trim() && !attachment) return;

        const tempId = `temp_${Date.now()}`;
        const optimistic: ChatMessage = {
            id: tempId,
            senderId: adminId,
            isAdmin: true,
            message: input,
            hasAttachment: !!attachment,
            attachmentType: attachment?.type || null,
            attachment: attachment?.dataUrl || null,
            senderName: "BookMyVeg Support",
            createdAt: new Date().toISOString(),
            pending: true,
        };

        setMessages(prev => [...prev, optimistic]);
        const msgText = input;
        const msgAttachment = attachment;
        setInput("");
        setAttachment(null);

        try {
            const res = await apiFetch("/chat/send", {
                method: "POST",
                body: JSON.stringify({
                    message: msgText,
                    hasAttachment: !!msgAttachment,
                    attachmentType: msgAttachment?.type,
                    attachment: msgAttachment?.dataUrl,
                    targetUserId: selectedUserId,
                    orderId: queryOrderId || undefined,
                }),
            });

            const saved: ChatMessage = res.message;
            if (msgAttachment) {
                saveAdminMedia(selectedUserId, saved.id, msgAttachment.dataUrl);
            }

            setMessages(prev =>
                prev.map(m => m.id === tempId ? { ...saved, attachment: msgAttachment?.dataUrl || null } : m)
            );

            // Socket relay for instant delivery
            socketRef.current?.emit("chat_message_relay", {
                ...saved,
                attachment: msgAttachment?.dataUrl || null,
                isAdmin: true,
                targetUserId: selectedUserId,
            });
        } catch {
            toast.error("Failed to send message");
            setMessages(prev => prev.filter(m => m.id !== tempId));
        }
    };

    // ── End session ───────────────────────────────────────────────────────────
    const handleEndSession = async () => {
        if (!selectedUserId) return;
        if (!confirm("End this customer's chat session? This will clear all media on both ends.")) return;
        try {
            await apiFetch("/chat/end-session", {
                method: "POST",
                body: JSON.stringify({ targetUserId: selectedUserId }),
            });
            clearAdminChatStorage(selectedUserId);
            setMessages([]);
            setSelectedUserId(null);
            loadConversations();
            toast.success("Session ended. Media cleared.");
        } catch {
            toast.error("Failed to end session");
        }
    };

    // ── Render media bubble ───────────────────────────────────────────────────
    const renderMedia = (msg: ChatMessage) => {
        if (!msg.hasAttachment) return null;
        const src = msg.attachment || (selectedUserId ? getAdminMedia(selectedUserId, msg.id) : null);
        if (!src) return (
            <div className="mt-2 flex items-center gap-1.5 text-[10px] opacity-50">
                <AlertCircle className="h-3 w-3" />
                <span>Media not on this device</span>
            </div>
        );
        if (msg.attachmentType === "VIDEO") {
            return <video src={src} controls className="mt-2 rounded-xl max-w-[220px] max-h-[160px] object-cover" />;
        }
        return (
            <img
                src={src} alt="attachment"
                className="mt-2 rounded-xl max-w-[220px] max-h-[200px] object-cover cursor-pointer"
                onClick={() => window.open(src, "_blank")}
            />
        );
    };

    // ── Filtered conversations ────────────────────────────────────────────────
    const filtered = conversations.filter(c =>
        c.userName.toLowerCase().includes(search.toLowerCase()) ||
        c.userPhone.includes(search)
    );

    // ────────────────────────────────────────────────────────────────────────
    return (
        <div className="flex h-[calc(100vh-6rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {/* ── Left Panel: Conversation List ────────────────────── */}
            <aside className="w-80 flex-shrink-0 border-r border-slate-100 flex flex-col bg-slate-50">
                {/* Header */}
                <div className="p-5 border-b border-slate-100 bg-white">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">Support Chat</h2>
                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                                {conversations.length} Active Conversations
                            </p>
                        </div>
                        <button
                            onClick={loadConversations}
                            className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 hover:text-emerald-600 transition-colors"
                        >
                            <RefreshCw className="h-3.5 w-3.5" />
                        </button>
                    </div>

                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search customers..."
                            className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/30"
                        />
                    </div>
                </div>

                {/* Conversation list */}
                <div className="flex-1 overflow-y-auto py-2">
                    {loadingConvs && (
                        <div className="flex justify-center py-8">
                            <div className="w-5 h-5 border-2 border-emerald-100 border-t-emerald-500 rounded-full animate-spin" />
                        </div>
                    )}

                    {!loadingConvs && filtered.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-4">
                            <MessageSquare className="h-8 w-8 text-slate-300" />
                            <p className="text-xs text-slate-400 font-medium">No active conversations</p>
                        </div>
                    )}

                    {filtered.map(conv => {
                        const unread = unreadCounts[conv.userId] || 0;
                        const isActive = selectedUserId === conv.userId;
                        return (
                            <button
                                key={conv.userId}
                                onClick={() => openConversation(conv.userId)}
                                className={cn(
                                    "w-full flex items-center gap-3 px-4 py-3.5 transition-all text-left relative",
                                    isActive
                                        ? "bg-emerald-50 border-r-2 border-emerald-500"
                                        : "hover:bg-slate-100 border-r-2 border-transparent"
                                )}
                            >
                                {/* Avatar */}
                                <div className={cn(
                                    "w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 text-sm font-black",
                                    isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                                )}>
                                    {conv.userName?.[0]?.toUpperCase() || "?"}
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-slate-800 truncate">{conv.userName}</span>
                                        <span className="text-[8px] text-slate-400 font-medium flex-shrink-0 ml-1">
                                            {new Date(conv.lastMessageTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1 mt-0.5">
                                        {conv.hasAttachment && <ImageIcon className="h-3 w-3 text-slate-400 flex-shrink-0" />}
                                        <p className="text-[10px] text-slate-400 truncate font-medium">{conv.lastMessage || "Sent an attachment"}</p>
                                    </div>
                                </div>

                                {unread > 0 && (
                                    <span className="w-5 h-5 bg-emerald-500 rounded-full text-white text-[9px] font-black flex items-center justify-center flex-shrink-0">
                                        {unread > 9 ? "9+" : unread}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </aside>

            {/* ── Right Panel: Chat Window ─────────────────────────── */}
            <div className="flex-1 flex flex-col min-w-0">
                {!selectedUserId ? (
                    // Empty state
                    <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8">
                        <div className="w-16 h-16 bg-slate-50 rounded-3xl border border-slate-100 flex items-center justify-center">
                            <MessageSquare className="h-8 w-8 text-slate-300" />
                        </div>
                        <div>
                            <p className="text-sm font-black text-slate-700 uppercase tracking-widest">Select a conversation</p>
                            <p className="text-xs text-slate-400 mt-1">Choose a customer to start replying</p>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Conversation Header */}
                        <div className="h-16 border-b border-slate-100 px-6 flex items-center justify-between bg-white flex-shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center text-sm font-black text-emerald-700">
                                    {conversations.find(c => c.userId === selectedUserId)?.userName?.[0]?.toUpperCase() || "?"}
                                </div>
                                <div>
                                    <p className="text-sm font-black text-slate-900">
                                        {conversations.find(c => c.userId === selectedUserId)?.userName || "Customer"}
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <p className="text-[9px] text-slate-400 font-medium">
                                            {conversations.find(c => c.userId === selectedUserId)?.userPhone}
                                        </p>
                                        {queryOrderId && (
                                            <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider leading-none">
                                                <Package className="h-2.5 w-2.5" /> Order: #{queryOrderId.slice(-8).toUpperCase()}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 rounded-xl">
                                    <Circle className="h-2 w-2 text-emerald-500 fill-current" />
                                    <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Active</span>
                                </div>
                                <button
                                    onClick={handleEndSession}
                                    className="w-9 h-9 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center text-red-400 hover:text-red-600 transition-colors"
                                    title="End Session"
                                >
                                    <PhoneOff className="h-4 w-4" />
                                </button>
                            </div>
                        </div>

                        {/* Messages */}
                        <div
                            ref={scrollRef}
                            className="flex-1 overflow-y-auto px-6 py-5 space-y-4 bg-slate-50"
                        >
                            {loadingMsgs && (
                                <div className="flex justify-center py-8">
                                    <div className="w-5 h-5 border-2 border-emerald-100 border-t-emerald-500 rounded-full animate-spin" />
                                </div>
                            )}

                            {!loadingMsgs && messages.length === 0 && (
                                <div className="flex justify-center py-12">
                                    <p className="text-xs text-slate-400 font-medium">No messages yet</p>
                                </div>
                            )}

                            {messages.map(msg => {
                                const isMine = msg.isAdmin;
                                return (
                                    <div
                                        key={msg.id}
                                        className={cn(
                                            "flex flex-col gap-1 max-w-[70%] animate-in fade-in slide-in-from-bottom-1 duration-300",
                                            isMine ? "ml-auto items-end" : "mr-auto items-start"
                                        )}
                                    >
                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest px-2">
                                            {msg.isAdmin ? "You (Support)" : conversations.find(c => c.userId === msg.senderId)?.userName || "Customer"}
                                        </span>

                                        {msg.orderId && (
                                            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 rounded-xl text-[9px] font-black text-emerald-700 border border-emerald-100">
                                                <Package className="h-3 w-3" />
                                                Order #{msg.orderId.slice(-8).toUpperCase()}
                                            </div>
                                        )}

                                        <div className={cn(
                                            "px-4 py-3 rounded-2xl text-sm font-medium shadow-sm",
                                            isMine
                                                ? "bg-emerald-600 text-white rounded-tr-md"
                                                : "bg-white text-slate-800 border border-slate-100 rounded-tl-md",
                                            msg.pending && "opacity-60"
                                        )}>
                                            {msg.message && <p>{msg.message}</p>}
                                            {renderMedia(msg)}
                                        </div>

                                        <div className="flex items-center gap-1 px-2">
                                            <span className="text-[8px] text-slate-400 font-medium">
                                                {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                            </span>
                                            {isMine && (
                                                msg.pending
                                                    ? <Clock className="h-2.5 w-2.5 text-slate-300" />
                                                    : <CheckCheck className="h-2.5 w-2.5 text-emerald-400" />
                                            )}
                                        </div>
                                    </div>
                                );
                            })}

                            {isTyping && (
                                <div className="flex items-end gap-2 mr-auto">
                                    <div className="px-4 py-3 bg-white border border-slate-100 rounded-2xl rounded-tl-md flex items-center gap-1.5">
                                        {[0, 150, 300].map(delay => (
                                            <span
                                                key={delay}
                                                className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce"
                                                style={{ animationDelay: `${delay}ms` }}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Attachment preview */}
                        {attachment && (
                            <div className="border-t border-slate-100 bg-white px-4 py-3 flex items-center gap-3">
                                <div className="relative flex-shrink-0">
                                    {attachment.type === "IMAGE" ? (
                                        <img src={attachment.dataUrl} alt="preview" className="w-14 h-14 rounded-xl object-cover" />
                                    ) : (
                                        <div className="w-14 h-14 rounded-xl bg-emerald-50 flex items-center justify-center">
                                            <Video className="h-5 w-5 text-emerald-600" />
                                        </div>
                                    )}
                                    <button
                                        onClick={() => setAttachment(null)}
                                        className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center"
                                    >
                                        <X className="h-3 w-3 text-white" />
                                    </button>
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-slate-700">{attachment.type} ready to send</p>
                                    <p className="text-[9px] text-slate-400 mt-0.5">Stored on admin device only</p>
                                </div>
                            </div>
                        )}

                        {/* Input */}
                        <div className="border-t border-slate-100 bg-white px-5 py-4 flex gap-3 items-end flex-shrink-0">
                            <input
                                ref={fileRef}
                                type="file"
                                accept="image/*,video/*"
                                className="hidden"
                                onChange={handleFileSelect}
                            />
                            <button
                                onClick={() => fileRef.current?.click()}
                                className={cn(
                                    "w-10 h-10 rounded-xl border flex items-center justify-center transition-all flex-shrink-0",
                                    attachment
                                        ? "bg-emerald-50 border-emerald-200 text-emerald-600"
                                        : "bg-slate-50 border-slate-200 text-slate-400 hover:text-emerald-600"
                                )}
                            >
                                <ImageIcon className="h-4 w-4" />
                            </button>

                            <div className="flex-1 relative">
                                <textarea
                                    rows={1}
                                    value={input}
                                    onChange={e => setInput(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === "Enter" && !e.shiftKey) {
                                            e.preventDefault();
                                            handleSend();
                                        }
                                    }}
                                    placeholder="Reply to customer..."
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/30 resize-none pr-14"
                                    style={{ minHeight: "48px", maxHeight: "120px" }}
                                />
                                <button
                                    onClick={handleSend}
                                    disabled={!input.trim() && !attachment}
                                    className="absolute right-3 bottom-3 w-8 h-8 bg-emerald-600 rounded-xl flex items-center justify-center text-white hover:bg-emerald-700 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                    <Send className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

export default function AdminChatPage() {
    return (
        <Suspense fallback={
            <div className="flex-1 flex items-center justify-center p-8 bg-slate-50 min-h-screen">
                <div className="w-8 h-8 border-4 border-emerald-100 border-t-emerald-500 rounded-full animate-spin" />
            </div>
        }>
            <AdminChatContent />
        </Suspense>
    );
}
