BEGIN;
SELECT plan(1);
SELECT ok(1 = 1, 'smoke test: 1 equals 1');
SELECT * FROM finish();
ROLLBACK;
