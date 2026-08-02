# Member Event Detail Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-layout the member event detail page to match the approved structured-itinerary design on desktop and mobile without changing behavior.

**Architecture:** Keep the page as an async Server Component and retain `EventLocation`, `NaverMap`, and `RegistrationPanel` as their existing boundaries. Change only the page composition and utility classes; the map and registration actions keep their client behavior.

**Tech Stack:** Next.js App Router, React Server Components, TypeScript, Tailwind CSS v4, Vitest.

## Global Constraints

- Reuse existing design tokens and components; add no packages or shared abstractions.
- Preserve API calls, URL handling, accessible controls, and optional-data rendering.
- At widths below `sm`, stack information, map, and registration action vertically.

---

### Task 1: Recompose the event detail layout

**Files:**
- Modify: `src/app/(member)/events/[id]/page.tsx`
- Test: `pnpm exec tsc --noEmit`

**Interfaces:**
- Consumes: `Event`, `EventLocation`, `NaverMap`, `RegistrationPanel` unchanged.
- Produces: the same `/events/[id]` route with a responsive structured-itinerary layout.

- [ ] **Step 1: Establish the verification baseline**

Run: `pnpm exec tsc --noEmit`

Expected: exit 0 before the layout-only change.

- [ ] **Step 2: Replace the event-information card composition**

Use a `sm:grid sm:grid-cols-2` wrapper: the left `Card` contains the date, optional location, and optional speaker rows separated by `border-t`; the right `Card` contains the `NaverMap`. Render the page header with the existing `Badge` as its `action`.

```tsx
<PageHeader title={e.title} action={<Badge tone={TYPE_TONES[e.type]}>{TYPE_LABELS[e.type]}</Badge>} />
<div className="grid gap-4 sm:grid-cols-2">
  <Card>...</Card>
  <Card>...</Card>
</div>
```

- [ ] **Step 3: Add the compact capacity and description sections**

Render capacity in its own `Card` after the grid. When `e.capacity` is present, add a semantic `role="progressbar"` bar whose `aria-valuenow` is the confirmed count and whose max is the capacity. Leave the description conditional.

```tsx
{e.capacity && <div role="progressbar" aria-valuenow={confirmed} aria-valuemin={0} aria-valuemax={e.capacity}>...</div>}
```

- [ ] **Step 4: Make registration responsive without changing its behavior**

Keep `<RegistrationPanel eventId={e.id} profile={profile} code={code} />` unchanged. Its existing card handles state and actions; update its flex direction only if needed for its action to stack below 640px.

- [ ] **Step 5: Verify the route types**

Run: `pnpm exec tsc --noEmit`

Expected: exit 0.

### Task 2: Check the responsive visual path

**Files:**
- Modify: `src/app/(member)/events/[id]/page.tsx`
- Modify if needed: `src/components/RegistrationPanel.tsx`
- Test: `pnpm exec tsc --noEmit`

**Interfaces:**
- Consumes: the unchanged registration status and server action props.
- Produces: a one-column mobile layout and an action row that remains operable at narrow widths.

- [ ] **Step 1: Inspect the responsive classes**

Confirm the information/map layout is one column by default and two columns only with `sm:grid-cols-2`; confirm the registration panel uses `flex-col` by default and `sm:flex-row` for its heading/action row.

- [ ] **Step 2: Run final type verification**

Run: `pnpm exec tsc --noEmit`

Expected: exit 0.
