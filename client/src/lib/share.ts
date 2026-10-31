/**
 * Cross-Platform Mobile Share & Clipboard Utility
 */

export interface ShareOptions {
    title: string;
    text?: string;
    url: string;
}

/**
 * Robust cross-platform clipboard copy supporting:
 * 1. navigator.clipboard.writeText (HTTPS / secure context)
 * 2. document.execCommand fallback (HTTP / LAN testing / older browsers)
 */
export async function copyToClipboard(text: string): Promise<boolean> {
    if (typeof window === "undefined") return false;

    // 1. Try modern clipboard API
    if (navigator?.clipboard && typeof navigator.clipboard.writeText === "function") {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (err) {
            console.warn("navigator.clipboard failed, falling back to execCommand:", err);
        }
    }

    // 2. Bulletproof fallback for HTTP (e.g. 192.168.x.x) or when permission is restricted
    try {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        textarea.style.top = "-9999px";
        textarea.style.opacity = "0";
        textarea.setAttribute("readonly", "");
        document.body.appendChild(textarea);
        textarea.select();
        textarea.setSelectionRange(0, 99999);
        const successful = document.execCommand("copy");
        document.body.removeChild(textarea);
        return successful;
    } catch (err) {
        console.error("Fallback clipboard copy failed:", err);
        return false;
    }
}

/**
 * Safely launches a native mobile app URI scheme (e.g., whatsapp://, instagram://)
 * using an invisible anchor element so it NEVER opens a blank/new browser tab.
 */
export function launchNativeScheme(schemeUrl: string): void {
    if (typeof window === "undefined") return;
    try {
        const link = document.createElement("a");
        link.href = schemeUrl;
        link.style.display = "none";
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
            try {
                if (link.parentNode) {
                    document.body.removeChild(link);
                }
            } catch (_) {}
        }, 500);
    } catch (e) {
        console.warn("Could not launch scheme:", schemeUrl, e);
    }
}

export async function shareProduct({ title, text, url }: ShareOptions): Promise<void> {
    if (typeof window === "undefined") return;

    const fullUrl = url.startsWith("http")
        ? url
        : `${window.location.origin}${url.startsWith("/") ? "" : "/"}${url}`;

    const cleanTitle = (title || "BookMyVeg").trim();
    const cleanText = (text || `Order fresh ${cleanTitle} on BookMyVeg 🥬`).trim();

    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        try {
            await navigator.share({
                title: cleanTitle,
                text: cleanText,
                url: fullUrl,
            });
            return;
        } catch (err: any) {
            if (err?.name === "AbortError") return;
        }
    }

    // Native app fallback without opening new browser tab
    const shareMessage = `${cleanTitle}: ${cleanText}\n${fullUrl}`;
    launchNativeScheme(`whatsapp://send?text=${encodeURIComponent(shareMessage)}`);
}

