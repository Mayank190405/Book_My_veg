
export const MOCK_BANNERS = [
    { id: 1, image: "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&q=80&w=800", title: "Super Sale" },
    { id: 2, image: "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&q=80&w=800", title: "New Arrivals" },
    { id: 3, image: "https://images.unsplash.com/photo-1555529733-0e670560f7e1?auto=format&fit=crop&q=80&w=800", title: "Electronics" },
];

export const MOCK_CATEGORIES = [
    { id: 1, name: "Grocery", icon: "https://cdn-icons-png.flaticon.com/512/3724/3724720.png" },
    { id: 2, name: "Mobiles", icon: "https://cdn-icons-png.flaticon.com/512/644/644458.png" },
    { id: 3, name: "Fashion", icon: "https://cdn-icons-png.flaticon.com/512/3050/3050239.png" },
    { id: 4, name: "Electronics", icon: "https://cdn-icons-png.flaticon.com/512/3659/3659899.png" },
    { id: 5, name: "Home", icon: "https://cdn-icons-png.flaticon.com/512/263/263115.png" },
    { id: 6, name: "Beauty", icon: "https://cdn-icons-png.flaticon.com/512/1940/1940922.png" },
    { id: 7, name: "Toys", icon: "https://cdn-icons-png.flaticon.com/512/3081/3081840.png" },
    { id: 8, name: "Sports", icon: "https://cdn-icons-png.flaticon.com/512/857/857455.png" },
];

export const MOCK_PRODUCTS = [
    { id: "p1", name: "Fresh Apples", price: 120, oldPrice: 150, image: "https://images.unsplash.com/photo-1570913149827-d2ac84ab3f9a?auto=format&fit=crop&q=80&w=400", discount: 20 },
    { id: "p2", name: "Smartphone X", price: 15000, oldPrice: 18000, image: "https://images.unsplash.com/photo-1598327105666-5b89351aff23?auto=format&fit=crop&q=80&w=400", discount: 15 },
    { id: "p3", name: "Men's T-Shirt", price: 499, oldPrice: 999, image: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&q=80&w=400", discount: 50 },
    { id: "p4", name: "Wireless Earbuds", price: 1999, oldPrice: 3999, image: "https://images.unsplash.com/photo-1572569028738-411a5611488c?auto=format&fit=crop&q=80&w=400", discount: 50 },
    { id: "p5", name: "Smart Watch", price: 2499, oldPrice: 4999, image: "https://images.unsplash.com/photo-1546868871-7041f2a55e12?auto=format&fit=crop&q=80&w=400", discount: 50 },
];

export const FLASH_DEALS = [
    { id: "f1", name: "Gaming Console", price: 25000, oldPrice: 35000, image: "https://images.unsplash.com/photo-1486401899868-0e435ed85128?auto=format&fit=crop&q=80&w=400", discount: 30, stock: 10, totalStock: 50, endTime: Date.now() + 3600000 },
    { id: "f2", name: "4K TV", price: 45000, oldPrice: 60000, image: "https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?auto=format&fit=crop&q=80&w=400", discount: 25, stock: 5, totalStock: 20, endTime: Date.now() + 7200000 },
];

export const RECENT_PURCHASES = [
    { id: "p1", name: "Fresh Apples", price: 120, image: "https://images.unsplash.com/photo-1570913149827-d2ac84ab3f9a?auto=format&fit=crop&q=80&w=400", purchasedDate: "2024-02-15" },
];
