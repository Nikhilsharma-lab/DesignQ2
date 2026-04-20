// Runs all test/sql/*.sql files against DIRECT_DATABASE_URL.
//
// Each file is expected to wrap itself in BEGIN/ROLLBACK and use the
// pg-tap protocol (plan(N), assertions, finish()). The runner captures
// every TAP line per file (both "ok N - desc" and "not ok N - desc")
// and prints them indented. Failures are detected by any TAP line
// starting with "not ok ". Exit code is non-zero on any failure.
//
// Usage:
//   npm run test:sql
//
// Env:
//   DIRECT_DATABASE_URL  preferred — session-mode connection
//   DATABASE_URL         fallback when DIRECT_DATABASE_URL is unset
//
// pg-tap is dev-only — see test/sql/README.md and
// docs/WORKING-RULES.md (Supabase connection strings section) for
// the contract that prevents these tests from running against prod.

import postgres from "postgres";
import { readFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";

const TEST_DIR = "test/sql";

const url = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error("ERROR: DIRECT_DATABASE_URL (or DATABASE_URL fallback) must be set.");
  process.exit(2);
}

// Production safety: production project ref should never be tested against.
// Project ref is public (visible in NEXT_PUBLIC_SUPABASE_URL) but serves as
// an unambiguous guard. Do not "clean this up" — it's intentional defensive
// code that catches misconfigured .env.local or CI env injection.
const PROD_PROJECT_REF = "dsivjzwalqqpojopcmyb";
if (url.includes(PROD_PROJECT_REF)) {
  console.error(`ERROR: DATABASE_URL points at production Supabase project (${PROD_PROJECT_REF}). Refusing to run tests.`);
  process.exit(2);
}

if (!existsSync(TEST_DIR)) {
  console.log(`No ${TEST_DIR}/ directory — 0 tests found.`);
  process.exit(0);
}

const files = readdirSync(TEST_DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort();

if (files.length === 0) {
  console.log(`0 tests found in ${TEST_DIR}/.`);
  process.exit(0);
}

console.log(`Running ${files.length} test file(s) from ${TEST_DIR}/...`);
console.log("");

// Indent every line of a multi-line string. pg-tap's ok() failures
// return multi-line strings, and some NOTICEs span lines — both need
// per-line indenting or only the first line gets the prefix.
function indentLines(text, prefix = "  ") {
  return text.split("\n").map((l) => prefix + l).join("\n");
}

// onnotice indents pg-tap's RAISE NOTICE diagnostics to align with TAP rows.
const sql = postgres(url, {
  max: 1,
  connect_timeout: 8,
  onnotice: (n) => process.stdout.write(indentLines(n.message) + "\n"),
});

let filesPassed = 0;
let filesFailed = 0;

// Walk a postgres-js result of arbitrary nesting depth and yield
// every leaf row. Multi-statement SQL via sql.unsafe() may return
// either a flat array of rows or an array of result-sets.
function* walkRows(result) {
  if (result == null) return;
  if (Array.isArray(result)) {
    for (const item of result) {
      if (item != null && typeof item === "object" && !Array.isArray(item)) {
        yield item;
      } else {
        yield* walkRows(item);
      }
    }
  } else if (typeof result === "object") {
    yield result;
  }
}

// Convert a postgres-js row to a TAP line. pg-tap typically emits
// rows with a single string-valued column. Anything else is
// surfaced as a diagnostic comment so it isn't silently dropped.
function rowToTapLine(row) {
  const values = Object.values(row);
  if (values.length === 1 && typeof values[0] === "string") {
    return values[0];
  }
  return `# unexpected row shape: ${JSON.stringify(row)}`;
}

for (const f of files) {
  const path = join(TEST_DIR, f);
  const sqlText = readFileSync(path, "utf8");

  console.log(`${f}:`);

  let tapLines = [];
  let executionError = null;

  try {
    const result = await sql.unsafe(sqlText);
    for (const row of walkRows(result)) {
      tapLines.push(rowToTapLine(row));
    }
  } catch (e) {
    executionError = e;
  }

  // Print every TAP line indented, regardless of pass/fail.
  // ok()'s failure output is multi-line; indent each sub-line so the
  // diagnostic ("# Failed test ...") aligns with the "not ok" row.
  for (const line of tapLines) {
    console.log(indentLines(line));
  }

  if (executionError) {
    console.log(`  ERROR: ${executionError.message}`);
    console.log(`  FAIL`);
    filesFailed++;
    console.log("");
    continue;
  }

  const failures = tapLines.filter((l) => l.startsWith("not ok "));
  const assertions = tapLines.filter((l) => /^(ok|not ok) \d+/.test(l));

  if (failures.length > 0) {
    console.log(`  FAIL (${failures.length} of ${assertions.length} assertion(s) failed)`);
    filesFailed++;
  } else {
    console.log(`  PASS (${assertions.length} assertion(s))`);
    filesPassed++;
  }
  console.log("");
}

await sql.end();

console.log(`Results: ${filesPassed} passed, ${filesFailed} failed, ${files.length} total.`);
process.exit(filesFailed === 0 ? 0 : 1);
