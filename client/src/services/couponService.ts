import api from "./api";

export interface Coupon {
    id: string;
    code: string;
    type: "DISCOUNT" | "ITEM_DISCOUNT" | "SPECIAL_PRICE_ITEM" | "FREE_GIFT" | "CASHBACK";
    description: string;
    discountType: "FLAT" | "PERCENTAGE";
    discountValue?: number;
    minOrderAmount: number;
    maxDiscount?: number;
    expiresAt?: string;
    rewardProductId?: string;
    rewardVariantId?: string;
    specialPrice?: number;
    allowedLocations?: string[];
    allowedPincodes?: string[];
    allowedPayment?: string[];
    userSegments?: string[];
    cartRulesJson?: any;
    scheduleRulesJson?: any;
}

export const getAvailableCoupons = async (): Promise<Coupon[]> => {
    const response = await api.get("/coupons");
    return response.data;
};
