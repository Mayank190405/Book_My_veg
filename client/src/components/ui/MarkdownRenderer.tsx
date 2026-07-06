"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface MarkdownRendererProps {
    content: string;
    light?: boolean;
}

export default function MarkdownRenderer({ content, light = false }: MarkdownRendererProps) {
    if (!content) return null;

    // Escaping to prevent basic XSS (allow only structured markdown rendering)
    let html = content
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

    // Colors & spacing based on light theme flag
    const h3Class = light 
        ? "text-sm font-black text-[#0b5c3e] uppercase tracking-widest italic mt-6 mb-3" 
        : "text-sm font-black text-primary uppercase tracking-widest italic mt-6 mb-3";
        
    const h2Class = light 
        ? "text-base font-black text-[#0b5c3e] uppercase tracking-widest italic mt-8 mb-4" 
        : "text-base font-black text-primary uppercase tracking-widest italic mt-8 mb-4";
        
    const h1Class = light 
        ? "text-xl font-black text-slate-900 uppercase tracking-widest italic mb-6" 
        : "text-xl font-black text-white uppercase tracking-widest italic mb-6";

    const ulClass = light
        ? "list-disc pl-5 text-xs text-slate-600 space-y-2 leading-relaxed mb-4"
        : "list-disc pl-5 text-xs text-white/60 space-y-2 leading-relaxed mb-4";

    const pClass = light
        ? "text-xs text-slate-600 leading-relaxed mb-4"
        : "text-xs text-white/80 leading-relaxed mb-4";

    const hrClass = light
        ? "border-slate-100 my-6"
        : "border-white/5 my-6";

    // Headings
    html = html.replace(/^### (.*$)/gim, `<h3 class="${h3Class}">$1</h3>`);
    html = html.replace(/^## (.*$)/gim, `<h2 class="${h2Class}">$1</h2>`);
    html = html.replace(/^# (.*$)/gim, `<h1 class="${h1Class}">$1</h1>`);

    // Bold
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__(.*?)__/g, '<strong>$1</strong>');

    // Italic
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    html = html.replace(/_(.*?)_/g, '<em>$1</em>');

    // Links
    const linkColorClass = light ? "text-[#0b5c3e] hover:underline" : "text-primary hover:underline";
    html = html.replace(/\[(.*?)\]\((.*?)\)/g, `<a href="$2" class="${linkColorClass}" target="_blank" rel="noopener noreferrer">$1</a>`);

    // Unordered Lists
    const lines = html.split('\n');
    let inList = false;
    const processedLines = lines.map(line => {
        const trimmed = line.trim();
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            const listContent = trimmed.substring(2);
            let result = '';
            if (!inList) {
                inList = true;
                result += `<ul class="${ulClass}">`;
            }
            result += `<li>${listContent}</li>`;
            return result;
        } else {
            let result = '';
            if (inList) {
                inList = false;
                result += '</ul>';
            }
            return result + line;
        }
    });
    if (inList) {
        processedLines.push('</ul>');
    }
    html = processedLines.join('\n');

    // Paragraphs
    html = html.split(/\n{2,}/).map(p => {
        const trimmed = p.trim();
        if (!trimmed) return "";
        if (trimmed.startsWith('<h') || trimmed.startsWith('<ul') || trimmed.startsWith('<li') || trimmed.startsWith('<hr')) {
            return trimmed;
        }
        return `<p class="${pClass}">${trimmed}</p>`;
    }).filter(Boolean).join('\n');

    // Horizontal Rules
    html = html.replace(/^---$/gim, `<hr class="${hrClass}" />`);

    // Line breaks
    html = html.replace(/\n/g, '<br />');

    return (
        <div 
            className={cn(light ? "prose max-w-none text-slate-800" : "prose prose-invert max-w-none text-white")}
            dangerouslySetInnerHTML={{ __html: html }}
        />
    );
}
