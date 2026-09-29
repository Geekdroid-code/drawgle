import { describe, expect, it } from "vitest";
import type { ProjectMessageRow, ProjectNavigationRow, ProjectRow, ScreenRow } from "@/lib/supabase/database.types";
import {
  mapProjectMessageRow, mapProjectNavigationRow, mapProjectRow, mapScreenCatalogRow, mapScreenRow,
  PROJECT_COLUMNS, PROJECT_MESSAGE_COLUMNS, PROJECT_NAVIGATION_COLUMNS, SCREEN_COLUMNS,
} from "@/lib/supabase/mappers";
import { isCompleteRecord, mergeRealtimeRecord } from "@/lib/supabase/realtime-patch";

const projectRow: ProjectRow = {
  id: "project", owner_id: "owner", name: "Pets", prompt: "An app for families with multiple pets", status: "active" as ProjectRow["status"],
  project_charter: { appType: "Pet care", designRationale: "Calm beige" },
  product_planning: null,
  design_tokens: { system_schema: "mobile_universal_core", tokens: { color: { background: { primary: "#F5F1EA" } } } },
  token_revision: 3, public_preview_token: null, public_preview_enabled: false, public_preview_created_at: null,
  next_screen_x: 0, screen_origin_y: 0, created_at: "2026-09-29T08:00:00Z", updated_at: "2026-09-29T08:00:00Z",
};

describe("realtime record merge", () => {
  it("keeps the design tokens when a charter-only update omits them", () => {
    const current = mapProjectRow(projectRow);
    // What Realtime sends for `update projects set project_charter = ...`:
    // every column except unchanged out-of-line (TOAST) values.
    const { design_tokens: _tokens, product_planning: _planning, ...record } = {
      ...projectRow, project_charter: { appType: "Pet care", designRationale: "Batch 2 charter" }, updated_at: "2026-09-29T08:05:00Z",
    };

    expect(isCompleteRecord(record, PROJECT_COLUMNS)).toBe(false);
    expect(mapProjectRow(record as unknown as ProjectRow).designTokens).toBeNull();
    const merged = mergeRealtimeRecord(current, record, mapProjectRow, PROJECT_COLUMNS);
    expect(merged.designTokens).toBe(current.designTokens);
    expect(merged.charter).toEqual({ appType: "Pet care", designRationale: "Batch 2 charter" });
    expect(merged.updatedAt).toBe("2026-09-29T08:05:00Z");
    expect(isCompleteRecord(projectRow, PROJECT_COLUMNS)).toBe(true);
  });

  it("keeps screen source, block index and load state when a status update omits them", () => {
    const row = {
      id: "screen", project_id: "project", owner_id: "owner", generation_run_id: "run", name: "Daily Care Dashboard",
      prompt: "Brief", code: "<div>ready</div>", summary: "Summary", block_index: { version: 1, blocks: [] },
      chrome_policy: { chrome: "bottom-tabs" }, navigation_item_id: "today", parent_screen_id: null, state_key: null,
      state_label: null, state_role: null, roadmap_item_id: "item", position_x: 10, position_y: 20, sort_index: 0,
      status: "ready", error: null, trigger_run_id: "trigger", stream_public_token: "stream", design_revision: 2,
      created_at: "2026-09-29T08:00:00Z", updated_at: "2026-09-29T08:00:00Z",
    } as unknown as ScreenRow;
    const catalogScreen = mapScreenCatalogRow({ ...row, code: undefined, block_index: undefined });
    const { code: _code, prompt: _prompt, block_index: _index, summary: _summary, ...record } = {
      ...row, navigation_item_id: "calendar", updated_at: "2026-09-29T08:05:00Z",
    };

    const merged = mergeRealtimeRecord(mapScreenRow(row), record, mapScreenRow, SCREEN_COLUMNS);
    expect(merged).toMatchObject({ code: "<div>ready</div>", prompt: "Brief", blockIndex: { version: 1, blocks: [] }, navigationItemId: "calendar" });
    expect(mergeRealtimeRecord(catalogScreen, record, mapScreenRow, SCREEN_COLUMNS).sourceLoaded).toBe(false);
  });

  it("keeps the navigation plan and shell, and message metadata, when updates omit them", () => {
    const navigationRow = {
      id: "navigation", project_id: "project", owner_id: "owner", design_revision: 1, status: "ready", error: null,
      plan: { version: 2, enabled: true, kind: "bottom-tabs", decision: "project-native", items: [], visualBrief: "Dock", screenChrome: [] },
      shell_code: "<nav data-drawgle-primary-nav></nav>", block_index: null,
      created_at: "2026-09-29T08:00:00Z", updated_at: "2026-09-29T08:00:00Z",
    } as unknown as ProjectNavigationRow;
    const { plan: _plan, shell_code: _shell, ...navigationRecord } = { ...navigationRow, updated_at: "2026-09-29T08:05:00Z" };
    const heldNavigation = mapProjectNavigationRow(navigationRow);
    const navigation = mergeRealtimeRecord(heldNavigation, navigationRecord, mapProjectNavigationRow, PROJECT_NAVIGATION_COLUMNS);
    expect(navigation.shellCode).toBe("<nav data-drawgle-primary-nav></nav>");
    expect(navigation.plan).toBe(heldNavigation.plan);
    expect(navigation.updatedAt).toBe("2026-09-29T08:05:00Z");

    const messageRow = {
      id: "message", project_id: "project", owner_id: "owner", screen_id: null, role: "system", content: "Created 1 screen",
      message_type: "generation_completed", metadata: { generationJournal: { title: "Created 1 screen" } },
      created_at: "2026-09-29T08:00:00Z",
    } as unknown as ProjectMessageRow;
    const { metadata: _metadata, ...messageRecord } = { ...messageRow, content: "Created 2 screens" };
    const message = mergeRealtimeRecord(mapProjectMessageRow(messageRow), messageRecord, mapProjectMessageRow, PROJECT_MESSAGE_COLUMNS);
    expect(message.metadata).toEqual({ generationJournal: { title: "Created 1 screen" } });
    expect(message.content).toBe("Created 2 screens");
  });
});
