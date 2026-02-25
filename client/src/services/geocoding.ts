import axios from "axios";

interface GeocodeResult {
    display_name: string;
    address: {
        road?: string;
        suburb?: string;
        city?: string;
        state?: string;
        postcode?: string;
        country?: string;
        [key: string]: string | undefined;
    };
    lat: string;
    lon: string;
}

export const reverseGeocode = async (lat: number, lon: number): Promise<{
    fullAddress: string;
    city: string;
    state: string;
    pincode: string;
    street: string;
} | null> => {
    try {
        // Using OpenStreetMap Nominatim API (Free, requires User-Agent)
        // Rate limit: 1 request per second.
        const response = await axios.get<GeocodeResult>(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`,
            {
                headers: {
                    "User-Agent": "BMVQuickCommerce/1.0"
                }
            }
        );

        const data = response.data;
        const addr = data.address;

        const street = addr.road || addr.suburb || "";
        const city = addr.city || addr.town || addr.village || addr.county || "";
        const state = addr.state || "";
        const pincode = addr.postcode || "";

        let fullAddress = data.display_name;
        // Clean up full address if needed, or just use what OSM provides

        return {
            fullAddress,
            city,
            state,
            pincode,
            street
        };
    } catch (error) {
        console.error("Geocoding error:", error);
        return null; // Handle gracefully
    }
};
