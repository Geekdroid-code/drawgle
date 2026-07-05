# Debug Session: openrouter-stream-reasoning

**Status:** [OPEN]

## Bug Report (from user)

1. **Streaming bug** — When using OpenRouter models, the stream is being received on the server (2040 chunks shown in Trigger.dev UI), but the front-end does not show chunks in real-time. The screen only appears at the end of the run.
2. **Reasoning control** — OpenRouter models are over-using thinking. The first "code" event in the trace took 29m 16.4s (likely the reasoning phase). User wants to add the `reasoning` parameter to control effort.
3. **Earlier commit `950280a`** — Already added `lib/ai/openrouter-stream.ts` and a smoke test, but did not solve these. The body sent to OpenRouter does not include `reasoning`.

## Code Map (paths)

| Path | Role |
|---|---|
| `lib/ai/openrouter-stream.ts` | The HTTP streaming layer. Builds the request body. **Does NOT include `reasoning` param.** |
| `lib/ai/provider.ts` | Selects the provider. `getScreenBuilderProvider()` returns `"openrouter"` or `"gemini"`. |
| `lib/generation/service.ts` (line 2483) | `buildScreenStream` calls `generateScreenBuilderContentStream`. |
| `trigger/generate-ui-flow.ts` (line 774) | Pipes the stream via `streams.pipe("code", buildScreenStream(...))`. |
| `route.ts` (project root) | Reference/sample file, uses non-streaming `openrouter.chat.send()`. Not the production path. |

## Hypotheses (3-5, falsifiable)

### H1 — Frontend not subscribed to the Trigger.dev stream
The `streams.pipe("code", ...)` is the Trigger.dev mechanism that forwards chunks to the front-end in real-time. If the front-end code does not subscribe to a stream with that key, it will not see chunks as they arrive. Evidence to collect: grep the front-end for stream subscription, check the run token / handle structure.

### H2 — `reasoning` parameter not sent; model uses internal thinking
The OpenRouter request body does not include `reasoning: { effort: "low" }`. Without it, models like Anthropic Claude and OpenAI o-series default to high reasoning effort, which can take 10+ minutes for screen-build prompts. Evidence: capture the exact JSON body sent to OpenRouter, look at the latency between `before_fetch` and `first_content_token`.

### H3 — `streams.pipe` returns an async iterator; the `for await` loop is not the issue, but the public token may be missing
The `streams.pipe` returns a stream handle with a `publicAccessToken`. The front-end uses this token to subscribe. If the token is not exposed to the front-end, the subscription fails silently and the user only sees the final result.

### H4 — `max_tokens` may be too low, causing silent truncation that looks like "no streaming"
A low `max_tokens` ceiling can cause the model to return very little content after thinking. Evidence: compare the streamed text length with the expected screen code length.

### H5 — `temperature: 0.2` is fine, but `geminiPolicyForTask` may set config that doesn't apply to OpenRouter
The config from `geminiPolicyForTask` is built for Gemini. It may set fields that OpenRouter ignores but may also set a top-p or response format that conflicts. Need to confirm only the relevant fields are sent.

## Plan

1. **Step 1-4**: Hypothesize, instrument, collect evidence. Do not modify business logic yet.
2. **Step 5+**: Once root cause is confirmed, implement minimal fix.
3. **Step 11**: Cleanup after user confirms the fix.

## Static Analysis Findings

| File | Finding |
|---|---|
| `lib/ai/openrouter-stream.ts` (line ~325) | The outgoing body to OpenRouter is `{model, messages, temperature, max_tokens, provider, stream}`. **No `reasoning` field.** |
| `lib/ai/provider.ts` (line ~285) | `streamOpenRouterChatCompletion(...)` is called without any `reasoning` argument. |
| `lib/env/server.ts` | No helper to compute a `reasoning` config from env. |
| `components/ScreenNode.tsx` (line ~571) | Front-end IS subscribed via `useRealtimeRunWithStreams`, joins `triggerStreams.code` chunks. Streaming plumbing is correct. |
| `trigger/generate-ui-flow.ts` (line ~774) | `streams.pipe("code", buildScreenStream(...))` correctly pipes chunks. |

## Root Cause (confirmed by static analysis + user screenshot)

**The 29m 16.4s duration on the first `code` event in the Trigger.dev trace is the model spending 29 minutes on internal reasoning before emitting the first content token.** Because the request body has no `reasoning` field, the model defaults to its maximum thinking effort. Once thinking finishes, the 2040 chunks arrive rapidly, but the front-end only ever shows the joined end result to the user — they perceived this as "streaming doesn't work".

So the two reported bugs collapse into one:
- **Streaming plumbing is correct** (chunks reach server, are piped to front-end, front-end subscribes).
- **The model is over-thinking for ~29 minutes before streaming any content**, which makes the streaming feel broken from the user's perspective.

## Fix Applied (minimal, evidence-driven)

1. **Type**: Added `OpenRouterReasoningConfig` to `lib/ai/openrouter-stream.ts` and `reasoning?: OpenRouterReasoningConfig | null` to `StreamOpenRouterChatCompletionInput`.
2. **Body**: The outgoing body now includes a sanitized `reasoning` field, built from `input.reasoning` (undefined entries stripped so the field is `null` only when explicitly disabled).
3. **Configurable defaults**: Added `getOpenRouterScreenBuildReasoning()` to `lib/env/server.ts`. It reads:
   - `DRAWGLE_OPENROUTER_SCREEN_BUILD_REASONING_ENABLED` (default: enabled)
   - `DRAWGLE_OPENROUTER_SCREEN_BUILD_REASONING_EFFORT` (default: `low`)
   - `DRAWGLE_OPENROUTER_SCREEN_BUILD_REASONING_MAX_TOKENS` (default: unset)
   - `DRAWGLE_OPENROUTER_SCREEN_BUILD_REASONING_EXCLUDE` (default: false)
4. **Wired through**: `lib/ai/provider.ts` now passes `reasoning: getOpenRouterScreenBuildReasoning()` to `streamOpenRouterChatCompletion`.
5. **Instrumentation**: Added an `openrouter:reasoning_configured` emit before `before_fetch` so the next trace will show `hasReasoningInBody: true` and the exact `reasoning` payload.

## Expected Behaviour After Fix

- Screen-build requests will be sent with `reasoning.effort: "low"` (or whatever the user sets).
- Models like Kimi K2.5 and Anthropic Claude will spend far less time thinking before emitting content.
- Chunks will start arriving in seconds, not minutes. The front-end will visibly stream the response.

## Verification Plan

Ask the user to:
1. Trigger a new build.
2. Check the Trigger.dev trace for the new `openrouter:reasoning_configured` event with `hasReasoningInBody: true`.
3. Watch the front-end for real-time chunk updates.
4. Confirm the time from request start to first content token is reasonable (seconds, not 29 minutes).

## Status

[IN PROGRESS] — Awaiting user verification of next run.

