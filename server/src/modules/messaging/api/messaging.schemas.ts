/**
 * Book My Veg — Messaging Zod Validation Schemas
 */

import { z } from "zod";

export const sendDueRemindersSchema = z.object({
    customerIds: z.array(z.string().min(1)).optional(),
    locationId: z.string().optional()
});

export const sendSingleOrderReminderSchema = z.object({
    orderId: z.string().min(1, "Order ID is required"),
    locationId: z.string().optional()
});

export const sendCustomTemplateSchema = z.object({
    phone: z.string().min(10, "Valid phone number is required"),
    templateName: z.string().min(1, "Template name is required"),
    variables: z.union([
        z.array(z.union([z.string(), z.number()])),
        z.object({
            header: z.array(z.string()).optional(),
            body: z.array(z.union([z.string(), z.number()])).optional()
        })
    ]).optional(),
    dynamicMedia: z.string().url().optional()
});

export const sendChatHubFlowSchema = z.object({
    phone: z.string().min(10, "Valid phone number is required"),
    flowId: z.string().min(1, "Flow ID is required"),
    name: z.string().optional(),
    customFields: z.record(z.string()).optional()
});

