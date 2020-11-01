import jwt from "express-jwt";
import config from "../config/config";

export default jwt({ secret: config.get("jwtKey"), algorithms: ["HS256"] });
