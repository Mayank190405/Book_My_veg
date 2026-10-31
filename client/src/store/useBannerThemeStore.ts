import { create } from "zustand";

export interface BannerItem {
    id: string;
    tagline: string;
    title: string;
    highlightTitle: string;
    description: string;
    ctaText: string;
    ctaLink: string;
    sticker1: string;
    sticker2: string;
    // Manager customizable colors
    bannerGradient: string;
    accentColor: string;
    textColor: string;
    searchBarBg: string;
    searchBarTextColor: string;
    searchIconColor: string;
    micBg: string;
    micIconColor: string;
    headerScrolledBg: string;
    leftImage: string;
    rightImage: string;
}

export const DEFAULT_BANNERS: BannerItem[] = [
    {
        id: "banner-farm-fresh",
        tagline: "FARM FRESH • FAST DELIVERY",
        title: "FRESHNESS AT",
        highlightTitle: "YOUR DOORSTEP",
        description: "Fresh vegetables, seasonal fruits & daily essentials, carefully selected and delivered straight to your home.",
        ctaText: "SHOP FRESH NOW",
        ctaLink: "/categories",
        sticker1: "FARM FRESH",
        sticker2: "SEASONAL PICKS",
        bannerGradient: "from-[#082a1f] via-[#0c392c] to-[#061e16]",
        accentColor: "#bef264",
        textColor: "#ffffff",
        searchBarBg: "bg-white/95",
        searchBarTextColor: "text-slate-400",
        searchIconColor: "text-emerald-800",
        micBg: "bg-black/25",
        micIconColor: "text-[#bef264]",
        headerScrolledBg: "bg-[#0c392c]/95",
        leftImage: "/images/avocado_cutout.jpg",
        rightImage: "/images/beetroot_cutout.jpg",
    }
];

interface BannerThemeStore {
    banners: BannerItem[];
    activeBannerIndex: number;
    setActiveBannerIndex: (index: number) => void;
    getActiveBanner: () => BannerItem;
    updateBanner: (id: string, updates: Partial<BannerItem>) => void;
    setBanners: (banners: BannerItem[]) => void;
}

export const useBannerThemeStore = create<BannerThemeStore>((set, get) => ({
    banners: DEFAULT_BANNERS,
    activeBannerIndex: 0,
    setActiveBannerIndex: (index: number) => set({ activeBannerIndex: index }),
    getActiveBanner: () => {
        const { banners, activeBannerIndex } = get();
        return banners[activeBannerIndex] || DEFAULT_BANNERS[0];
    },
    updateBanner: (id: string, updates: Partial<BannerItem>) =>
        set((state) => ({
            banners: state.banners.map((b) => (b.id === id ? { ...b, ...updates } : b)),
        })),
    setBanners: (banners: BannerItem[]) => set({ banners }),
}));
