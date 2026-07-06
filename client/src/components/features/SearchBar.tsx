"use client";

import { useState } from "react";
import SearchInput from "@/components/ui/SearchInput";

interface SearchBarProps {
    focused?: boolean;
    onFocusChange?: (val: boolean) => void;
}

export default function SearchBar({ focused, onFocusChange }: SearchBarProps) {
    const [query, setQuery] = useState("");

    return (
        <div className="w-full">
            <SearchInput
                value={query}
                onChange={setQuery}
                placeholder="SEARCH FOR FRESH PRODUCE..."
                className="w-full"
                focused={focused}
                onFocusChange={onFocusChange}
            />
        </div>
    );
}
