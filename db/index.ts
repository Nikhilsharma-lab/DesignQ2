// `db` is the privileged/system DB path.
// Normal authenticated request flows should migrate to `withUserDb()` over time.
import { systemDb } from "./system";

export const db = systemDb;
export * from "./schema";
