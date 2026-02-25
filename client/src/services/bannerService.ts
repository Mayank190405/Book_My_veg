import api from "./api";

export const getBanners = async () => {
    const response = await api.get("/banners");
    return response.data;
};
