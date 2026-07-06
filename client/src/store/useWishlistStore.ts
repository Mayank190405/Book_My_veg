import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface WishlistItem {
    productId: string;
    name: string;
    price: number;
    image: string;
}

interface WishlistState {
    items: WishlistItem[];
    addToWishlist: (item: WishlistItem) => void;
    removeFromWishlist: (productId: string) => void;
    toggleWishlist: (item: WishlistItem) => void;
    isInWishlist: (productId: string) => boolean;
    clearWishlist: () => void;
}

export const useWishlistStore = create<WishlistState>()(
    persist(
        (set, get) => ({
            items: [],
            addToWishlist: (item) => {
                const { items } = get();
                if (!items.some((i) => i.productId === item.productId)) {
                    set({ items: [...items, item] });
                }
            },
            removeFromWishlist: (productId) => {
                const { items } = get();
                set({ items: items.filter((i) => i.productId !== productId) });
            },
            toggleWishlist: (item) => {
                const { items } = get();
                const exists = items.some((i) => i.productId === item.productId);
                if (exists) {
                    set({ items: items.filter((i) => i.productId !== item.productId) });
                } else {
                    set({ items: [...items, item] });
                }
            },
            isInWishlist: (productId) => {
                return get().items.some((i) => i.productId === productId);
            },
            clearWishlist: () => set({ items: [] }),
        }),
        {
            name: 'wishlist-storage',
        }
    )
);
