import type { User } from "@supabase/supabase-js";
import { eq } from "drizzle-orm";
import { profiles, type Profile } from "@/db/schema";
import type { UserDb } from "@/db/user";
import { withUserDb } from "@/db/user";
import { createClient } from "@/lib/supabase/server";

export interface AuthContextError {
  error: string;
  status: number;
}

export interface AuthContext {
  user: User;
  profile: Profile;
  db: UserDb;
}

export async function withAuthContext<T>(
  fn: (ctx: AuthContext) => Promise<T>,
): Promise<T | AuthContextError> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized", status: 401 };
  }

  return withUserDb(user.id, async (db) => {
    const [profile] = await db.select().from(profiles).where(eq(profiles.id, user.id));
    if (!profile) {
      return { error: "Profile not found", status: 404 };
    }

    return fn({ user, profile, db });
  });
}

export function isAuthContextError(value: unknown): value is AuthContextError {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    "status" in value
  );
}
