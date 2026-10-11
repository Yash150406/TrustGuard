import { createDb, type DB } from "@trustguard/db";
import { env } from "./env";

const g = globalThis as unknown as { __db?: DB };
export const db = g.__db ?? createDb(env.DATABASE_URL);
if (process.env.NODE_ENV !== "production") g.__db = db;
