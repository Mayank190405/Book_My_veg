"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.reverseGeocode = exports.autocomplete = void 0;
const axios_1 = __importDefault(require("axios"));
// Using Mapbox as the provider.
// User needs to provide MAPBOX_ACCESS_TOKEN in .env
const autocomplete = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { query } = req.query;
    if (!query) {
        return res.status(400).json({ message: "Query is required" });
    }
    try {
        const token = process.env.MAPBOX_ACCESS_TOKEN;
        if (!token) {
            // Fallback to Photon (OpenStreetMap based) for autocomplete
            const response = yield axios_1.default.get(`https://photon.komoot.io/api/`, {
                params: {
                    q: query,
                    limit: 5,
                    bbox: "68.1,6.8,97.4,35.5" // Approximate bounding box for India
                }
            });
            const features = response.data.features.map((f) => {
                var _a;
                return ({
                    id: ((_a = f.properties.osm_id) === null || _a === void 0 ? void 0 : _a.toString()) || Math.random().toString(),
                    place_name: [
                        f.properties.name,
                        f.properties.street,
                        f.properties.city,
                        f.properties.state,
                        f.properties.postcode
                    ].filter(Boolean).join(", "),
                    center: f.geometry.coordinates
                });
            });
            return res.json({ features });
        }
        const response = yield axios_1.default.get(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`, {
            params: {
                access_token: token,
                country: "in", // Limit to India
                types: "place,locality,neighborhood,address,poi",
                limit: 5
            }
        });
        res.json(response.data);
    }
    catch (error) {
        console.error("Geocoding Error:", error);
        res.status(500).json({ message: "Error fetching suggestions" });
    }
});
exports.autocomplete = autocomplete;
const reverseGeocode = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { lat, lng } = req.query;
    if (!lat || !lng) {
        return res.status(400).json({ message: "Lat and Lng are required" });
    }
    try {
        const token = process.env.MAPBOX_ACCESS_TOKEN;
        if (!token) {
            // Fallback to Nominatim (OpenStreetMap) for real data without token
            const response = yield axios_1.default.get(`https://nominatim.openstreetmap.org/reverse`, {
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
            });
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
        const response = yield axios_1.default.get(`https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json`, {
            params: {
                access_token: token,
            }
        });
        res.json(response.data);
    }
    catch (error) {
        console.error("Reverse Geocoding Error:", error);
        res.status(500).json({ message: "Error fetching address" });
    }
});
exports.reverseGeocode = reverseGeocode;
