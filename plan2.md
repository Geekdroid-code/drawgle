# Plan: Unified Chat Panel — Production-Grade Upgrade

## TL;DR
Replace the split PromptBar/ScreenEditorPanel UX with a single persistent ChatPanel that handles both "create new screen" and "edit existing screen" flows in one unified conversation thread. Add project-level chat history, agentic status messages, and vector-embedded message context for efficient retrieval.

## Current State Summary

### What exists:
- **PromptBar** (bottom center): visible when NO screen selected → plans + builds a new screen
- **ScreenEditorPanel** (right sidebar): visible when screen IS selected → edit chat per screen
- **screen_messages** table: raw text messages per screen_id, no embeddings
- **block-index system**: already scoped edits via `<edit>` blocks — good, production-ready
- **diff-engine**: applies `<edit>` blocks with flexible matching — good
- **summary + embedding on screens**: used for project context RAG when planning new screens

### Problems:
1. UI swaps entirely between two components — jarring, not how production tools work
2. screen_messages are per-screen only — no project-level conversation continuity
3. No vector embeddings on messages — all raw text sent to LLM every time
4. No agentic status visualization in chat (just "Applied changes" checkmark)
5. Creating new screens and editing existing ones feel like completely different workflows
6. Chat history is lost when user deselects a screen

---

## Architecture

### New data model

**New table: `project_messages`** (replaces per-screen-only `screen_messages` for the unified thread)
- `id uuid PK`
- `project_id uuid FK → projects`
- `owner_id uuid FK → profiles`
- `screen_id uuid FK → screens NULLABLE` — which screen this message is about (null = project-level)
- `role message_role` — user | model | system
- `content text` — the message text
- `message_type text` — 'chat' | 'edit_applied' | 'screen_created' | 'generation_started' | 'generation_completed' | 'error'
- `metadata jsonb` — flexible payload (e.g., { screenName, editBlockCount, generationRunId })
- `summary text NULLABLE` — AI-generated summary for retrieval
- `embedding vector(768) NULLABLE` — for semantic search across conversation
- `created_at timestamptz`

**Keep `screen_messages`** as-is for backward compat but stop writing to it from new flows.

### Unified ChatPanel Component

Single component replaces both PromptBar and ScreenEditorPanel:
- Always visible at bottom/right of canvas
- Shows project-level conversation thread
- When user selects a screen, messages tagged with that screen_id get highlighted/filtered
- Input box works for BOTH creating new screens and editing selected ones
- Agent determines intent from context (selected screen + prompt text)

### Intent Detection (backend)

New `/api/chat` route replaces direct `/api/edit` and `/api/plan` calls:
1. Receives: `{ projectId, prompt, image?, selectedScreenId? }`
2. Determines intent:
   - Screen selected + edit-like prompt → scoped edit flow (existing block-index system)
   - No screen selected + creation prompt → plan + build flow (existing generation pipeline)
   - Screen selected + "create a new screen" prompt → new screen flow despite selection
3. Executes the appropriate pipeline
4. Writes system messages to `project_messages` for agentic status

### Chat Context Window (retrieval)

Instead of sending ALL messages to the LLM:
1. Always include: last 6 messages (recency)
2. Semantic retrieval: embed current prompt → match against `project_messages.embedding` → top 5 relevant messages
3. Screen context: if editing, include the scoped block context (already working)
4. Project context: charter + design tokens + relevant screen summaries (already working)

### Agentic Status Messages

System messages inserted into chat to show agent work:
- "Planning screen: Login Screen..."
- "Building 3 screens..." (with progress updates via Realtime)
- "Editing Header block in Dashboard..."
- "✓ Applied 2 changes to Dashboard"
- "✓ Created Login Screen, Signup Screen"

---

## Steps

### Phase 1: Database & Backend (blocks Phase 2)

1. Create migration `project_messages` table with vector column, indexes, RLS policies, and `match_project_messages` RPC function
   - Files: `supabase/migrations/2026XXXX_project_messages.sql`
   
2. Add `project_messages` types to `lib/supabase/database.types.ts` (or regenerate)
   - Files: `lib/supabase/database.types.ts`

3. Add queries: `fetchProjectMessages`, `insertProjectMessage`, `matchProjectMessages`
   - Files: `lib/supabase/queries.ts`

4. Add mapper for project message rows
   - Files: `lib/supabase/mappers.ts`

5. Create `hooks/use-project-messages.ts` — Realtime subscription on `project_messages` filtered by project_id
   - Files: `hooks/use-project-messages.ts`

### Phase 2: Unified Chat API (*depends on Phase 1*)

6. Create `/api/chat/route.ts` — intent detection + dispatch:
   - Parse prompt + selectedScreenId
   - If edit intent → delegate to existing `editScreenStream` (keep block-index scoping)
   - If create intent → delegate to existing plan + enqueueGeneration flow
   - Write user message + system status messages to `project_messages`
   - Stream response back
   - Files: `app/api/chat/route.ts`

7. Add message embedding pipeline — after saving model response, fire-and-forget embed the message summary
   - Reuse existing `generateEmbedding` from `lib/generation/embeddings.ts`
   - Files: `app/api/chat/route.ts` or a new Trigger.dev task

8. Add context assembly for chat — build retrieval context from `project_messages` embeddings + last N messages
   - Files: `lib/generation/context.ts` (extend `assembleProjectContext` or new function)

### Phase 3: Unified ChatPanel Component (*depends on Phase 2*)

9. Create `components/ChatPanel.tsx` — replaces both PromptBar and ScreenEditorPanel:
   - Persistent position (bottom bar collapsed, expandable to right sidebar)
   - Shows conversation thread with message type indicators
   - Screen-tagged messages get screen name badge
   - Input box with image upload (from PromptBar)
   - Selected screen indicator in input area (shows which screen edits target)
   - Agentic status bubbles (spinner, progress, checkmarks)
   - Files: `components/ChatPanel.tsx`

10. Update `components/ProjectShell.tsx`:
    - Remove conditional PromptBar / ScreenEditorPanel rendering
    - Mount single ChatPanel always
    - Pass selectedScreen, project, generationRun state
    - Wire ChatPanel onSubmit to `/api/chat`
    - Files: `components/ProjectShell.tsx`

11. Update or deprecate `components/ScreenEditorPanel.tsx` and `components/PromptBar.tsx`
    - Keep files but stop mounting them from ProjectShell

### Phase 4: Agentic Status Messages (*parallel with Phase 3*)

12. Update `trigger/generate-ui-flow.ts` to write system messages to `project_messages`:
    - "Planning screens..." when status = planning
    - "Building Screen Name..." when each screen starts
    - "✓ Screen Name ready" when each screen completes
    - Files: `trigger/generate-ui-flow.ts`

13. Update edit flow to write system messages:
    - "Editing [block names] in [screen name]..."
    - "✓ Applied N changes"
    - Files: `app/api/chat/route.ts`

---

## Relevant Files

- `supabase/migrations/20260417000100_initial_drawgle.sql` — existing schema reference
- `supabase/migrations/20260418020000_pgvector_screen_embeddings.sql` — existing vector setup to mirror
- `components/ScreenEditorPanel.tsx` — to be replaced by ChatPanel
- `components/PromptBar.tsx` — to be replaced by ChatPanel
- `components/ProjectShell.tsx` — wire new ChatPanel, remove old conditional mounts
- `app/api/edit/route.ts` — keep as internal, called by new `/api/chat`
- `app/api/plan/route.ts` — keep as internal, called by new `/api/chat`
- `app/api/generations/route.ts` — keep as internal, called by new `/api/chat`
- `lib/generation/block-index.ts` — keep entirely, `detectTargetBlocks` + `buildScopedEditContext` already production-grade
- `lib/diff-engine.ts` — keep entirely, `applyEdits` already handles flexible matching
- `lib/generation/service.ts` — `editScreenStream` stays, used by `/api/chat`
- `lib/generation/context.ts` — extend with message-level retrieval
- `lib/generation/embeddings.ts` — reuse for message embeddings
- `hooks/use-screen-messages.ts` — deprecate in favor of `use-project-messages.ts`
- `trigger/generate-ui-flow.ts` — add system message writes

## Verification

1. Create a project, generate 3 screens → verify all 3 show agentic status messages in chat ("Planning...", "Building Screen X...", "✓ Ready")
2. Select a screen, type "make the button red" → verify scoped edit via block-index, chat shows "Editing button-1 in Dashboard..." then "✓ Applied 1 change"
3. With screen selected, type "create a settings screen" → verify intent detection routes to creation flow, not edit
4. Deselect screen, type "add a profile page" → verify new screen creation flow
5. After 10+ messages, verify only relevant context is sent to LLM (not all messages)
6. Verify `project_messages` embeddings are populated asynchronously
7. Verify chat thread persists across page refresh
8. Run with 5+ screens to verify no context bloat

## Decisions

- **Keep `screen_messages` table** — no destructive migration, just stop writing to it from new code
- **`project_messages` over extending `screen_messages`** — project-level thread needs nullable screen_id which changes the fundamental model
- **Block-index scoped editing stays exactly as-is** — it's already the correct approach (same as Cursor/v0 diff-based editing)
- **Intent detection on backend, not frontend** — avoids UI state machine complexity; backend has full context
- **concurrencyLimit 2 per project for Gemini** — already implemented, stays

## Further Considerations (For LAunch V2)

1. **Message pruning** — For very long conversations (100+ messages), should we auto-summarize old messages? Recommendation: Yes, add a "conversation summary" system message every 50 messages and archive older ones.
2. **Multi-screen edits** — Should a single prompt be able to edit multiple screens at once ("make all buttons blue across all screens")? Recommendation: Defer to v2, keep single-screen edits for now.
3. **Undo/redo** — Should chat support "undo last edit"? Recommendation: Defer, but the `screen_messages` history + version tracking would make this feasible later.
