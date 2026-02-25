import api from "./api";

export const syncCart = async (items: { productId: string; variantId?: string; quantity: number }[]) => {
    const response = await api.post("/cart/sync", { items });
    return response.data;
};

export const getCart = async () => {
    const response = await api.get("/cart");
    return response.data;
};

export const validateCoupon = async (code: string, orderAmount: number) => {
    try {
        const response = await api.post("/coupons/validate", { code, orderAmount });
        return response.data;
    } catch (error: any) {
        throw new Error(error.response?.data?.message || "Invalid coupon");
    }
};
export const updateCartItem = async (productId: string, quantity: number, variantId?: string, metadata?: any) => {
    const response = await api.post("/cart/update", { productId, variantId, quantity, metadata });
    return response.data;
};
