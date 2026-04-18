# Production Rebuild Plan — Drawgle

## TL;DR
Replace the current "name project → canvas → PromptBar → ArtDirectorPanel" flow with a dedicated Project Lobby page (like Google Stitch). Add project memory so later generations have context. Add block-scoped editing so edits don't dump full code to LLM. Deliver in 4 independent phases, each verified before the next starts.

---

## Phase 1: Project Lobby Page + Project Charter

Status: implemented on Apr 18, 2026.

**Goal:** Dedicated project setup experience before the canvas. User enters prompt, uploads reference image, reviews/tweaks design system, sees planned screen briefs, then hits "Build" → redirect to canvas.

### 1.1 Database: Project Charter
- Migration: Add `project_charter jsonb` to `projects` table
- Charter schema: `{ originalPrompt, imageReferenceSummary, appType, targetAudience, navigationModel, keyFeatures[], designRationale }`
- Update `lib/types.ts`: Add `ProjectCharter` interface, add `charter?: ProjectCharter | null` to `ProjectData`
- Update `lib/supabase/database.types.ts`: Add `project_charter` column
- Update `lib/supabase/mappers.ts`: Map `project_charter` → `charter`

### 1.2 New Page: `/project/new`
- Create `app/project/new/page.tsx` as an authenticated server page that renders `components/ProjectLobby.tsx`
- Center prompt area with:
  - Large textarea for prompt (simple 2-liner or full app brief)
  - Image upload button (reuse PromptImagePayload pattern from PromptBar)
  - "Generate" button
- On submit:
  1. Call POST `/api/design` with prompt + image → get design tokens
  2. Show design token preview/editor via `components/DesignSystemEditor.tsx`
  3. User tweaks tokens → clicks "Continue"
  4. Call POST `/api/plan` with prompt + image + approved design tokens → get screen briefs + project charter
  5. Show screen brief cards (name, type, description) — user can review
  6. "Build All" button → POST `/api/generations` with reviewed screens + charter (creates project + generation run + triggers Trigger.dev without replanning) → `router.push(/project/[id])`

### 1.3 Update Dashboard
- `components/DashboardShell.tsx`: Change "Start Project" to navigate to `/project/new` instead of creating an empty project directly
- Remove the inline project creation logic (createProject call)

### 1.4 Remove Draft-Mode from Canvas
- `components/ProjectShell.tsx`: Remove the `project.status === "draft"` conditional that shows ArtDirectorPanel overlay
- `components/ProjectShell.tsx`: Remove `needsDesign` logic from `handlePromptSubmit` — PromptBar on canvas is now always for adding screens to an existing project, never for initial setup
- `components/DesignSystemEditor.tsx`: New reusable token editor for the lobby flow

### 1.5 Store Charter on Generation
- `app/api/generations/route.ts`: When creating a new project (no projectId), also store the charter
- `trigger/generate-ui-flow.ts`: Accept reviewed screens + charter from the lobby and persist the charter to the project row

### 1.6 Verification
- Create a new project from dashboard → lands on lobby page
- Enter prompt + upload image → see design tokens → tweak → continue
- See screen briefs → hit "Build All" → redirect to canvas
- Screens generate and stream as before
- Old canvas flow no longer shows ArtDirectorPanel overlay
- `npm run check` passes

**Files modified:**
- NEW: `supabase/migrations/20260418010000_project_charter.sql`
- NEW: `app/project/new/page.tsx`
- NEW: `components/ProjectLobby.tsx`
- NEW: `components/DesignSystemEditor.tsx`
- EDIT: `lib/types.ts` (ProjectCharter interface)
- EDIT: `lib/supabase/database.types.ts` (project_charter column)
- EDIT: `lib/supabase/mappers.ts` (charter mapping)
- EDIT: `components/DashboardShell.tsx` (navigate to /project/new)
- EDIT: `components/PromptBar.tsx` (canvas prompt no longer handles first-run design flow)
- EDIT: `components/ProjectShell.tsx` (remove draft/ArtDirectorPanel overlay)
- EDIT: `app/api/plan/route.ts` (accept approved design tokens)
- EDIT: `app/api/generations/route.ts` (store charter)
- EDIT: `lib/generation/service.ts` (planner now returns charter + screens)
- EDIT: `lib/generation/prompts.ts` (planner prompt returns charter JSON)
- EDIT: `trigger/generate-ui-flow.ts` (build from reviewed plan without silent replanning)

---

## Phase 2: Vector-Based Project Memory (RAG)

**Goal:** After generation, store screen summaries + vector embeddings. Use semantic similarity search (RAG) to retrieve only relevant context for new requests. Scales to 50+ screens without context blowup.

### Architecture
- **Embedding model:** `gemini-embedding-001` via `@google/genai` (already installed, zero new deps). 768 dimensions (MTEB 67.99, best perf/storage balance per Supabase benchmarks).
- **Storage:** pgvector extension in Supabase. `embedding vector(768)` column on `screens` table.
- **Retrieval:** Embed user's new prompt → cosine similarity search via Supabase RPC function → retrieve top-K relevant screen summaries (NOT all screens).
- **Context budget:** Charter (~100 tokens, always) + design tokens (~200 tokens, always) + top-5 relevant screen summaries (~500 tokens) = ~800 tokens total regardless of project size.

### 2.1 Enable pgvector + Schema
- Migration: Enable `vector` extension, add `summary text` and `embedding extensions.vector(768)` columns to `screens` table
- Create HNSW index: `CREATE INDEX ON screens USING hnsw (embedding vector_cosine_ops);`
- Create Postgres RPC function `match_screens(query_embedding vector(768), p_project_id uuid, match_threshold float, match_count int)` → returns screen id, name, summary, similarity score, filtered by project_id, ordered by cosine distance

### 2.2 Embedding Helper
- New: `lib/generation/embeddings.ts`
  - `generateEmbedding(text: string, taskType: 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY'): Promise<number[]>` — calls `client.models.embedContent({ model: 'gemini-embedding-001', contents: text, config: { taskType, outputDimensionality: 768 } })`
  - `generateScreenSummary(screenName: string, screenCode: string): Promise<string>` — calls Gemini to produce 2-3 sentence summary of the screen

### 2.3 Store Summaries + Embeddings After Build
- `trigger/generate-ui-flow.ts` → in `buildScreenTask`, after screen code is ready:
  1. Call `generateScreenSummary(screenName, code)` → get summary text
  2. Call `generateEmbedding(summary, 'RETRIEVAL_DOCUMENT')` → get 768-dim vector
  3. Update screen row with `summary` + `embedding`

### 2.4 Context Assembler (RAG Retrieval)
- New: `lib/generation/context.ts`
  - `assembleProjectContext(projectId: string, userPrompt: string): Promise<string>`
  - Always fetches: project charter + design tokens (tiny, fixed cost)
  - Embeds `userPrompt` via `generateEmbedding(userPrompt, 'RETRIEVAL_QUERY')`
  - Calls `match_screens` RPC with query embedding + project_id → gets top-5 relevant screen summaries
  - Composes compact context string (~800 tokens total regardless of 5 or 500 screens)

### 2.5 Wire Into Generation
- `trigger/generate-ui-flow.ts`: Before `planUiFlow()`, call `assembleProjectContext()` and pass result as additional context
- `lib/generation/service.ts` → `planUiFlow()`: Accept optional `projectContext` param
- `lib/generation/prompts.ts`: Update planner instruction to use retrieved context

### 2.6 Verification
- Generate a 3-screen project → check summaries + embeddings stored in DB (768-dim vectors)
- Add 4th screen → verify only relevant screens retrieved via similarity search (not all 3)
- Check Trigger.dev logs: context string stays ~800 tokens
- Stress test: 10-screen project → add 11th → context still ~800 tokens, not growing
- `npm run check` passes

**Files modified:**
- NEW: `supabase/migrations/YYYYMMDD_pgvector_screen_embeddings.sql`
- NEW: `lib/generation/embeddings.ts`
- NEW: `lib/generation/context.ts`
- EDIT: `lib/supabase/database.types.ts` (summary + embedding columns)
- EDIT: `lib/supabase/mappers.ts` (summary mapping — embedding stays server-side only)
- EDIT: `lib/types.ts` (summary field on ScreenData — no embedding sent to client)
- EDIT: `trigger/generate-ui-flow.ts` (generate summaries + embeddings after build, assemble context before planning)
- EDIT: `lib/generation/service.ts` (accept projectContext in planUiFlow, buildScreenStream)
- EDIT: `lib/generation/prompts.ts` (context-aware planner prompt)

---

## Phase 3: Canvas — Add-Screen Sidebar Flow

**Goal:** When user wants to add a screen on canvas, use a sidebar-based flow with planning preview before building.

### 3.1 New Screen Request Mode
- `components/PromptBar.tsx`: When project already has screens and design tokens, submitting a prompt enters "add screen" mode
- Instead of immediately queueing generation, show a sidebar with the planned screen brief
- User reviews brief → clicks "Build" → single screen generates

### 3.2 Add-Screen Sidebar Component
- NEW: `components/AddScreenSidebar.tsx`
  - Shows: "Planning your screen..." → screen brief card → "Build" / "Cancel" buttons
  - On "Build": calls `/api/generations` with the single screen plan + project context
  - On "Cancel": dismisses sidebar, returns to PromptBar

### 3.3 Single-Screen Generation Path
- `app/api/generations/route.ts`: Accept optional `singleScreenPlan` parameter
- `trigger/generate-ui-flow.ts`: If `singleScreenPlan` provided, skip planner and build just that one screen
- Context assembler provides project memory so the new screen is coherent with existing ones

### 3.4 Verification
- Project with 3 screens → enter prompt in PromptBar → see sidebar with planned screen
- Approve → 4th screen builds with project context → appears on canvas
- Cancel → nothing happens, PromptBar returns
- `npm run check` passes

**Files modified:**
- NEW: `components/AddScreenSidebar.tsx`
- EDIT: `components/ProjectShell.tsx` (wire sidebar state)
- EDIT: `components/PromptBar.tsx` (add-screen mode)
- EDIT: `app/api/generations/route.ts` (single screen plan)
- EDIT: `trigger/generate-ui-flow.ts` (single screen path)

---

## Phase 4: Block-Scoped Screen Editing

**Goal:** Don't send full screen code for every edit. Index generated code into blocks, send only relevant blocks to LLM.

### 4.1 Screen Code Indexing
- New helper: `lib/generation/block-index.ts`
  - `indexScreenCode(html: string)` → parses HTML into named blocks (header, hero, content-section-N, nav, footer, etc.)
  - Each block: `{ id, name, startLine, endLine, code, parentId? }`
  - Store block manifest as `screen.block_index jsonb` after generation

### 4.2 Block-Scoped Edit Routing
- `lib/generation/service.ts` → `editScreenStream()`: Accept optional `blockIndex` and `targetBlockIds`
- If target blocks identified: send only those blocks + their parent container + neighboring blocks as context (not the whole screen)
- Edit instruction updated to work with block-scoped context

### 4.3 Target Block Detection
- Before calling edit API, analyze user's edit prompt to identify which blocks are affected
- Simple heuristic first: keyword matching against block names/content
- LLM-based detection as fallback for ambiguous requests

### 4.4 Migration: Block Index Column
- Add `block_index jsonb` to `screens` table
- After generation completes, run `indexScreenCode()` and store result

### 4.5 Verification
- Generate a screen → check block_index stored in DB
- Edit "change the header color" → verify only header block sent to LLM (check logs)
- Edit applies correctly to the targeted block
- Full-screen fallback still works for complex restructuring
- `npm run check` passes

**Files modified:**
- NEW: `supabase/migrations/YYYYMMDD_screen_block_index.sql`
- NEW: `lib/generation/block-index.ts`
- EDIT: `lib/supabase/database.types.ts` (block_index column)
- EDIT: `lib/supabase/mappers.ts` (block_index mapping)
- EDIT: `lib/types.ts` (blockIndex field on ScreenData)
- EDIT: `lib/generation/service.ts` (block-scoped editScreenStream)
- EDIT: `lib/generation/prompts.ts` (block-scoped edit instruction)
- EDIT: `components/ScreenEditorPanel.tsx` (pass block context to edit API)
- EDIT: `app/api/edit/route.ts` (accept block targeting params)
- EDIT: `trigger/generate-ui-flow.ts` (index blocks after build)

---

## Decisions
- `/api/plan` route is currently unused but will be revived in Phase 1 for the lobby page planning step
- `/api/build` route stays dead — building always goes through Trigger.dev
- Draft-mode overlay is removed from canvas; the lobby now owns first-run design/planning, and `DesignSystemEditor` is the reusable editor component
- Project prompt is no longer overwritten on each generation — charter stores the original intent, generation_runs store per-run prompts
- Image upload on canvas (PromptBar) is restricted to "add screen" context only, not "create a different app"

## Scope Boundaries
- **Included:** Project lobby, project memory, context assembly, add-screen sidebar, block-scoped editing
- **Excluded (future):** Component library extraction, multi-user collaboration, web/desktop target modes, version history/undo
