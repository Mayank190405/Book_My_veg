import api from "./api";

export interface PageContent {
    id: string;
    slug: string;
    title: string;
    content: string;
    createdAt: string;
    updatedAt: string;
}

export const listPages = async (): Promise<PageContent[]> => {
    const response = await api.get<PageContent[]>("/page-content");
    return response.data;
};

export const getPageBySlug = async (slug: string): Promise<PageContent> => {
    const response = await api.get<PageContent>(`/page-content/${slug}`);
    return response.data;
};

export const updatePageContent = async (slug: string, title: string, content: string): Promise<{ message: string; page: PageContent }> => {
    const response = await api.put<{ message: string; page: PageContent }>(`/page-content/${slug}`, { title, content });
    return response.data;
};

export const deletePageContent = async (slug: string): Promise<{ message: string }> => {
    const response = await api.delete<{ message: string }>(`/page-content/${slug}`);
    return response.data;
};
