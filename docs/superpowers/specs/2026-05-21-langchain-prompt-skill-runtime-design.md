# LangChain Prompt Skill Runtime Design

Date: 2026-05-21
Project: image2-ui
Status: Design approved for spec review

## Goal

Replace the current hard-coded prompt optimizer with a reusable LangChain-based runtime skill layer that can optimize prompts for image and video generation, while preserving project-specific reference token behavior.

The runtime should do more than beautify prompts. It should:

- understand user intent
- detect unreasonable or conflicting prompt structure
- conservatively fix obvious issues
- lightly fill in missing visual or cinematic details when helpful
- preserve special prompt tokens exactly where required

This should become the shared prompt optimization foundation for:

- text-to-image
- image-to-image
- three-view resource generation
- video generation

## Current Problems

The current implementation in `server/promptOptimizer.ts` is a single hard-coded optimizer flow:

- one fixed system instruction
- one fixed output shape
- no reusable skill abstraction
- no dedicated rule layer for different generation contexts
- no special treatment for video prompt tokens such as `@img1` or `@资源库/...`

This is workable for basic image optimization, but it is too rigid for broader use across image, three-view, and video generation.

## Product Scope

This design covers:

- a LangChain-based runtime prompt optimization layer
- runtime skills for image, img2img identity preservation, three-view generation, and video prompt optimization
- token-preservation rules for `@imgN` and `@资源库/...` references
- prompt reasonableness checks before rewriting
- structured optimization output for image and video routes
- reusing the same runtime across generation routes

This design does not cover:

- replacing the existing video provider integration itself
- agentic multi-step planning with LangGraph
- user-facing prompt optimization presets in the UI
- semantic editing of reference token meaning

## Design Principles

### Preserve intent first

The runtime must not rewrite the user into a different subject, story, or style unless the original prompt strongly implies that change.

### Fix before embellish

The runtime should first identify:

- contradictory instructions
- vague wording that blocks generation quality
- malformed or repetitive prompt structure
- obvious subject or viewpoint conflicts

Only after that should it add small useful details such as:

- composition
- lighting
- material rendering
- camera framing
- motion language for video

### Keep additions conservative

When information is missing, the runtime may fill small gaps, but it should not over-author the scene.

### Preserve special tokens exactly

For video prompts, any token beginning with `@` that represents an existing app reference must be preserved exactly and remain in the same order.

This includes at minimum:

- `@img1`, `@img2`, and similar image mention tokens
- `@资源库/...` resource library path tokens

The optimizer may rewrite surrounding language, but it may not rename, reorder, drop, duplicate, or reinterpret those tokens.

## Architecture

### Shared runtime module

Create a shared runtime entry point:

- `server/promptOptimizer.ts`

This module becomes the orchestration layer, not the place where all rules live.

Responsibilities:

- accept prompt optimization requests
- detect prompt category and route context
- extract and freeze protected tokens when needed
- select the appropriate runtime skill
- invoke a LangChain chain
- validate structured output
- restore and verify protected tokens
- fail safely back to the original prompt

### Runtime skill registry

Create a runtime skill directory:

- `server/prompt-skills/`

Each skill defines:

- when it applies
- the system guidance for that generation mode
- the prompt template variables it expects
- the output schema expectations
- token policy requirements

Initial skills:

- `base-image`
- `img2img-identity`
- `three-view`
- `video-scene`

### Token guard layer

Create a helper module such as:

- `server/promptTokenGuards.ts`

Responsibilities:

- extract protected tokens from prompt text
- replace them with stable placeholders before optimization
- restore them after the model returns
- verify exact token preservation and order

This is especially important for video.

### Schema layer

Create a schema module such as:

- `server/promptOptimizerSchema.ts`

Use `zod` to define structured outputs for:

- image-style optimization
- video-style optimization

LangChain should use structured output against these schemas so the project does not rely on brittle manual JSON extraction.

## LangChain Integration

Use the lightweight LangChain approach rather than a full agent stack.

Recommended packages:

- `@langchain/core`
- `@langchain/openai`
- `zod`

Recommended runtime pattern:

1. select skill
2. build `ChatPromptTemplate`
3. instantiate `ChatOpenAI` with configured `apiKey`, `baseURL`, and optimizer model
4. apply `withStructuredOutput(zodSchema)`
5. invoke the chain
6. post-process and validate token restoration

This keeps the implementation simple and aligned with the current request/response architecture.

## Skill Responsibilities

### `base-image`

Use for standard text-to-image prompts.

Responsibilities:

- improve visual clarity
- fix awkward or conflicting wording
- make subject, environment, composition, and rendering intent clearer
- lightly fill missing detail where helpful

### `img2img-identity`

Use for image-to-image or referenced image generation.

Responsibilities:

- preserve identity, clothing, material, silhouette, and subject continuity
- prioritize requested changes over generic style elaboration
- avoid altering the grounded source subject unless explicitly requested

### `three-view`

Use for front, side, and back character or subject sheet generation.

Responsibilities:

- maintain consistent identity across all views
- enforce view-specific clarity
- avoid drifting proportions, outfit details, or materials
- produce prompts appropriate for asset reuse and video reference generation

This skill should replace the current purely local template-first behavior as the primary optimization layer, while still preserving hard requirements for each angle.

### `video-scene`

Use for text-to-video, image-to-video, first/last frame, multimodal, and continuation prompts.

Responsibilities:

- improve cinematic clarity
- fix contradictory motion or camera instructions
- preserve `@` reference tokens exactly
- strengthen sequencing, motion, framing, pacing, and atmosphere wording without breaking the referenced assets

## Prompt Reasonableness Rules

All runtime skills should check for prompt issues before rewriting.

Examples of issues worth fixing:

- conflicting camera directions
- conflicting subject counts
- contradictory aspect or framing descriptions
- redundant repeated phrases
- vague style spam without a clear main subject
- identity drift instructions in a reference-preserving flow

The runtime may fix these by:

- removing clear contradictions
- collapsing repetition
- clarifying missing subject/action/viewpoint links
- softening impossible combinations into the most likely intended version

The runtime should not:

- replace the main subject
- invent extra characters
- convert a product shot into a cinematic story scene
- drop protected tokens

## Video Token Preservation

For video prompts, protected `@` tokens must be handled with a strict policy:

1. extract tokens in source order
2. replace them with placeholders before sending to the model
3. instruct the model that placeholders represent immutable external references
4. restore original tokens after output
5. verify restored token count and order exactly match the input

If verification fails:

- discard the optimized prompt
- fall back to the original prompt
- mark the optimization result as fallback

This keeps current `@imgN` insertion and `extractResourcePaths()` behavior intact.

## Route Integration

### Image routes

`server/routes/generate.ts` should stop embedding prompt strategy details directly and instead call the shared runtime with route context:

- mode
- reference-image presence
- size
- quality
- background
- output format

### Video routes

`server/routes/video.ts` should call the shared runtime before `buildSeedanceRequestBody(input)`.

Important:

- optimize only the prompt text
- do not change how media are collected
- do not change how `@资源库/...` is resolved into media
- do not change how `@imgN` is inserted by the UI

The optimized prompt becomes the `content[0].text` value in the provider request body.

## Persistence

Both image and video generation history should store prompt optimization metadata inside `generation_history.parameters`.

Recommended metadata:

- `originalPrompt`
- `optimizedPrompt`
- `originalNegativePrompt`
- `optimizedNegativePrompt`
- `intentSummary`
- `optimizationNotes`
- `optimizerSkill`
- `optimizerUsedFallback`
- `protectedTokens`

For video, storing `protectedTokens` helps debugging token preservation issues.

## API Response Shape

Both image and video routes should be able to return optimization metadata for the latest request:

- `originalPrompt`
- `optimizedPrompt`
- `originalNegativePrompt`
- `optimizedNegativePrompt`
- `intentSummary`
- `optimizationNotes`
- `optimizerSkill`
- `optimizerUsedFallback`

This allows future UI surfaces to explain what the runtime changed.

## Failure Handling

Prompt optimization remains best-effort.

If the LangChain call fails because of:

- missing configuration
- unsupported structured output behavior on the provider
- schema validation failure
- token restoration mismatch
- network error

then the route should continue with the original prompt when the downstream generation API is otherwise usable.

## Testing Strategy

Add regression coverage for:

1. skill selection across image, img2img, three-view, and video contexts
2. token extraction and restoration for `@imgN` and `@资源库/...`
3. fallback on token mismatch
4. prompt reasonableness normalization output shape
5. video route integration preserving prompt references
6. image route integration preserving existing generation behavior

## Implementation Order

1. add LangChain and schema dependencies
2. add runtime skill interfaces and registry
3. add token guard utilities
4. refactor `server/promptOptimizer.ts` to LangChain-based orchestration
5. rewire image routes to use the new runtime
6. rewire video route prompt handling to use the new runtime
7. rework three-view generation to select the `three-view` skill
8. extend tests and verification

## Risks And Mitigations

### Over-rewriting prompts

Risk:
The model may still become too opinionated.

Mitigation:
Keep skill system prompts explicit about conservative correction before embellishment.

### Provider compatibility with LangChain structured output

Risk:
Some OpenAI-compatible providers may not fully support provider-native structured output.

Mitigation:
Use LangChain structured output with careful fallback handling, and treat optimization as best-effort.

### Token corruption

Risk:
Video prompt references could break if tokens are modified.

Mitigation:
Add a dedicated token guard layer with exact post-run verification.
