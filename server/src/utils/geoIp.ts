import logger from "./logger";

export interface GeoLocation {
    country: string;
    latitude: number;
    longitude: number;
}

// Static lookup database of IPs for rich demonstrations and tests
const GEO_IP_DATABASE: Record<string, GeoLocation> = {
    "127.0.0.1": { country: "IN", latitude: 28.6139, longitude: 77.2090 }, // Delhi, India
    "localhost": { country: "IN", latitude: 28.6139, longitude: 77.2090 },
    "::1": { country: "IN", latitude: 28.6139, longitude: 77.2090 },
    "103.21.141.2": { country: "IN", latitude: 19.0760, longitude: 72.8777 }, // Mumbai, India
    "185.190.140.1": { country: "US", latitude: 37.7749, longitude: -122.4194 }, // San Francisco, USA
    "45.223.23.12": { country: "DE", latitude: 50.1109, longitude: 8.6821 }, // Frankfurt, Germany
};

/**
 * Resolves IP Address to GeoLocation metadata.
 */
export const resolveIpLocation = (ip: string): GeoLocation => {
    const cleanedIp = ip.replace(/^::ffff:/, ""); // strip IPv6 mapped IPv4 address

    if (GEO_IP_DATABASE[cleanedIp]) {
        return GEO_IP_DATABASE[cleanedIp];
    }

    // Dynamic mock logic based on IP hash to make testing active travel possible
    const ipParts = cleanedIp.split(".");
    if (ipParts.length === 4) {
        const lastPart = Number(ipParts[3]);
        if (lastPart % 7 === 0) {
            return { country: "US", latitude: 40.7128, longitude: -74.0060 }; // New York, USA
        } else if (lastPart % 5 === 0) {
            return { country: "DE", latitude: 52.5200, longitude: 13.4050 }; // Berlin, Germany
        }
    }

    return { country: "IN", latitude: 28.6139, longitude: 77.2090 }; // Delhi, India (default)
};

/**
 * Calculates geographical distance between two coordinates in kilometers using Haversine formula.
 */
export const calculateDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Radius of Earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};
