# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

**Whiteboard Agent** — a visual tool for diagramming agentic/multi-agent workflows on a canvas,
then exporting the diagram as a `whiteboard.md` spec file that Claude Code / Codex can read to
scaffold the real implementation. Aimed at both technical and non-technical users.

Built incrementally via the `/webapp-guide` 5-phase process:
- ✅ Phase 1 (blueprint), Phase 2 (data model), Phase 3 (API design) — agreed; **Phase 5
  superseded most of the backend/auth/data-model decisions made here — see the Supabase notes
  throughout this file for what actually shipped**
- ✅ Phase 4 (frontend UI) — scaffolded in `frontend/`; later **replaced wholesale** with a
  pixel-faithful port of a richer Claude Design handoff (see "Visual identity & design system"
  below) — canvas, dashboard, inspector, export, and branding all rebuilt against that design
- ✅ Phase 5 (live integration) — **shipped as a full pivot to Supabase** (hosted Postgres +
  Auth + `@supabase/supabase-js`) instead of the originally-planned hand-rolled Express/Prisma/
  JWT backend: faster to ship, and Supabase Auth provides the documented access+refresh-token
  *behavior* natively, so there was nothing to gain from hand-writing it. There is **no
  `backend/` folder** — Supabase *is* the backend. See "Architecture" and "Data model" below
  for the concrete shape of what replaced the Phase 3 plan.

The frontend (`frontend/`) is the only deployable project; it talks directly to Supabase
(no intermediate API server). Auth, persistence, loading/error states, and the
`whiteboard.md` exporter are all live end-to-end — see `frontend/src/lib/auth-store.tsx`,
`frontend/src/lib/wb-store.tsx`, and `frontend/src/lib/use-project-editor.ts` (autosave).
Local dev needs a `frontend/.env.local` with `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`
(copy `frontend/.env.example`) pointing at a Supabase project that has run
`frontend/supabase/schema.sql`. Run commands (standard Vite, from `frontend/`): `npm run dev`,
`npm run build`, `npm run lint`.

As code lands, update this file with:
- Build, lint, and test commands (including how to run a single test)
- Any further deviations from the plan below, and why

## Visual identity & design system

The product's look-and-feel comes from a Claude Design handoff bundle ("whiteboard-agent")
that was ported **pixel-faithfully** into `frontend/`, replacing the original Phase 4 styling
wholesale (branding, dashboard, canvas, inspector, export modal):

- **Brand**: "whiteboard-agent" wordmark (accent on "-agent") + "workflow studio" subtitle,
  a custom converging-workflow `LogoMark` glyph (`src/components/wb/Logo.tsx`), ocean-blue
  accent `#0e7fb8` (also wired into the shadcn `--primary` token in `src/index.css`)
- **Type**: Hanken Grotesk (UI) + JetBrains Mono (code/mono), loaded via Google Fonts in
  `index.html`
- **Tokens**: oklch-based design tokens (`--bg`, `--surface`, `--ink`, `--accent`,
  `--t-agent`…`--t-decision` per-node-type tints, `--canvas-*`, `--edge*`, `--r-*`, `--sh-*`)
  and all ported component classes live in `src/styles/whiteboard.css`, **scoped under a
  `.wb-theme` wrapper class** so they layer over the existing shadcn/Tailwind theme without
  colliding on shared names like `--accent`/`--ink`. Apply `.wb-theme` to any container that
  uses these tokens/classes — see Dashboard, the editor shell, `Logo` usages in
  `AppLayout`/`AuthCard`, and the node-type badges on the landing page.
- The design's default "tweaks" (`accent: #0e7fb8`, `grid: dots`, `cards: plain`,
  `theme: light`) are baked in as fixed values rather than exposed as a settings UI — its
  `tweaks-panel.jsx` was the design tool's own internal Storybook-style scaffold
  (`@ds-adherence-ignore`-tagged), not a real product feature.

## Architecture

**Frontend + BaaS** (one deployable project — `frontend/` — talking directly to Supabase;
no custom server, no `backend/` folder):

| Layer | Choice |
|---|---|
| Frontend | Vite + React + TypeScript, React Router for client-side routing |
| Canvas/diagram engine | Custom hand-rolled SVG + pointer-events canvas (`src/components/wb/Canvas.tsx`) — pan, zoom-to-cursor, drag-to-connect ports, bezier edge routing, right-click duplicate/delete, palette drag-and-drop. **Deviation:** originally planned as React Flow (`@xyflow/react`); replaced to pixel-match the Claude Design handoff's hand-built interactions — `@xyflow/react` has been removed from `package.json` |
| Styling/UI | Tailwind CSS + shadcn/ui, layered with a ported `.wb-theme` design-system (see "Visual identity" above) |
| Backend | **Deviation:** no custom server — **Supabase** (hosted Postgres + Auth + auto REST via PostgREST), called directly from the browser through `@supabase/supabase-js` (`frontend/src/lib/supabase.ts`). The originally-planned Node/Express API was dropped: Supabase already provides everything Phase 3 specced (CRUD + auth) with Row Level Security standing in for hand-written ownership checks |
| Database | PostgreSQL, hosted by Supabase. One table, `whiteboards` — schema + RLS policies live in `frontend/supabase/schema.sql` (run once in the Supabase SQL Editor). No Prisma — Supabase owns migrations/schema |
| Auth | **Deviation:** Supabase Auth via **Google OAuth only** (`supabase.auth.signInWithOAuth`), wrapped by `frontend/src/lib/auth-store.tsx` (`AuthProvider`/`useAuth`). Originally shipped as Supabase email/password, then **replaced again** — see "Why Google OAuth only" below. Still the same documented "JWT access + refresh token" *behavior* under the hood: Supabase issues short-lived access tokens and rotates long-lived refresh tokens, persisted/auto-refreshed by the client SDK, just without hand-written token code |
| Hosting (planned) | Frontend → Vercel/Netlify; DB/Auth → Supabase (already hosted, nothing else to provision) |

**Why Google OAuth only:** Phase 5 first shipped Supabase email/password, but live
verification surfaced real friction — Supabase's "confirm email" flow plus its email-send rate
limiting made even routine sign-up testing slow and error-prone, and that same friction would
land on every new user. **Deviation:** auth was switched to **Google OAuth as the sole sign-in
method** (`signInWithGoogle` in `auth-store.tsx`) — one button, no passwords to store/reset/
confirm, identity delegated entirely to Google. This also collapses "log in" and "sign up" into
one action (a Google account *is* the account — Supabase creates the `auth.users` row on first
OAuth login), so the dedicated `/signup` page and its form were removed; `/signup` now redirects
to `/login`. Requires a one-time Google Cloud OAuth client + Supabase provider config (Google Cloud Console
→ OAuth credentials, redirect URI = `<your-project>.supabase.co/auth/v1/callback`; then Supabase
dashboard → Authentication → Providers → Google, plus `http://localhost:5173` in the Redirect
URLs allow-list for local dev) — no env vars needed beyond the existing
`VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`, since the OAuth client lives in Supabase, not the
frontend.

### Data model (Supabase Postgres + RLS)

Two tables — see `frontend/supabase/schema.sql` for the executable migration (the `profiles`
section was appended later for pricing/plans; it's written to be safe to re-run on a project
that already has `whiteboards`):

- **`profiles`**: `user_id` (uuid pk, `references auth.users`, cascade-deletes), `plan`
  (text, `'free' | 'pro'`, defaults to `'free'`), `created_at`. A `security definer` trigger
  (`handle_new_user`/`on_auth_user_created`) inserts a `'free'`-plan row the instant a new
  `auth.users` row is created — "users who sign up are instantly on the free plan" needed no
  client-side provisioning step, just a DB trigger; a one-off backfill `insert … on conflict do
  nothing` covers accounts created before this table existed. RLS: `select`/`update` gated on
  `auth.uid() = user_id` (no `insert`/`delete` policies — those only ever happen via the
  trigger/cascade, never from the client)
- **`whiteboards`**: `id` (uuid pk), `user_id` (uuid, `references auth.users`, cascade-deletes
  with the account), `title`, `description` (nullable — present for parity with the
  originally-planned `Whiteboard.description`, but not yet surfaced in the UI), `graph_data`
  (jsonb: `{ nodes, edges, view, library }` — **deviates** from the originally-planned
  `graphData: { nodes, edges }` by nesting `view`/`library` too, mirroring the frontend's
  `Project` shape directly so reads/writes need no translation), `created_at`/`updated_at`
  (the latter auto-stamped
  by a `before update` trigger so the client never has to set it)
- **Row Level Security**: enabled, with `select`/`insert`/`update`/`delete` policies all gated
  on `auth.uid() = user_id` — this *is* the per-user ownership enforcement Phase 3 specced,
  just expressed as DB policy instead of route-handler middleware
- **Deviations from the originally-planned Prisma models**:
  - No separate `User` table — Supabase's built-in `auth.users` (managed entirely by Supabase
    Auth) is the user record; the frontend maps it to the existing `User` type in
    `src/types/index.ts` (`name`/`avatarUrl` come from `user_metadata`)
  - No `NodeType` table / seed / `GET /api/node-types` endpoint — the 8-category palette catalog
    (`NODE_TYPES`/`CATALOG` in `src/lib/wb-data.ts`) is static UI metadata, not user data, so a
    DB round-trip would be pure overhead; it stays a frontend constant
  - No `RefreshToken` table — Supabase Auth owns session/refresh-token storage and rotation
    internally; there is nothing for the app to hash or revoke by hand

The canvas graph is stored as a single JSONB blob per whiteboard (not normalized into node/edge
tables) since it's read and written as a whole and is naturally graph-shaped.

### Route map

**Frontend (React Router):**
- `/` — landing page
- `/login`, `/signup` — auth
- `/pricing` — public Free vs. Pro plan comparison (no auth required)
- `/dashboard` — list/create whiteboards
- `/whiteboard/:id` — canvas editor (export is now an in-editor `ExportModal`, not its own route —
  the originally-planned `/whiteboard/:id/export` preview page was removed/superseded)

**Backend:** none — **Deviation:** the originally-planned Express API
(`/api/auth/*`, `/api/whiteboards*`, `/api/node-types`) was dropped entirely. Auth and
whiteboard CRUD now go straight from the frontend to Supabase via `@supabase/supabase-js`
(`supabase.auth.*` and `supabase.from('whiteboards')`), with Row Level Security doing the
ownership enforcement those routes would have done by hand. The planned
`GET /api/whiteboards/:id/export` endpoint was dropped too — see below, export was always
designed to be client-only and stays that way permanently now that there's no server to host it.
The palette catalog never needed `GET /api/node-types` either, since it's a static frontend
constant (see "Data model" above).

### The `whiteboard.md` export engine

The key differentiating feature, implemented **entirely client-side** in
`src/lib/wb-export.ts` (`buildMarkdown`, rendered by `ExportModal` via `MdView`) as a
pixel-faithful port of the design handoff's exporter. **Deviation:** the original Phase 3 plan
sketched a future `GET /api/whiteboards/:id/export` endpoint as a server-side mirror of this
logic "for parity/automation use cases" — that's now moot, since Phase 5 removed the server
entirely. Client-side export was always the real implementation (no round-trip needed) and is
now also the *only* implementation, permanently. Given a project's nodes/edges, it:
1. Builds an execution order via BFS from entry nodes (no incoming edges) outward
2. Emits "▶ Build instructions" — numbered steps telling the coding agent how to read the rest
3. Emits "Stack at a glance" — all chosen models/frameworks/integrations grouped by `CATALOG_GROUPS`
4. Emits "Architecture" — the ordered step list plus a plain-text flow-map code block
5. Emits one "Components" section per node (type, role, stack, receives-from/sends-to)
6. Emits "Connections & notes" (one line per labeled edge) and a "Suggested project structure"
   file tree (agents/tools/data dirs inferred from node types, `.py`/`.ts` based on detected stack)

Export is **download-and-copy** (Blob download + clipboard, with a `<textarea>` fallback) —
fully self-contained in the browser, with no backend involved at any point.

### Pricing & plans

Two tiers, defined in `src/lib/plans.ts` (`PLAN_LIMITS`, `PLANS` catalog — single source of
truth for both the `/pricing` page and the dashboard's enforcement):

- **Free** ($0): full editor + export, up to **2** saved workflows
- **Pro** ($10.99/mo): everything in Free, up to **12** saved workflows, plus **Brainstorm** —
  an AI agent assistant for ideating workflows. Brainstorm doesn't exist yet, so its tab on the
  Pro card (`PricingPage.tsx`, via shadcn `Tabs`) is marked **"Coming soon"**, and the
  "Upgrade to Pro" CTA opens a "Pro is launching soon" dialog rather than charging anyone —
  **no payment processing is wired up** (a deliberate scope cut: standing up real billing would
  mean Stripe Checkout + webhooks, and webhooks need a server to receive them — i.e. Supabase
  Edge Functions — which is a bigger lift than an MVP pricing page warrants before Brainstorm
  itself exists to sell)
- `src/lib/plan-store.tsx` (`PlanProvider`/`usePlan`) reads the signed-in user's `plan` from
  the new `profiles` table (see "Data model"), mirroring `wb-store.tsx`'s fetch-on-user-change
  pattern; wired in at the app root in `main.tsx` between `AuthProvider` and `WbStoreProvider`
- **Enforcement is UI-side only** (no DB-level cap): `DashboardPage` disables "New workflow"
  and per-card "Duplicate" once `projects.length` reaches `PLAN_LIMITS[plan]`, and shows an
  inline upsell banner linking to `/pricing`. This matches the "UI + plan tracking only" scope
  — there's no real Pro to sell yet, so a hard server-side quota would be premature; revisit
  once Brainstorm ships and Pro becomes purchasable for real

## Frontend structure (`frontend/`)

Vite + React + TS app, scaffolded with `@tailwindcss/vite`, shadcn/ui (`components.json`, `new-york`
style, components in `src/components/ui/`), and React Router. Path alias `@/*` → `src/*`.
`@xyflow/react` was removed — the canvas is now hand-rolled (see Architecture table above).

- `src/types/index.ts` — shared types: `NodeType` (8-value union), `NodeTypeDef`, `WBNode`, `WBEdge`,
  `Project`, `AppState`, `Selection`, `StackPreset`, `ProjectView`, plus `User` (kept from Phase 4)
- `src/lib/supabase.ts` — the Supabase client singleton, built from
  `import.meta.env.VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` (see `.env.example`); throws at
  startup if either is missing, so a misconfigured `.env.local` fails loudly
- `src/lib/auth-store.tsx` — `AuthProvider`/`useAuth()`: wraps `supabase.auth`
  (`signInWithOAuth`/`signOut`/`getSession`/`onAuthStateChange`), maps a Supabase `Session` to
  the existing `User` type (`name` from Google's `user_metadata.name`/`full_name`, `avatarUrl`
  from `avatar_url`/`picture` — Google populates these inconsistently across flows, hence the
  fallback chain), and exposes `{ user, loading, signInWithGoogle, signOut }`. **Deviation:**
  originally `signUp`/`signIn` (email/password); replaced with a single
  `signInWithGoogle(redirectPath?)` that threads the intended post-login destination through
  `signInWithOAuth`'s `redirectTo` so `RequireAuth`'s "redirect back to where you were" survives
  the full-page round trip to Google (see "Why Google OAuth only" above for the rationale).
  Wired in at the app root in `main.tsx` (outside `WbStoreProvider`, since the store depends on
  the authed user)
- `src/components/auth/RouteGuards.tsx` — `RequireAuth`/`RedirectIfAuthed`: `<Outlet/>`-based
  layout-route guards used in `App.tsx` to gate `/dashboard`+`/whiteboard/:id` vs.
  `/login`+`/signup`, redirecting based on `useAuth()` (and showing a brief loading state while
  the initial session check resolves, so refreshes don't flash a redirect)
- `src/lib/wb-data.ts` — `NODE_TYPES`/`TYPE_ORDER` catalog, `CATALOG`/`CATALOG_GROUPS` (stack/
  integration picker contents), factories (`makeNode`, `makeProject`, `sampleProject`), `uid`.
  **Deviation:** `loadState`/`saveState`/`defaultState` (the localStorage layer) were removed —
  persistence now lives in `wb-store.tsx`/`use-project-editor.ts` against Supabase
- `src/lib/wb-store.tsx` — `WbStoreProvider`/`useWbStore`: global project list CRUD against the
  Supabase `whiteboards` table (RLS-scoped to `useAuth()`'s current user), wired in at the app
  root in `main.tsx`. **Deviation:** replaced the original localStorage sync wholesale —
  `state`/`setState` remain the synchronous in-memory source of truth the canvas mutates
  directly (so drags/undo stay instant), while `createProject`/`duplicateProject`/
  `deleteProject` round-trip to Supabase and `persistProject` is exposed for the editor's
  autosave; also exposes `loading`/`error`/`reload` (used by `DashboardPage` for skeleton/retry
  states) and clears its in-memory cache on logout
- `src/lib/use-project-editor.ts` — `useProjectEditor(projectId)`: per-project editing session
  (selection, undo/redo history via JSON-snapshot refs, all node/edge mutation `actions`,
  `beginInteraction`/`commitInteraction` for drag-style continuous edits). **Deviation:** now
  also owns debounced autosave — every history-recording mutation (`commit`, completed drags,
  undo/redo, rename) calls `scheduleSave()`, which 800ms later persists the project via
  `wb-store`'s `persistProject` and reports `saveStatus: 'idle' | 'saving' | 'saved' | 'error'`
  back to `WhiteboardEditorPage` for its topbar indicator; continuous `live` edits (panning,
  in-progress drags) intentionally don't trigger it. Used by `WhiteboardEditorPage`
- `src/lib/wb-geometry.ts` — `rectAnchor`/`curve`/`edgePath` bezier-routing math shared by the
  canvas's SVG edges
- `src/lib/wb-export.ts` — `buildMarkdown(project)`, the export engine described above
- `src/lib/plans.ts` / `src/lib/plan-store.tsx` — the pricing catalog (`PLAN_LIMITS`, `PLANS`)
  and `PlanProvider`/`usePlan` (reads `profiles.plan`); see "Pricing & plans" above
- `src/components/wb/` — the ported design-system components: `Icon`, `Logo`/`LogoMark`, `Btn`,
  `Modal`, `ThumbGraph` (dashboard card mini-graph), `Canvas` (the custom canvas), `Inspector`
  (`NodeInspector`/`EdgeInspector`/`OverviewInspector`/`StackPicker`), `ExportModal` (`MdView` +
  copy/download)
- `src/styles/whiteboard.css` — the `.wb-theme`-scoped design-token system and component CSS
  (imported from `src/index.css`)
- `src/components/layout/AppLayout.tsx` — header/nav/footer shell, now driven by `useAuth()`
  (avatar dropdown shows the real user's name/initials and calls `signOut()`); brand uses `Logo`
  from `wb/`. **Deviation:** the `mockUser`/hardcoded `isAuthed = true` this used to render with
  is gone — `src/lib/mock-data.ts` was deleted outright (nothing else referenced it)
- `src/pages/PricingPage.tsx` — public Free-vs-Pro comparison (shadcn `Card`/`Tabs`/`Dialog`,
  matching `LandingPage`'s styling rather than the `.wb-theme` system); shows a "current plan"
  badge for signed-in users via `usePlan()`
- `src/pages/` — one component per route; `WhiteboardEditorPage` is full-bleed (`wb-app-shell`),
  composing `Canvas` + `Inspector` + topbar (incl. a `SaveIndicator` showing `saveStatus`) +
  `ExportModal`, driven by `useProjectEditor`; `LoginPage` is the sole auth entry point — a
  single "Continue with Google" button (`AuthCard`) wired to `useAuth().signInWithGoogle`,
  with loading/error states and OAuth-failure parsing (`?error=`/`#error=` from Supabase's
  redirect). **Deviation:** `SignupPage` was deleted — see "Why Google OAuth only" above;
  `DashboardPage` adds
  loading-skeleton and error/retry states sourced from `wb-store`

Auth, persistence, loading/error states, and `whiteboard.md` export are all live end-to-end
against Supabase — **nothing in the app is mocked anymore**. Local dev requires a
`frontend/.env.local` (gitignored, copy `.env.example`) with `VITE_SUPABASE_URL`/
`VITE_SUPABASE_ANON_KEY` pointing at a Supabase project that has run
`frontend/supabase/schema.sql`.

## MVP feature scope

In scope: canvas editor with drag/connect, node palette + per-node config panel, save/load
projects (requires auth), `whiteboard.md` export (download), Free/Pro pricing tiers with
plan-gated project limits (see "Pricing & plans") — **but not real billing**, since Pro's
headline feature (Brainstorm) doesn't exist yet.

Explicitly deferred: real-time multiplayer collaboration, version history, workflow template
library, direct/automated Claude Code triggering, image export, **Brainstorm** (the Pro-tier AI
agent assistant — currently a "coming soon" placeholder on `/pricing`), and real payment
processing (Stripe Checkout + webhooks would need Supabase Edge Functions to receive them —
revisit once Brainstorm exists to actually sell).
