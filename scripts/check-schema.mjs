import postgres from "postgres";
import { readFileSync } from "fs";

const env = readFileSync(".env.local", "utf8");
for (const line of env.split("\n")) {
  const [key, ...rest] = line.split("=");
  if (key && rest.length) process.env[key.trim()] = rest.join("=").trim();
}

const sql = postgres(process.env.DATABASE_URL, { prepare: false });

try {
  const tables = await sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name
  `;
  console.log("Tables:", tables.map(t => t.table_name).join(", "));

  const cols = await sql`
    SELECT table_name, column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'assignments'
    ORDER BY ordinal_position
  `;
  console.log("\nassignments columns:");
  cols.forEach(c => console.log(`  ${c.column_name} (${c.data_type})`));
} catch (err) {
  console.error("Error:", err.message);
} finally {
  await sql.end();
}
