import { create } from "zustand";

export interface CategoryTheme {
    id: string;
    label: string;
    icon: string;
    themeColor: string; // Header & Hero background hex
    lightBg: string;   // Soft tint for cards / badges
    accentColor: string;
    tagline: string;
    badge: string;
    trustBadge: string;
    heroTitle: string;
    heroSubtitle: string;
    heroImage: string;
    dealText: string;
    matchSlug: (slugOrName: string) => boolean;
}

export const CATEGORY_THEMES: Record<string, CategoryTheme> = {
    all: {
        id: "all",
        label: "All",
        icon: "",
        themeColor: "#028452", // Fresh, elegant emerald green (softer density)
        lightBg: "#e9f6ef",   // Exact pale mint background from user mockup
        accentColor: "#bef264",
        tagline: "Everyday essentials",
        badge: "100% Farm Fresh Harvest",
        trustBadge: "Direct Farm",
        heroTitle: "Farm fresh,\ncrisp & green",
        heroSubtitle: "Vegetables, fruits and more.",
        heroImage: "/images/hero_veg_basket_hd.png",
        dealText: "Get free delivery & extra 5% off on fresh fruits",
        matchSlug: () => true,
    },
    vegetables: {
        id: "vegetables",
        label: "Vegetables",
        icon: "",
        themeColor: "#059669", // Fresh natural garden green
        lightBg: "#DCF4E9",   // User custom palette
        accentColor: "#a7f3d0",
        tagline: "FARM HARVESTED DAILY",
        badge: "100% Organic & Pesticide-Free",
        trustBadge: "Harvested Today",
        heroTitle: "Farm fresh,\ncrisp & green",
        heroSubtitle: "Broccoli, carrots, tomatoes, leafy greens & more",
        heroImage: "/images/cutout_vegetables_v3.png",
        dealText: "Up to 30% OFF on all daily farm vegetables",
        matchSlug: (s) => /veg/i.test(s) && !/exotic/i.test(s),
    },
    fruits: {
        id: "fruits",
        label: "Fruits",
        icon: "",
        themeColor: "#be123c", // Vibrant orchard berry rose (lighter & less dense than dark burgundy)
        lightBg: "#FFE5DF",   // User custom palette
        accentColor: "#fecdd3",
        tagline: "NATURALLY SWEET & RIPE",
        badge: "100% Farm Fresh Orchard Picks",
        trustBadge: "Tree Ripe",
        heroTitle: "Sweet & juicy,\npicked ripe",
        heroSubtitle: "Apples, berries, citrus, bananas & seasonal melons",
        heroImage: "/images/cutout_fruits_v3.png",
        dealText: "Flat ₹50 OFF on fresh seasonal fruit boxes",
        matchSlug: (s) => /fruit/i.test(s) && !/exotic/i.test(s),
    },
    dairy: {
        id: "dairy",
        label: "Dairy",
        icon: "",
        themeColor: "#0284c7", // Clear, fresh morning sky blue (softer density)
        lightBg: "#E0F0FF",   // User custom palette
        accentColor: "#bae6fd",
        tagline: "PURE MORNING GOODNESS",
        badge: "100% Pure A2 & Buffalo Milk",
        trustBadge: "Early Morning Delivery",
        heroTitle: "Pure goodness,\nfarm fresh",
        heroSubtitle: "Farm milk, artisanal paneer, country butter & eggs",
        heroImage: "/images/cutout_dairy_v3.png",
        dealText: "Up to 25% OFF on morning dairy essentials",
        matchSlug: (s) => /dairy|milk|egg/i.test(s),
    },
    leafy: {
        id: "leafy",
        label: "Leafy Veg",
        icon: "",
        themeColor: "#16a34a", // Crisp, vibrant garden green (less dense than dark forest)
        lightBg: "#D8F3E6",   // User custom palette
        accentColor: "#6ee7b7",
        tagline: "CRISP MORNING GREENS",
        badge: "100% Hydroponic & Farm Harvest",
        trustBadge: "Picked Today",
        heroTitle: "Fresh greens,\ncrisp & clean",
        heroSubtitle: "Palak, methi, coriander, mint, spinach & fresh salad leaves",
        heroImage: "/images/cutout_leafy_v3.png",
        dealText: "Buy any 3 leafy bunches and save flat 20% today",
        matchSlug: (s) => /leaf|palak|methi|coriander|spinach/i.test(s),
    },
    exotic: {
        id: "exotic",
        label: "Exotic",
        icon: "",
        themeColor: "#7c3aed", // Soft royal violet (fresh, modern, less dense)
        lightBg: "#EBE6FF",   // User custom palette
        accentColor: "#ddd6fe",
        tagline: "RARE & HANDPICKED",
        badge: "Premium Imported & Hydroponic",
        trustBadge: "Specialty Crop",
        heroTitle: "Rare & exotic,\nhandpicked",
        heroSubtitle: "Hass avocados, blueberries, dragonfruit & asparagus",
        heroImage: "/images/cutout_exotic_v3.png",
        dealText: "Special deals on fresh Hass avocados & blueberries",
        matchSlug: (s) => /exotic/i.test(s),
    },
    grains: {
        id: "grains",
        label: "Grains",
        icon: "",
        themeColor: "#d97706", // Warm wholesome golden amber (softer than dark brown)
        lightBg: "#FFF0D2",   // User custom palette
        accentColor: "#fde68a",
        tagline: "WHOLESOME PANTRY STAPLES",
        badge: "Unpolished & Organic Grains",
        trustBadge: "Traditional Mill",
        heroTitle: "Wholesome grains,\npure staples",
        heroSubtitle: "Organic dals, stone-ground flours, basmati & millets",
        heroImage: "/images/cutout_grains_v3.png",
        dealText: "Buy 5kg Atta or Dal & get flat 10% instant discount",
        matchSlug: (s) => /grain|pulse|flour|atta|dal/i.test(s),
    },
    oils: {
        id: "oils",
        label: "Oils",
        icon: "",
        themeColor: "#ca8a04", // Warm golden honey (lighter and pleasant)
        lightBg: "#FCE9D4",   // User custom palette
        accentColor: "#fde68a",
        tagline: "COLD-PRESSED PURITY",
        badge: "Traditional Wood-Pressed (Kachi Ghani)",
        trustBadge: "Zero Chemical",
        heroTitle: "Wood-pressed oils,\n100% pure",
        heroSubtitle: "Pure groundnut, mustard, coconut oil & pure cow ghee",
        heroImage: "/images/cutout_oil_v3.png",
        dealText: "Free 250ml sample on first 1-liter cold-pressed oil order",
        matchSlug: (s) => /oil|ghee/i.test(s),
    },
    oil: {
        id: "oil",
        label: "Oil",
        icon: "",
        themeColor: "#ca8a04",
        lightBg: "#FCE9D4",   // User custom palette
        accentColor: "#fde68a",
        tagline: "COLD-PRESSED PURITY",
        badge: "Traditional Wood-Pressed (Kachi Ghani)",
        trustBadge: "Zero Chemical",
        heroTitle: "Wood-pressed oils,\n100% pure",
        heroSubtitle: "Pure groundnut, mustard, coconut oil & pure cow ghee",
        heroImage: "/images/cutout_oil_v3.png",
        dealText: "Free 250ml sample on first 1-liter cold-pressed oil order",
        matchSlug: (s) => /oil|ghee/i.test(s),
    },
};

interface CategoryThemeStore {
    selectedCategory: string;
    setSelectedCategory: (category: string) => void;
    getActiveTheme: () => CategoryTheme;
    getThemeForCategoryName: (name: string) => CategoryTheme;
}

export const useCategoryThemeStore = create<CategoryThemeStore>((set, get) => ({
    selectedCategory: "all",
    setSelectedCategory: (category: string) => set({ selectedCategory: category }),
    getActiveTheme: () => {
        const key = get().selectedCategory;
        return CATEGORY_THEMES[key] || CATEGORY_THEMES.all;
    },
    getThemeForCategoryName: (name: string) => {
        if (!name) return CATEGORY_THEMES.all;
        const found = Object.values(CATEGORY_THEMES).find((t) => t.id !== "all" && t.matchSlug(name));
        return found || CATEGORY_THEMES.all;
    },
}));
