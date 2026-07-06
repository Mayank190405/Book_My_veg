import api from "./api";

export const createOrder = async (orderData: any) => {
    const response = await api.post("/orders", orderData);
    return response.data;
};

export const getOrders = async () => {
    const response = await api.get("/orders");
    return response.data;
};

export const getOrderById = async (id: string) => {
    const response = await api.get(`/orders/${id}`);
    return response.data;
};

export const cancelOrder = async (id: string, reason?: string) => {
    const response = await api.post(`/orders/${id}/cancel`, { remark: reason });
    return response.data;
};

export const getAllOrders = async (cursor?: string, limit = 20) => {
    const response = await api.get(`/orders/admin/all?cursor=${cursor || ""}&limit=${limit}`);
    return response.data;
};

export const updateOrderStatus = async (id: string, status: string, remark?: string) => {
    const response = await api.patch(`/orders/${id}/status`, { status, remark });
    return response.data;
};
