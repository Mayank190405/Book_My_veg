
import { AsyncLocalStorage } from 'async_hooks';

export interface RequestContext {
    userId?: string;
    locationId?: string;
    role?: string;
}

export const context = new AsyncLocalStorage<RequestContext>();

export const getContext = () => context.getStore();

export const runWithContext = <T>(ctx: RequestContext, fn: () => T): T => {
    return context.run(ctx, fn);
};
