import { Response, Request, NextFunction } from "express";
/**
 * middleware for doing role-based permissions
 * @param allowed allowed roles
 * @param redirect redirect route if role is not permitted
 */
export function permit(allowed: string[], redirect: string = "/") {

    const isAllowed = (role: string) => allowed.indexOf(role) > -1;

    return (req: Request, res: Response, next: NextFunction) => {

        res.locals.authentication.role.array.forEach((role: string) => {
            if (isAllowed(role))
                return next();
        });

        return res.redirect(redirect);
    };
}

