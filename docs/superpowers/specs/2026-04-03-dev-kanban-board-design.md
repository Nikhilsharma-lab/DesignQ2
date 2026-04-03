# Dev Kanban Board — Design Spec

**Date:** 2026-04-03  
**Status:** Approved  
**Feature:** Phase 3 — Dev Board (new dedicated kanban view)

---

## What We're Building

A dedicated kanban board at `/dashboard/dev` that shows all dev-phase requests grouped into columns by their `kanban_state`. Devs go here every morning to see and move work — no filtering through the request list required.

---

## User Experience

### Board Layout

- Full-width page with 5 horizontal columns: **To Do · In Progress · In Review · QA · Done**
- Each column header shows its name + card count
- Columns scroll vertically if they overflow
- Project switcher in the header filters the board (same `?project=` param as main dashboard)

### Cards

Each card shows:
- Title
- Priority badge (P0–P3, colour-coded)
- Request type badge (feature, bug, etc.)
- Project badge (coloured dot + name)
- Assignee name(s)
- Deadline (if set)

### Moving Cards

Three ways to move a card between columns:

1. **Drag and drop** — grab a card, drop it into any column
2. **Keyboard shortcuts** — focus a card, press `]` to move forward one column, `[` to move back
3. **Buttons in the slide-over** — same forward/back buttons as the request detail page

All moves are optimistic (instant UI feedback). On API failure, card snaps back and shows an error.

### Slide-Over

Clicking any card opens a `Sheet` (shadcn slide-over) from the right. The board stays fully visible and interactive in the background. The sheet shows:
- Request title, description, business context
- `DevPhasePanel` (kanban stepper + move buttons)
- Figma link (if set)
- Comments / activity feed
- Assignees, priority, deadline

Keyboard: `Enter` opens the slide-over, `Escape` closes it.

### Navigation

"Dev Board" added as a nav item alongside Requests, Team, Insights, Ideas, Radar in all dashboard headers.

### Real-time

The board subscribes to the existing Supabase Realtime hook (`useRealtimeDashboard`). When a teammate moves a card, the board refreshes automatically via `router.refresh()`.

---

## Architecture

### New Files

| File | Purpose |
|------|---------|
| `app/(dashboard)/dashboard/dev/page.tsx` | Server component — fetches dev-phase requests, groups by `kanban_state`, renders `<DevBoard>` |
| `components/dev-board/dev-board.tsx` | Client component — owns `DndContext`, optimistic state, keyboard listeners |
| `components/dev-board/kanban-column.tsx` | Single column — `SortableContext` + droppable zone |
| `components/dev-board/kanban-card.tsx` | Single card — draggable, focusable, displays all card fields |
| `components/dev-board/card-drawer.tsx` | Slide-over — wraps shadcn `Sheet`, loads request detail |

### Changed Files

| File | Change |
|------|--------|
| `app/(dashboard)/layout.tsx` | Add Dev Board nav link |
| All 4 dashboard page headers | Add Dev Board nav link |

### Data Flow

```
page.tsx (server)
  → fetch requests WHERE phase = 'dev' AND org_id = ? [AND project_id = ?]
  → group by kanban_state into 5 buckets
  → pass to <DevBoard columns={...} />

DevBoard (client)
  → useState for optimistic column state
  → DndContext onDragEnd → moveCard(id, newState)
  → moveCard: optimistic update → PATCH /api/requests/[id]/kanban → on fail: revert
  → useRealtimeDashboard(orgId) → router.refresh() on external changes
  → keyboard useEffect: ] / [ move focused card, Enter open drawer, Escape close
```

### Dependencies

- `@dnd-kit/core` + `@dnd-kit/sortable` — drag and drop (install via npm)
- `Sheet` from shadcn/ui — slide-over (already in project)

---

## What's Not In Scope

- Drag to reorder within a column (cards have no explicit ordering — not needed for MVP)
- Swimlanes by assignee or project
- Creating new requests from the board
- Filtering by assignee

---

## Success Criteria

- Devs can see all dev-phase requests at a glance, grouped by state
- Moving a card (drag, keyboard, or button) persists immediately
- Clicking a card opens the full detail without leaving the board
- Board updates live when a teammate moves a card
