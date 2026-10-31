export interface NashikLocality {
    id: string;
    name: string;
    landmark: string;
    lat: number;
    lng: number;
    pincode: string;
    keywords: string[];
    radiusKm?: number;
}

export const NASHIK_LOCALITIES: NashikLocality[] = [
    {
        id: "kale-nagar",
        name: "Kale Nagar",
        landmark: "Kale Nagar, Gangapur Road, Anandvalli, Nashik",
        lat: 20.0083,
        lng: 73.7452,
        pincode: "422013",
        keywords: ["kale", "nagar", "tukaram kale", "anandvalli", "gangapur", "gangapur road", "pipers"]
    },
    {
        id: "serene-meadows",
        name: "Serene Meadows",
        landmark: "Anandvalli, Gangapur Road, Nashik",
        lat: 20.0245,
        lng: 73.7388,
        pincode: "422013",
        keywords: ["serene", "meadows", "anandvalli", "gangapur", "navshya ganpati"]
    },
    {
        id: "anandvalli",
        name: "Anandvalli",
        landmark: "Near Navshya Ganpati, Gangapur Road, Nashik",
        lat: 20.0185,
        lng: 73.7460,
        pincode: "422013",
        keywords: ["anandvalli", "navshya ganpati", "gangapur", "someshwar"]
    },
    {
        id: "sawarkar-nagar",
        name: "Sawarkar Nagar",
        landmark: "Gangapur Road, Near Navshya Ganpati Cross, Nashik",
        lat: 20.0055,
        lng: 73.7540,
        pincode: "422013",
        keywords: ["sawarkar", "nagar", "gangapur", "anandvalli"]
    },
    {
        id: "samarth-nagar",
        name: "Samarth Nagar",
        landmark: "Parijat Nagar Cross / Gangapur Road, Nashik",
        lat: 20.0010,
        lng: 73.7590,
        pincode: "422005",
        keywords: ["samarth", "nagar", "parijat nagar", "gangapur road"]
    },
    {
        id: "jehan-circle",
        name: "Jehan Circle",
        landmark: "Gangapur Road, Nashik",
        lat: 20.0121,
        lng: 73.7645,
        pincode: "422013",
        keywords: ["jehan", "circle", "gangapur", "vandan", "chopda lawns"]
    },
    {
        id: "gangapur-road",
        name: "Gangapur Road",
        landmark: "Near Prasad Circle & Dongre Vasti, Nashik",
        lat: 20.0075,
        lng: 73.7675,
        pincode: "422013",
        keywords: ["gangapur", "prasad circle", "dongre vasti", "akashwani"]
    },
    {
        id: "college-road",
        name: "College Road",
        landmark: "Near BYK & RYK College, Thatte Nagar, Nashik",
        lat: 19.9998,
        lng: 73.7621,
        pincode: "422005",
        keywords: ["college", "byk", "ryk", "thatte nagar", "model colony", "d souza colony"]
    },
    {
        id: "model-colony",
        name: "Model Colony",
        landmark: "Off College Road, Near BYK, Nashik",
        lat: 20.0015,
        lng: 73.7580,
        pincode: "422005",
        keywords: ["model", "colony", "college road", "byk"]
    },
    {
        id: "dsouza-colony",
        name: "D'Souza Colony",
        landmark: "College Road, Near Big Bazaar, Nashik",
        lat: 20.0040,
        lng: 73.7640,
        pincode: "422005",
        keywords: ["dsouza", "d souza", "colony", "college road"]
    },
    {
        id: "thatte-nagar",
        name: "Thatte Nagar",
        landmark: "Off College Road, Near ABB Cross, Nashik",
        lat: 20.0034,
        lng: 73.7662,
        pincode: "422005",
        keywords: ["thatte", "nagar", "college road", "bapu bunglow"]
    },
    {
        id: "krishi-nagar",
        name: "Krishi Nagar",
        landmark: "Off College Road / Gangapur Road, Nashik",
        lat: 20.0020,
        lng: 73.7510,
        pincode: "422005",
        keywords: ["krishi", "nagar", "college road", "police ground"]
    },
    {
        id: "parijat-nagar",
        name: "Parijat Nagar",
        landmark: "Canal Link Road / Mahatma Nagar Road, Nashik",
        lat: 19.9960,
        lng: 73.7590,
        pincode: "422005",
        keywords: ["parijat", "nagar", "canal link", "saubhagya nagar"]
    },
    {
        id: "mahatma-nagar",
        name: "Mahatma Nagar",
        landmark: "Near Cricket Ground & Jogging Track, Nashik",
        lat: 19.9936,
        lng: 73.7548,
        pincode: "422005",
        keywords: ["mahatma", "nagar", "cricket ground", "jogging track", "water tank"]
    },
    {
        id: "canada-corner",
        name: "Canada Corner",
        landmark: "Sharanpur Road / Trimbak Naka, Nashik",
        lat: 19.9975,
        lng: 73.7718,
        pincode: "422001",
        keywords: ["canada", "corner", "sharanpur", "rajiv gandhi", "kulkarni garden", "cbs"]
    },
    {
        id: "pandit-colony",
        name: "Pandit Colony",
        landmark: "Sharanpur Road, Near Kulkarni Garden, Nashik",
        lat: 19.9990,
        lng: 73.7710,
        pincode: "422001",
        keywords: ["pandit", "colony", "sharanpur", "kulkarni garden"]
    },
    {
        id: "govind-nagar",
        name: "Govind Nagar",
        landmark: "Near Symbiosis School, City Center Road, Nashik",
        lat: 19.9830,
        lng: 73.7702,
        pincode: "422002",
        keywords: ["govind", "nagar", "symbiosis", "city center road", "kamat hotel"]
    },
    {
        id: "untwadi",
        name: "Untwadi",
        landmark: "Near City Center Mall & Sambhaji Chowk, Nashik",
        lat: 19.9845,
        lng: 73.7634,
        pincode: "422002",
        keywords: ["untwadi", "city center mall", "ccm", "sambhaji chowk", "lawate nagar"]
    },
    {
        id: "city-center-mall",
        name: "City Center Mall",
        landmark: "Untwadi Road, Lawate Nagar, Nashik",
        lat: 19.9835,
        lng: 73.7665,
        pincode: "422002",
        keywords: ["ccm", "city center", "mall", "untwadi", "inox"]
    },
    {
        id: "indira-nagar",
        name: "Indira Nagar",
        landmark: "Near Jogging Track & Rathchakra Chowk, Nashik",
        lat: 19.9678,
        lng: 73.7915,
        pincode: "422009",
        keywords: ["indira", "nagar", "jogging track", "rathchakra", "deepali nagar"]
    },
    {
        id: "deepali-nagar",
        name: "Deepali Nagar",
        landmark: "Indira Nagar Cross, Mumbai-Agra Highway, Nashik",
        lat: 19.9690,
        lng: 73.7850,
        pincode: "422009",
        keywords: ["deepali", "nagar", "indira nagar", "highway"]
    },
    {
        id: "wadala-gaon",
        name: "Wadala Gaon",
        landmark: "Near Ashoka Marg / Indira Nagar, Nashik",
        lat: 19.9720,
        lng: 73.8010,
        pincode: "422009",
        keywords: ["wadala", "gaon", "wadala naka", "mehbub nagar"]
    },
    {
        id: "tidke-colony",
        name: "Tidke Colony",
        landmark: "Near Katkade Nagar, Mumbai Naka, Nashik",
        lat: 19.9875,
        lng: 73.7805,
        pincode: "422002",
        keywords: ["tidke", "colony", "katkade", "milton", "mumbai naka"]
    },
    {
        id: "cidco-trimurti-chowk",
        name: "Trimurti Chowk",
        landmark: "Kamatwada Road, CIDCO, Nashik",
        lat: 19.9685,
        lng: 73.7580,
        pincode: "422008",
        keywords: ["trimurti", "chowk", "cidco", "kamatwada", "divya nagri"]
    },
    {
        id: "cidco-pawan-nagar",
        name: "Pawan Nagar",
        landmark: "CIDCO Sector 4, Nashik",
        lat: 19.9740,
        lng: 73.7520,
        pincode: "422008",
        keywords: ["pawan", "nagar", "cidco", "stadium", "sector 4"]
    },
    {
        id: "cidco-uttam-nagar",
        name: "Uttam Nagar",
        landmark: "Near Sambhaji Stadium, CIDCO, Nashik",
        lat: 19.9650,
        lng: 73.7480,
        pincode: "422008",
        keywords: ["uttam", "nagar", "cidco", "sambhaji stadium", "cidco bus stand"]
    },
    {
        id: "cidco-lekha-nagar",
        name: "Lekha Nagar",
        landmark: "Off Ambad Link Road, CIDCO, Nashik",
        lat: 19.9620,
        lng: 73.7650,
        pincode: "422009",
        keywords: ["lekha", "nagar", "cidco", "ambad link", "ranenagar"]
    },
    {
        id: "rane-nagar",
        name: "Rane Nagar",
        landmark: "Mumbai-Agra Highway Cross, Nashik",
        lat: 19.9605,
        lng: 73.7710,
        pincode: "422009",
        keywords: ["rane", "nagar", "highway", "croma", "tata motors"]
    },
    {
        id: "satpur-midc",
        name: "Satpur MIDC",
        landmark: "Trimbak Road, ITI Signal, Nashik",
        lat: 19.9980,
        lng: 73.7250,
        pincode: "422007",
        keywords: ["satpur", "midc", "iti", "trimbak road", "nice area"]
    },
    {
        id: "ambad-midc",
        name: "Ambad MIDC",
        landmark: "Near XLO Point & Siemens, Nashik",
        lat: 19.9480,
        lng: 73.7420,
        pincode: "422010",
        keywords: ["ambad", "midc", "xlo", "siemens", "mahindra"]
    },
    {
        id: "pathardi-phata",
        name: "Pathardi Phata",
        landmark: "Mumbai-Agra Highway & Guru Gobind Singh College, Nashik",
        lat: 19.9482,
        lng: 73.7749,
        pincode: "422010",
        keywords: ["pathardi", "phata", "guru gobind singh", "highway", "deolali naka"]
    },
    {
        id: "ashoka-marg",
        name: "Ashoka Marg",
        landmark: "Near Ashoka Universal School & Kalpataru Nagar, Nashik",
        lat: 19.9750,
        lng: 73.8120,
        pincode: "422006",
        keywords: ["ashoka", "marg", "kalpataru", "universal school", "renuka nagar"]
    },
    {
        id: "panchavati-ramkund",
        name: "Ramkund Panchavati",
        landmark: "Godavari Ghat, Sita Gumpha, Nashik",
        lat: 20.0084,
        lng: 73.7958,
        pincode: "422003",
        keywords: ["ramkund", "panchavati", "sita gumpha", "kalaram", "ghat", "godavari"]
    },
    {
        id: "nashik-road-station",
        name: "Nashik Road Station",
        landmark: "Railway Station Terminal & Subhash Road, Nashik Road",
        lat: 19.9634,
        lng: 73.8378,
        pincode: "422101",
        keywords: ["nashik road", "railway", "station", "subhash road", "muktidham"]
    }
];

export function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

export function findNearestNashikLocality(lat: number, lng: number): { locality: NashikLocality; distanceKm: number } {
    let nearest = NASHIK_LOCALITIES[0];
    let minDistance = Infinity;

    for (const loc of NASHIK_LOCALITIES) {
        const dist = haversineDistanceKm(lat, lng, loc.lat, loc.lng);
        if (dist < minDistance) {
            minDistance = dist;
            nearest = loc;
        }
    }

    return { locality: nearest, distanceKm: minDistance };
}

// Intelligent Road to Micro-Locality / Nagar Normalizer (Zepto style)
export function normalizeRoadToColony(roadName: string, lat?: number, lng?: number): string | null {
    if (!roadName) return null;
    const lower = roadName.toLowerCase();

    // Tukaram Kale Marg -> Kale Nagar
    if (lower.includes("kale")) return "Kale Nagar";
    if (lower.includes("sawarkar")) return "Sawarkar Nagar";
    if (lower.includes("samarth")) return "Samarth Nagar";
    if (lower.includes("parijat")) return "Parijat Nagar";
    if (lower.includes("saubhagya")) return "Shreerang Nagar";
    if (lower.includes("mahatma")) return "Mahatma Nagar";
    if (lower.includes("dsouza") || lower.includes("d'souza")) return "D'Souza Colony";
    if (lower.includes("model colony")) return "Model Colony";
    if (lower.includes("krishi")) return "Krishi Nagar";
    if (lower.includes("pandit")) return "Pandit Colony";
    if (lower.includes("thatte")) return "Thatte Nagar";
    if (lower.includes("kamatwada")) return "Kamatwada";
    if (lower.includes("pawan nagar")) return "Pawan Nagar";
    if (lower.includes("uttam nagar")) return "Uttam Nagar";
    if (lower.includes("trimurti")) return "Trimurti Chowk";
    if (lower.includes("rane nagar")) return "Rane Nagar";
    if (lower.includes("lekha nagar")) return "Lekha Nagar";
    if (lower.includes("deepali")) return "Deepali Nagar";
    if (lower.includes("ashoka")) return "Ashoka Marg";
    if (lower.includes("kalpataru")) return "Kalpataru Nagar";
    if (lower.includes("untwadi")) return "Untwadi";
    if (lower.includes("govind nagar")) return "Govind Nagar";

    return null;
}

export function searchNashikLocalities(query: string, limit = 6): NashikLocality[] {
    const clean = query.trim().toLowerCase();
    if (!clean) return [];

    const matches: { loc: NashikLocality; score: number }[] = [];

    for (const loc of NASHIK_LOCALITIES) {
        let score = 0;
        const nameLower = loc.name.toLowerCase();
        const landmarkLower = loc.landmark.toLowerCase();

        if (nameLower === clean) score += 150;
        else if (nameLower.startsWith(clean)) score += 100;
        else if (nameLower.includes(clean)) score += 60;

        if (landmarkLower.includes(clean)) score += 30;

        for (const kw of loc.keywords) {
            if (kw === clean) score += 50;
            else if (kw.includes(clean)) score += 25;
        }

        if (score > 0) {
            matches.push({ loc, score });
        }
    }

    matches.sort((a, b) => b.score - a.score);
    return matches.slice(0, limit).map(m => m.loc);
}
