-- Dev-only: install pg-tap for SQL-level testing.
-- Deliberately unnumbered (not 0010+) so drizzle-kit push
-- on production never picks this up. Manually applied to dev
-- via psql.
-- Do NOT rename or renumber this file.
CREATE EXTENSION IF NOT EXISTS pgtap;
