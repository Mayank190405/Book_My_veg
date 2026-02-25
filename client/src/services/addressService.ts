import api from "./api";

export interface Address {
    id: string;
    type: string;
    fullAddress: string;
    landmark?: string;
    city?: string;
    state?: string;
    pincode?: string;
    name?: string;
    phone?: string;
    latitude?: number;
    longitude?: number;
    isDefault: boolean;
}

export const getAddresses = async () => {
    const response = await api.get("/addresses");
    return response.data;
};

export const createAddress = async (address: Omit<Address, "id">) => {
    const response = await api.post("/addresses", address);
    return response.data;
};

export const updateAddress = async (id: string, address: Partial<Address>) => {
    const response = await api.put(`/addresses/${id}`, address);
    return response.data;
};

export const deleteAddress = async (id: string) => {
    const response = await api.delete(`/addresses/${id}`);
    return response.data;
};
