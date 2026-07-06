import api from "./api";

export const getCategories = async () => {
    const response = await api.get("/categories");
    return response.data;
};

export const getCategoryById = async (id: string, limit = 100) => {
    const response = await api.get(`/categories/${id}?limit=${limit}`);
    return response.data;
};
