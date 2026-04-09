// `db` is the privileged/system DB path — it bypasses all RLS policies.
//
// ⚠️  RLS ENFORCEMENT GAP: As of the 0005 migration, RLS policies are defined
// on all tables but are only enforced for routes that use `withUserDb()` from
// `db/user.ts`. The ~52 routes that still import from `@/db` run as the system
// role and bypass RLS entirely — authorization for those routes is enforced only
// at the application layer.
//
// Before migrating a route to `withUserDb()`, read the constraint in db/user.ts:
// AI-calling routes MUST NOT be migrated until the transaction model is resolved.
import { systemDb } from "./system";

export const db = systemDb;
export * from "./schema";
