
import { Request, Response, NextFunction } from 'express';
import { runWithContext } from '../utils/context';

export const contextMiddleware = (req: any, res: Response, next: NextFunction) => {
    // If authenticate middleware has already run, it will have attached req.user
    const userId = req.user?.userId;
    const locationId = req.user?.locationId || (req.headers['x-location-id'] as string);
    const role = req.user?.role;

    runWithContext({ userId, locationId, role }, () => {
        next();
    });
};
