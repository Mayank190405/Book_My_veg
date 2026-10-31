import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface NotifiedProduct {
    id: string;
    name: string;
    image?: string;
    price?: number;
    notifiedAt: number;
}

interface NotifyStore {
    notifiedProducts: Record<string, NotifiedProduct>;
    addNotification: (product: { id: string; name: string; image?: string; price?: number }) => void;
    removeNotification: (id: string) => void;
    isNotified: (id: string) => boolean;
}

export const useNotifyStore = create<NotifyStore>()(
    persist(
        (set, get) => ({
            notifiedProducts: {},
            addNotification: (product) => {
                set((state) => ({
                    notifiedProducts: {
                        ...state.notifiedProducts,
                        [product.id]: {
                            ...product,
                            notifiedAt: Date.now(),
                        },
                    },
                }));
            },
            removeNotification: (id) => {
                set((state) => {
                    const updated = { ...state.notifiedProducts };
                    delete updated[id];
                    return { notifiedProducts: updated };
                });
            },
            isNotified: (id) => {
                return !!get().notifiedProducts[id];
            },
        }),
        {
            name: "bmv-notified-products",
        }
    )
);
