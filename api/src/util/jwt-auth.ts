import * as jwt from 'express-jwt';
import { config } from '../config';

export = jwt({ secret: config.jwtKey });
