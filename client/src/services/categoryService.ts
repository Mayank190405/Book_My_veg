import api from "./api";

export const getCategories = async () => {
    const response = await api.get("/categories");
    return response.data;
};

export const getCategoryById = async (id: string) => {
    const response = await api.get(`/categories/${id}`);
    return response.data;
};
