"use client";

import { useState } from "react";
import SearchInput from "@/components/ui/SearchInput";

export default function SearchBar() {
    const [query, setQuery] = useState("");

    return (
        <div className="w-full">
            <SearchInput
                value={query}
                onChange={setQuery}
                placeholder="SEARCH FOR FRESH PRODUCE..."
                className="w-full"
            />
        </div>
    );
}
