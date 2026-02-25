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

export const cancelOrder = async (id: string) => {
    const response = await api.post(`/orders/${id}/cancel`);
    return response.data;
};
