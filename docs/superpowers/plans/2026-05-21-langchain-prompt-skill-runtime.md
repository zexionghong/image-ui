# LangChain Prompt Skill Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current hard-coded prompt optimizer with a LangChain-based runtime skill system for image, video, and three-view generation while preserving protected `@` tokens and falling back safely on errors.

**Architecture:** Build a shared prompt optimization runtime around `ChatPromptTemplate`, `ChatOpenAI`, and `withStructuredOutput(zodSchema)`. Keep skill selection, token freezing/restoration, and route integration separate so image, video, and three-view flows reuse one runtime without changing existing media upload or reference-resolution behavior.

**Tech Stack:** TypeScript, Express, React, Zustand, LangChain JS, Zod, tsx-based tests, Vite build

---

### File Structure

**Create:**
- `server/promptOptimizerSchema.ts` - Zod schemas and shared optimization result types
- `server/promptTokenGuards.ts` - protected token extraction, placeholder substitution, restoration, and verification
- `server/prompt-skills/types.ts` - runtime skill interfaces
- `server/prompt-skills/baseImage.ts` - standard text-to-image skill
- `server/prompt-skills/img2imgIdentity.ts` - image-reference-preserving image skill
- `server/prompt-skills/threeView.ts` - three-view image skill
- `server/prompt-skills/videoScene.ts` - video prompt skill with protected token rules
- `server/prompt-skills/index.ts` - skill registry and selector
- `tests/promptTokenGuards.test.ts` - token guard regression coverage
- `tests/videoPromptOptimizer.test.ts` - video prompt integration coverage

**Modify:**
- `package.json` - add LangChain and Zod dependencies if missing
- `server/promptOptimizer.ts` - replace manual JSON optimizer with LangChain runtime orchestration
- `server/routes/generate.ts` - use skill-aware optimizer context and persist skill metadata
- `server/routes/video.ts` - optimize video prompt before provider request body generation
- `src/store/useGenerateStore.ts` - extend metadata with optimizer skill if returned
- `src/components/generate/GeneratePage.tsx` - optionally show optimizer skill label if desired
- `src/store/useResourceStore.ts` - provide three-view context so the runtime selects the `three-view` skill
- `tests/promptOptimizer.test.ts` - update assertions to fit the new schema-driven runtime
- `tests/videoRequestBody.test.ts` - verify optimized prompt text is accepted without breaking content layout
- `docs/skills/image-prompt-optimizer/SKILL.md` - align the repo skill doc with the new runtime layout

---

### Task 1: Add LangChain runtime dependencies and schemas

**Files:**
- Modify: `package.json`
- Create: `server/promptOptimizerSchema.ts`
- Test: `tests/promptOptimizer.test.ts`

- [ ] **Step 1: Write the failing test**

Update `tests/promptOptimizer.test.ts` to assert that schema-normalized results include `optimizerSkill` and `protectedTokens`:

```ts
import assert from 'node:assert/strict'
import { normalizePromptOptimizerResult } from '../server/promptOptimizer'

const normalized = normalizePromptOptimizerResult({
  optimizedPrompt: 'hero product photo of premium sneakers',
  optimizedNegativePrompt: 'blurry',
  intentSummary: 'premium sneaker campaign',
  optimizationNotes: ['removed repetition'],
  optimizerSkill: 'base-image',
  protectedTokens: [],
}, {
  prompt: 'shoe ad',
  negativePrompt: '',
  reason: 'unused',
})

assert.equal(normalized.optimizerSkill, 'base-image')
assert.deepEqual(normalized.protectedTokens, [])
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx tests/promptOptimizer.test.ts`  
Expected: FAIL because `optimizerSkill` and `protectedTokens` are not part of the normalized result yet.

- [ ] **Step 3: Write minimal implementation**

Add dependencies:

```json
"@langchain/core": "^0.x",
"@langchain/openai": "^0.x",
"zod": "^3.x"
```

Create `server/promptOptimizerSchema.ts`:

```ts
import { z } from 'zod'

export const promptOptimizationSchema = z.object({
  optimizedPrompt: z.string().min(1),
  optimizedNegativePrompt: z.string().default(''),
  intentSummary: z.string().default(''),
  optimizationNotes: z.array(z.string()).default([]),
  optimizerSkill: z.string().min(1),
})

export type PromptOptimizationStructuredOutput = z.infer<typeof promptOptimizationSchema>
```

Extend the normalized return shape in `server/promptOptimizer.ts`:

```ts
optimizerSkill: typeof raw.optimizerSkill === 'string' && raw.optimizerSkill.trim() ? raw.optimizerSkill : 'base-image',
protectedTokens: fallback?.protectedTokens || [],
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx tests/promptOptimizer.test.ts`  
Expected: PASS with new schema fields present in normalized results.

- [ ] **Step 5: Commit**

```bash
git add package.json server/promptOptimizerSchema.ts server/promptOptimizer.ts tests/promptOptimizer.test.ts
git commit -m "feat: add prompt optimizer schemas"
```

### Task 2: Add protected token guards for video prompts

**Files:**
- Create: `server/promptTokenGuards.ts`
- Create: `tests/promptTokenGuards.test.ts`
- Test: `tests/promptTokenGuards.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/promptTokenGuards.test.ts`:

```ts
import assert from 'node:assert/strict'
import {
  freezeProtectedPromptTokens,
  restoreProtectedPromptTokens,
} from '../server/promptTokenGuards'

const frozen = freezeProtectedPromptTokens('use @img1 with @资源库/角色A/三视图/正面 and keep motion soft')

assert.equal(frozen.tokens.length, 2)
assert.match(frozen.prompt, /__PROMPT_TOKEN_0__/)
assert.match(frozen.prompt, /__PROMPT_TOKEN_1__/)

const restored = restoreProtectedPromptTokens(
  'use __PROMPT_TOKEN_0__ with __PROMPT_TOKEN_1__ and keep motion soft',
  frozen.tokens,
)

assert.equal(restored.prompt, 'use @img1 with @资源库/角色A/三视图/正面 and keep motion soft')
assert.equal(restored.valid, true)

const mismatch = restoreProtectedPromptTokens('use __PROMPT_TOKEN_1__ before __PROMPT_TOKEN_0__', frozen.tokens)
assert.equal(mismatch.valid, false)

console.log('promptTokenGuards tests passed')
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx tests/promptTokenGuards.test.ts`  
Expected: FAIL because `server/promptTokenGuards.ts` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Create `server/promptTokenGuards.ts`:

```ts
const PROTECTED_TOKEN_PATTERN = /@img\d+|@资源库\/[^\s,，。；;！!？?]+/g

export function freezeProtectedPromptTokens(prompt: string) {
  const tokens = Array.from(prompt.matchAll(PROTECTED_TOKEN_PATTERN)).map((match, index) => ({
    value: match[0],
    placeholder: `__PROMPT_TOKEN_${index}__`,
  }))

  let frozenPrompt = prompt
  for (const token of tokens) {
    frozenPrompt = frozenPrompt.replace(token.value, token.placeholder)
  }

  return { prompt: frozenPrompt, tokens }
}

export function restoreProtectedPromptTokens(prompt: string, tokens: Array<{ value: string; placeholder: string }>) {
  let restored = prompt
  for (const token of tokens) {
    restored = restored.replace(token.placeholder, token.value)
  }

  const restoredTokens = Array.from(restored.matchAll(PROTECTED_TOKEN_PATTERN)).map((match) => match[0])
  const valid = restoredTokens.length === tokens.length && restoredTokens.every((value, index) => value === tokens[index].value)
  return { prompt: restored, valid }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx tests/promptTokenGuards.test.ts`  
Expected: PASS with token count, placeholder insertion, and mismatch detection verified.

- [ ] **Step 5: Commit**

```bash
git add server/promptTokenGuards.ts tests/promptTokenGuards.test.ts
git commit -m "feat: guard protected prompt tokens"
```

### Task 3: Add runtime skill registry and LangChain chain assembly

**Files:**
- Create: `server/prompt-skills/types.ts`
- Create: `server/prompt-skills/baseImage.ts`
- Create: `server/prompt-skills/img2imgIdentity.ts`
- Create: `server/prompt-skills/threeView.ts`
- Create: `server/prompt-skills/videoScene.ts`
- Create: `server/prompt-skills/index.ts`
- Modify: `server/promptOptimizer.ts`
- Test: `tests/promptOptimizer.test.ts`

- [ ] **Step 1: Write the failing test**

Extend `tests/promptOptimizer.test.ts` with skill selection expectations:

```ts
import { selectPromptSkill } from '../server/prompt-skills'

assert.equal(selectPromptSkill({
  mediaKind: 'image',
  mode: 'text2img',
  hasReferenceImages: false,
  isThreeView: false,
}).name, 'base-image')

assert.equal(selectPromptSkill({
  mediaKind: 'image',
  mode: 'img2img',
  hasReferenceImages: true,
  isThreeView: false,
}).name, 'img2img-identity')

assert.equal(selectPromptSkill({
  mediaKind: 'video',
  mode: 'multimodal',
  hasReferenceImages: true,
  isThreeView: false,
}).name, 'video-scene')
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx tests/promptOptimizer.test.ts`  
Expected: FAIL because the skill registry and selector do not exist yet.

- [ ] **Step 3: Write minimal implementation**

Create the shared skill type:

```ts
export interface PromptSkillContext {
  mediaKind: 'image' | 'video'
  mode: string
  hasReferenceImages: boolean
  isThreeView: boolean
}

export interface PromptSkill {
  name: string
  appliesTo: (context: PromptSkillContext) => boolean
  systemInstructions: string
}
```

Create the selector:

```ts
export const promptSkills = [threeViewSkill, img2imgIdentitySkill, videoSceneSkill, baseImageSkill]

export function selectPromptSkill(context: PromptSkillContext) {
  return promptSkills.find((skill) => skill.appliesTo(context)) || baseImageSkill
}
```

Refactor `server/promptOptimizer.ts` to:

```ts
const prompt = ChatPromptTemplate.fromMessages([
  ['system', skill.systemInstructions],
  ['user', '{userPromptPayload}'],
])

const llm = new ChatOpenAI({
  model: optimizerModel,
  apiKey: input.apiKey,
  configuration: { baseURL: input.baseUrl.replace(/\/+$/, '') },
  temperature: 0.4,
})

const chain = prompt.pipe(
  llm.withStructuredOutput(promptOptimizationSchema, { name: 'prompt_optimization_result' })
)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx tests/promptOptimizer.test.ts`  
Expected: PASS with skill selection assertions succeeding.

- [ ] **Step 5: Commit**

```bash
git add server/prompt-skills server/promptOptimizer.ts tests/promptOptimizer.test.ts
git commit -m "feat: add prompt skill registry"
```

### Task 4: Rewire image generation routes to use the skill runtime

**Files:**
- Modify: `server/routes/generate.ts`
- Modify: `tests/promptOptimizer.test.ts`
- Test: `tests/promptOptimizer.test.ts`

- [ ] **Step 1: Write the failing test**

Add a merge assertion that image parameters persist `optimizerSkill` and `protectedTokens`:

```ts
const parameters = mergeGenerationParameters(
  { size: '1024x1024', quality: 'auto', model: 'gpt-image-2' },
  {
    originalPrompt: 'simple portrait',
    originalNegativePrompt: '',
    optimizedPrompt: 'cinematic portrait, soft rim light, clean background',
    optimizedNegativePrompt: 'blurry, extra fingers',
    intentSummary: 'cinematic portrait',
    optimizationNotes: ['added lighting'],
    optimizerSkill: 'base-image',
    protectedTokens: [],
    usedFallback: false,
  }
)

assert.equal(parameters.optimizerSkill, 'base-image')
assert.deepEqual(parameters.protectedTokens, [])
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx tests/promptOptimizer.test.ts`  
Expected: FAIL because `mergeGenerationParameters` does not persist the new fields yet.

- [ ] **Step 3: Write minimal implementation**

Update `mergeGenerationParameters`:

```ts
optimizerSkill: optimization.optimizerSkill,
protectedTokens: optimization.protectedTokens,
```

Update image optimization calls to pass explicit media context:

```ts
const optimization = await optimizePrompt({
  mediaKind: 'image',
  mode: 'img2img',
  isThreeView: false,
  hasReferenceImages: true,
  ...
})
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx tests/promptOptimizer.test.ts`  
Expected: PASS with merged metadata including skill and token arrays.

- [ ] **Step 5: Commit**

```bash
git add server/routes/generate.ts tests/promptOptimizer.test.ts
git commit -m "feat: persist image optimizer skill metadata"
```

### Task 5: Rewire video route prompt handling with protected token preservation

**Files:**
- Modify: `server/routes/video.ts`
- Create: `tests/videoPromptOptimizer.test.ts`
- Test: `tests/videoPromptOptimizer.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/videoPromptOptimizer.test.ts`:

```ts
import assert from 'node:assert/strict'
import { applyVideoPromptOptimizationResult } from '../server/routes/video'

const result = applyVideoPromptOptimizationResult({
  originalPrompt: 'use @img1 and @资源库/角色A/三视图/正面, slow orbit shot',
  optimizedPrompt: 'Use @img1 and @资源库/角色A/三视图/正面 as the visual anchors, with a slow orbit shot and cinematic easing.',
  protectedTokens: ['@img1', '@资源库/角色A/三视图/正面'],
  optimizerSkill: 'video-scene',
  usedFallback: false,
})

assert.match(result.prompt, /@img1/)
assert.match(result.prompt, /@资源库\/角色A\/三视图\/正面/)
assert.equal(result.optimizerSkill, 'video-scene')
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx tests/videoPromptOptimizer.test.ts`  
Expected: FAIL because `applyVideoPromptOptimizationResult` is not defined.

- [ ] **Step 3: Write minimal implementation**

Add a helper in `server/routes/video.ts`:

```ts
export function applyVideoPromptOptimizationResult(input: {
  originalPrompt: string
  optimizedPrompt: string
  protectedTokens: string[]
  optimizerSkill: string
  usedFallback: boolean
}) {
  return {
    prompt: input.usedFallback ? input.originalPrompt : input.optimizedPrompt,
    optimizerSkill: input.optimizerSkill,
    protectedTokens: input.protectedTokens,
  }
}
```

Use optimized prompt in `/generate` before `buildSeedanceRequestBody(input)` and persist metadata in history parameters.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx tests/videoPromptOptimizer.test.ts`  
Expected: PASS with protected tokens retained in the final video prompt.

- [ ] **Step 5: Commit**

```bash
git add server/routes/video.ts tests/videoPromptOptimizer.test.ts
git commit -m "feat: optimize video prompts with token preservation"
```

### Task 6: Route three-view generation through the `three-view` skill

**Files:**
- Modify: `src/store/useResourceStore.ts`
- Modify: `server/routes/generate.ts`
- Modify: `tests/promptOptimizer.test.ts`
- Test: `tests/promptOptimizer.test.ts`

- [ ] **Step 1: Write the failing test**

Extend `tests/promptOptimizer.test.ts` with a three-view selector assertion:

```ts
assert.equal(selectPromptSkill({
  mediaKind: 'image',
  mode: 'text2img',
  hasReferenceImages: false,
  isThreeView: true,
}).name, 'three-view')
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx tests/promptOptimizer.test.ts`  
Expected: FAIL because three-view context is not supplied yet.

- [ ] **Step 3: Write minimal implementation**

In `src/store/useResourceStore.ts`, append three-view context fields:

```ts
formData.append('promptContext', 'three-view')
formData.append('threeViewAngle', request.angle)
```

In `server/routes/generate.ts`, translate those request fields into optimizer context:

```ts
const isThreeView = String(req.body.promptContext || '') === 'three-view'
const threeViewAngle = String(req.body.threeViewAngle || '')
```

Pass them into the optimizer input and include `threeViewAngle` in the payload context.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx tests/promptOptimizer.test.ts`  
Expected: PASS with `three-view` selected when the request is tagged as three-view generation.

- [ ] **Step 5: Commit**

```bash
git add src/store/useResourceStore.ts server/routes/generate.ts tests/promptOptimizer.test.ts
git commit -m "feat: route three-view prompts through dedicated skill"
```

### Task 7: Final verification and doc alignment

**Files:**
- Modify: `docs/skills/image-prompt-optimizer/SKILL.md`
- Verify: `server/promptOptimizer.ts`
- Verify: `server/routes/generate.ts`
- Verify: `server/routes/video.ts`
- Verify: `server/promptTokenGuards.ts`
- Verify: `server/prompt-skills/*`
- Verify: `tests/promptOptimizer.test.ts`
- Verify: `tests/promptTokenGuards.test.ts`
- Verify: `tests/videoPromptOptimizer.test.ts`

- [ ] **Step 1: Align the repo skill doc**

Update `docs/skills/image-prompt-optimizer/SKILL.md` to reference:

```md
- `server/prompt-skills/` for runtime skills
- `server/promptTokenGuards.ts` for protected token handling
- `server/promptOptimizer.ts` as the shared orchestration entry point
```

- [ ] **Step 2: Run targeted tests**

Run: `npx tsx tests/promptOptimizer.test.ts`  
Expected: PASS

Run: `npx tsx tests/promptTokenGuards.test.ts`  
Expected: PASS

Run: `npx tsx tests/videoPromptOptimizer.test.ts`  
Expected: PASS

Run: `npx tsx tests/videoRequestBody.test.ts`  
Expected: PASS

- [ ] **Step 3: Run build verification**

Run: `npm run build`  
Expected: Vite build exits 0

- [ ] **Step 4: Review diff**

Run: `git diff -- server/promptOptimizer.ts server/promptOptimizerSchema.ts server/promptTokenGuards.ts server/prompt-skills server/routes/generate.ts server/routes/video.ts src/store/useResourceStore.ts docs/skills/image-prompt-optimizer/SKILL.md tests/promptOptimizer.test.ts tests/promptTokenGuards.test.ts tests/videoPromptOptimizer.test.ts tests/videoRequestBody.test.ts`  
Expected: diff contains only LangChain prompt skill runtime changes.

- [ ] **Step 5: Commit final integration**

```bash
git add package.json server/promptOptimizer.ts server/promptOptimizerSchema.ts server/promptTokenGuards.ts server/prompt-skills server/routes/generate.ts server/routes/video.ts src/store/useResourceStore.ts docs/skills/image-prompt-optimizer/SKILL.md tests/promptOptimizer.test.ts tests/promptTokenGuards.test.ts tests/videoPromptOptimizer.test.ts tests/videoRequestBody.test.ts
git commit -m "feat: add langchain prompt skill runtime"
```
