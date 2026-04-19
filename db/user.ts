import { drizzle } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";
import { sql as sqlt } from "drizzle-orm";
import * as schema from "./schema";
import { systemDb } from "./system";

type LaneSchema = typeof schema;
export type UserDb = ReturnType<typeof drizzle<LaneSchema>>;
export type SessionDb = UserDb;

/**
 * Picks the database URL for `withUserSession`.
 *
 * `withUserSession` sets a session-level GUC (`app.current_user_id`) outside
 * a transaction. Under Supabase's transaction-mode pooler (port 6543), which
 * this project uses for `systemDb`, session-level GUCs set outside a
 * transaction are unreliable — Supavisor may release the backend connection
 * between queries, dropping the setting.
 *
 * Fix: connect `withUserSession` via a session-pooler or direct connection
 * (typically port 5432) configured in `DIRECT_DATABASE_URL`. In production,
 * this env var is required; missing it throws rather than silently running
 * with unreliable RLS identity.
 */
export function selectUserSessionDatabaseUrl(env: {
  DIRECT_DATABASE_URL?: string;
  DATABASE_URL?: string;
  NODE_ENV?: string;
}): string {
  if (env.DIRECT_DATABASE_URL) return env.DIRECT_DATABASE_URL;
  if (env.NODE_ENV === "production") {
    throw new Error(
      "[db/user] DIRECT_DATABASE_URL is required in production. " +
        "withUserSession uses session-level GUCs for RLS identity, which are " +
        "unreliable under Supabase's transaction-mode pooler. Set " +
        "DIRECT_DATABASE_URL to a session-pooler or direct connection URL."
    );
  }
  if (!env.DATABASE_URL) {
    throw new Error(
      "[db/user] Neither DIRECT_DATABASE_URL nor DATABASE_URL is set."
    );
  }
  console.warn(
    "[db/user] DIRECT_DATABASE_URL not set, falling back to DATABASE_URL. " +
      "RLS identity via withUserSession may be unreliable under transaction pooling."
  );
  return env.DATABASE_URL;
}

interface SessionOptions {
  userId?: string | null;
  inviteToken?: string | null;
}

// ⚠️  TRANSACTION CONSTRAINT: `withDbSession` wraps the entire callback in a
// single Postgres transaction (via Drizzle's db.transaction()). The DB connection
// is held open for the full duration of `fn`, including any awaited I/O.
//
// For routes that make external API calls (Claude, Figma, Resend, etc.),
// use `withUserSession()` instead — it sets session-level RLS config on a
// dedicated connection without a wrapping transaction.
export async function withDbSession<T>(
  options: SessionOptions,
  fn: (db: SessionDb) => Promise<T>,
): Promise<T> {
  return systemDb.transaction(async (tx) => {
    if (options.userId) {
      await tx.execute(sqlt`select set_config('app.current_user_id', ${options.userId}, true)`);
    }
    if (options.inviteToken) {
      await tx.execute(sqlt`select set_config('app.invite_token', ${options.inviteToken}, true)`);
    }
    return fn(tx as unknown as SessionDb);
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
 *
 * Connection URL is resolved via {@link selectUserSessionDatabaseUrl}.
 * Production deployments MUST set `DIRECT_DATABASE_URL` — `DATABASE_URL`
 * points to the transaction-mode pooler, which silently drops session GUCs.
 */
export async function withUserSession<T>(
  userId: string,
  fn: (db: SessionDb) => Promise<T>,
): Promise<T> {
  const dedicatedSql = postgres(selectUserSessionDatabaseUrl(process.env), {
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
