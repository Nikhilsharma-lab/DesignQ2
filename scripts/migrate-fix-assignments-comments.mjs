import postgres from "postgres";
import { readFileSync } from "fs";

const env = readFileSync(".env.local", "utf8");
for (const line of env.split("\n")) {
  const [key, ...rest] = line.split("=");
  if (key && rest.length) process.env[key.trim()] = rest.join("=").trim();
}

const sql = postgres(process.env.DATABASE_URL, { prepare: false });

try {
  // Drop stale tables (old schema had idea_id/designer_id/content)
  await sql`DROP TABLE IF EXISTS "assignments" CASCADE`;
  console.log("✓ dropped old assignments");

  await sql`DROP TABLE IF EXISTS "comments" CASCADE`;
  console.log("✓ dropped old comments");

  // Recreate assignment_role enum if it exists from a previous bad state
  await sql`DROP TYPE IF EXISTS "assignment_role" CASCADE`;

  await sql`CREATE TYPE "assignment_role" AS ENUM ('lead', 'reviewer', 'contributor')`;

  await sql`
    CREATE TABLE "assignments" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "request_id" uuid NOT NULL REFERENCES "requests"("id") ON DELETE CASCADE,
      "assignee_id" uuid NOT NULL REFERENCES "profiles"("id"),
      "assigned_by_id" uuid REFERENCES "profiles"("id"),
      "role" assignment_role NOT NULL DEFAULT 'lead',
      "notes" text,
      "assigned_at" timestamp with time zone NOT NULL DEFAULT now()
    )
  `;
  console.log("✓ created assignments (request_id, assignee_id, role)");

  await sql`
    CREATE TABLE "comments" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "request_id" uuid NOT NULL REFERENCES "requests"("id") ON DELETE CASCADE,
      "author_id" uuid REFERENCES "profiles"("id"),
      "body" text NOT NULL,
      "is_system" boolean NOT NULL DEFAULT false,
      "created_at" timestamp with time zone NOT NULL DEFAULT now(),
      "updated_at" timestamp with time zone NOT NULL DEFAULT now()
    )
  `;
  console.log("✓ created comments (request_id, body, is_system)");

} catch (err) {
  console.error("Error:", err.message);
} finally {
  await sql.end();
}
