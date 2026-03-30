import postgres from "postgres";
import { readFileSync } from "fs";

const env = readFileSync(".env.local", "utf8");
for (const line of env.split("\n")) {
  const [key, ...rest] = line.split("=");
  if (key && rest.length) process.env[key.trim()] = rest.join("=").trim();
}

const sql = postgres(process.env.DATABASE_URL, { prepare: false });

try {
  // Enums (idempotent via DO blocks)
  await sql`
    DO $$ BEGIN
      CREATE TYPE assignment_role AS ENUM ('lead', 'reviewer', 'contributor');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS "assignments" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "request_id" uuid NOT NULL REFERENCES "requests"("id") ON DELETE CASCADE,
      "assignee_id" uuid NOT NULL REFERENCES "profiles"("id"),
      "assigned_by_id" uuid REFERENCES "profiles"("id"),
      "role" assignment_role NOT NULL DEFAULT 'lead',
      "notes" text,
      "assigned_at" timestamp with time zone NOT NULL DEFAULT now()
    )
  `;
  console.log("✓ assignments table ready");

  await sql`
    CREATE TABLE IF NOT EXISTS "request_stages" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "request_id" uuid NOT NULL REFERENCES "requests"("id") ON DELETE CASCADE,
      "stage" stage NOT NULL,
      "entered_at" timestamp with time zone NOT NULL DEFAULT now(),
      "completed_at" timestamp with time zone,
      "completed_by_id" uuid REFERENCES "profiles"("id"),
      "notes" text
    )
  `;
  console.log("✓ request_stages table ready");

} catch (err) {
  console.error("Error:", err.message);
} finally {
  await sql.end();
}
