import postgres from "postgres";
import { readFileSync } from "fs";

const env = readFileSync(".env.local", "utf8");
for (const line of env.split("\n")) {
  const [key, ...rest] = line.split("=");
  if (key && rest.length) process.env[key.trim()] = rest.join("=").trim();
}

const sql = postgres(process.env.DATABASE_URL, { prepare: false });

try {
  await sql`
    ALTER TABLE "request_ai_analysis"
    ADD COLUMN IF NOT EXISTS "potential_duplicates" jsonb NOT NULL DEFAULT '[]'::jsonb
  `;
  console.log("✓ potential_duplicates column added to request_ai_analysis");
} catch (err) {
  console.error("Error:", err.message);
} finally {
  await sql.end();
}
