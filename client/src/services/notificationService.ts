import api from "./api";

export interface Notification {
    id: string;
    userId: string;
    title: string;
    body: string;
    type: "INFO" | "SUCCESS" | "WARNING" | "ORDER" | "ALERT";
    isRead: boolean;
    createdAt: string;
}

export const getNotifications = async () => {
    const { data } = await api.get<Notification[]>("/notifications");
    return data;
};

export const markNotificationAsRead = async (id: string) => {
    const { data } = await api.patch(`/notifications/${id}/read`);
    return data;
};

export const markAllNotificationsRead = async () => {
    const { data } = await api.patch("/notifications/read-all");
    return data;
};

export const deleteNotification = async (id: string) => {
    const { data } = await api.delete(`/notifications/${id}`);
    return data;
};
