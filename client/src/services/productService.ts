import api from "./api";

export const getProducts = async (cursor?: string, limit = 20) => {
    const response = await api.get(`/products?cursor=${cursor || ""}&limit=${limit}`);
    return response.data;
};

export const getTrendingProducts = async (pincode?: string, lat?: number, lng?: number) => {
    const params = new URLSearchParams();
    if (pincode) params.append("pincode", pincode);
    if (lat !== undefined && lat !== null) params.append("lat", lat.toString());
    if (lng !== undefined && lng !== null) params.append("lng", lng.toString());
    const response = await api.get(`/products/trending?${params.toString()}`);
    return response.data;
};

export const getFlashDeals = async () => {
    const response = await api.get("/products/flash-deals");
    return response.data;
};

export const getProductById = async (id: string) => {
    const response = await api.get(`/products/${id}`);
    return response.data;
};

export const getSimilarProducts = async (id: string) => {
    const response = await api.get(`/products/${id}/similar`);
    return response.data;
};

export const checkServiceability = async (pincode: string) => {
    const response = await api.get(`/products/check-pincode/${pincode}`);
    return response.data;
};

export const getBuyAgainProducts = async () => {
    const response = await api.get("/products/buy-again");
    return response.data;
};

export const createProduct = async (data: any) => {
    const response = await api.post("/products", data);
    return response.data;
};

export const updateProduct = async (id: string, data: any) => {
    const response = await api.patch(`/products/${id}`, data);
    return response.data;
};

export const deleteProduct = async (id: string) => {
    const response = await api.delete(`/products/${id}`);
    return response.data;
};

export const toggleProductStatus = async (id: string) => {
    const response = await api.patch(`/products/${id}/toggle`);
    return response.data;
};

export const bulkImportProducts = async (products: any[]) => {
    const response = await api.post("/products/bulk-import", { products });
    return response.data;
};
