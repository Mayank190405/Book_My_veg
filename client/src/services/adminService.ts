import api from "./api";

export const getAdminStats = async () => {
    const response = await api.get("/admin/stats");
    return response.data;
};

export const createProduct = async (data: any) => {
    const response = await api.post("/products", data);
    return response.data;
};

export const updateProduct = async (id: string, data: any) => {
    const response = await api.put(`/products/${id}`, data);
    return response.data;
};

export const deleteProduct = async (id: string) => {
    const response = await api.delete(`/products/${id}`);
    return response.data;
};

export const getAllOrders = async () => {
    const response = await api.get("/orders/admin/all");
    return response.data;
};

export const updateOrderStatus = async (id: string, status: string) => {
    const response = await api.put(`/orders/${id}/status`, { status });
    return response.data;
};
