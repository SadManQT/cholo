import { env } from './env.js';

export const corsOptions = Object.freeze({
  origin: env.CLIENT_ORIGIN,
  credentials: true,
});
