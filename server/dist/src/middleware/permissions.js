"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requirePermission = exports.RolePermissions = void 0;
/**
 * Role-to-Permission Mapping
 */
exports.RolePermissions = {
    ADMIN: [
        "manage_all_stores", "view_global_analytics", "manage_users_global",
        "manage_store_inventory", "manage_store_users", "view_store_finance",
        "create_order", "manage_customer", "inventory:read", "inventory:write", "pos:operate",
        "assign_packer", "update_order_packing", "update_delivery_status"
    ],
    STORE_ADMIN: [
        "manage_store_inventory", "manage_store_users", "view_store_finance",
        "inventory:read", "inventory:write", "pos:operate", "assign_packer",
        "update_order_packing", "update_delivery_status"
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
const requirePermission = (permission) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        const userPermissions = exports.RolePermissions[req.user.role] || [];
        if (!userPermissions.includes(permission)) {
            return res.status(403).json({
                message: `Forbidden: Missing required permission '${permission}'`
            });
        }
        next();
    };
};
exports.requirePermission = requirePermission;
