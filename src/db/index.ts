import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { db?: ReturnType<typeof drizzle>; pgClient?: ReturnType<typeof postgres> };

if (!globalForDb.pgClient) {
  globalForDb.pgClient = postgres(process.env.DATABASE_URL!, { max: 10 });
}

if (!globalForDb.db) {
  globalForDb.db = drizzle(globalForDb.pgClient, { schema });
}

export const db = globalForDb.db;
