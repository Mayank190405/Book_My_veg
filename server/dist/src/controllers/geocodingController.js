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
const nashikLocations_1 = require("../utils/nashikLocations");
// High-Precision Zepto/Zomato-Style Geocoding Controller
// Implements 5-level spatial hierarchy:
// 1. City / Neighborhood (Nashik)
// 2. Small Colony / Nagar (Kale Nagar, Parijat Nagar, Serene Meadows)
// 3. Society / Building / POI (Individual building name or complex)
// 4. Entrance / Gate / Road
// 5. Doorstep unit address
const autocomplete = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { query } = req.query;
    if (!query) {
        return res.status(400).json({ message: "Query is required" });
    }
    try {
        const cleanQuery = String(query).trim();
        const token = process.env.MAPBOX_ACCESS_TOKEN;
        // 1. Instant local dictionary matches (Colonies, Circles, Sectors, Colleges, Malls)
        const localMatches = (0, nashikLocations_1.searchNashikLocalities)(cleanQuery, 6);
        const localFeatures = localMatches.map((loc) => ({
            id: `loc-${loc.id}`,
            place_name: `${loc.name}, ${loc.landmark}`,
            main_title: loc.name,
            secondary_text: loc.landmark,
            center: [loc.lng, loc.lat],
            pincode: loc.pincode
        }));
        // 2. OpenStreetMap Nominatim live search (or Mapbox if configured)
        let osmFeatures = [];
        if (!token) {
            try {
                const searchQuery = cleanQuery.toLowerCase().includes("nashik") ? cleanQuery : `${cleanQuery}, Nashik`;
                const osmRes = yield axios_1.default.get(`https://nominatim.openstreetmap.org/search`, {
                    params: {
                        format: "json",
                        q: searchQuery,
                        addressdetails: 1,
                        limit: 6,
                        countrycodes: "in"
                    },
                    headers: {
                        'User-Agent': 'BookMyVegApp/1.0'
                    },
                    timeout: 3500
                });
                osmFeatures = (osmRes.data || []).map((item) => {
                    var _a;
                    const addr = item.address || {};
                    const poi = addr.amenity || addr.shop || addr.building || addr.office || addr.tourism || addr.leisure;
                    const road = addr.road || addr.street || addr.pedestrian;
                    const locality = addr.suburb || addr.neighbourhood || addr.residential || addr.quarter;
                    const city = addr.city || addr.town || addr.village || "Nashik";
                    const pincode = addr.postcode || "";
                    const itemName = item.name && item.name !== road ? item.name : "";
                    const normalized = (0, nashikLocations_1.normalizeRoadToColony)(road);
                    const mainTitle = itemName || normalized || (poi && road ? `${poi}, ${road}` : (road || locality || city));
                    const secondary = [locality, city, pincode].filter(Boolean).join(", ");
                    return {
                        id: ((_a = item.place_id) === null || _a === void 0 ? void 0 : _a.toString()) || Math.random().toString(),
                        place_name: item.display_name,
                        main_title: mainTitle,
                        secondary_text: secondary || item.display_name,
                        center: [Number(item.lon), Number(item.lat)],
                        pincode
                    };
                });
            }
            catch (err) {
                console.warn("OSM autocomplete error (fallback to local):", err);
            }
        }
        // Merge: local landmark matches first, then unique OSM results
        const merged = [...localFeatures];
        const seenTitles = new Set(localFeatures.map(f => f.main_title.toLowerCase()));
        for (const osmItem of osmFeatures) {
            const lowerTitle = (osmItem.main_title || "").toLowerCase();
            if (!seenTitles.has(lowerTitle)) {
                seenTitles.add(lowerTitle);
                merged.push(osmItem);
            }
        }
        return res.json({ features: merged.slice(0, 8) });
    }
    catch (error) {
        console.error("Geocoding Error:", error);
        res.status(500).json({ message: "Error fetching suggestions" });
    }
});
exports.autocomplete = autocomplete;
const reverseGeocode = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { lat, lng } = req.query;
    if (!lat || !lng) {
        return res.status(400).json({ message: "Lat and Lng are required" });
    }
    const numLat = Number(lat);
    const numLng = Number(lng);
    // 1. Find closest Nashik micro-locality from dictionary
    const { locality: nearestLocality, distanceKm } = (0, nashikLocations_1.findNearestNashikLocality)(numLat, numLng);
    try {
        const token = process.env.MAPBOX_ACCESS_TOKEN;
        if (!token) {
            // Live Nominatim reverse geocode
            let osmData = null;
            try {
                const response = yield axios_1.default.get(`https://nominatim.openstreetmap.org/reverse`, {
                    params: {
                        format: "json",
                        lat: numLat,
                        lon: numLng,
                        zoom: 18,
                        addressdetails: 1
                    },
                    headers: {
                        'User-Agent': 'BookMyVegApp/1.0'
                    },
                    timeout: 3500
                });
                osmData = response.data;
            }
            catch (osmErr) {
                console.warn("OSM reverse geocode timeout, using nearest locality:", osmErr);
            }
            if (osmData && osmData.address) {
                const addr = osmData.address;
                const placeName = osmData.display_name || "";
                // Ignore internal road codes like "S13", "SH 22", "NH 848"
                let rawRoad = addr.road || addr.street || addr.pedestrian || addr.footway || "";
                if (/^[A-Z]{1,3}\s*\d+$/i.test(rawRoad.trim())) {
                    rawRoad = "";
                }
                // POI or Named Building (Level 3: Society / Building)
                const poi = (osmData.name && osmData.name !== rawRoad && !/^[A-Z]{1,3}\s*\d+$/i.test(osmData.name))
                    ? osmData.name
                    : (addr.amenity || addr.shop || addr.building || addr.office || addr.tourism || addr.leisure || addr.historic || "");
                // Locality from OSM
                const osmlocality = addr.suburb || addr.neighbourhood || addr.residential || addr.quarter || "";
                const city = addr.city || addr.town || addr.village || "Nashik";
                const state = addr.state || "Maharashtra";
                // Intelligent Road to Micro-Locality Normalization (e.g. Tukaram Kale Marg -> Kale Nagar)
                const roadColony = (0, nashikLocations_1.normalizeRoadToColony)(rawRoad, numLat, numLng);
                const finalColony = roadColony || (distanceKm <= 1.2 ? nearestLocality.name : (osmlocality || nearestLocality.name));
                // Precise Pincode:
                let pincode = addr.postcode;
                if (!pincode || pincode === "422001" || distanceKm <= 2.5) {
                    pincode = nearestLocality.pincode;
                }
                // Main Title formatting (Zepto/Zomato style)
                let mainTitle = "";
                if (poi) {
                    mainTitle = poi.toLowerCase().includes(finalColony.toLowerCase()) ? poi : `${poi}, ${finalColony}`;
                }
                else {
                    mainTitle = finalColony;
                }
                // Secondary Text formatting: e.g. "Kale Nagar, Nashik, Maharashtra 422013"
                let secondaryText = "";
                if (rawRoad && !rawRoad.toLowerCase().includes(finalColony.toLowerCase())) {
                    secondaryText = `${finalColony}, ${rawRoad}, ${city}, ${state} ${pincode}`;
                }
                else {
                    secondaryText = `${finalColony}, ${city}, ${state} ${pincode}`;
                }
                return res.json({
                    features: [
                        {
                            id: ((_a = osmData.place_id) === null || _a === void 0 ? void 0 : _a.toString()) || `${numLat}-${numLng}`,
                            place_name: placeName,
                            main_title: mainTitle,
                            secondary_text: secondaryText,
                            center: [numLng, numLat],
                            pincode: pincode,
                            address: {
                                poi: poi || null,
                                road: rawRoad || null,
                                locality: finalColony,
                                city: city,
                                state: state,
                                postcode: pincode
                            },
                            context: [
                                { id: "pincode", text: pincode },
                                { id: "area", text: mainTitle },
                                { id: "secondary", text: secondaryText }
                            ]
                        }
                    ]
                });
            }
            // Fallback when OSM reverse fails or returns no address
            return res.json({
                features: [
                    {
                        id: `loc-${nearestLocality.id}`,
                        place_name: `${nearestLocality.name}, ${nearestLocality.landmark}`,
                        main_title: nearestLocality.name,
                        secondary_text: `${nearestLocality.landmark} - ${nearestLocality.pincode}`,
                        center: [numLng, numLat],
                        pincode: nearestLocality.pincode,
                        address: {
                            locality: nearestLocality.name,
                            city: "Nashik",
                            state: "Maharashtra",
                            postcode: nearestLocality.pincode
                        },
                        context: [
                            { id: "pincode", text: nearestLocality.pincode },
                            { id: "area", text: nearestLocality.name },
                            { id: "secondary", text: nearestLocality.landmark }
                        ]
                    }
                ]
            });
        }
        // Mapbox flow if key is configured
        const response = yield axios_1.default.get(`https://api.mapbox.com/geocoding/v5/mapbox.places/${numLng},${numLat}.json`, {
            params: {
                access_token: token,
            }
        });
        res.json(response.data);
    }
    catch (error) {
        console.error("Reverse Geocoding Error:", error);
        // Resilient fallback
        return res.json({
            features: [
                {
                    id: `loc-${nearestLocality.id}`,
                    place_name: `${nearestLocality.name}, ${nearestLocality.landmark}`,
                    main_title: nearestLocality.name,
                    secondary_text: `${nearestLocality.landmark} - ${nearestLocality.pincode}`,
                    center: [numLng, numLat],
                    pincode: nearestLocality.pincode
                }
            ]
        });
    }
});
exports.reverseGeocode = reverseGeocode;
