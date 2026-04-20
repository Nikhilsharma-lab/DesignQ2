# supabase/

Supabase-related artifacts that are NOT part of Drizzle's managed
schema (`db/schema/`) or migrations (`db/migrations/`). Currently
holds:

- `migrations/` — raw SQL migrations for things Drizzle doesn't
  manage (RLS policies, custom indexes, type evolution). Pre-existing
  before A3; one file: `20260412_nav_schema.sql`. Run manually after
  `npm run db:push` per its own header comment.
- `test-seed.sql` — shared test fixture (added in A3, see below).

## test-seed.sql

Deterministic test fixture per `docs/user-flows-spec.md` §15 Phase A3.
Creates a baseline of:

- 1 workspace (`Test Workspace`, slug `test-workspace`)
- 1 owner (`owner@e2e.lane.test`, profile role `lead`, access role `owner`)
- 1 admin (`admin@e2e.lane.test`, profile role `pm`, access role `admin`)
- 2 members (`member1@e2e.lane.test` designer, `member2@e2e.lane.test` developer)
- 1 pending invite to `invitee@e2e.lane.test` (token `test-invite-token-001`)

All fixture entities use predictable UUIDs (see the UUID scheme block
at the top of `test-seed.sql`) so tests can reference them by known
ID without a query roundtrip.

### Idempotency

The file wraps everything in `BEGIN`/`COMMIT` and starts with
DELETEs scoped to known fixture IDs and `@e2e.lane.test` emails.
Re-running is safe — never touches non-test data, never errors on
unique-key conflicts.

### Schema target

Targets the **CURRENT** `db/schema/` state — pre-Phase B. Once Phase B
migrations 0010-0013 land (audit_log, waitlist_approvals, invite team
scoping, profiles.left_at), this file gets a follow-up to seed those
new tables/columns. Each Phase B migration's pg-tap test file may also
extend the seed for its own scenarios; that's tests-parallel work, not
A3 scope.

### IMPORTANT: this file is NOT auto-applied anywhere yet

Applying it is the responsibility of whatever consumes it:

- **pg-tap tests (Phase B)**: each test file decides whether to apply
  the seed before its assertions. Some tests will want a clean DB and
  call the seed; others test the RPCs that create this state and will
  start from empty.
- **Playwright tests (Phase D)**: most likely applied via
  `e2e/global-setup.ts` (extending the existing auth-user creation
  there) once the public-schema tables exist on lane dev.
- **CI**: the existing `sql` job in `.github/workflows/ci.yml` applies
  numbered migrations via `drizzle-kit migrate`. Phase B will likely
  add a step to also apply this seed file. Same for the `e2e` job.

If Phase D test writers find their tests "passing" but operating on
unexpectedly-empty data, the most likely cause is forgetting to apply
this seed. The harness ships the file; consumers wire it in.

### Application (when ready)

Manually against lane dev (after the schema is seeded — see ROADMAP
parking lot for the `drizzle-kit push` pre-B1 step):

```
psql "$DIRECT_DATABASE_URL" -f supabase/test-seed.sql
```

Or via a one-off Node script (psql isn't installed locally — Lane
uses the postgres-js direct pattern, see scripts/run-sql-tests.mjs
or scripts/_a2b-apply-sent-emails.mjs as templates).

### Production safety

The DELETEs at the top of `test-seed.sql` only target fixture IDs and
`@e2e.lane.test` emails — they cannot affect non-test data. The
INSERTs only create rows with the same predictable values. Running
this against production would create test-shaped rows but would not
delete or corrupt real workspace data.

That said: don't run it against production. It would clutter the
production DB with test users that an admin would have to manually
clean up. The production-ref guard pattern from
`scripts/run-sql-tests.mjs` and `lib/email/index.ts` is worth porting
to any wrapper script that applies this seed.

## Why `supabase/` and not `db/`?

`db/` is for Drizzle-managed schema and migrations — the code and SQL
that defines Lane's production data model. `supabase/` is for
Supabase-platform-adjacent artifacts that aren't part of that managed
contract: test fixtures, future seed scripts, Supabase edge function
sources if those ever land, etc.

This separation keeps Drizzle's `db/migrations/_journal.json` clean
and makes it obvious which SQL files are part of the production
contract vs. development tooling.
