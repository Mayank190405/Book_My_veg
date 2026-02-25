import api from "./api";

export const getAssignedOrders = async (packerId: string) => {
    const response = await api.get(`/packer/assigned/${packerId}`);
    return response.data;
};

export const completePacking = async (orderId: string, data: {
    verificationPhoto: string;
    packerNotes?: string;
    adjustments?: Array<{
        productId: string;
        variantId?: string;
        reason: "DAMAGED" | "OUT_OF_STOCK" | "QUALITY_ISSUE";
        quantity: number;
    }>;
}) => {
    const response = await api.post(`/packer/complete/${orderId}`, data);
    return response.data;
};
