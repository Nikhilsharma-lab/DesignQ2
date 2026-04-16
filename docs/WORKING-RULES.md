# Lane — Working Rules for AI Sessions

These rules were developed across the April 14-16, 2026 sessions. They exist because every rule here was learned the hard way — a bug was missed, time was wasted, or a commitment was forgotten because the rule wasn't followed. Any Claude instance working on Lane should follow these.

## Source of truth
- `docs/ROADMAP.md` is the source of truth for what to build next. Every session starts by reading the "Next session" pointer.
- `CLAUDE.md` is the source of truth for vocabulary, architecture, and product philosophy. When in doubt, CLAUDE.md wins.
- `docs/nav-spec.md` and `docs/onboarding-spec.md` are the sources of truth for their respective features.
- This chat is where we think. The files are where decisions live.

## Verify before acting
- Never trust documentation claims about what's "already built." Grep the codebase to confirm.
- Never trust CLAUDE.md's description of how a feature works. Read the actual code.
- Before writing any fix, grep for the full scope of what needs changing. The first grep always misses something.
- Run `npx tsc --noEmit` after every code change. TypeScript catches what grep misses.
- After every rename or refactor, run a verification grep to confirm zero stale references remain.

## Commit discipline
- Claude Code does NOT commit. Every commit is manual after human review.
- Read the full `git diff` before committing. Don't skim.
- One logical change per commit. Don't bundle unrelated fixes.
- Commit messages describe what changed AND why (reference the roadmap item or bug).
- Don't push until the end of the session or until a logical block of work is complete.

## Stop-point discipline
- Claude Code prompts include explicit STOP points between steps.
- At each stop, Claude Code shows the diff and waits for "continue."
- Never let Claude Code run multiple steps without review between them.
- If Claude Code skips a step or "defers" something that was in the prompt, call it out immediately.

## Lock commitments immediately
- When a decision is made to do something later, add it to `docs/ROADMAP.md` immediately — not "at the end of the session."
- Parking lot items go in the parking lot section of the roadmap the moment they're identified.
- The "Next session" pointer gets updated before the session ends, every time.

## AI file fixes (Anthropic structured output)
- Zod 4 `.int()` emits safe-integer bounds that Anthropic rejects (vercel/ai#13355).
- Pattern: drop `.int().min().max()` from schema → prepend range info to `.describe()` → add runtime Math.round + clamp after generateObject returns → spread return to preserve other fields.
- Array constraints: drop `.min().max()` → add `.describe()` with count guidance → truncate if too long, throw if too short.
- Runtime clamps are insurance, not patches. The model usually returns clean values.

## Claude Code environment quirk
- Claude Code's host shell exports `ANTHROPIC_BASE_URL=https://api.anthropic.com` (missing `/v1`) and overrides `ANTHROPIC_API_KEY`.
- Any tsx/node scripts that hit Anthropic need: `unset ANTHROPIC_API_KEY ANTHROPIC_BASE_URL &&` prefixed before the command.

## Architecture facts (discovered April 14-16)
- Sidebar rendering: `components/shell/sidebar.tsx` (NOT `components/nav/`)
- Nav logic: `components/nav/team-section.tsx` for team sections, `lib/nav/` for keys and order
- Hotkeys: `components/shell/hotkeys-provider.tsx`
- Request detail: DetailDock side panel (`?dock={id}` URL param), NOT a dedicated `[id]/page.tsx` route
- AI features: all 8 in `lib/ai/`, all verified working against `claude-haiku-4-5-20251001`
- Database: single hosted Supabase project shared between local dev and production

## Vocabulary lock (from CLAUDE.md)
- Request (never Stream, Ticket, Issue)
- Predesign, Design, Build, Track (the four phases)
- Sense, Frame, Diverge, Converge, Prove (the five design stages)
- Intake (where Requests land)
- Prove (the three-sign-off quality gate, NOT "Validation gate")
- Commitments (cycle-committed work)
- Ideas (upstream pool)
- Rationale (per-direction thinking in Diverge stage, renamed from "Reflection field")
- Reflection — vocabulary preserved but feature deferred to post-v1

## Production status (as of April 16, 2026)
- ANTHROPIC_API_KEY in Vercel returns 401 — needs diagnosis
- Database connection pool exhaustion on multiple endpoints — needs diagnosis
- Both are blockers for real customer use but NOT for local dev work
