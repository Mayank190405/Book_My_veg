import { create } from 'zustand';
import { persist } from 'zustand/middleware';


interface User {
    id: string;
    name: string;
    email: string;
    phone: string;
    role: string;
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
    setLocation: (location: UserState['location']) => void;
    recentSearches: string[];
    addRecentSearch: (term: string) => void;
    clearRecentSearches: () => void;
    _hasHydrated: boolean;
    setHasHydrated: (state: boolean) => void;
}

export const useUserStore = create<UserState>()(
    persist(
        (set) => ({
            user: null,
            token: null,
            setUser: (user) => set({ user }),
            setToken: (token) => set({ token }),
            logout: () => set({ user: null, token: null }),
            location: null,
            setLocation: (location) => set({ location }),
            recentSearches: [],
            addRecentSearch: (term) =>
                set((state) => ({
                    recentSearches: [
                        term,
                        ...state.recentSearches.filter((t) => t !== term),
                    ].slice(0, 5),
                })),
            clearRecentSearches: () => set({ recentSearches: [] }),
            _hasHydrated: false,
            setHasHydrated: (state) => set({ _hasHydrated: state }),
        }),
        {
            name: 'user-storage',
            onRehydrateStorage: () => (state) => {
                state?.setHasHydrated(true);
            },
        }
    )
);
