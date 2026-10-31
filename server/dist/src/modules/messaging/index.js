"use strict";
/**
 * Book My Veg — Messaging Module Exports
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
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
exports.getConversation = exports.messagingRoutes = void 0;
__exportStar(require("./domain/notification.types"), exports);
__exportStar(require("./domain/notification.events"), exports);
__exportStar(require("./domain/notification.policies"), exports);
__exportStar(require("./templates/template-registry"), exports);
__exportStar(require("./templates/template-mapper"), exports);
__exportStar(require("./templates/template-validator"), exports);
__exportStar(require("./infrastructure/providers/whatsapp-provider.interface"), exports);
__exportStar(require("./infrastructure/providers/mbg-whatsapp.provider"), exports);
__exportStar(require("./infrastructure/repositories/notification.repository"), exports);
__exportStar(require("./policies/cooldown.policy"), exports);
__exportStar(require("./policies/idempotency.policy"), exports);
__exportStar(require("./policies/authorization.policy"), exports);
__exportStar(require("./policies/channel.policy"), exports);
__exportStar(require("./application/recipient.service"), exports);
__exportStar(require("./application/notification-dispatcher.service"), exports);
__exportStar(require("./application/reminder.service"), exports);
__exportStar(require("./application/template.service"), exports);
__exportStar(require("./application/notification.service"), exports);
__exportStar(require("./api/messaging.schemas"), exports);
__exportStar(require("./api/messaging.controller"), exports);
var messaging_routes_1 = require("./api/messaging.routes");
Object.defineProperty(exports, "messagingRoutes", { enumerable: true, get: function () { return __importDefault(messaging_routes_1).default; } });
/**
 * Legacy stub for backward compatibility
 */
const getConversation = (_phone) => __awaiter(void 0, void 0, void 0, function* () {
    return null;
});
exports.getConversation = getConversation;
