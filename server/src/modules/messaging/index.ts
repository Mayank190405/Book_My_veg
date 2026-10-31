/**
 * Book My Veg — Messaging Module Exports
 */

export * from "./domain/notification.types";
export * from "./domain/notification.events";
export * from "./domain/notification.policies";

export * from "./templates/template-registry";
export * from "./templates/template-mapper";
export * from "./templates/template-validator";

export * from "./infrastructure/providers/whatsapp-provider.interface";
export * from "./infrastructure/providers/mbg-whatsapp.provider";
export * from "./infrastructure/repositories/notification.repository";

export * from "./policies/cooldown.policy";
export * from "./policies/idempotency.policy";
export * from "./policies/authorization.policy";
export * from "./policies/channel.policy";

export * from "./application/recipient.service";
export * from "./application/notification-dispatcher.service";
export * from "./application/reminder.service";
export * from "./application/template.service";
export * from "./application/notification.service";

export * from "./api/messaging.schemas";
export * from "./api/messaging.controller";
export { default as messagingRoutes } from "./api/messaging.routes";

/**
 * Legacy stub for backward compatibility
 */
export const getConversation = async (_phone: string): Promise<any> => {
    return null;
};


