# Member Home Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the logged-in member home visually prioritize the upcoming event while preserving all current data and navigation behavior.

**Architecture:** Change only the render structure and Tailwind classes in `HomeDashboard`. Reuse its existing Supabase results, `Link`, `Card`, `Badge`, `StatCard`, `EmptyState`, and month filter; no new component, endpoint, or dependency is needed.

**Tech Stack:** Next.js 16 App Router, React 19 server components, TypeScript, Tailwind CSS 4.

## Global Constraints

- Preserve the sidebar, blue brand color, latest-notice link, event links, survey link, profile link, and `month` URL filter.
- Keep the existing data queries and event filtering unchanged.
- Use existing tokens and components only; add no dependency, font, or global color.
- Stack the featured-event and monthly-points panels below `sm`.

---

### Task 1: Restructure the member home visual hierarchy

**Files:**
- Modify: `src/app/(member)/HomeDashboard.tsx`
- Test: TypeScript compile via `pnpm exec tsc --noEmit`

**Interfaces:**
- Consumes: `Event`, `EventType`, `Notice`, existing `HomeDashboard({ month, profileId })` inputs.
- Produces: the same links, filtering behavior, and server-rendered dashboard data with a featured upcoming-event presentation.

- [ ] **Step 1: Keep data flow unchanged**

Leave the `latestNotice`, surveys, point logs, events, confirmed-count RPC, `upcoming`, `past`, and `monthOptions` declarations as-is. Do not add a new query or prop.

- [ ] **Step 2: Make the event card optionally featured**

Extend the local props and select the layout through a `featured` boolean:

```tsx
function EventCard({
  event,
  confirmed,
  featured = false,
}: {
  event: Event;
  confirmed: number;
  featured?: boolean;
}) {
  // retain the existing Link href and event metadata
}
```

For `featured`, use a compact hierarchy with the event type badge, `text-xl` title, date, location, and confirmed count. For non-featured cards, retain the existing concise content.

- [ ] **Step 3: Build the approved page order**

Render the following order in the existing outer `flex flex-col` container:

```tsx
<header>{/* greeting */}</header>
{notice && <Link href={`/notices/${notice.id}`}>{/* notice strip */}</Link>}
{unanswered.length > 0 && <Link href="/surveys">{/* survey strip */}</Link>}
<div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_260px]">
  <section>{/* upcoming event heading and featured EventCard */}</section>
  <Link href="/profile">{/* existing StatCard */}</Link>
</div>
<section>{/* unchanged past-events heading, MonthFilter, cards or EmptyState */}</section>
```

Use only existing `gray-*`, `primary*`, `warning*`, `Card`, `Badge`, `StatCard`, and `EmptyState` patterns. Give each strip its existing link target and a visible hover/focus treatment.

- [ ] **Step 4: Check the type surface**

Run: `pnpm exec tsc --noEmit`

Expected: exit code 0.

- [ ] **Step 5: Inspect behavior manually**

Open `http://localhost:3000/` as a logged-in member and verify the notice, event, points link, event link, month filter, empty state, and a narrow viewport. Expected: every existing destination and condition remains reachable, while the upcoming event is the strongest visual block.
