import { MetadataRoute } from 'next';

const BASE_URL = 'https://bookmyveg.co.in';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const staticUrls = [
        { url: `${BASE_URL}/`, lastModified: new Date(), changeFrequency: 'daily' as const, priority: 1.0 },
        { url: `${BASE_URL}/products`, lastModified: new Date(), changeFrequency: 'daily' as const, priority: 0.9 },
        { url: `${BASE_URL}/categories`, lastModified: new Date(), changeFrequency: 'weekly' as const, priority: 0.8 },
        { url: `${BASE_URL}/privacy`, lastModified: new Date(), changeFrequency: 'monthly' as const, priority: 0.5 },
        { url: `${BASE_URL}/terms`, lastModified: new Date(), changeFrequency: 'monthly' as const, priority: 0.5 },
        { url: `${BASE_URL}/exchange-policy`, lastModified: new Date(), changeFrequency: 'monthly' as const, priority: 0.5 },
        { url: `${BASE_URL}/payment-flow`, lastModified: new Date(), changeFrequency: 'monthly' as const, priority: 0.5 },
        { url: `${BASE_URL}/contact`, lastModified: new Date(), changeFrequency: 'monthly' as const, priority: 0.6 },
    ];

    let categoryUrls: MetadataRoute.Sitemap = [];
    try {
        const res = await fetch(`${API_URL}/categories`, { next: { revalidate: 3600 } });
        const categories = await res.json();
        if (Array.isArray(categories)) {
            categoryUrls = categories.map((cat: any) => ({
                url: `${BASE_URL}/category/${cat.id}`,
                lastModified: new Date(cat.updatedAt || cat.createdAt || Date.now()),
                changeFrequency: 'weekly' as const,
                priority: 0.8,
            }));
        }
    } catch (err) {
        console.error('Failed to fetch categories for sitemap:', err);
    }

    let productUrls: MetadataRoute.Sitemap = [];
    try {
        const res = await fetch(`${API_URL}/products?limit=500`, { next: { revalidate: 3600 } });
        const data = await res.json();
        const products = data.data || [];
        if (Array.isArray(products)) {
            productUrls = products.map((prod: any) => ({
                url: `${BASE_URL}/products/${prod.id}`,
                lastModified: new Date(prod.updatedAt || prod.createdAt || Date.now()),
                changeFrequency: 'daily' as const,
                priority: 0.8,
            }));
        }
    } catch (err) {
        console.error('Failed to fetch products for sitemap:', err);
    }

    return [...staticUrls, ...categoryUrls, ...productUrls];
}
