import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const shared = globalThis as unknown as { orselPool?: Pool };
const pool = (shared.orselPool ??= new Pool({ connectionString: process.env.DATABASE_URL, max: 8 }));

export const db = drizzle(pool, { schema });
export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export { schema };
export const closeDb = () => pool.end();
