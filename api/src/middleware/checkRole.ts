import { Request, Response, NextFunction } from "express";

const error = (res: Response) => {
  return res.status(401).send("Insufficient scope");
};

export const checkRole = (expectedScopes: Array<string>) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = (<any>req).user;
    if (!user || typeof user.scope !== "string") {
      return error(res);
    }
    const scopes = user.scope.split(" ");
    const allowed = expectedScopes.some(function (scope) {
      return scopes.indexOf(scope) !== -1;
    });

    return allowed ? next() : error(res);
  };
};
