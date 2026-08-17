"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.bulkIngestUsers = exports.getDeliveryPartners = exports.updateUserAdmin = exports.createUserAdmin = exports.getUsersAdmin = exports.updateProfile = void 0;
const prisma_1 = __importDefault(require("../config/prisma"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const logger_1 = __importDefault(require("../utils/logger"));
const updateProfile = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
    const { name, email } = req.body;
    if (!userId)
        return res.status(401).json({ message: "Unauthorized" });
    try {
        // Validate email uniqueness if changing email
        if (email) {
            const existing = yield prisma_1.default.user.findUnique({ where: { email } });
            if (existing && existing.id !== userId) {
                return res.status(409).json({ message: "Email already in use" });
            }
        }
        const user = yield prisma_1.default.user.update({
            where: { id: userId },
            data: {
                name,
                email,
            },
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                role: true,
            }
        });
        res.json(user);
    }
    catch (error) {
        console.error("Error updating profile:", error);
        res.status(500).json({ message: "Error updating profile" });
    }
});
exports.updateProfile = updateProfile;
const getUsersAdmin = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const caller = req.user;
        const where = {};
        // Institutional Sovereignty: Hub Managers only see their own regional staff
        if ((caller === null || caller === void 0 ? void 0 : caller.role) === "STORE_ADMIN") {
            let targetLocationId = null;
            if (caller.userId.startsWith("STORE_")) {
                // Virtual Institutional User
                targetLocationId = caller.userId.replace("STORE_", "");
            }
            else {
                // Physical Admin User
                const admin = yield prisma_1.default.user.findUnique({ where: { id: caller.userId } });
                targetLocationId = admin === null || admin === void 0 ? void 0 : admin.locationId;
            }
            if (targetLocationId) {
                where.locationId = targetLocationId;
            }
            else {
                return res.json([]);
            }
        }
        const users = yield prisma_1.default.user.findMany({
            where,
            include: {
                location: { select: { id: true, name: true } },
                orders: { select: { id: true } },
                addresses: { where: { isDefault: true }, take: 1 }
            },
            orderBy: { createdAt: "desc" }
        });
        res.json(users);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.getUsersAdmin = getUsersAdmin;
const createUserAdmin = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { phone, name, email, role, locationId, password, baseSalary, joiningDate } = req.body;
    const caller = req.user;
    try {
        // Validation: Hub Managers can only create staff for their own hub
        let targetLocationId = locationId;
        if ((caller === null || caller === void 0 ? void 0 : caller.role) === "STORE_ADMIN") {
            if (caller.userId.startsWith("STORE_")) {
                // Virtual Institutional User
                targetLocationId = caller.userId.replace("STORE_", "");
            }
            else {
                // Physical Admin User
                const admin = yield prisma_1.default.user.findUnique({ where: { id: caller.userId } });
                targetLocationId = admin === null || admin === void 0 ? void 0 : admin.locationId;
            }
            // Restrict roles a Hub Manager can grant
            const allowedRoles = ["PACKING", "DELIVERY_PARTNER", "POS_OPERATOR", "USER", "MANAGER", "PURCHASE_MANAGER"];
            if (!allowedRoles.includes(role)) {
                return res.status(403).json({ message: "Hub Managers can only onboard Operators, Packers, and Drivers." });
            }
        }
        const hashedPassword = password ? yield bcryptjs_1.default.hash(password, 10) : undefined;
        const user = yield prisma_1.default.user.create({
            data: {
                phone,
                name,
                email,
                role,
                locationId: targetLocationId,
                password: hashedPassword,
                isActive: true,
                baseSalary: baseSalary ? parseFloat(baseSalary) : null,
                joiningDate: joiningDate ? new Date(joiningDate) : null
            },
            include: {
                location: { select: { id: true, name: true } }
            }
        });
        res.status(201).json(user);
    }
    catch (error) {
        if (error.code === 'P2002')
            return res.status(409).json({ message: "Phone number already registered in merchandise grid." });
        res.status(500).json({ error: error.message });
    }
});
exports.createUserAdmin = createUserAdmin;
const updateUserAdmin = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const { role, locationId, password, isActive, name, email, baseSalary, joiningDate } = req.body;
    const caller = req.user;
    try {
        // Institutional Sovereignty Check
        const targetUser = yield prisma_1.default.user.findUnique({ where: { id: id } });
        if (!targetUser)
            return res.status(404).json({ message: "Staff record not found." });
        if ((caller === null || caller === void 0 ? void 0 : caller.role) === "STORE_ADMIN") {
            let adminLocationId = null;
            if (caller.userId.startsWith("STORE_")) {
                adminLocationId = caller.userId.replace("STORE_", "");
            }
            else {
                const admin = yield prisma_1.default.user.findUnique({ where: { id: caller.userId } });
                adminLocationId = admin === null || admin === void 0 ? void 0 : admin.locationId;
            }
            // Managers can only edit staff assigned to their own regional hub
            if (targetUser.locationId !== adminLocationId || (locationId && locationId !== adminLocationId)) {
                return res.status(403).json({ message: "Hub managers are restricted to managing local hub staff only." });
            }
            // Restrict role elevation during update
            const restrictedRoles = ["ADMIN", "STORE_ADMIN", "CENTER_HEAD"];
            if (role && restrictedRoles.includes(role)) {
                return res.status(403).json({ message: "Access level orchestration restricted for this role profile." });
            }
        }
        let hashedPassword = undefined;
        if (password && String(password).trim().length > 0) {
            hashedPassword = yield bcryptjs_1.default.hash(String(password).trim(), 10);
        }
        // Clean email value (convert empty strings to null or omit to avoid P2002 unique error)
        const cleanEmail = (email !== undefined && String(email).trim().length > 0) ? String(email).trim() : (email === "" ? null : undefined);
        // Clean joiningDate (check for valid date string)
        let parsedJoiningDate = undefined;
        if (joiningDate !== undefined) {
            if (!joiningDate) {
                parsedJoiningDate = null;
            }
            else {
                const d = new Date(joiningDate);
                if (!isNaN(d.getTime())) {
                    parsedJoiningDate = d;
                }
            }
        }
        const updateData = {};
        if (role)
            updateData.role = role;
        if ((caller === null || caller === void 0 ? void 0 : caller.role) !== "STORE_ADMIN" && locationId !== undefined) {
            updateData.locationId = locationId ? String(locationId) : null;
        }
        if (isActive !== undefined)
            updateData.isActive = Boolean(isActive);
        if (name !== undefined && String(name).trim().length > 0)
            updateData.name = String(name).trim();
        if (cleanEmail !== undefined)
            updateData.email = cleanEmail;
        if (parsedJoiningDate !== undefined)
            updateData.joiningDate = parsedJoiningDate;
        if (baseSalary !== undefined)
            updateData.baseSalary = baseSalary ? parseFloat(String(baseSalary)) : null;
        if (hashedPassword)
            updateData.password = hashedPassword;
        const user = yield prisma_1.default.user.update({
            where: { id: id },
            data: updateData,
            include: {
                location: { select: { id: true, name: true } }
            }
        });
        res.json(user);
    }
    catch (error) {
        logger_1.default.error(`[updateUserAdmin Error] User ID: ${id} -> ${error.message}`);
        if (error.code === 'P2002') {
            return res.status(409).json({ message: "Email or phone number already in use by another account." });
        }
        res.status(500).json({ error: error.message || "Failed to update user profile" });
    }
});
exports.updateUserAdmin = updateUserAdmin;
const getDeliveryPartners = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const drivers = yield prisma_1.default.user.findMany({
            where: { role: "DELIVERY_PARTNER", isActive: true },
            select: { id: true, name: true, phone: true },
            orderBy: { name: "asc" }
        });
        res.json(drivers);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.getDeliveryPartners = getDeliveryPartners;
const bulkIngestUsers = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { users } = req.body;
    const caller = req.user;
    if (!Array.isArray(users))
        return res.status(400).json({ message: "Invalid payload format." });
    try {
        let adminLocationId = null;
        if ((caller === null || caller === void 0 ? void 0 : caller.role) === "STORE_ADMIN") {
            if (caller.userId.startsWith("STORE_")) {
                adminLocationId = caller.userId.replace("STORE_", "");
            }
            else {
                const admin = yield prisma_1.default.user.findUnique({ where: { id: caller.userId } });
                adminLocationId = admin === null || admin === void 0 ? void 0 : admin.locationId;
            }
        }
        const results = { success: 0, updated: 0, failed: 0 };
        // Use a transaction for stability but process individually for granular upsert reporting
        // For very large sets (500+), consider Promise.all or chunking
        for (const userData of users) {
            try {
                const { phone, name, email, profileAddress, totalDue, role, locationId, isActive } = userData;
                // Isolation constraint
                const targetLocationId = adminLocationId || locationId || null;
                const user = yield prisma_1.default.user.upsert({
                    where: { phone: phone.toString() },
                    update: Object.assign({ name,
                        email,
                        profileAddress, totalDue: totalDue ? parseFloat(totalDue) : undefined, isActive: isActive !== undefined ? isActive : undefined }, ((caller === null || caller === void 0 ? void 0 : caller.role) === "ADMIN" && { role, locationId: targetLocationId })),
                    create: {
                        phone: phone.toString(),
                        name,
                        email,
                        profileAddress,
                        totalDue: totalDue ? parseFloat(totalDue) : 0,
                        role: role || "USER",
                        locationId: targetLocationId,
                        isActive: true,
                        password: userData.password || "user123"
                    }
                });
                // Check if it was an update or create (Prisma upsert doesn't tell directly without checking timestamps)
                results.success++;
            }
            catch (err) {
                console.error("Bulk Item Failure:", err);
                results.failed++;
            }
        }
        res.json(Object.assign({ message: "Bulk Ingestion Finalized." }, results));
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.bulkIngestUsers = bulkIngestUsers;
