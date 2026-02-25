import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { updateCartItem, syncCart as apiSyncCart, validateCoupon } from "@/services/cartService";
import { toast } from "sonner";

interface CartItem {
    productId: string;
    variantId?: string;
    name: string;
    price: number;
    image: string;
    quantity: number;
    metadata?: any;
}

interface CartState {
    items: CartItem[];
    addItem: (item: CartItem) => void;
    removeItem: (productId: string, variantId?: string) => void;
    updateQuantity: (productId: string, quantity: number, variantId?: string) => void;
    clearCart: () => void;
    totalItems: number;
    totalPrice: number;
    syncWithBackend: () => Promise<void>;
    couponCode: string | null;
    discount: number;
    applyCoupon: (code: string) => void;
    removeCoupon: () => void;
}

export const useCartStore = create<CartState>()(
    persist(
        (set, get) => ({
            items: [],
            totalItems: 0,
            totalPrice: 0,
            couponCode: null,
            discount: 0,

            addItem: async (newItem) => {
                const { items } = get();
                const existingItem = items.find((i) => i.productId === newItem.productId && i.variantId === newItem.variantId);

                let updatedItems;
                if (existingItem) {
                    updatedItems = items.map((i) =>
                        (i.productId === newItem.productId && i.variantId === newItem.variantId) ? { ...i, quantity: i.quantity + (newItem.quantity || 1) } : i
                    );
                } else {
                    updatedItems = [...items, { ...newItem, quantity: newItem.quantity || 1 }];
                }

                set({
                    items: updatedItems,
                    totalItems: updatedItems.reduce((acc, i) => acc + i.quantity, 0),
                    totalPrice: updatedItems.reduce((acc, i) => acc + i.price * i.quantity, 0)
                });

                // Optimistic update, then sync
                try {
                    await updateCartItem(newItem.productId, existingItem ? existingItem.quantity + (newItem.quantity || 1) : (newItem.quantity || 1), newItem.variantId, newItem.metadata);
                } catch (error) {
                    console.error("Failed to sync cart item", error);
                }
            },

            removeItem: async (productId, variantId) => {
                const { items } = get();
                const updatedItems = items.filter((i) => !(i.productId === productId && i.variantId === variantId));

                set({
                    items: updatedItems,
                    totalItems: updatedItems.reduce((acc, i) => acc + i.quantity, 0),
                    totalPrice: updatedItems.reduce((acc, i) => acc + i.price * i.quantity, 0)
                });

                try {
                    await updateCartItem(productId, 0, variantId);
                } catch (error) {
                    console.error("Failed to remove cart item", error);
                }
            },

            updateQuantity: async (productId, quantity, variantId) => {
                const { items } = get();
                if (quantity <= 0) {
                    get().removeItem(productId, variantId);
                    return;
                }

                const updatedItems = items.map((i) =>
                    (i.productId === productId && i.variantId === variantId) ? { ...i, quantity } : i
                );

                set({
                    items: updatedItems,
                    totalItems: updatedItems.reduce((acc, i) => acc + i.quantity, 0),
                    totalPrice: updatedItems.reduce((acc, i) => acc + i.price * i.quantity, 0)
                });

                try {
                    await updateCartItem(productId, quantity, variantId, get().items.find(i => i.productId === productId && i.variantId === variantId)?.metadata);
                } catch (error) {
                    console.error("Failed to update cart quantity", error);
                }
            },

            clearCart: () => set({ items: [], totalItems: 0, totalPrice: 0, couponCode: null, discount: 0 }),

            applyCoupon: async (code: string) => {
                const { totalPrice } = get();
                try {
                    const coupon = await validateCoupon(code, totalPrice);
                    set({
                        couponCode: coupon.code,
                        discount: coupon.discountAmount
                    });
                    toast.success("Coupon applied!");
                } catch (error: any) {
                    set({ couponCode: null, discount: 0 });
                    toast.error(error.message);
                }
            },

            removeCoupon: () => set({ couponCode: null, discount: 0 }),

            syncWithBackend: async () => {
                const { items } = get();
                try {
                    const serverCart = await apiSyncCart(items.map(i => ({
                        productId: i.productId,
                        variantId: i.variantId,
                        quantity: i.quantity
                    })));
                    if (serverCart && serverCart.items) {
                        const mergedItems = serverCart.items.map((item: any) => ({
                            productId: item.productId,
                            variantId: item.variantId,
                            name: item.variant ? `${item.product.name} (${item.variant.name})` : item.product.name,
                            price: item.variant ? Number(item.variant.price) : Number(item.product.basePrice),
                            image: item.product.images[0],
                            quantity: item.quantity,
                            metadata: item.metadata
                        }));
                        set({
                            items: mergedItems,
                            totalItems: mergedItems.reduce((acc: any, i: any) => acc + i.quantity, 0),
                            totalPrice: mergedItems.reduce((acc: any, i: any) => acc + i.price * i.quantity, 0)
                        });
                    }
                } catch (error) {
                    console.error("Sync failed", error);
                }
            }
        }),
        {
            name: 'cart-storage',
        }
    )
);
