Understood. Completely different architecture than what I proposed. Let me rethink this properly.

The design you want:
1. **Bottom prompt bar** — always visible, single input for everything
2. **Right sidebar chat history** — always visible, read-only, shows all messages + inline plan cards
3. **No input inside the chat panel** — it's just a display
4. **No conditional rendering** — one stream, not filtered by screen
5. **Smart routing** — selected screen → edit, no screen → create, all from one prompt box 

Read [](file:///d%3A/tutorial/2026/apr2026/drawgle/components/ProjectShell.tsx#1-1), lines 1 to 260

Now I have the full picture. Let me update the plan. 

Deleted memory [](file:///c%3A/Users/harva/AppData/Roaming/Code/User/workspaceStorage/d12c2bebb83bd4f740f744f32215e07e/GitHub.copilot-chat/memory-tool/memories/NTZlOWVhYjMtODdjMy00MDg0LThlNjQtMmZlMWJlOGUwZTY1/plan.md)

Created memory file [](file:///c%3A/Users/harva/AppData/Roaming/Code/User/workspaceStorage/d12c2bebb83bd4f740f744f32215e07e/GitHub.copilot-chat/memory-tool/memories/NTZlOWVhYjMtODdjMy00MDg0LThlNjQtMmZlMWJlOGUwZTY1/plan.md)

Here's the updated plan:

---

## Plan: Unified Prompt + Chat History — Agentic Single-Input Architecture

Two components, always visible, never conditional:
1. **PromptBox** (bottom center) — single input for ALL intents. Smart routing: selected screen → edit, no screen → create.
2. **ChatHistoryPanel** (right sidebar) — read-only message stream + inline plan cards. **No input box.** Always shows ALL messages. Never filtered by screen selection.

AddScreenSidebar killed. No collapsed/expanded modes. No conditional rendering.

**Steps**

### Phase 1: Create `PromptBox` (new file)
1. Create `components/PromptBox.tsx` — standalone prompt input extracted from ChatPanel's collapsed bar
2. Props: `selectedScreen`, `disabled`, `onSend(prompt, image?)`, `isProcessing`, `agentStatus`, `onSelectScreen`, `onDeleteScreen`
3. Selected screen context banner ("Editing: X" with deselect/delete buttons)
4. Textarea + send + image upload (image only in create mode)
5. Agent status pill floating above when processing
6. Positioned absolute bottom-center, max-w-2xl — same spot as current collapsed bar

### Phase 2: Rewrite `ChatPanel.tsx` → `ChatHistoryPanel`
7. Strip ALL input code: textarea, send button, image upload, `handleSend`, `handleImageUpload`, prompt/image state, `onPromptSubmit` prop
8. Remove `isExpanded` state and the entire collapsed bar branch
9. Always render as right sidebar (`right-0 top-16 bottom-0 w-[360px]`)
10. Show ALL messages unfiltered — one unified stream regardless of screen selection
11. Add `screenPlan`, `isBuilding`, `onBuildPlannedScreen`, `onCancelPlan` props
12. Add inline `PlanCard` sub-component: planning spinner / ready card with Build+Cancel / error card — replaces AddScreenSidebar
13. Render PlanCard at bottom of message list when `screenPlan` is non-null

### Phase 3: Rewire ProjectShell.tsx
14. Remove `AddScreenSidebar` import and JSX
15. Import `PromptBox` + updated `ChatHistoryPanel`
16. Move edit flow logic (fetch `/api/chat`, `applyEdits`, `updateScreenCode`) from ChatPanel into a new `handlePromptSend` in ProjectShell:
    - Selected screen → post user message to DB, call `/api/chat`, stream response, apply diffs
    - No screen → post user message, call `planSingleScreen`, show plan card inline
17. Mount `ChatHistoryPanel` **once**, unconditional — passes `project`, `screens`, `selectedScreen`, `screenPlan`, `isBuilding`, `onBuildPlannedScreen`, `onCancelPlan`
18. Mount `PromptBox` **once**, unconditional — passes `selectedScreen`, `disabled`, `onSend`, `isProcessing`, `agentStatus`
19. Add `isProcessing` + `agentStatus` state to ProjectShell for the status pill
20. Edit flow posts user message to `project_messages` BEFORE calling `/api/chat` so it appears in chat immediately via Realtime

**Relevant files**
- `components/PromptBox.tsx` — NEW: standalone prompt input
- ChatPanel.tsx — REWRITE: read-only sidebar with PlanCard, no input
- ProjectShell.tsx — REWIRE: single mount of both, edit/create routing logic moves here

**Verification**
1. Zero compile errors on all 3 files
2. PromptBox always visible at bottom center — regardless of screen selection
3. ChatHistoryPanel always visible as right sidebar — ALL messages always shown
4. Create flow: type prompt → message appears in chat → plan card inline → Build button → generates
5. Edit flow: select screen, type prompt → message appears in chat → edit streams → result in chat
6. No AddScreenSidebar Sheet ever appears
7. Deselecting a screen does NOT hide or change the chat history

**Decisions**
- PromptBox is a separate component, not inside ChatPanel
- Edit flow logic moves from ChatPanel into ProjectShell (keeps ChatPanel purely presentational)
- ChatPanel file keeps its filename to minimize import changes but component renamed
- Mobile layout deferred
- AddScreenSidebar.tsx kept on disk, just not imported