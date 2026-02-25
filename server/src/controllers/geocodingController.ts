import { Request, Response } from "express";
import axios from "axios";

// Using Mapbox as the provider.
// User needs to provide MAPBOX_ACCESS_TOKEN in .env

export const autocomplete = async (req: Request, res: Response) => {
    const { query } = req.query;

    if (!query) {
        return res.status(400).json({ message: "Query is required" });
    }

    try {
        const token = process.env.MAPBOX_ACCESS_TOKEN;

        if (!token) {
            // Fallback to Photon (OpenStreetMap based) for autocomplete
            const response = await axios.get(
                `https://photon.komoot.io/api/`,
                {
                    params: {
                        q: query,
                        limit: 5,
                        bbox: "68.1,6.8,97.4,35.5" // Approximate bounding box for India
                    }
                }
            );

            const features = response.data.features.map((f: any) => ({
                id: f.properties.osm_id?.toString() || Math.random().toString(),
                place_name: [
                    f.properties.name,
                    f.properties.street,
                    f.properties.city,
                    f.properties.state,
                    f.properties.postcode
                ].filter(Boolean).join(", "),
                center: f.geometry.coordinates
            }));

            return res.json({ features });
        }

        const response = await axios.get(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query as string)}.json`,
            {
                params: {
                    access_token: token,
                    country: "in", // Limit to India
                    types: "place,locality,neighborhood,address,poi",
                    limit: 5
                }
            }
        );

        res.json(response.data);
    } catch (error) {
        console.error("Geocoding Error:", error);
        res.status(500).json({ message: "Error fetching suggestions" });
    }
};

export const reverseGeocode = async (req: Request, res: Response) => {
    const { lat, lng } = req.query;

    if (!lat || !lng) {
        return res.status(400).json({ message: "Lat and Lng are required" });
    }

    try {
        const token = process.env.MAPBOX_ACCESS_TOKEN;

        if (!token) {
            // Fallback to Nominatim (OpenStreetMap) for real data without token
            const response = await axios.get(
                `https://nominatim.openstreetmap.org/reverse`,
                {
                    params: {
                        format: "json",
                        lat: lat,
                        lon: lng,
                        zoom: 18,
                        addressdetails: 1
                    },
                    headers: {
                        'User-Agent': 'BlinkitMockClone/1.0'
                    }
                }
            );

            const addr = response.data.address;
            const placeName = response.data.display_name;
            const pincode = addr.postcode || "";
            const area = addr.suburb || addr.neighbourhood || addr.residential || addr.city_district || addr.town || addr.village || "Unknown Area";

            return res.json({
                features: [
                    {
                        id: response.data.place_id.toString(),
                        place_name: placeName,
                        center: [Number(lng), Number(lat)],
                        context: [
                            { id: "pincode", text: pincode },
                            { id: "area", text: area }
                        ]
                    }
                ]
            });
        }

        const response = await axios.get(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json`,
            {
                params: {
                    access_token: token,
                }
            }
        );

        res.json(response.data);
    } catch (error) {
        console.error("Reverse Geocoding Error:", error);
        res.status(500).json({ message: "Error fetching address" });
    }
};
