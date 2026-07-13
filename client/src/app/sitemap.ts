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

    let dynamicUrls: MetadataRoute.Sitemap = [];
    try {
        const res = await fetch(`${API_URL}/locations/seo-data`, { next: { revalidate: 3600 } });
        if (res.ok) {
            const data = await res.json();
            const locations = data.locations || [];
            const categories = data.categories || [];
            const products = data.products || [];
            const popularSearches = data.popularSearches || [];
            const uniqueCities = data.uniqueCities || [];
            const uniquePincodes = data.uniquePincodes || [];

            // 1. Store location PSEO URLs
            locations.forEach((store: any) => {
                dynamicUrls.push({
                    url: `${BASE_URL}/products?store=${store.slug}`,
                    lastModified: new Date(),
                    changeFrequency: 'daily' as const,
                    priority: 0.7,
                });
            });

            // 2. Category PSEO URLs
            categories.forEach((cat: any) => {
                dynamicUrls.push({
                    url: `${BASE_URL}/category/${cat.id}`,
                    lastModified: new Date(),
                    changeFrequency: 'weekly' as const,
                    priority: 0.8,
                });

                // Category X Store combinations
                locations.forEach((store: any) => {
                    dynamicUrls.push({
                        url: `${BASE_URL}/category/${cat.id}?store=${store.slug}`,
                        lastModified: new Date(),
                        changeFrequency: 'weekly' as const,
                        priority: 0.7,
                    });
                });
            });

            // 3. Product PSEO URLs
            products.forEach((prod: any) => {
                dynamicUrls.push({
                    url: `${BASE_URL}/products/${prod.id}`,
                    lastModified: new Date(prod.updatedAt || prod.createdAt || Date.now()),
                    changeFrequency: 'daily' as const,
                    priority: 0.8,
                });
            });

            // 4. Customer Addresses: Local City Landing PSEO URLs
            uniqueCities.forEach((city: any) => {
                dynamicUrls.push({
                    url: `${BASE_URL}/products?city=${encodeURIComponent(city)}`,
                    lastModified: new Date(),
                    changeFrequency: 'weekly' as const,
                    priority: 0.7,
                });
            });

            // 5. Customer Addresses: Local Pincode Landing PSEO URLs
            uniquePincodes.forEach((pincode: any) => {
                dynamicUrls.push({
                    url: `${BASE_URL}/products?pincode=${pincode}`,
                    lastModified: new Date(),
                    changeFrequency: 'weekly' as const,
                    priority: 0.7,
                });
            });

            // 6. Popular Searches PSEO URLs
            popularSearches.forEach((query: string) => {
                dynamicUrls.push({
                    url: `${BASE_URL}/search?q=${encodeURIComponent(query)}`,
                    lastModified: new Date(),
                    changeFrequency: 'weekly' as const,
                    priority: 0.6,
                });
            });
        }
    } catch (err) {
        console.warn('Skipping programmatic sitemap generation during static build:', err instanceof Error ? err.message : err);
    }

    return [...staticUrls, ...dynamicUrls];
}
