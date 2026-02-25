import { Response, NextFunction } from "express";
import { AuthRequest } from "./auth";

/**
 * Capability-based Permission Strings
 */
export type Permission =
    | "manage_all_stores"
    | "view_global_analytics"
    | "manage_users_global"
    | "manage_store_inventory"
    | "manage_store_users"
    | "view_store_finance"
    | "create_order"
    | "manage_customer"
    | "assign_packer"
    | "update_order_packing"
    | "update_delivery_status"
    | "inventory:read"
    | "inventory:write"
    | "pos:operate";

/**
 * Role-to-Permission Mapping
 */
export const RolePermissions: Record<string, Permission[]> = {
    SUPER_ADMIN: [
        "manage_all_stores", "view_global_analytics", "manage_users_global",
        "manage_store_inventory", "manage_store_users", "view_store_finance",
        "create_order", "manage_customer", "inventory:read", "inventory:write", "pos:operate"
    ],
    ADMIN: [
        "manage_all_stores", "view_global_analytics", "manage_users_global",
        "inventory:read", "inventory:write", "pos:operate"
    ],
    STORE_ADMIN: [
        "manage_store_inventory", "manage_store_users", "view_store_finance",
        "inventory:read", "inventory:write", "pos:operate"
    ],
    POS_OPERATOR: [
        "create_order", "manage_customer", "assign_packer", "view_store_finance",
        "inventory:read", "pos:operate"
    ],
    PACKING: [
        "update_order_packing"
    ],
    DELIVERY_PARTNER: [
        "update_delivery_status"
    ]
};

/**
 * Middleware to check if the user has a specific permission.
 */
export const requirePermission = (permission: Permission) => {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        if (!req.user) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const userPermissions = RolePermissions[req.user.role] || [];

        if (!userPermissions.includes(permission)) {
            return res.status(403).json({
                message: `Forbidden: Missing required permission '${permission}'`
            });
        }

        next();
    };
};
