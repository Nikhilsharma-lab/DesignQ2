# AI Context Brief — Design Spec

**Date:** 2026-04-03  
**Feature:** Killer Feature 3 — AI Context Brief  
**Status:** Approved, ready for implementation

---

## Problem

When a designer is assigned a request and opens it for the first time, they face raw PM language: vague goals, assumed context, missing constraints. They spend 20–30 minutes either guessing what the PM actually means or firing off Slack messages. This slows every design cycle and frustrates both sides.

---

## Solution

When a designer opens a request in the **design phase**, an AI-generated brief is shown immediately after the description. It synthesises everything the PM wrote and answers the 5 questions a designer needs before touching Figma. Generated once, stored in DB, instant on every subsequent open.

---

## Trigger & Visibility

- **When:** Request is in `phase === "design"` and no brief exists yet in DB
- **Who:** Everyone who opens the request (designer, PM, Design Head, team)
- **Generation:** Lazy — fires on first page open, not on phase transition
- **Regeneration:** None (no button). Generated once. Future version can add refresh.

---

## The 5 Brief Sections

### 1. What this actually means
Plain-language rewrite of the PM's request. Removes jargon. States the real user problem the design needs to solve.

### 2. Related past work
Up to 3 past requests from the same org that solved a similar problem. Each entry has: title, a one-sentence reason it's related, and a link to the request detail page. Gives the designer a head start instead of designing from scratch.

### 3. Key constraints
Extracted from the business context and shaping notes. The non-negotiables: timeline, technical limits, scope boundaries, budget signals. These are facts the designer must work within, not suggestions.

### 4. Questions to ask before starting
3–5 specific, actionable questions the designer should clarify with the PM before opening Figma. Generated from gaps in the request — not generic checklist questions.

### 5. Exploration directions
2–3 directional angles to explore based on request type and context. Not prescriptive — starting points for thinking, not final answers.

---

## Architecture

### New files
```
lib/ai/context-brief.ts
  └─ generateContextBrief(input) → ContextBriefResult
  └─ Uses generateObject + claude-3-5-haiku-20241022 + zod schema
  └─ Input: request fields + up to 20 past org requests (for related work)

db/schema/context_briefs.ts
  └─ request_context_briefs table (1:1 with requests, unique requestId)
  └─ Stores: all 5 sections, aiModel, tokensUsed, createdAt

app/api/requests/[id]/context-brief/route.ts
  └─ POST: auth + org guard → fetch request + past requests → generateContextBrief → upsert DB → return JSON

components/requests/context-brief-panel.tsx
  └─ Client component
  └─ If brief prop passed → renders all 5 sections (server-pre-rendered path)
  └─ If no brief prop → fires POST on mount → shows skeleton → renders on success
  └─ Error state: renders nothing (silent fail, matches error handling policy below)
```

### Modified files
```
db/schema/index.ts
  └─ Export contextBriefs table

app/(dashboard)/dashboard/requests/[id]/page.tsx
  └─ Query request_context_briefs for this requestId (wrapped in try/catch like other queries)
  └─ If phase === "design": render <ContextBriefPanel> after the description section
  └─ Pass existing brief data as prop (null if not found)
```

---

## Data Model

```typescript
request_context_briefs {
  id: uuid (PK)
  requestId: uuid (FK → requests.id, unique, cascade delete)
  
  // The 5 sections
  plainSummary: text          // "What this actually means"
  relatedRequests: jsonb      // Array<{ id, title, reason }>
  keyConstraints: jsonb       // string[]
  questionsToAsk: jsonb       // string[]
  explorationDirections: jsonb // string[]
  
  // Metadata
  aiModel: text
  tokensUsed: integer (nullable)
  createdAt: timestamp
}
```

---

## AI Prompt Design

**Model:** `claude-3-5-haiku-20241022` (same as triage and idea-validator)

**Input to AI:**
- Request: title, description, businessContext, successMetrics, deadlineAt, requestType
- Past org requests: last 20 (id, title, description) for related work detection

**Output schema (zod):**
```typescript
{
  plainSummary: string          // 2-3 sentences, plain language
  relatedRequests: Array<{
    id: string,
    title: string,
    reason: string              // 1 sentence
  }>                            // max 3, only if genuinely similar
  keyConstraints: string[]      // 2-5 items, factual
  questionsToAsk: string[]      // 3-5 items, specific and actionable
  explorationDirections: string[] // 2-3 items, directional not prescriptive
}
```

---

## UI Placement

```
REQUEST DETAIL PAGE (main content column, left side)
├── Title + metadata
├── Description                    ← existing
├── Business Context               ← existing (if present)
├── Success Metrics                ← existing (if present)
│
├── ✨ AI CONTEXT BRIEF            ← NEW — inserted here
│   ├── Header: "AI Context Brief" + model badge (right)
│   ├── What this actually means
│   ├── Related past work (links to requests)
│   ├── Key constraints
│   ├── Questions to ask before starting
│   └── Exploration directions
│
├── Figma                          ← existing
├── AI Triage                      ← existing
└── Activity / Comments            ← existing
```

**Visual style:** Same card style as AI Triage section — `border border-zinc-800 rounded-xl`, dark header row, inner sections with `text-[10px] text-zinc-600 uppercase` labels. Skeleton: 4 lines of `bg-zinc-800 animate-pulse rounded` while loading.

---

## Error Handling

- If AI call fails: component renders nothing (silent fail). No error message shown to user — brief is a "nice to have," not blocking.
- If DB write fails after AI generation: same — silent fail. Brief not stored, next open re-attempts generation.
- If request has no description: brief still generates from title + available fields.

---

## Out of Scope (this version)

- Regenerate button — no
- Brief only visible to designer — no (everyone sees it)
- Brief in predesign / dev / track phases — no
- Brief editing by PM — no
- Email/notification when brief is ready — no
