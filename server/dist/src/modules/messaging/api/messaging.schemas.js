"use strict";
/**
 * Book My Veg — Messaging Zod Validation Schemas
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendChatHubFlowSchema = exports.sendCustomTemplateSchema = exports.sendSingleOrderReminderSchema = exports.sendDueRemindersSchema = void 0;
const zod_1 = require("zod");
exports.sendDueRemindersSchema = zod_1.z.object({
    customerIds: zod_1.z.array(zod_1.z.string().min(1)).optional(),
    locationId: zod_1.z.string().optional()
});
exports.sendSingleOrderReminderSchema = zod_1.z.object({
    orderId: zod_1.z.string().min(1, "Order ID is required"),
    locationId: zod_1.z.string().optional()
});
exports.sendCustomTemplateSchema = zod_1.z.object({
    phone: zod_1.z.string().min(10, "Valid phone number is required"),
    templateName: zod_1.z.string().min(1, "Template name is required"),
    variables: zod_1.z.union([
        zod_1.z.array(zod_1.z.union([zod_1.z.string(), zod_1.z.number()])),
        zod_1.z.object({
            header: zod_1.z.array(zod_1.z.string()).optional(),
            body: zod_1.z.array(zod_1.z.union([zod_1.z.string(), zod_1.z.number()])).optional()
        })
    ]).optional(),
    dynamicMedia: zod_1.z.string().url().optional()
});
exports.sendChatHubFlowSchema = zod_1.z.object({
    phone: zod_1.z.string().min(10, "Valid phone number is required"),
    flowId: zod_1.z.string().min(1, "Flow ID is required"),
    name: zod_1.z.string().optional(),
    customFields: zod_1.z.record(zod_1.z.string()).optional()
});
