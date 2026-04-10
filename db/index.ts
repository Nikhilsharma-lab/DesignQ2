// `db` is the privileged/system DB path — it bypasses all RLS policies.
//
// RLS-enforced alternatives (from db/user.ts):
//   withUserDb(userId, fn)      — transaction-wrapped, for short DB-only operations
//   withUserSession(userId, fn) — session-level, for routes with external API calls (AI, Figma, Resend)
//
// ⚠️  RLS ENFORCEMENT GAP: As of the 0005 migration, RLS policies are defined
// on all tables but are only enforced for routes that use the above helpers from
// `db/user.ts`. The ~52 routes that still import from `@/db` run as the system
// role and bypass RLS entirely — authorization for those routes is enforced only
// at the application layer. See GitHub issue #19.
import { systemDb } from "./system";

export const db = systemDb;
export * from "./schema";
