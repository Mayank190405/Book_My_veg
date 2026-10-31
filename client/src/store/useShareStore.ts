import { create } from "zustand";

export interface ShareItem {
    id: string;
    name: string;
    image?: string;
    price?: number;
    url?: string;
    weight?: string;
}

interface ShareState {
    isOpen: boolean;
    item: ShareItem | null;
    openShare: (item: ShareItem) => void;
    closeShare: () => void;
}

export const useShareStore = create<ShareState>((set) => ({
    isOpen: false,
    item: null,
    openShare: (item) => set({ isOpen: true, item }),
    closeShare: () => set({ isOpen: false, item: null }),
}));
