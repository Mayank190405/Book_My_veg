import { create } from 'zustand';
import { persist } from 'zustand/middleware';


interface User {
    id: string;
    name: string;
    email: string;
    phone: string;
    role: string;
    image?: string;
    locationId?: string;
}

interface UserState {
    user: User | null;
    token: string | null;
    setUser: (user: User | null) => void;
    setToken: (token: string | null) => void;
    logout: () => void;
    location: {
        address: string;
        pincode: string;
        coords?: { lat: number; lng: number };
    } | null;
    activeStore: {
        id: string;
        slug: string;
        name: string;
    } | null;
    setLocation: (location: UserState['location']) => void;
    setActiveStore: (store: UserState['activeStore']) => void;
    /** 'detecting' while resolving, 'in-range' if a store covers the area, 'out-of-range' if none do */
    serviceArea: 'detecting' | 'in-range' | 'out-of-range';
    setServiceArea: (val: 'detecting' | 'in-range' | 'out-of-range') => void;
    /** A nearby eligible store (within radius) that has stock, when the active store is out */
    nearbyStoreWithStock: { id: string; slug: string; name: string } | null;
    setNearbyStoreWithStock: (store: { id: string; slug: string; name: string } | null) => void;
    recentSearches: string[];
    addRecentSearch: (term: string) => void;
    removeRecentSearch: (term: string) => void;
    clearRecentSearches: () => void;
    hasSeenWelcome: boolean;
    setHasSeenWelcome: (val: boolean) => void;
    _hasHydrated: boolean;
    setHasHydrated: (state: boolean) => void;
    notificationsEnabled: boolean;
    setNotificationsEnabled: (val: boolean) => void;
}

export const useUserStore = create<UserState>()(
    persist(
        (set) => ({
            user: null,
            token: null,
            setUser: (user) => set({ user }),
            setToken: (token) => set({ token }),
            logout: () => set({ user: null, token: null, activeStore: null }),
            location: { address: "Govind Nagar", pincode: "422002", coords: { lat: 20.0012, lng: 73.7639 } },
            activeStore: null,
            setLocation: (location) => set({ location }),
            setActiveStore: (activeStore) => set({ activeStore }),
            serviceArea: 'detecting',
            setServiceArea: (serviceArea) => set({ serviceArea }),
            nearbyStoreWithStock: null,
            setNearbyStoreWithStock: (nearbyStoreWithStock) => set({ nearbyStoreWithStock }),
            recentSearches: [],
            addRecentSearch: (term) =>
                set((state) => ({
                    recentSearches: [
                        term,
                        ...state.recentSearches.filter((t) => t !== term),
                    ].slice(0, 5),
                })),
            removeRecentSearch: (term) =>
                set((state) => ({
                    recentSearches: state.recentSearches.filter((t) => t !== term),
                })),
            clearRecentSearches: () => set({ recentSearches: [] }),
            hasSeenWelcome: false,
            setHasSeenWelcome: (val) => set({ hasSeenWelcome: val }),
            _hasHydrated: false,
            setHasHydrated: (state) => set({ _hasHydrated: state }),
            notificationsEnabled: false,
            setNotificationsEnabled: (notificationsEnabled) => set({ notificationsEnabled }),
        }),
        {
            name: 'user-storage',
            onRehydrateStorage: () => (state) => {
                state?.setHasHydrated(true);
            },
        }
    )
);
