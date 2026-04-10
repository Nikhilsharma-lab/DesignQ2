import { drizzle } from "drizzle-orm/postgres-js";
import postgres, { type Sql, type TransactionSql } from "postgres";
import * as schema from "./schema";
import { systemSql } from "./system";

type LaneSchema = typeof schema;
export type UserDb = ReturnType<typeof drizzle<LaneSchema>>;
export type SessionDb = UserDb;

interface SessionOptions {
  userId?: string | null;
  inviteToken?: string | null;
}

function createUserDb(sql: TransactionSql): UserDb {
  return drizzle(sql as unknown as Sql, { schema });
}

// ⚠️  TRANSACTION CONSTRAINT: `withDbSession` wraps the entire callback in a
// single Postgres transaction (via systemSql.begin). This means the DB connection
// is held open for the full duration of `fn`, including any awaited I/O.
//
// For routes that make external API calls (Claude, Figma, Resend, etc.),
// use `withUserSession()` instead — it sets session-level RLS config on a
// dedicated connection without a wrapping transaction.
export async function withDbSession<T>(
  options: SessionOptions,
  fn: (db: SessionDb) => Promise<T>,
): Promise<T> {
  return systemSql.begin(async (sql) => {
    const tx = sql as unknown as Sql;

    if (options.userId) {
      await tx`select set_config('app.current_user_id', ${options.userId}, true)`;
    }
    if (options.inviteToken) {
      await tx`select set_config('app.invite_token', ${options.inviteToken}, true)`;
    }
    return fn(createUserDb(sql));
  }) as Promise<T>;
}

export async function withUserDb<T>(
  userId: string,
  fn: (db: UserDb) => Promise<T>,
): Promise<T> {
  return withDbSession({ userId }, fn);
}

export async function withOptionalUserDb<T>(
  userId: string | null | undefined,
  fn: (db: UserDb) => Promise<T>,
): Promise<T> {
  return withDbSession({ userId }, fn);
}

export async function withInviteDb<T>(
  inviteToken: string,
  fn: (db: SessionDb) => Promise<T>,
): Promise<T> {
  return withDbSession({ inviteToken }, fn);
}

export async function withUserInviteDb<T>(
  userId: string,
  inviteToken: string,
  fn: (db: SessionDb) => Promise<T>,
): Promise<T> {
  return withDbSession({ userId, inviteToken }, fn);
}

/**
 * Session-level RLS identity — no wrapping transaction.
 * Safe for routes that make external API calls (AI, Figma, Resend).
 * Creates a dedicated connection, sets session config, runs callback, closes connection.
 *
 * Use this instead of `withUserDb` when the callback awaits external I/O that
 * could hold a connection open for seconds (e.g. Claude API, Figma API, Resend).
 */
export async function withUserSession<T>(
  userId: string,
  fn: (db: SessionDb) => Promise<T>,
): Promise<T> {
  const dedicatedSql = postgres(process.env.DATABASE_URL!, {
    prepare: false,
    max: 1,
    idle_timeout: 5,
    connect_timeout: 10,
  });

  try {
    // set_config(..., false) = session-level (persists for connection lifetime),
    // unlike set_config(..., true) which is transaction-local.
    await dedicatedSql`select set_config('app.current_user_id', ${userId}, false)`;
    const db = drizzle(dedicatedSql as unknown as Sql, { schema });
    return await fn(db);
  } finally {
    await dedicatedSql.end();
  }
}

/**
 * Like `withUserSession`, but falls back to systemDb when no userId is provided.
 * Useful for routes that may or may not have a user context.
 */
export async function withOptionalUserSession<T>(
  userId: string | null | undefined,
  fn: (db: SessionDb) => Promise<T>,
): Promise<T> {
  if (!userId) {
    const { systemDb } = await import("./system");
    return fn(systemDb as unknown as SessionDb);
  }
  return withUserSession(userId, fn);
}
