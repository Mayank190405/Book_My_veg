import api from "./api";

export interface GeocodingFeature {
    id: string;
    place_name: string;
    main_title?: string;
    secondary_text?: string;
    center: [number, number]; // [lng, lat]
    pincode?: string;
    context?: Array<{ id: string; text: string }>;
}

export const getAutocompleteSuggestions = async (query: string): Promise<GeocodingFeature[]> => {
    if (!query) return [];
    try {
        const response = await api.get(`/geocoding/autocomplete?query=${encodeURIComponent(query)}`);
        return response.data.features || [];
    } catch (err) {
        console.warn("Autocomplete error:", err);
        return [];
    }
};

export const getReverseGeocode = async (lat: number, lng: number): Promise<GeocodingFeature | null> => {
    try {
        const response = await api.get(`/geocoding/reverse?lat=${lat}&lng=${lng}`);
        const features = response.data.features;
        return features && features.length > 0 ? features[0] : null;
    } catch (err) {
        console.warn("Reverse geocode error:", err);
        return null;
    }
};

