import api from "./api";

export const getMe = async () => {
    const response = await api.get("/auth/me");
    return response.data;
};

export const updateProfile = async (data: { name: string; email: string }) => {
    const response = await api.put("/users/profile", data);
    return response.data;
};
