"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runWithContext = exports.getContext = exports.context = void 0;
const async_hooks_1 = require("async_hooks");
exports.context = new async_hooks_1.AsyncLocalStorage();
const getContext = () => exports.context.getStore();
exports.getContext = getContext;
const runWithContext = (ctx, fn) => {
    return exports.context.run(ctx, fn);
};
exports.runWithContext = runWithContext;
