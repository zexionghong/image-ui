# Image Prompt Optimizer Design

Date: 2026-05-21
Project: image2-ui
Status: Design approved for spec review

## Goal

Add a built-in prompt optimization layer for image generation so the app can understand the user's intent, rewrite rough prompts into stronger image-generation prompts, and then continue through the existing text-to-image or image-to-image flow without changing the core generation UX.

The feature should improve output quality for ordinary users while preserving the current "enter prompt and click generate" workflow.

## Current Project Context

The current image generation flow is:

1. `src/components/generate/GeneratePage.tsx` collects prompt, negative prompt, image references, and generation settings.
2. `src/store/useGenerateStore.ts` submits a `FormData` payload to `/api/generate/text2img` or `/api/generate/img2img`.
3. `server/routes/generate.ts` validates input, calls an OpenAI-compatible image endpoint, persists history, and returns the saved result.

Today, the server forwards the user's prompt almost unchanged. There is no intent interpretation, prompt normalization, or prompt-quality feedback layer.

## Product Scope

This design covers:

- automatic prompt optimization before image generation
- intent-aware rewriting for both `text2img` and `img2img`
- optimized negative prompt suggestions
- persistence of original and optimized prompt metadata in generation history parameters
- frontend display of optimization results for the latest generation
- a local project skill documenting how prompt optimization should be handled for future image features

This design does not cover:

- a separate interactive "optimize prompt" page
- prompt optimization for video generation in this change
- user-selectable optimization styles or presets
- model-specific prompt recipes beyond a generic OpenAI-compatible image prompt structure

## User Experience

The primary interaction stays the same:

1. User writes a rough prompt.
2. User clicks generate.
3. The server optimizes the prompt behind the scenes.
4. The optimized prompt is sent to the image API.
5. The UI shows the final image plus a compact summary of how the prompt was interpreted.

The generation page should surface:

- original prompt
- optimized prompt
- optimized negative prompt when present
- short intent summary or optimization note

This display should be informative, not blocking. The user is not asked to approve the rewrite before generation.

## Architecture

### Server-side prompt optimizer

Add a dedicated server module responsible for prompt refinement before image generation. This module should:

- accept the raw user prompt and generation context
- call an LLM using the existing API configuration pattern
- return a structured optimization result
- fail safely by falling back to the raw prompt if optimization cannot complete

Recommended new module:

- `server/promptOptimizer.ts`

This keeps prompt-rewriting logic out of the route handler and makes it reusable from the generate route and later from workflow execution.

### Route integration

`server/routes/generate.ts` should call the optimizer after validating the request and before calling the image API.

Both routes should use the same optimizer:

- `POST /api/generate/text2img`
- `POST /api/generate/img2img`

The route still creates a single generation task and still calls the same image endpoint. The only difference is that the prompt and negative prompt may be replaced by optimized values before the image API call.

### Frontend display

`src/store/useGenerateStore.ts` should store optimization metadata from the server response.

`src/components/generate/GeneratePage.tsx` should show a small result card or info block after generation that displays:

- original prompt
- optimized prompt
- optimized negative prompt
- note such as "intent: product photo with clean studio lighting"

This UI should only appear when optimization metadata exists.

## Optimizer Input And Output

### Input

The optimizer should receive:

- raw `prompt`
- raw `negativePrompt`
- generation mode: `text2img` or `img2img`
- whether reference images exist
- `size`
- `quality`
- `background`
- `outputFormat`

This context helps the optimizer avoid rewriting the prompt in a way that conflicts with the actual generation mode.

### Output

The optimizer should return structured JSON:

- `optimizedPrompt: string`
- `optimizedNegativePrompt: string`
- `intentSummary: string`
- `optimizationNotes: string[]`
- `usedFallback: boolean`

`usedFallback` should be `true` if the optimizer returns the original prompt because of parsing failure, API error, or empty output.

## Prompt Optimization Rules

The optimizer should aim to:

- preserve the user's subject and goal
- make visual details explicit when the user prompt is vague
- organize prompt content into a cleaner image-generation structure
- avoid inventing a different scene or subject
- respect attached reference images by treating them as grounding context, not optional decoration
- keep negative prompt concise and useful rather than dumping a long generic blacklist

For `img2img`, the optimizer should preserve source-image identity and emphasize:

- keep the same subject unless the user explicitly asks to transform it
- use the reference image as the base composition or identity anchor
- change only the requested aspects

## LLM Call Strategy

The optimizer should use the configured API key and base URL already used by image generation.

Recommended behavior:

- use the same provider credentials from request body or environment
- call a chat/completions-style endpoint with a strict JSON response requirement
- default to a lightweight text model if no dedicated optimizer model is configured

Suggested configuration:

- optional env: `OPENAI_PROMPT_OPTIMIZER_MODEL`
- fallback model: request `model` if it is text-capable is not guaranteed, so use a dedicated default such as `gpt-4.1-mini` or another configured text model

The implementation should keep the optimizer model separate from the image model because `gpt-image-2` should not be assumed to behave like a chat completion model.

## Failure Handling

Prompt optimization must never block image generation when the image API itself is otherwise usable.

If optimization fails because of:

- missing optimizer API key
- invalid optimizer response
- network error
- unsupported endpoint

then the system should:

1. log the optimizer failure server-side
2. continue generation with the original prompt and original negative prompt
3. mark the optimization metadata with `usedFallback: true`
4. include a brief note in the response for UI display if useful

This is important because prompt optimization is an enhancement layer, not a hard dependency for core generation.

## Persistence

The existing `generation_history.parameters` JSON field should be extended to store optimization metadata instead of changing the schema immediately.

Recommended fields inside `parameters`:

- `originalPrompt`
- `originalNegativePrompt`
- `optimizedPrompt`
- `optimizedNegativePrompt`
- `intentSummary`
- `optimizationNotes`
- `optimizerUsedFallback`

This avoids a migration while keeping enough detail for history display and debugging.

## API Response Shape

The generate response should include the optimization metadata for the newest result:

- `prompt`
- `negativePrompt`
- `optimizedPrompt`
- `optimizedNegativePrompt`
- `intentSummary`
- `optimizationNotes`
- `optimizerUsedFallback`

The response should remain backward-compatible for existing consumers by keeping current fields like `url`, `id`, and `generation_history_id`.

## Frontend State Changes

`useGenerateStore` should add fields for:

- `optimizedPrompt`
- `optimizedNegativePrompt`
- `intentSummary`
- `optimizationNotes`
- `optimizerUsedFallback`

These should be reset at the start of a new generation and updated from the successful response. If generation fails after optimization, the store should still clear stale optimization results so the UI does not show mismatched metadata.

## Testing Strategy

Add focused tests around the new optimizer behavior.

Recommended coverage:

1. optimizer returns structured prompt data and the route forwards optimized values
2. optimizer failure falls back to original prompt without failing the request builder
3. generation history parameters store both original and optimized prompt metadata
4. frontend store persists optimization metadata from the response

If route-level automated tests are difficult with the current harness, extract the optimizer result normalization into a small pure function and test that directly.

## Local Skill

Add a local skill documenting how image prompt optimization should work in this repository.

Recommended location:

- `.codex/skills/image-prompt-optimizer/SKILL.md`

Purpose:

- describe when this repository should optimize prompts before image generation
- define the preserve-intent rule
- define fallback behavior
- document that image routes should reuse the shared optimizer module instead of reimplementing prompt rewriting ad hoc

This skill is for future development consistency, not for runtime execution in the app.

## Implementation Order

1. add optimizer module and response parser
2. add tests for optimizer normalization or route integration
3. wire optimizer into `server/routes/generate.ts`
4. persist optimization metadata into generation history parameters
5. extend store and generation response handling
6. add optimization result UI in `GeneratePage`
7. add local skill documentation

## Risks And Mitigations

### Wrong prompt rewrites

Risk:
The optimizer may over-interpret vague prompts and change the user's meaning.

Mitigation:
Keep the system prompt strict about preserving user intent and avoiding new subjects, settings, or styles unless implied by the input.

### Provider incompatibility

Risk:
Some configured base URLs may support image generation but not chat completions.

Mitigation:
Treat optimization as best-effort and fall back to the original prompt automatically.

### UI clutter

Risk:
Showing too much optimization detail could make the generate page noisy.

Mitigation:
Use a compact, collapsible, or secondary card below the result rather than expanding the main form.
