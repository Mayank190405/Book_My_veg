"use client";

import { 
    Key, 
    ShieldAlert, 
    Activity, 
    Plus, 
    Copy, 
    Check, 
    RefreshCw, 
    Trash2, 
    Shield, 
    AlertTriangle, 
    Lock, 
    Unlock, 
    User, 
    Search,
    MapPin,
    Clock,
    Send,
    Eye,
    Globe,
    Terminal,
    AlertOctagon,
    Play,
    Save,
    ChevronRight,
    Code,
    FileCode,
    Cpu
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import api from "@/services/api";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { io } from "socket.io-client";

interface EndpointDoc {
    id: string;
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    path: string;
    description: string;
    category: "Users" | "Addresses" | "Products" | "Locations" | "Orders";
    reqBody: string;
    resBody: string;
    curl: string;
}

export default function ApiConsole() {
    const [activeTab, setActiveTab] = useState<"analytics" | "keys" | "incidents" | "docs">("analytics");
    
    // Core data states
    const [keys, setKeys] = useState<any[]>([]);
    const [incidents, setIncidents] = useState<any[]>([]);
    const [locations, setLocations] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    const [overview, setOverview] = useState<any>(null);
    const [topApis, setTopApis] = useState<any[]>([]);
    const [secMetrics, setSecMetrics] = useState<any>(null);
    
    // UI Loading / Modals states
    const [loading, setLoading] = useState(true);
    const [isAddKeyOpen, setIsAddKeyOpen] = useState(false);
    const [createdKeyDetails, setCreatedKeyDetails] = useState<any>(null);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [selectedIncident, setSelectedIncident] = useState<any>(null);
    const [commentText, setCommentText] = useState("");
    const [investigationProof, setInvestigationProof] = useState<any>(null);

    // Dynamic threat pop-up overlays (WS triggered)
    const [incomingThreat, setIncomingThreat] = useState<any>(null);
    
    // Key Creation Form
    const [keyFormData, setKeyFormData] = useState({
        name: "",
        role: "STORE_ADMIN",
        locationId: ""
    });

    // Escalation Mitigation Form
    const [mitigationFormData, setMitigationFormData] = useState({
        status: "OPEN",
        assignedToId: "",
        rootCause: "",
        resolution: ""
    });

    // Documentation state
    const [selectedDocId, setSelectedDocId] = useState("get_users");
    const [apiBaseUrl, setApiBaseUrl] = useState("http://localhost:5000");

    // Setup WebSocket connection for real-time threat HUD pops
    useEffect(() => {
        const socketUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
        const socket = io(socketUrl, { transports: ["websocket"] });

        socket.on("connect", () => {
            console.log("Connected to Real-Time API Threat Listener.");
        });

        // 🚨 Dynamic threat popup triggers
        socket.on("admin:threat_alert", (data: any) => {
            console.log("🚨 SECURITY INTRUSION THREAT TRIGGERED:", data);
            setIncomingThreat(data);
            toast.error(`⚠️ CRITICAL: Security Threat Detected! Key "${data.name}" auto-suspended.`);
            
            // Re-fetch state
            fetchKeys();
            fetchIncidents();
            fetchSecurityMetrics();
        });

        socket.on("admin:sla_breach", (data: any) => {
            console.warn("🚨 CRITICAL SLA BREACH DETECTED:", data);
            toast.warning(`🚨 SLA BREACH: Incident ${data.incidentId} has exceeded SLA deadband.`);
            fetchIncidents();
        });

        return () => {
            socket.disconnect();
        };
    }, []);

    // Initial Data Fetching
    const fetchKeys = async () => {
        try {
            const res = await api.get("/integration-keys");
            setKeys(res.data);
        } catch (err) {
            console.error("Failed to fetch integration keys registry");
        }
    };

    const fetchIncidents = async () => {
        try {
            const res = await api.get("/incidents");
            setIncidents(res.data.data || []);
        } catch (err) {
            console.error("Failed to fetch incidents timeline");
        }
    };

    const fetchLocations = async () => {
        try {
            const res = await api.get("/locations");
            setLocations(res.data);
        } catch (err) {
            console.error("Failed to fetch stores");
        }
    };

    const fetchUsers = async () => {
        try {
            const res = await api.get("/users/admin/all");
            setUsers(res.data);
        } catch (err) {
            console.error("Failed to fetch logistics managers");
        }
    };

    const fetchAnalyticsOverview = async () => {
        try {
            const res = await api.get("/analytics/overview");
            setOverview(res.data);
        } catch (err) {
            console.error("Failed to fetch analytics overview");
        }
    };

    const fetchTopApis = async () => {
        try {
            const res = await api.get("/analytics/top-apis");
            setTopApis(res.data);
        } catch (err) {
            console.error("Failed to fetch top apis consumption");
        }
    };

    const fetchSecurityMetrics = async () => {
        try {
            const res = await api.get("/analytics/security");
            setSecMetrics(res.data);
        } catch (err) {
            console.error("Failed to fetch security analytics scorecard");
        }
    };

    const refreshConsole = async () => {
        setLoading(true);
        await Promise.all([
            fetchKeys(),
            fetchIncidents(),
            fetchLocations(),
            fetchUsers(),
            fetchAnalyticsOverview(),
            fetchTopApis(),
            fetchSecurityMetrics()
        ]);
        setLoading(false);
    };

    useEffect(() => {
        refreshConsole();
    }, []);

    // Create API Key
    const handleCreateKey = async () => {
        if (!keyFormData.name) {
            toast.error("Name is required");
            return;
        }
        if (keyFormData.role === "STORE_ADMIN" && !keyFormData.locationId) {
            toast.error("Assigned store location is required for Store-level keys");
            return;
        }

        try {
            const res = await api.post("/integration-keys", keyFormData);
            setCreatedKeyDetails(res.data);
            toast.success("Credential pair generated successfully");
            fetchKeys();
        } catch (err: any) {
            toast.error(err.response?.data?.message || "Failed to generate key");
        }
    };

    // Toggle API Key Active/Disable (Also un-suspends)
    const handleToggleKey = async (id: string, activeStatus: boolean) => {
        try {
            await api.patch(`/integration-keys/${id}/toggle`, { isActive: activeStatus });
            toast.success(`Key ${activeStatus ? "activated" : "deactivated"} successfully`);
            fetchKeys();
        } catch (err) {
            toast.error("Failed to update credential active state");
        }
    };

    // Delete API Key
    const handleDeleteKey = async (id: string) => {
        if (!confirm("Are you sure you want to permanently revoke this integration credential?")) return;
        try {
            await api.delete(`/integration-keys/${id}`);
            toast.success("Key pair deleted from system registers");
            fetchKeys();
        } catch (err) {
            toast.error("Failed to delete credential");
        }
    };

    // Copy to Clipboard helper
    const handleCopyToClipboard = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        toast.info("Copied to clipboard");
        setTimeout(() => setCopiedId(null), 2000);
    };

    // Handle single Incident details modal opening
    const handleOpenIncidentDetails = async (id: string) => {
        try {
            const res = await api.get(`/incidents/${id}`);
            const data = res.data;
            setSelectedIncident(data);
            setMitigationFormData({
                status: data.status,
                assignedToId: data.assignedToId || "",
                rootCause: data.rootCause || "",
                resolution: data.resolution || ""
            });
            
            // Try parsing detection proof safely
            let proofObj = data.detectionProof;
            if (typeof proofObj === "string") {
                try { proofObj = JSON.parse(proofObj); } catch (e) {}
            }
            setInvestigationProof(proofObj);
        } catch (err) {
            toast.error("Failed to load incident detail parameters");
        }
    };

    // Commit incident workflow updates (resolutions, assignees)
    const handleSaveIncidentMitigation = async () => {
        if (!selectedIncident) return;
        try {
            await api.put(`/incidents/${selectedIncident.id}`, mitigationFormData);
            toast.success("Incident mitigation records synchronized");
            setSelectedIncident(null);
            fetchIncidents();
            fetchSecurityMetrics();
        } catch (err) {
            toast.error("Failed to update incident parameters");
        }
    };

    // Add Incident Comment
    const handleAddComment = async () => {
        if (!selectedIncident || !commentText) return;
        try {
            const res = await api.post(`/incidents/${selectedIncident.id}/comments`, { content: commentText });
            toast.success("Investigation note recorded");
            setCommentText("");
            // Refresh incident detail
            handleOpenIncidentDetails(selectedIncident.id);
        } catch (err) {
            toast.error("Failed to submit comment note");
        }
    };

    // Live SLA Remaining Count Timer hook component
    const SlaTimer = ({ deadline, status }: { deadline: string; status: string }) => {
        const [timeLeft, setTimeLeft] = useState("");
        const [isOverdue, setIsOverdue] = useState(false);

        useEffect(() => {
            const updateTimer = () => {
                if (status === "RESOLVED" || status === "CLOSED") {
                    setTimeLeft("Mitigated");
                    setIsOverdue(false);
                    return;
                }

                const diff = new Date(deadline).getTime() - Date.now();
                if (diff <= 0) {
                    setTimeLeft("OVERDUE BREACHED");
                    setIsOverdue(true);
                    return;
                }

                const minutes = Math.floor(diff / (1000 * 60));
                const seconds = Math.floor((diff % (1000 * 60)) / 1000);
                setTimeLeft(`${minutes}m ${seconds}s`);
            };

            updateTimer();
            const interval = setInterval(updateTimer, 1000);
            return () => clearInterval(interval);
        }, [deadline, status]);

        if (status === "RESOLVED" || status === "CLOSED") {
            return <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 uppercase tracking-wider">Mitigated</span>;
        }

        return (
            <span className={cn(
                "text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider font-mono",
                isOverdue 
                    ? "text-red-600 bg-red-50 border-red-100 animate-pulse" 
                    : "text-amber-600 bg-amber-50 border-amber-100"
            )}>
                {timeLeft}
            </span>
        );
    };

    // Static API Documentation registry
    const API_DOCS: EndpointDoc[] = [
        {
            id: "get_users",
            method: "GET",
            path: "/api/integration/v1/users",
            description: "Retrieve a paged list of customer profiles. Scoped strictly to your API key store boundary if STORE_ADMIN role is active.",
            category: "Users",
            reqBody: "No payload body required.",
            resBody: `{
  "data": [
    {
      "id": "e4a2a16d-9654-469b-8bc6-f1311b151ab3",
      "phone": "+919876543210",
      "email": "customer@example.com",
      "name": "Arjun Sharma",
      "role": "USER",
      "isActive": true,
      "locationId": "loc-delhi-hub",
      "createdAt": "2026-06-01T12:00:00.000Z"
    }
  ],
  "nextCursor": "e4a2a16d-9654-469b-8bc6-f1311b151ab3"
}`,
            curl: `curl -X GET "http://localhost:5000/api/integration/v1/users" \\
  -H "x-api-key: bmv_live_your_secret_api_key"`
        },
        {
            id: "get_user_detail",
            method: "GET",
            path: "/api/integration/v1/users/:id",
            description: "Retrieve detailed profile, role configuration, status, and associated addresses of a specific customer.",
            category: "Users",
            reqBody: "No payload body required.",
            resBody: `{
  "id": "e4a2a16d-9654-469b-8bc6-f1311b151ab3",
  "phone": "+919876543210",
  "email": "customer@example.com",
  "name": "Arjun Sharma",
  "role": "USER",
  "isActive": true,
  "locationId": "loc-delhi-hub",
  "createdAt": "2026-06-01T12:00:00.000Z",
  "updatedAt": "2026-06-02T20:30:00.000Z",
  "addresses": []
}`,
            curl: `curl -X GET "http://localhost:5000/api/integration/v1/users/e4a2a16d-9654-469b-8bc6-f1311b151ab3" \\
  -H "x-api-key: bmv_live_your_secret_api_key"`
        },
        {
            id: "create_user",
            method: "POST",
            path: "/api/integration/v1/users",
            description: "Register a new customer profile. For STORE_ADMIN key scopes, the new user will be automatically assigned to your store hub location.",
            category: "Users",
            reqBody: `{
  "phone": "+919876543210",
  "name": "Arjun Sharma",
  "email": "customer@example.com",
  "role": "USER",
  "password": "optionalSecurePassword",
  "locationId": "optional-store-id-for-admin-key"
}`,
            resBody: `{
  "id": "e4a2a16d-9654-469b-8bc6-f1311b151ab3",
  "phone": "+919876543210",
  "email": "customer@example.com",
  "name": "Arjun Sharma",
  "role": "USER",
  "isActive": true,
  "locationId": "loc-delhi-hub",
  "createdAt": "2026-06-02T20:30:00.000Z"
}`,
            curl: `curl -X POST "http://localhost:5000/api/integration/v1/users" \\
  -H "x-api-key: bmv_live_your_secret_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{"phone": "+919876543210", "name": "Arjun Sharma", "email": "customer@example.com"}'`
        },
        {
            id: "update_user",
            method: "PUT",
            path: "/api/integration/v1/users/:id",
            description: "Modify user attributes such as name, email, active status, or password. Location modifications are restricted to maintain regional store isolation.",
            category: "Users",
            reqBody: `{
  "name": "Arjun Sharma Updated",
  "email": "arjun.updated@example.com",
  "isActive": true,
  "password": "newSecurePassword"
}`,
            resBody: `{
  "id": "e4a2a16d-9654-469b-8bc6-f1311b151ab3",
  "phone": "+919876543210",
  "email": "arjun.updated@example.com",
  "name": "Arjun Sharma Updated",
  "role": "USER",
  "isActive": true,
  "locationId": "loc-delhi-hub",
  "updatedAt": "2026-06-02T20:32:00.000Z"
}`,
            curl: `curl -X PUT "http://localhost:5000/api/integration/v1/users/e4a2a16d-9654-469b-8bc6-f1311b151ab3" \\
  -H "x-api-key: bmv_live_your_secret_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{"name": "Arjun Sharma Updated", "email": "arjun.updated@example.com"}'`
        },
        {
            id: "get_addresses",
            method: "GET",
            path: "/api/integration/v1/addresses/user/:userId",
            description: "Retrieve recorded shipping addresses of a customer. Blocks request if the user is outside of your store location boundary.",
            category: "Addresses",
            reqBody: "No payload body required.",
            resBody: `[
  {
    "id": "addr-74bb65a8-2041",
    "userId": "e4a2a16d-9654-469b-8bc6-f1311b151ab3",
    "type": "HOME",
    "fullAddress": "Flat 402, Sector 12, Dwarka",
    "city": "Delhi",
    "state": "Delhi",
    "pincode": "110075",
    "name": "Arjun Sharma",
    "phone": "+919876543210",
    "isDefault": true
  }
]`,
            curl: `curl -X GET "http://localhost:5000/api/integration/v1/addresses/user/e4a2a16d-9654-469b-8bc6-f1311b151ab3" \\
  -H "x-api-key: bmv_live_your_secret_api_key"`
        },
        {
            id: "create_address",
            method: "POST",
            path: "/api/integration/v1/addresses/user/:userId",
            description: "Add a new shipping/billing address for a user. Supports address types HOME, OFFICE, or OTHER. Sets coordinates automatically.",
            category: "Addresses",
            reqBody: `{
  "type": "HOME",
  "fullAddress": "Flat 402, Sector 12, Dwarka",
  "landmark": "Near Metro Station",
  "city": "Delhi",
  "state": "Delhi",
  "pincode": "110075",
  "name": "Arjun Sharma",
  "phone": "+919876543210",
  "latitude": 28.59,
  "longitude": 77.06,
  "isDefault": true
}`,
            resBody: `{
  "id": "addr-74bb65a8-2041",
  "userId": "e4a2a16d-9654-469b-8bc6-f1311b151ab3",
  "type": "HOME",
  "fullAddress": "Flat 402, Sector 12, Dwarka",
  "landmark": "Near Metro Station",
  "city": "Delhi",
  "state": "Delhi",
  "pincode": "110075",
  "name": "Arjun Sharma",
  "phone": "+919876543210",
  "latitude": 28.59,
  "longitude": 77.06,
  "isDefault": true,
  "tag": "Home"
}`,
            curl: `curl -X POST "http://localhost:5000/api/integration/v1/addresses/user/e4a2a16d-9654-469b-8bc6-f1311b151ab3" \\
  -H "x-api-key: bmv_live_your_secret_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{"type": "HOME", "fullAddress": "Flat 402, Sector 12, Dwarka", "city": "Delhi", "pincode": "110075", "name": "Arjun Sharma", "phone": "+919876543210", "isDefault": true}'`
        },
        {
            id: "update_address",
            method: "PUT",
            path: "/api/integration/v1/addresses/:id",
            description: "Modify an existing address profile. Updates tag definitions dynamically and checks customer regional boundaries.",
            category: "Addresses",
            reqBody: `{
  "type": "OFFICE",
  "fullAddress": "DLF CyberCity, Building 10C",
  "city": "Gurugram",
  "state": "Haryana",
  "pincode": "122002",
  "isDefault": false
}`,
            resBody: `{
  "id": "addr-74bb65a8-2041",
  "userId": "e4a2a16d-9654-469b-8bc6-f1311b151ab3",
  "type": "OFFICE",
  "fullAddress": "DLF CyberCity, Building 10C",
  "city": "Gurugram",
  "state": "Haryana",
  "pincode": "122002",
  "isDefault": false,
  "tag": "Office"
}`,
            curl: `curl -X PUT "http://localhost:5000/api/integration/v1/addresses/addr-74bb65a8-2041" \\
  -H "x-api-key: bmv_live_your_secret_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{"type": "OFFICE", "fullAddress": "DLF CyberCity, Building 10C", "city": "Gurugram", "pincode": "122002"}'`
        },
        {
            id: "get_categories",
            method: "GET",
            path: "/api/integration/v1/categories",
            description: "Fetch global category trees containing active merchandise sections.",
            category: "Products",
            reqBody: "No payload body required.",
            resBody: `[
  {
    "id": "cat-leafy-greens",
    "name": "Leafy Vegetables",
    "slug": "leafy-vegetables",
    "imageUrl": "/uploads/categories/greens.png",
    "isActive": true,
    "children": []
  }
]`,
            curl: `curl -X GET "http://localhost:5000/api/integration/v1/categories" \\
  -H "x-api-key: bmv_live_your_secret_api_key"`
        },
        {
            id: "get_products",
            method: "GET",
            path: "/api/integration/v1/products",
            description: "Fetch catalog items with variants. For Store API keys, stock volumes are automatically filtered to show only the localized hub availability.",
            category: "Products",
            reqBody: "No payload body required.",
            resBody: `{
  "data": [
    {
      "id": "prod-fresh-spinach",
      "name": "Fresh Spinach",
      "slug": "fresh-spinach",
      "sku": "VEG-SPIN-01",
      "basePrice": "40.00",
      "variants": [
        {
          "id": "var-spinach-250g",
          "name": "250g Bunch",
          "price": "12.00",
          "inventory": [
            {
              "locationId": "loc-delhi-hub",
              "currentStock": "80.000",
              "isLowStock": false
            }
          ]
        }
      ]
    }
  ],
  "nextCursor": "prod-fresh-spinach"
}`,
            curl: `curl -X GET "http://localhost:5000/api/integration/v1/products" \\
  -H "x-api-key: bmv_live_your_secret_api_key"`
        },
        {
            id: "create_product",
            method: "POST",
            path: "/api/integration/v1/products",
            description: "Onboard a new product to the global vegetable merchandise catalog. Requires an ADMIN-level API key.",
            category: "Products",
            reqBody: `{
  "name": "Fresh Cauliflower",
  "slug": "fresh-cauliflower",
  "description": "Fresh white cauliflowers directly from local farms.",
  "categoryId": "cat-leafy-greens",
  "basePrice": 35.00,
  "sku": "VEG-CAUL-01",
  "barcode": "8902234123456",
  "taxSlab": 5.0,
  "gstRate": 5.0,
  "hsnCode": "0704"
}`,
            resBody: `{
  "id": "prod-fresh-cauliflower",
  "name": "Fresh Cauliflower",
  "slug": "fresh-cauliflower",
  "description": "Fresh white cauliflowers directly from local farms.",
  "categoryId": "cat-leafy-greens",
  "basePrice": "35.00",
  "sku": "VEG-CAUL-01",
  "barcode": "8902234123456",
  "taxSlab": 5,
  "gstRate": 5,
  "hsnCode": "0704",
  "isActive": true
}`,
            curl: `curl -X POST "http://localhost:5000/api/integration/v1/products" \\
  -H "x-api-key: bmv_live_your_secret_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{"name": "Fresh Cauliflower", "slug": "fresh-cauliflower", "categoryId": "cat-leafy-greens", "basePrice": 35.00, "sku": "VEG-CAUL-01"}'`
        },
        {
            id: "update_product",
            method: "PUT",
            path: "/api/integration/v1/products/:id",
            description: "Modify an existing product parameter sheet. Requires an ADMIN-level API key.",
            category: "Products",
            reqBody: `{
  "name": "Fresh Cauliflower Premium",
  "basePrice": 42.00,
  "isActive": true
}`,
            resBody: `{
  "id": "prod-fresh-cauliflower",
  "name": "Fresh Cauliflower Premium",
  "slug": "fresh-cauliflower",
  "categoryId": "cat-leafy-greens",
  "basePrice": "42.00",
  "sku": "VEG-CAUL-01",
  "isActive": true
}`,
            curl: `curl -X PUT "http://localhost:5000/api/integration/v1/products/prod-fresh-cauliflower" \\
  -H "x-api-key: bmv_live_your_secret_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{"name": "Fresh Cauliflower Premium", "basePrice": 42.00}'`
        },
        {
            id: "patch_inventory",
            method: "PATCH",
            path: "/api/integration/v1/products/inventory",
            description: "Perform atomic inventory stock modifications. Restricts updates to your registered hub boundary location.",
            category: "Products",
            reqBody: `{
  "productId": "prod-fresh-spinach",
  "variantId": "var-spinach-250g",
  "currentStock": 120,
  "thresholdStock": 15
}`,
            resBody: `{
  "id": "inv-55bb62a9-1102",
  "productId": "prod-fresh-spinach",
  "variantId": "var-spinach-250g",
  "locationId": "loc-delhi-hub",
  "currentStock": "120.000",
  "thresholdStock": "15.000",
  "isLowStock": false
}`,
            curl: `curl -X PATCH "http://localhost:5000/api/integration/v1/products/inventory" \\
  -H "x-api-key: bmv_live_your_secret_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{"productId": "prod-fresh-spinach", "variantId": "var-spinach-250g", "currentStock": 120}'`
        },
        {
            id: "update_pricing",
            method: "POST",
            path: "/api/integration/v1/products/pricing",
            description: "Create or update localized channel pricing indices for products and variants. Requires an ADMIN-level API key.",
            category: "Products",
            reqBody: `{
  "productId": "prod-fresh-cauliflower",
  "variantId": null,
  "channel": "WEB",
  "price": 38.50,
  "discountType": "FLAT",
  "discountValue": 3.0,
  "startDate": "2026-06-02T12:00:00Z",
  "endDate": "2026-06-15T12:00:00Z"
}`,
            resBody: `{
  "id": "price-44aa12bb",
  "productId": "prod-fresh-cauliflower",
  "variantId": null,
  "channel": "WEB",
  "price": 38.5,
  "discountType": "FLAT",
  "discountValue": 3,
  "startDate": "2026-06-02T12:00:00.000Z",
  "endDate": "2026-06-15T12:00:00.000Z",
  "isActive": true
}`,
            curl: `curl -X POST "http://localhost:5000/api/integration/v1/products/pricing" \\
  -H "x-api-key: bmv_live_your_secret_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{"productId": "prod-fresh-cauliflower", "price": 38.5, "channel": "WEB"}'`
        },
        {
            id: "get_locations",
            method: "GET",
            path: "/api/integration/v1/locations",
            description: "List logistics hub stores and warehouses. Store-level keys will only receive their own location node.",
            category: "Locations",
            reqBody: "No payload body required.",
            resBody: `[
  {
    "id": "loc-delhi-hub",
    "slug": "delhi-hub",
    "name": "Central Delhi Hub",
    "address": "Sector 3, R.K. Puram, New Delhi",
    "contactNumber": "+919999988888",
    "isOpen": true
  }
]`,
            curl: `curl -X GET "http://localhost:5000/api/integration/v1/locations" \\
  -H "x-api-key: bmv_live_your_secret_api_key"`
        },
        {
            id: "get_location_detail",
            method: "GET",
            path: "/api/integration/v1/locations/:id",
            description: "Retrieve comprehensive configuration params of a store hub, including address details and geofence parameters.",
            category: "Locations",
            reqBody: "No payload body required.",
            resBody: `{
  "id": "loc-delhi-hub",
  "slug": "delhi-hub",
  "name": "Central Delhi Hub",
  "address": "Sector 3, R.K. Puram, New Delhi",
  "contactNumber": "+919999988888",
  "gstNumber": "07AAAAA1111A1Z1",
  "latitude": 28.57,
  "longitude": 77.18,
  "deliveryRadius": 10.5,
  "isOpen": true
}`,
            curl: `curl -X GET "http://localhost:5000/api/integration/v1/locations/loc-delhi-hub" \\
  -H "x-api-key: bmv_live_your_secret_api_key"`
        },
        {
            id: "get_orders",
            method: "GET",
            path: "/api/integration/v1/orders",
            description: "List dispatch orders scoped strictly by location boundaries. Supports filtering by active OrderStatus.",
            category: "Orders",
            reqBody: "No payload body required.",
            resBody: `{
  "data": [
    {
      "id": "BMV-ORD-2026-8812",
      "userId": "e4a2a16d-9654-469b-8bc6-f1311b151ab3",
      "totalAmount": "240.00",
      "status": "CONFIRMED",
      "locationId": "loc-delhi-hub",
      "createdAt": "2026-06-02T19:00:00.000Z",
      "items": [],
      "user": {
        "id": "e4a2a16d-9654-469b-8bc6-f1311b151ab3",
        "name": "Arjun Sharma",
        "phone": "+919876543210"
      }
    }
  ],
  "nextCursor": "BMV-ORD-2026-8812"
}`,
            curl: `curl -X GET "http://localhost:5000/api/integration/v1/orders" \\
  -H "x-api-key: bmv_live_your_secret_api_key"`
        },
        {
            id: "get_order_detail",
            method: "GET",
            path: "/api/integration/v1/orders/:id",
            description: "Fetch comprehensive parameters of a single order booking, including item matrices, payments, and workflow history loggers.",
            category: "Orders",
            reqBody: "No payload body required.",
            resBody: `{
  "id": "BMV-ORD-2026-8812",
  "userId": "e4a2a16d-9654-469b-8bc6-f1311b151ab3",
  "totalAmount": "240.00",
  "status": "CONFIRMED",
  "locationId": "loc-delhi-hub",
  "createdAt": "2026-06-02T19:00:00.000Z",
  "items": [
    {
      "productId": "prod-fresh-spinach",
      "variantId": "var-spinach-250g",
      "quantity": 2,
      "price": "12.00",
      "product": {
        "id": "prod-fresh-spinach",
        "name": "Fresh Spinach",
        "sku": "VEG-SPIN-01"
      }
    }
  ],
  "statusHistory": [
    {
      "status": "CONFIRMED",
      "remark": "Order confirmed",
      "createdAt": "2026-06-02T19:00:00.000Z"
    }
  ],
  "payments": [],
  "user": {
    "id": "e4a2a16d-9654-469b-8bc6-f1311b151ab3",
    "name": "Arjun Sharma",
    "phone": "+919876543210"
  }
}`,
            curl: `curl -X GET "http://localhost:5000/api/integration/v1/orders/BMV-ORD-2026-8812" \\
  -H "x-api-key: bmv_live_your_secret_api_key"`
        },
        {
            id: "create_order",
            method: "POST",
            path: "/api/integration/v1/orders",
            description: "Commit new cart orders programmatically. Executes atomic inventory locking and schedules automated payment timers.",
            category: "Orders",
            reqBody: `{
  "userId": "e4a2a16d-9654-469b-8bc6-f1311b151ab3",
  "totalAmount": 24.00,
  "deliverySlot": "10:00 AM - 12:00 PM",
  "deliveryDate": "2026-06-03",
  "address": {
    "fullAddress": "Flat 402, Sector 12, Dwarka",
    "city": "Delhi",
    "pincode": "110075",
    "name": "Arjun Sharma",
    "phone": "+919876543210"
  },
  "items": [
    {
      "productId": "prod-fresh-spinach",
      "variantId": "var-spinach-250g",
      "quantity": 2,
      "price": 12.00
    }
  ]
}`,
            resBody: `{
  "id": "BMV-ORD-2026-8813",
  "userId": "e4a2a16d-9654-469b-8bc6-f1311b151ab3",
  "totalAmount": "24.00",
  "status": "PAYMENT_PENDING",
  "paymentStatus": "PENDING",
  "locationId": "loc-delhi-hub",
  "createdAt": "2026-06-02T20:31:00.000Z"
}`,
            curl: `curl -X POST "http://localhost:5000/api/integration/v1/orders" \\
  -H "x-api-key: bmv_live_your_secret_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{"userId": "e4a2a16d-9654-469b-8bc6-f1311b151ab3", "totalAmount": 24.00, "items": [{"productId": "prod-fresh-spinach", "variantId": "var-spinach-250g", "quantity": 2}]}'`
        },
        {
            id: "update_order_status",
            method: "PUT",
            path: "/api/integration/v1/orders/:id/status",
            description: "Modify state transitions for dispatch execution workflows. Valid states: CONFIRMED, SHIPPED, OUT_FOR_DELIVERY, DELIVERED.",
            category: "Orders",
            reqBody: `{
  "status": "SHIPPED",
  "remark": "Handed over to delivery executive",
  "deliveryPartnerId": "partner-998"
}`,
            resBody: `{
  "id": "BMV-ORD-2026-8812",
  "userId": "e4a2a16d-9654-469b-8bc6-f1311b151ab3",
  "totalAmount": "240.00",
  "status": "SHIPPED",
  "locationId": "loc-delhi-hub",
  "updatedAt": "2026-06-02T20:33:00.000Z"
}`,
            curl: `curl -X PUT "http://localhost:5000/api/integration/v1/orders/BMV-ORD-2026-8812/status" \\
  -H "x-api-key: bmv_live_your_secret_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{"status": "SHIPPED", "remark": "Dispatched via regional partner."}'`
        },
        {
            id: "cancel_order",
            method: "POST",
            path: "/api/integration/v1/orders/:id/cancel",
            description: "Perform transaction cancellation. Automatically rolls back reserved stock quantities atomically to associated regional store inventory.",
            category: "Orders",
            reqBody: `{
  "remark": "Cancelled programmatically due to customer system sync"
}`,
            resBody: `{
  "message": "Order cancelled and inventory restored successfully."
}`,
            curl: `curl -X POST "http://localhost:5000/api/integration/v1/orders/BMV-ORD-2026-8812/cancel" \\
  -H "x-api-key: bmv_live_your_secret_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{"remark": "Cancelled programmatically due to customer system sync"}'`
        }
    ];

    const selectedDoc = API_DOCS.find(d => d.id === selectedDocId) || API_DOCS[0];

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Real-time Threat Overlay Pop-up HUD Modal */}
            {incomingThreat && (
                <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-white border-2 border-red-500 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-500 shadow-red-500/10">
                        {/* Red Header Bar */}
                        <div className="bg-red-600 p-6 flex items-center gap-4 text-white">
                            <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center border border-white/20 shadow-inner">
                                <AlertOctagon className="h-6 w-6 text-white animate-bounce" />
                            </div>
                            <div>
                                <h3 className="text-lg font-black uppercase tracking-tight leading-none">Intrusion Alert Pop-up</h3>
                                <span className="text-[10px] font-bold text-red-100 uppercase tracking-widest mt-1 inline-block">Threat Engine Auto-Mitigated</span>
                            </div>
                        </div>

                        {/* Summary details */}
                        <div className="p-6 md:p-8 space-y-6">
                            <div className="text-center p-4 bg-red-50 rounded-2xl border border-red-100 flex flex-col items-center">
                                <span className="text-[10px] font-bold text-red-500 uppercase tracking-wider">Compromised Integration Key</span>
                                <h4 className="text-md font-extrabold text-slate-800 mt-1">{incomingThreat.name}</h4>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">Severity Scope</span>
                                    <p className="text-sm font-black text-red-600 uppercase tracking-tight mt-1">P0 - Critical</p>
                                </div>
                                <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">Attack Type</span>
                                    <p className="text-xs font-black text-slate-800 uppercase tracking-tight mt-1">{incomingThreat.threatType}</p>
                                </div>
                                <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">Origin IP</span>
                                    <p className="text-xs font-bold text-slate-800 mt-1 font-mono">{incomingThreat.sourceIp}</p>
                                </div>
                                <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">Origin Geo</span>
                                    <p className="text-xs font-bold text-slate-800 mt-1 flex items-center gap-1.5 uppercase font-black">
                                        <Globe className="h-3.5 w-3.5 text-slate-400" /> {incomingThreat.country || "Unknown"}
                                    </p>
                                </div>
                            </div>

                            {/* Threat Snippet Proof */}
                            <div className="space-y-2">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Injection Payload Proof</span>
                                <pre className="bg-slate-900 text-red-400 p-4 rounded-xl text-[10px] font-mono overflow-x-auto whitespace-pre-wrap max-h-24 leading-relaxed border border-slate-800 shadow-inner">
                                    {JSON.stringify(incomingThreat.proof)}
                                </pre>
                            </div>
                        </div>

                        {/* Bottom Actions */}
                        <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-3">
                            <button 
                                onClick={() => setIncomingThreat(null)}
                                className="px-6 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-600 hover:bg-white border border-transparent hover:border-slate-200 transition-all active:scale-95"
                            >
                                Acknowledge Breach
                            </button>
                            <button 
                                onClick={() => {
                                    const threatId = incomingThreat.incidentId;
                                    setIncomingThreat(null);
                                    setActiveTab("incidents");
                                    handleOpenIncidentDetails(threatId);
                                }}
                                className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs shadow-lg shadow-red-100 flex items-center gap-2 active:scale-95 transition-all"
                            >
                                <Terminal className="h-4 w-4" /> Open Investigation
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-200">
                <div className="px-1 md:px-0">
                    <h2 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">API Security Console</h2>
                    <p className="text-sm text-slate-500 mt-1">API keys management, real-time threat deactivation logs, and exfiltration alerts center.</p>
                </div>
                
                <div className="flex items-center gap-3">
                    <button 
                        onClick={refreshConsole}
                        className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-50 transition-all shadow-sm active:scale-95"
                    >
                        <RefreshCw className="h-5 w-5" />
                    </button>

                    <Dialog open={isAddKeyOpen} onOpenChange={(open) => {
                        setIsAddKeyOpen(open);
                        if (!open) {
                            setCreatedKeyDetails(null);
                            setKeyFormData({ name: "", role: "STORE_ADMIN", locationId: "" });
                        }
                    }}>
                        <DialogTrigger asChild>
                            <button className="h-12 bg-slate-900 hover:bg-emerald-600 text-white px-6 rounded-xl flex items-center justify-center gap-3 shadow-lg shadow-slate-100 transition-all active:scale-95 font-bold text-sm">
                                <Plus className="h-5 w-5" />
                                <span>Generate API Key</span>
                            </button>
                        </DialogTrigger>
                        <DialogContent className="bg-white border-slate-200 border rounded-2xl w-[95vw] md:w-full max-w-lg p-0 shadow-2xl animate-in zoom-in-95 duration-300">
                            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 border border-emerald-100">
                                        <Key className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-900 uppercase tracking-tight">Generate Key</h3>
                                        <p className="text-xs text-slate-500 mt-0.5">Register a secure API key for external integrations</p>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="p-6 md:p-8 space-y-6">
                                {createdKeyDetails ? (
                                    /* Display generated raw key once */
                                    <div className="space-y-6">
                                        <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex flex-col items-center text-center">
                                            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Credential Pair Generated</span>
                                            <p className="text-xs text-slate-500 mt-1">Please copy and save this secret key now. You will not be able to view it again.</p>
                                        </div>

                                        <div className="space-y-2">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Raw API Key Pair</span>
                                            <div className="flex items-center gap-2 p-4 bg-slate-900 rounded-2xl border border-slate-800 shadow-inner group">
                                                <input 
                                                    readOnly 
                                                    className="bg-transparent border-none outline-none text-emerald-400 font-mono text-xs w-full font-bold select-all"
                                                    value={createdKeyDetails.key}
                                                />
                                                <button 
                                                    onClick={() => handleCopyToClipboard(createdKeyDetails.key, createdKeyDetails.id)}
                                                    className="w-10 h-10 bg-slate-800 hover:bg-slate-700 rounded-xl flex items-center justify-center text-emerald-400 hover:text-white border border-slate-700/50 active:scale-95 transition-all"
                                                >
                                                    {copiedId === createdKeyDetails.id ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                                </button>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Scope Role</span>
                                                <p className="text-xs font-bold text-slate-800 uppercase tracking-tight mt-0.5">{createdKeyDetails.role}</p>
                                            </div>
                                            <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Assigned Store</span>
                                                <p className="text-xs font-bold text-slate-800 uppercase tracking-tight mt-0.5">{createdKeyDetails.locationName}</p>
                                            </div>
                                        </div>

                                        <button 
                                            onClick={() => setIsAddKeyOpen(false)}
                                            className="w-full h-12 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-sm shadow-sm active:scale-95 transition-all"
                                        >
                                            I Have Saved the Key
                                        </button>
                                    </div>
                                ) : (
                                    /* Key configuration input */
                                    <div className="space-y-6">
                                        <div className="space-y-2 group">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Integration/Partner Name</label>
                                            <input 
                                                className="w-full h-12 bg-white rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-900 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 transition-all placeholder:text-slate-300"
                                                placeholder="E.g. Zapier Delivery Ingestion"
                                                value={keyFormData.name}
                                                onChange={(e) => setKeyFormData({...keyFormData, name: e.target.value})}
                                            />
                                        </div>

                                        <div className="space-y-2 group">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Access Scope Role</label>
                                            <select 
                                                className="w-full h-12 bg-white rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-800 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 transition-all"
                                                value={keyFormData.role}
                                                onChange={(e) => setKeyFormData({...keyFormData, role: e.target.value, locationId: e.target.value === "ADMIN" ? "" : keyFormData.locationId})}
                                            >
                                                <option value="STORE_ADMIN">Store Level (Scoped to specific store)</option>
                                                <option value="ADMIN">Admin Level (Global network access)</option>
                                            </select>
                                        </div>

                                        {keyFormData.role === "STORE_ADMIN" && (
                                            <div className="space-y-2 group">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Assigned Store Location</label>
                                                <select 
                                                    className="w-full h-12 bg-white rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-800 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 transition-all"
                                                    value={keyFormData.locationId}
                                                    onChange={(e) => setKeyFormData({...keyFormData, locationId: e.target.value})}
                                                >
                                                    <option value="">Select a logistics store hub...</option>
                                                    {locations.map(loc => (
                                                        <option key={loc.id} value={loc.id}>{loc.name} (/{loc.slug})</option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}

                                        <button 
                                            onClick={handleCreateKey}
                                            className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm shadow-lg shadow-emerald-100 flex items-center justify-center gap-2 active:scale-95 transition-all"
                                        >
                                            <Save className="h-4 w-4" />
                                            Generate API Credentials
                                        </button>
                                    </div>
                                )}
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex gap-4 border-b border-slate-200 pb-px">
                <button 
                    onClick={() => setActiveTab("analytics")}
                    className={cn(
                        "h-12 px-6 text-sm font-bold border-b-2 -mb-px transition-all uppercase tracking-wider flex items-center gap-2.5",
                        activeTab === "analytics" 
                            ? "border-emerald-600 text-emerald-600" 
                            : "border-transparent text-slate-400 hover:text-slate-900"
                    )}
                >
                    <Activity className="h-4 w-4" />
                    Usage Analytics
                </button>
                <button 
                    onClick={() => setActiveTab("keys")}
                    className={cn(
                        "h-12 px-6 text-sm font-bold border-b-2 -mb-px transition-all uppercase tracking-wider flex items-center gap-2.5",
                        activeTab === "keys" 
                            ? "border-emerald-600 text-emerald-600" 
                            : "border-transparent text-slate-400 hover:text-slate-900"
                    )}
                >
                    <Key className="h-4 w-4" />
                    API Credentials
                </button>
                <button 
                    onClick={() => setActiveTab("incidents")}
                    className={cn(
                        "h-12 px-6 text-sm font-bold border-b-2 -mb-px transition-all uppercase tracking-wider flex items-center gap-2.5",
                        activeTab === "incidents" 
                            ? "border-emerald-600 text-emerald-600" 
                            : "border-transparent text-slate-400 hover:text-slate-900"
                    )}
                >
                    <ShieldAlert className="h-4 w-4" />
                    Security Incidents
                </button>
                <button 
                    onClick={() => setActiveTab("docs")}
                    className={cn(
                        "h-12 px-6 text-sm font-bold border-b-2 -mb-px transition-all uppercase tracking-wider flex items-center gap-2.5",
                        activeTab === "docs" 
                            ? "border-emerald-600 text-emerald-600" 
                            : "border-transparent text-slate-400 hover:text-slate-900"
                    )}
                >
                    <Code className="h-4 w-4" />
                    API Documentation
                </button>
            </div>

            {/* TAB 1: USAGE ANALYTICS */}
            {activeTab === "analytics" && (
                <div className="space-y-8">
                    {/* Performance Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="bg-white border border-slate-100 rounded-2xl p-6 flex items-center justify-between shadow-sm">
                            <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total API Requests</span>
                                <h3 className="text-2xl font-black text-slate-900 mt-1">{overview?.summary?.totalRequests || 0}</h3>
                            </div>
                            <div className="w-12 h-12 bg-slate-50 border border-slate-100 text-slate-400 rounded-xl flex items-center justify-center p-2.5 shadow-sm">
                                <Activity className="h-full w-full" />
                            </div>
                        </div>

                        <div className="bg-white border border-slate-100 rounded-2xl p-6 flex items-center justify-between shadow-sm">
                            <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Latency Average</span>
                                <h3 className="text-2xl font-black text-slate-900 mt-1">{overview?.summary?.averageResponseTimeMs || 0} <span className="text-xs font-semibold text-slate-400">ms</span></h3>
                            </div>
                            <div className="w-12 h-12 bg-slate-50 border border-slate-100 text-slate-400 rounded-xl flex items-center justify-center p-2.5 shadow-sm">
                                <Clock className="h-full w-full" />
                            </div>
                        </div>

                        <div className="bg-white border border-slate-100 rounded-2xl p-6 flex items-center justify-between shadow-sm">
                            <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Success Rate</span>
                                <h3 className="text-2xl font-black text-slate-900 mt-1">{overview?.summary?.successRate || 100} <span className="text-xs font-semibold text-slate-400">%</span></h3>
                            </div>
                            <div className="w-12 h-12 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center p-2.5 shadow-sm">
                                <Check className="h-full w-full" />
                            </div>
                        </div>

                        <div className="bg-white border border-slate-100 rounded-2xl p-6 flex items-center justify-between shadow-sm">
                            <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Security Scorecard</span>
                                <h3 className="text-2xl font-black text-slate-900 mt-1">
                                    {secMetrics?.incidentCounts?.total > 0 ? (
                                        <span className="text-red-500">{secMetrics?.incidentCounts?.total} <span className="text-xs font-semibold text-slate-400">Alerts</span></span>
                                    ) : (
                                        <span className="text-emerald-600">SECURE</span>
                                    )}
                                </h3>
                            </div>
                            <div className={cn(
                                "w-12 h-12 rounded-xl flex items-center justify-center p-2.5 shadow-sm",
                                secMetrics?.incidentCounts?.total > 0 
                                    ? "bg-red-50 border border-red-100 text-red-500" 
                                    : "bg-emerald-50 border border-emerald-100 text-emerald-600"
                            )}>
                                <Shield className="h-full w-full" />
                            </div>
                        </div>
                    </div>

                    {/* Historical Usage Graph */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
                        <h3 className="text-md font-bold text-slate-900 uppercase tracking-tight mb-6">Historical Traffic Timeline (Last 30 Days)</h3>
                        
                        {overview?.trends && overview.trends.length > 0 ? (
                            /* Custom Elegant CSS-bar chart */
                            <div className="flex items-end justify-between gap-2 h-48 pt-6">
                                {overview.trends.map((item: any, i: number) => {
                                    const maxVal = Math.max(...overview.trends.map((t: any) => t.total)) || 1;
                                    const fillPercent = Math.round((item.total / maxVal) * 100);
                                    return (
                                        <div key={i} className="flex flex-col items-center gap-2 flex-1 group relative">
                                            {/* Bar details tooltip */}
                                            <div className="absolute bottom-full mb-2 bg-slate-900 text-white text-[9px] font-bold py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none font-mono">
                                                {item.date}: {item.total} reqs ({item.success} OK)
                                            </div>
                                            
                                            {/* Stacked bar */}
                                            <div className="w-full bg-slate-50 border border-slate-100 rounded-md h-36 flex flex-col justify-end overflow-hidden shadow-inner relative">
                                                <div 
                                                    style={{ height: `${fillPercent}%` }} 
                                                    className="w-full bg-emerald-500 group-hover:bg-emerald-600 transition-colors shadow-sm rounded-t-sm"
                                                />
                                            </div>
                                            
                                            {/* Date label */}
                                            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wide truncate max-w-[2.5rem]">
                                                {item.date.substring(5)}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="h-48 border-2 border-dashed border-slate-100 rounded-xl flex items-center justify-center text-slate-400 text-xs font-bold uppercase tracking-widest">
                                No Traffic Recorded inside Metric Buffer
                            </div>
                        )}
                    </div>

                    {/* Top APIs & Security KPIs metrics */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-12">
                        {/* Top APIs Table */}
                        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col">
                            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-tight mb-6 flex items-center gap-2">
                                <Terminal className="h-4 w-4 text-slate-400" />
                                Consumption by Endpoint
                            </h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-slate-100">
                                            <th className="text-[9px] font-bold text-slate-400 uppercase tracking-widest pb-3">Method</th>
                                            <th className="text-[9px] font-bold text-slate-400 uppercase tracking-widest pb-3 pl-3">API Endpoint</th>
                                            <th className="text-[9px] font-bold text-slate-400 uppercase tracking-widest pb-3 text-right">Traffic</th>
                                            <th className="text-[9px] font-bold text-slate-400 uppercase tracking-widest pb-3 text-right">Avg latency</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {topApis.map((api, idx) => (
                                            <tr key={idx} className="group hover:bg-slate-50/50 transition-all">
                                                <td className="py-3">
                                                    <span className={cn(
                                                        "text-[9px] font-extrabold px-2 py-0.5 rounded uppercase tracking-wider",
                                                        api.method === "GET" ? "text-blue-600 bg-blue-50 border border-blue-100" :
                                                        api.method === "POST" ? "text-emerald-600 bg-emerald-50 border border-emerald-100" :
                                                        "text-amber-600 bg-amber-50 border border-amber-100"
                                                    )}>
                                                        {api.method}
                                                    </span>
                                                </td>
                                                <td className="py-3 pl-3 text-xs font-bold text-slate-800 font-mono group-hover:text-emerald-600 transition-colors">{api.endpoint}</td>
                                                <td className="py-3 text-right text-xs font-black text-slate-800 font-mono">{api.requestCount} <span className="text-[9px] text-slate-400 font-bold">Reqs</span></td>
                                                <td className="py-3 text-right text-xs font-bold text-slate-500 font-mono">{api.averageResponseTimeMs} ms</td>
                                            </tr>
                                        ))}
                                        {topApis.length === 0 && (
                                            <tr>
                                                <td colSpan={4} className="py-8 text-center text-xs text-slate-400 uppercase font-bold tracking-widest">
                                                    No API Requests logged in registers
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Security KPIs */}
                        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
                            <div>
                                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-tight mb-6 flex items-center gap-2">
                                    <Shield className="h-4 w-4 text-slate-400" />
                                    Operational KPIs
                                </h3>
                                
                                <div className="space-y-6">
                                    <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between">
                                        <div>
                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Mean Time To Detect (MTTD)</p>
                                            <h4 className="text-lg font-black text-slate-800">
                                                {secMetrics?.kpis?.mttdSeconds || 0.5} <span className="text-xs font-semibold text-slate-400">Seconds</span>
                                            </h4>
                                        </div>
                                        <div className="w-10 h-10 bg-white border border-slate-200 text-emerald-600 rounded-lg flex items-center justify-center font-black text-xs font-mono">
                                            INST
                                        </div>
                                    </div>

                                    <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between">
                                        <div>
                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Mean Time To Resolve (MTTR)</p>
                                            <h4 className="text-lg font-black text-slate-800">
                                                {secMetrics?.kpis?.mttrMinutes || 0} <span className="text-xs font-semibold text-slate-400">Minutes</span>
                                            </h4>
                                        </div>
                                        <div className="w-10 h-10 bg-white border border-slate-200 text-slate-500 rounded-lg flex items-center justify-center">
                                            <Clock className="h-5 w-5" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-6 border-t border-slate-50 mt-6 flex items-center justify-between">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Incident Rate</span>
                                <span className="text-xs font-black text-slate-800 font-mono">
                                    {secMetrics?.incidentCounts?.total || 0} Open Alerts
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 2: API KEYS MANAGEMENT */}
            {activeTab === "keys" && (
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden pb-12">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/50 border-b border-slate-100">
                                    <th className="text-[10px] font-bold text-slate-400 uppercase tracking-widest py-4 px-8">Integration name</th>
                                    <th className="text-[10px] font-bold text-slate-400 uppercase tracking-widest py-4">Masked Secret Key</th>
                                    <th className="text-[10px] font-bold text-slate-400 uppercase tracking-widest py-4">Access Scope</th>
                                    <th className="text-[10px] font-bold text-slate-400 uppercase tracking-widest py-4">Assigned Location</th>
                                    <th className="text-[10px] font-bold text-slate-400 uppercase tracking-widest py-4">Connection</th>
                                    <th className="text-[10px] font-bold text-slate-400 uppercase tracking-widest py-4 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {keys.map((key) => (
                                    <tr key={key.id} className="hover:bg-slate-50/20 transition-all">
                                        <td className="py-4 px-8">
                                            <h4 className="text-sm font-bold text-slate-800 uppercase tracking-tight">{key.name}</h4>
                                            <span className="text-[9px] text-slate-400 font-mono">ID: {key.id}</span>
                                        </td>
                                        <td className="py-4">
                                            <code className="text-xs font-bold text-slate-500 font-mono bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">{key.key}</code>
                                        </td>
                                        <td className="py-4">
                                            <span className={cn(
                                                "text-[9px] font-extrabold px-2 py-0.5 rounded uppercase tracking-wider",
                                                key.role === "ADMIN" 
                                                    ? "text-purple-600 bg-purple-50 border border-purple-100" 
                                                    : "text-blue-600 bg-blue-50 border border-blue-100"
                                            )}>
                                                {key.role === "ADMIN" ? "Global Admin" : "Store Admin"}
                                            </span>
                                        </td>
                                        <td className="py-4">
                                            <span className="text-xs font-semibold text-slate-500 uppercase">{key.locationName}</span>
                                        </td>
                                        <td className="py-4">
                                            {key.isSuspended ? (
                                                <div className="flex items-center gap-1.5 px-2 py-1 bg-red-50 text-red-600 rounded-md border border-red-100 w-fit">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                                                    <span className="text-[9px] font-extrabold uppercase tracking-wider">Suspended</span>
                                                </div>
                                            ) : key.isActive ? (
                                                <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-50 text-emerald-600 rounded-md border border-emerald-100 w-fit">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                                    <span className="text-[9px] font-extrabold uppercase tracking-wider">Active</span>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 text-slate-400 rounded-md border border-slate-200 w-fit">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                                                    <span className="text-[9px] font-extrabold uppercase tracking-wider">Inactive</span>
                                                </div>
                                            )}
                                        </td>
                                        <td className="py-4 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                {key.isActive ? (
                                                    <button 
                                                        onClick={() => handleToggleKey(key.id, false)}
                                                        className="w-9 h-9 rounded-xl bg-amber-50 text-amber-500 hover:bg-amber-100 border border-amber-100 flex items-center justify-center"
                                                        title="Disable API Key"
                                                    >
                                                        <Lock className="h-4 w-4" />
                                                    </button>
                                                ) : (
                                                    <button 
                                                        onClick={() => handleToggleKey(key.id, true)}
                                                        className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-100 flex items-center justify-center"
                                                        title="Enable/Unlock API Key"
                                                    >
                                                        <Unlock className="h-4 w-4" />
                                                    </button>
                                                )}
                                                <button 
                                                    onClick={() => handleDeleteKey(key.id)}
                                                    className="w-9 h-9 rounded-xl bg-red-50 text-red-400 hover:bg-red-100 border border-red-100 flex items-center justify-center"
                                                    title="Revoke / Delete Key"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {keys.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="py-12 text-center text-sm text-slate-400 uppercase font-bold tracking-widest">
                                            No Integration Keys registered.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB 3: SECURITY INCIDENTS */}
            {activeTab === "incidents" && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-12">
                    {/* Incidents Timeline */}
                    <div className="lg:col-span-2 space-y-4">
                        {incidents.map((inc) => (
                            <div 
                                key={inc.id} 
                                onClick={() => handleOpenIncidentDetails(inc.id)}
                                className={cn(
                                    "bg-white border rounded-2xl p-6 cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 flex flex-col gap-4 relative overflow-hidden group",
                                    selectedIncident?.id === inc.id ? "border-emerald-500 ring-2 ring-emerald-500/10" : "border-slate-100"
                                )}
                            >
                                {/* Left glowing severity marker */}
                                <div className={cn(
                                    "absolute left-0 top-0 h-full w-1.5",
                                    inc.severity === "P0" ? "bg-red-500" :
                                    inc.severity === "P1" ? "bg-amber-500" :
                                    "bg-blue-500"
                                )} />

                                <div className="flex items-start justify-between pl-2">
                                    <div className="space-y-1">
                                        <span className={cn(
                                            "text-[9px] font-black px-2 py-0.5 rounded border uppercase tracking-wider font-mono",
                                            inc.severity === "P0" ? "text-red-600 bg-red-50 border-red-100 animate-pulse" :
                                            inc.severity === "P1" ? "text-amber-600 bg-amber-50 border-amber-100" :
                                            "text-blue-600 bg-blue-50 border-blue-100"
                                        )}>
                                            {inc.severity} Severity
                                        </span>
                                        <h4 className="text-md font-extrabold text-slate-800 uppercase tracking-tight group-hover:text-emerald-600 transition-colors mt-2">{inc.title}</h4>
                                    </div>
                                    <span className="text-[10px] text-slate-400 font-mono">{new Date(inc.createdAt).toLocaleTimeString()}</span>
                                </div>

                                <div className="flex items-center justify-between pl-2 pt-2 border-t border-slate-50 mt-auto text-xs">
                                    <div className="flex items-center gap-4">
                                        <span className="text-slate-400">Status: <span className="font-bold text-slate-700 uppercase">{inc.status}</span></span>
                                        <span className="text-slate-400">Assigned: <span className="font-bold text-slate-700">{inc.assignedTo?.name || "Unassigned"}</span></span>
                                    </div>
                                    
                                    {/* SLA display */}
                                    <div className="flex items-center gap-1.5">
                                        <Clock className="h-3.5 w-3.5 text-slate-400" />
                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">SLA Left:</span>
                                        <SlaTimer deadline={inc.slaDeadline} status={inc.status} />
                                    </div>
                                </div>
                            </div>
                        ))}
                        {incidents.length === 0 && (
                            <div className="bg-white border border-slate-100 rounded-2xl h-80 flex flex-col items-center justify-center gap-4 text-center p-8">
                                <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-500 shadow-inner">
                                    <Shield className="h-8 w-8 animate-pulse" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Network Shield Active</p>
                                    <p className="text-xs text-slate-400 mt-1">Zero security incidents or intrusion anomalies logged.</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Investigation & Mitigation Center */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm h-fit space-y-6">
                        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-tight pb-4 border-b border-slate-100 flex items-center gap-2">
                            <Terminal className="h-4 w-4 text-slate-400 animate-pulse" />
                            Investigation Console
                        </h3>

                        {selectedIncident ? (
                            <div className="space-y-6 animate-in fade-in duration-300">
                                {/* Title and Details */}
                                <div>
                                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Active Incident</h4>
                                    <p className="text-sm font-black text-slate-800 uppercase tracking-tight">{selectedIncident.title}</p>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl">
                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">Mitigation Status</span>
                                        <select 
                                            className="w-full bg-transparent border-none outline-none text-xs font-bold text-slate-800 uppercase mt-1 cursor-pointer"
                                            value={mitigationFormData.status}
                                            onChange={(e) => setMitigationFormData({...mitigationFormData, status: e.target.value})}
                                        >
                                            <option value="OPEN">Open</option>
                                            <option value="ACKNOWLEDGED">Acknowledged</option>
                                            <option value="INVESTIGATING">Investigating</option>
                                            <option value="MITIGATED">Mitigated</option>
                                            <option value="RESOLVED">Resolved</option>
                                            <option value="CLOSED">Closed</option>
                                        </select>
                                    </div>
                                    <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl">
                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">Assignee</span>
                                        <select 
                                            className="w-full bg-transparent border-none outline-none text-xs font-bold text-slate-800 uppercase mt-1 cursor-pointer"
                                            value={mitigationFormData.assignedToId}
                                            onChange={(e) => setMitigationFormData({...mitigationFormData, assignedToId: e.target.value})}
                                        >
                                            <option value="">Unassigned</option>
                                            {users.filter(u => u.role === "ADMIN" || u.role === "SUPER_ADMIN" || u.role === "MANAGER").map(u => (
                                                <option key={u.id} value={u.id}>{u.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* Threat Payload Snippet */}
                                {investigationProof && (
                                    <div className="space-y-2">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Intrusion Evidence</span>
                                        <pre className="bg-slate-955 text-emerald-400 p-4 rounded-xl text-[10px] font-mono overflow-x-auto whitespace-pre-wrap max-h-36 border border-slate-900 shadow-inner leading-relaxed">
                                            {JSON.stringify(investigationProof, null, 2)}
                                        </pre>
                                    </div>
                                )}

                                {/* Root Cause & Resolution Summaries */}
                                <div className="space-y-4">
                                    <div className="space-y-1.5 group">
                                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest px-1">Root Cause Analysis</label>
                                        <textarea 
                                            className="w-full h-16 bg-white rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 transition-all placeholder:text-slate-300 resize-none"
                                            placeholder="Summarize threat origin..."
                                            value={mitigationFormData.rootCause}
                                            onChange={(e) => setMitigationFormData({...mitigationFormData, rootCause: e.target.value})}
                                        />
                                    </div>
                                    <div className="space-y-1.5 group">
                                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest px-1">Resolution Actions Summary</label>
                                        <textarea 
                                            className="w-full h-16 bg-white rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 transition-all placeholder:text-slate-300 resize-none"
                                            placeholder="Detail actions taken to resolve..."
                                            value={mitigationFormData.resolution}
                                            onChange={(e) => setMitigationFormData({...mitigationFormData, resolution: e.target.value})}
                                        />
                                    </div>
                                </div>

                                {/* Internal investigation comments log */}
                                <div className="space-y-4 pt-4 border-t border-slate-100">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Team Investigation Log</span>
                                    
                                    {/* Comments list */}
                                    <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                                        {selectedIncident.comments?.map((comment: any) => (
                                            <div key={comment.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs space-y-1">
                                                <div className="flex items-center justify-between text-[9px] font-bold text-slate-400 uppercase">
                                                    <span>{comment.author?.name}</span>
                                                    <span>{new Date(comment.createdAt).toLocaleTimeString()}</span>
                                                </div>
                                                <p className="text-slate-700 font-medium">{comment.content}</p>
                                            </div>
                                        ))}
                                        {(!selectedIncident.comments || selectedIncident.comments.length === 0) && (
                                            <p className="text-[10px] text-slate-300 italic py-2">No comments logged in investigation timeline yet.</p>
                                        )}
                                    </div>

                                    {/* Add Comment input */}
                                    <div className="flex gap-2 relative">
                                        <input 
                                            className="w-full h-10 bg-slate-50 rounded-xl border border-slate-200 pl-4 pr-10 text-xs font-medium text-slate-800 outline-none focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 transition-all"
                                            placeholder="Log investigation note..."
                                            value={commentText}
                                            onChange={(e) => setCommentText(e.target.value)}
                                            onKeyDown={(e) => e.key === "Enter" && handleAddComment()}
                                        />
                                        <button 
                                            onClick={handleAddComment}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-emerald-600 transition-colors"
                                        >
                                            <Send className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>

                                <button 
                                    onClick={handleSaveIncidentMitigation}
                                    className="w-full h-12 bg-slate-900 hover:bg-emerald-600 text-white rounded-xl font-bold text-sm shadow-sm flex items-center justify-center gap-2 active:scale-95 transition-all"
                                >
                                    <Save className="h-4 w-4" />
                                    Synchronize Records
                                </button>
                            </div>
                        ) : (
                            <div className="text-center py-12 text-slate-300 text-xs font-bold uppercase tracking-widest italic animate-pulse">
                                Select an active incident to launch investigation console
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* TAB 4: API DOCUMENTATION */}
            {activeTab === "docs" && (
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 pb-12 animate-in fade-in duration-300">
                    {/* Left Pane Endpoints Menu */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm h-fit space-y-4">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2">API Route Map</span>
                        
                        <div className="space-y-1.5 max-h-[calc(100vh-22rem)] overflow-y-auto pr-1">
                            {API_DOCS.map((doc) => (
                                <button
                                    key={doc.id}
                                    onClick={() => setSelectedDocId(doc.id)}
                                    className={cn(
                                        "w-full flex flex-col items-start gap-1 p-3 rounded-xl transition-all duration-200 text-left border",
                                        selectedDocId === doc.id 
                                            ? "bg-slate-900 border-slate-900 shadow-md" 
                                            : "hover:bg-slate-50 border-slate-100"
                                    )}
                                >
                                    <div className="flex items-center gap-2">
                                        <span className={cn(
                                            "text-[8px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider",
                                            doc.method === "GET" ? "text-blue-600 bg-blue-50 border border-blue-100" :
                                            doc.method === "POST" ? "text-emerald-600 bg-emerald-50 border border-emerald-100" :
                                            "text-amber-600 bg-amber-50 border border-amber-100"
                                        )}>
                                            {doc.method}
                                        </span>
                                        <span className={cn(
                                            "text-[9px] font-bold uppercase tracking-wider",
                                            selectedDocId === doc.id ? "text-slate-400" : "text-slate-400"
                                        )}>
                                            {doc.category}
                                        </span>
                                    </div>
                                    <code className={cn(
                                        "text-[10px] font-mono font-bold leading-tight block break-all mt-1",
                                        selectedDocId === doc.id ? "text-emerald-400" : "text-slate-700"
                                    )}>
                                        {doc.path}
                                    </code>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Right Pane Documentation Detail */}
                    <div className="lg:col-span-3 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
                        {/* Dynamic Base URL Selector */}
                        <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="space-y-1">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none block">Target API Server Base URL</span>
                                <p className="text-xs text-slate-500 font-medium">Toggle between localized local environments or custom production endpoints.</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <select 
                                    className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-emerald-500 cursor-pointer"
                                    value={apiBaseUrl}
                                    onChange={(e) => setApiBaseUrl(e.target.value)}
                                >
                                    <option value="http://localhost:5000">Development Localhost (5000)</option>
                                    <option value="https://api.bookmyveg.com">Production API Node (AWS)</option>
                                    <option value="custom">Custom Server Domain</option>
                                </select>
                                {apiBaseUrl !== "http://localhost:5000" && apiBaseUrl !== "https://api.bookmyveg.com" && (
                                    <input 
                                        className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-emerald-500 w-44"
                                        placeholder="https://your-domain.com"
                                        value={apiBaseUrl === "custom" ? "" : apiBaseUrl}
                                        onChange={(e) => setApiBaseUrl(e.target.value || "custom")}
                                    />
                                )}
                            </div>
                        </div>

                        {/* URL and badges */}
                        <div className="pb-6 border-b border-slate-100 space-y-3">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                                <div className="flex items-center gap-3">
                                    <span className={cn(
                                        "text-[10px] font-black px-3 py-1 rounded border uppercase tracking-wider",
                                        selectedDoc.method === "GET" ? "text-blue-600 bg-blue-50 border-blue-100" :
                                        selectedDoc.method === "POST" ? "text-emerald-600 bg-emerald-50 border-emerald-100" :
                                        "text-amber-600 bg-amber-50 border-amber-100"
                                    )}>
                                        {selectedDoc.method}
                                    </span>
                                    <code className="text-xs font-bold text-slate-800 font-mono select-all break-all bg-slate-50 border border-slate-100 px-3 py-1 rounded-lg">
                                        {apiBaseUrl === "custom" ? "" : apiBaseUrl}{selectedDoc.path}
                                    </code>
                                </div>
                                <button 
                                    onClick={() => handleCopyToClipboard((apiBaseUrl === "custom" ? "" : apiBaseUrl) + selectedDoc.path, selectedDoc.id + "_url")}
                                    className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 uppercase tracking-wider flex items-center gap-1 transition-all"
                                >
                                    {copiedId === selectedDoc.id + "_url" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                                    Copy Endpoint URL
                                </button>
                            </div>
                            <p className="text-sm text-slate-500 leading-relaxed">{selectedDoc.description}</p>
                        </div>

                        {/* Integration parameters */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-2">
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none block">Required HTTP Headers</span>
                                <div className="space-y-1 mt-2 text-xs font-bold font-mono">
                                    <p className="text-slate-800"><span className="text-slate-400">Content-Type:</span> application/json</p>
                                    <p className="text-slate-800"><span className="text-slate-400">x-api-key:</span> &lt;your_secret_api_key&gt;</p>
                                </div>
                            </div>
                            <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-2">
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none block">Integration Limits</span>
                                <div className="space-y-1 mt-2 text-xs font-bold font-mono text-slate-800">
                                    <p><span className="text-slate-400">Rate Limit:</span> 100 requests / minute</p>
                                    <p><span className="text-slate-400">Flood Limit:</span> 200 requests / minute (Auto-Suspends)</p>
                                </div>
                            </div>
                        </div>

                        {/* cURL Integration Code Block */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between px-1">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">cURL Command Ingestion</span>
                                <button 
                                    onClick={() => handleCopyToClipboard(selectedDoc.curl.replace("http://localhost:5000", apiBaseUrl === "custom" ? "https://api.yourdomain.com" : apiBaseUrl), selectedDoc.id + "_curl")}
                                    className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 uppercase tracking-wider flex items-center gap-1 transition-all"
                                >
                                    {copiedId === selectedDoc.id + "_curl" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                                    Copy Code
                                </button>
                            </div>
                            <pre className="bg-slate-900 text-slate-300 p-4 rounded-xl text-[10px] font-mono overflow-x-auto whitespace-pre-wrap border border-slate-800 shadow-inner leading-relaxed select-all">
                                {selectedDoc.curl.replace("http://localhost:5000", apiBaseUrl === "custom" ? "https://api.yourdomain.com" : apiBaseUrl)}
                            </pre>
                        </div>

                        {/* Request & Response Bodies */}
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
                            {/* Request JSON */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between px-1">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sample Request JSON</span>
                                    {selectedDoc.method !== "GET" && (
                                        <button 
                                            onClick={() => handleCopyToClipboard(selectedDoc.reqBody, selectedDoc.id + "_req")}
                                            className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 uppercase tracking-wider flex items-center gap-1 transition-all"
                                        >
                                            {copiedId === selectedDoc.id + "_req" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                                            Copy JSON
                                        </button>
                                    )}
                                </div>
                                <pre className="bg-slate-900 text-emerald-400 p-4 rounded-xl text-[10px] font-mono overflow-x-auto whitespace-pre-wrap max-h-72 border border-slate-800 shadow-inner leading-relaxed">
                                    {selectedDoc.reqBody}
                                </pre>
                            </div>

                            {/* Response JSON */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between px-1">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Expected Response JSON</span>
                                    <button 
                                        onClick={() => handleCopyToClipboard(selectedDoc.resBody, selectedDoc.id + "_res")}
                                        className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 uppercase tracking-wider flex items-center gap-1 transition-all"
                                    >
                                        {copiedId === selectedDoc.id + "_res" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                                        Copy JSON
                                    </button>
                                </div>
                                <pre className="bg-slate-950 text-slate-300 p-4 rounded-xl text-[10px] font-mono overflow-x-auto whitespace-pre-wrap max-h-72 border border-slate-900 shadow-inner leading-relaxed">
                                    {selectedDoc.resBody}
                                </pre>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
