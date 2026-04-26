import { drizzle } from "drizzle-orm/d1";
import type { Env } from "../env";

// Drizzle wraps the D1 binding; it's cheap to construct, no pooling needed.
export const db = (env: Env) => drizzle(env.DB);
