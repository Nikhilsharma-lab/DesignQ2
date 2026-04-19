-- scripts/cleanup-test-data.sql
--
-- One-off cleanup for Phase 3 verification test data (parking lot item,
-- April 15). Intended to run once before first customer onboarding.
--
-- HOW TO RUN
-- ──────────
-- Option 1: Drizzle Studio
--   npm run db:studio  → paste SELECTs into the SQL editor → review counts →
--   paste DELETE (after uncommenting) once the dry-run looks right.
--
-- Option 2: psql
--   psql "$DATABASE_URL" -f scripts/cleanup-test-data.sql
--   (Note: the DELETEs are commented out by default — nothing destructive
--   runs without explicit uncomment.)
--
-- SCOPE
-- ─────
-- Deletes requests with titles matching the Phase 3 verification pattern.
-- Cascading FKs on `requests` (onDelete: "cascade") will clean up:
--   - comments
--   - iterations + iteration_comments
--   - decision_log_entries
--   - validation_signoffs
--   - impact_records
--   - request_context_briefs
--   - request_handoff_briefs
--   - request_ai_analysis
--   - assignments
--   - request_stages
--   - proactive_alerts (request-linked)
--
-- NOT IN SCOPE
-- ────────────
-- Sample-team data (projects.is_sample = true, profiles.is_sample = true,
-- and their seeded requests from Item 8 Phase G) has a dedicated FK-safe
-- `clearSampleTeam` server action. Use that instead of SQL for sample data.

-- ── Dry run ─────────────────────────────────────────────────────────────
-- Verify what will be affected before uncommenting the DELETE.

SELECT count(*) AS test_requests
FROM requests
WHERE title ILIKE 'Phase 3 test%';

-- See the actual rows (titles + status) to sanity-check
SELECT id, title, status, phase, created_at
FROM requests
WHERE title ILIKE 'Phase 3 test%'
ORDER BY created_at DESC;

-- Count child rows that would cascade-delete
SELECT
  (SELECT count(*) FROM comments c
    JOIN requests r ON r.id = c.request_id
    WHERE r.title ILIKE 'Phase 3 test%') AS comments_to_cascade,
  (SELECT count(*) FROM impact_records ir
    JOIN requests r ON r.id = ir.request_id
    WHERE r.title ILIKE 'Phase 3 test%') AS impact_records_to_cascade,
  (SELECT count(*) FROM request_ai_analysis ra
    JOIN requests r ON r.id = ra.request_id
    WHERE r.title ILIKE 'Phase 3 test%') AS ai_analysis_to_cascade,
  (SELECT count(*) FROM iterations i
    JOIN requests r ON r.id = i.request_id
    WHERE r.title ILIKE 'Phase 3 test%') AS iterations_to_cascade;

-- ── Delete (commented) ──────────────────────────────────────────────────
-- Uncomment the line below ONLY after reviewing the counts above.
-- Cascade handles the children.

-- DELETE FROM requests WHERE title ILIKE 'Phase 3 test%';

-- ── Alternate patterns (if the Phase 3 prefix misses anything) ──────────
-- Review manually and uncomment only what you recognize as test data:

-- DELETE FROM requests WHERE title ILIKE 'Test %';
-- DELETE FROM requests WHERE title ILIKE '%-- debug%';

-- ── Verification after delete ───────────────────────────────────────────
-- Run this after the DELETE to confirm the test data is gone:

-- SELECT count(*) AS remaining_test_requests
-- FROM requests
-- WHERE title ILIKE 'Phase 3 test%';
