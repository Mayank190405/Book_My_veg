import api from "./api";

export const getAssignedDeliveries = async (driverId: string) => {
    const response = await api.get(`/driver/assigned/${driverId}`);
    return response.data;
};

export const pickUpOrder = async (assignmentId: string) => {
    const response = await api.post(`/driver/pickup/${assignmentId}`);
    return response.data;
};

export const completeDelivery = async (assignmentId: string, otp: string) => {
    const response = await api.post(`/driver/complete/${assignmentId}`, { otp });
    return response.data;
};

export const getHDFCLink = async (orderId: string) => {
    const response = await api.get(`/driver/hdfc-link/${orderId}`);
    return response.data;
};
