import api from "./api";

export interface GeocodingFeature {
    id: string;
    place_name: string;
    center: [number, number]; // [lng, lat]
}

export const getAutocompleteSuggestions = async (query: string): Promise<GeocodingFeature[]> => {
    if (!query) return [];
    const response = await api.get(`/geocoding/autocomplete?query=${encodeURIComponent(query)}`);
    return response.data.features || [];
};

export const getReverseGeocode = async (lat: number, lng: number): Promise<GeocodingFeature | null> => {
    const response = await api.get(`/geocoding/reverse?lat=${lat}&lng=${lng}`);
    const features = response.data.features;
    return features && features.length > 0 ? features[0] : null;
};
