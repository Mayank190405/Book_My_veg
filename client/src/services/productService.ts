import api from "./api";

export const getProducts = async (cursor?: string, limit = 20) => {
    const response = await api.get(`/products?cursor=${cursor || ""}&limit=${limit}`);
    return response.data;
};

export const getTrendingProducts = async (pincode?: string) => {
    const query = pincode ? `?pincode=${pincode}` : "";
    const response = await api.get(`/products/trending${query}`);
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

export const updateProduct = async (id: string, data: any) => {
    const response = await api.patch(`/products/${id}`, data);
    return response.data;
};

export const bulkImportProducts = async (products: any[]) => {
    const response = await api.post("/products/bulk-import", { products });
    return response.data;
};
