import { drizzle } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";
import * as schema from "./schema";

type LaneSchema = typeof schema;

const g = global as unknown as {
  _systemSql?: Sql;
  _systemDb?: ReturnType<typeof drizzle<LaneSchema>>;
};

function createSqlClient() {
  // max: 3 matches Fluid Compute's instance pattern — each function instance
  // needs only a few concurrent connections, and many instances can spin up.
  // Paired with the transaction-mode pooler (port 6543), this avoids the
  // MaxClientsInSessionMode error hit on session-mode pooler + higher limits.
  return postgres(process.env.DATABASE_URL!, {
    prepare: false,
    max: 3,
    idle_timeout: 20,
    connect_timeout: 10,
  });
}

if (!g._systemSql) {
  g._systemSql = createSqlClient();
}

if (!g._systemDb) {
  g._systemDb = drizzle(g._systemSql, { schema });
}

export const systemSql = g._systemSql;
export const systemDb = g._systemDb;

export type SystemDb = typeof systemDb;
export type SystemSql = typeof systemSql;
