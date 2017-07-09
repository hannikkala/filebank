declare module "is-invalid-path" {
  function isInvalidPath(path: string): boolean;
  export = isInvalidPath;
}

declare module "express-jwt-authz" {
  import express = require('express');
  function expressJwtAuthz(expectedScopes: string[]): express.RequestHandler;
  export = expressJwtAuthz;
}