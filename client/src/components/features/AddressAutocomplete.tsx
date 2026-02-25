"use client";

import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { getAutocompleteSuggestions, GeocodingFeature } from "@/services/geocodingService";
import { Loader2, MapPin } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface AddressAutocompleteProps {
    onSelect: (address: string, lat?: number, lng?: number) => void;
    placeholder?: string;
    defaultValue?: string;
}

export default function AddressAutocomplete({ onSelect, placeholder = "Search address...", defaultValue = "" }: AddressAutocompleteProps) {
    const [query, setQuery] = useState(defaultValue);
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    // Debounce logic could be added here, but for now relying on query key change
    const { data: suggestions, isLoading } = useQuery({
        queryKey: ["autocomplete", query],
        queryFn: () => getAutocompleteSuggestions(query),
        enabled: query.length > 2,
        staleTime: 1000 * 60 * 5, // Cache for 5 mins
    });

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleSelect = (feature: GeocodingFeature) => {
        setQuery(feature.place_name);
        setIsOpen(false);
        onSelect(feature.place_name, feature.center[1], feature.center[0]);
    };

    return (
        <div className="relative" ref={wrapperRef}>
            <div className="relative">
                <MapPin className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setIsOpen(true);
                    }}
                    placeholder={placeholder}
                    className="pl-9"
                />
                {isLoading && (
                    <div className="absolute right-3 top-3">
                        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                    </div>
                )}
            </div>

            {isOpen && suggestions && suggestions.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
                    {suggestions.map((suggestion: GeocodingFeature) => (
                        <div
                            key={suggestion.id}
                            className="px-4 py-2 hover:bg-gray-50 cursor-pointer text-sm border-b last:border-0"
                            onClick={() => handleSelect(suggestion)}
                        >
                            {suggestion.place_name}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
