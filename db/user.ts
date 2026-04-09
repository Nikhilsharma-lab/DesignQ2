import { drizzle } from "drizzle-orm/postgres-js";
import type { Sql, TransactionSql } from "postgres";
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
