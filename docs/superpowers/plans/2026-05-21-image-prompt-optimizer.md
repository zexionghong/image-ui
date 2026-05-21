# Image Prompt Optimizer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a server-side prompt optimizer that rewrites image prompts before generation, stores optimization metadata, and shows the result in the generate UI.

**Architecture:** Keep prompt optimization in a dedicated server module so `server/routes/generate.ts` only orchestrates request parsing, optimizer invocation, persistence, and image API calls. Expose optimization metadata in the generate response, persist it in `generation_history.parameters`, then extend the generate store and page to show the latest optimized prompt details.

**Tech Stack:** TypeScript, React, Zustand, Express, tsx-based test execution

---

### Task 1: Add backend optimizer regression tests

**Files:**
- Create: `tests/promptOptimizer.test.ts`
- Modify: `package.json`
- Test: `tests/promptOptimizer.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict'
import {
  buildPromptOptimizerPayload,
  normalizePromptOptimizerResult,
} from '../server/promptOptimizer'

const payload = buildPromptOptimizerPayload({
  prompt: 'a cool sneaker ad',
  negativePrompt: '',
  mode: 'text2img',
  hasReferenceImages: false,
  size: '1024x1024',
  quality: 'high',
  background: 'auto',
  outputFormat: 'png',
})

assert.match(payload.userPrompt, /a cool sneaker ad/)
assert.equal(payload.context.mode, 'text2img')

const normalized = normalizePromptOptimizerResult({
  optimizedPrompt: 'hero product photo of premium sneakers, studio lighting, sharp details',
  optimizedNegativePrompt: 'blurry, distorted proportions',
  intentSummary: 'premium sneaker product shot',
  optimizationNotes: ['clarified subject', 'added lighting direction'],
})

assert.equal(normalized.optimizedPrompt.includes('premium sneakers'), true)
assert.equal(normalized.usedFallback, false)

const fallback = normalizePromptOptimizerResult({}, {
  prompt: 'rough sketch portrait',
  negativePrompt: 'low quality',
  reason: 'empty-response',
})

assert.equal(fallback.optimizedPrompt, 'rough sketch portrait')
assert.equal(fallback.optimizedNegativePrompt, 'low quality')
assert.equal(fallback.usedFallback, true)
assert.match(fallback.optimizationNotes[0], /empty-response/)

console.log('promptOptimizer tests passed')
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx tests/promptOptimizer.test.ts`  
Expected: FAIL with module export errors because `server/promptOptimizer.ts` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```ts
export function buildPromptOptimizerPayload(input) {
  return {
    userPrompt: input.prompt,
    userNegativePrompt: input.negativePrompt,
    context: {
      mode: input.mode,
      hasReferenceImages: input.hasReferenceImages,
      size: input.size,
      quality: input.quality,
      background: input.background,
      outputFormat: input.outputFormat,
    },
  }
}

export function normalizePromptOptimizerResult(raw, fallback) {
  if (!raw.optimizedPrompt) {
    return {
      optimizedPrompt: fallback.prompt,
      optimizedNegativePrompt: fallback.negativePrompt,
      intentSummary: fallback.prompt,
      optimizationNotes: [`optimizer fallback: ${fallback.reason}`],
      usedFallback: true,
    }
  }

  return {
    optimizedPrompt: raw.optimizedPrompt,
    optimizedNegativePrompt: raw.optimizedNegativePrompt || '',
    intentSummary: raw.intentSummary || '',
    optimizationNotes: Array.isArray(raw.optimizationNotes) ? raw.optimizationNotes : [],
    usedFallback: false,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx tests/promptOptimizer.test.ts`  
Expected: PASS with `promptOptimizer tests passed`

- [ ] **Step 5: Commit**

```bash
git add tests/promptOptimizer.test.ts server/promptOptimizer.ts package.json
git commit -m "test: cover prompt optimizer helpers"
```

### Task 2: Implement optimizer API call and route integration

**Files:**
- Modify: `server/promptOptimizer.ts`
- Modify: `server/routes/generate.ts`
- Test: `tests/promptOptimizer.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict'
import { mergeGenerationParameters } from '../server/routes/generate'

const parameters = mergeGenerationParameters(
  { size: '1024x1024', quality: 'auto', model: 'gpt-image-2' },
  {
    originalPrompt: 'simple portrait',
    originalNegativePrompt: '',
    optimizedPrompt: 'cinematic portrait, soft rim light, clean background',
    optimizedNegativePrompt: 'blurry, extra fingers',
    intentSummary: 'cinematic portrait',
    optimizationNotes: ['added lighting', 'added background control'],
    usedFallback: false,
  }
)

assert.equal(parameters.originalPrompt, 'simple portrait')
assert.equal(parameters.optimizedPrompt.includes('cinematic portrait'), true)
assert.deepEqual(parameters.optimizationNotes, ['added lighting', 'added background control'])
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx tests/promptOptimizer.test.ts`  
Expected: FAIL because `mergeGenerationParameters` is not exported yet.

- [ ] **Step 3: Write minimal implementation**

```ts
export async function optimizeImagePrompt(input) {
  // call /chat/completions with strict JSON instructions
}

export function mergeGenerationParameters(parameters, optimization) {
  return {
    ...parameters,
    originalPrompt: optimization.originalPrompt,
    originalNegativePrompt: optimization.originalNegativePrompt,
    optimizedPrompt: optimization.optimizedPrompt,
    optimizedNegativePrompt: optimization.optimizedNegativePrompt,
    intentSummary: optimization.intentSummary,
    optimizationNotes: optimization.optimizationNotes,
    optimizerUsedFallback: optimization.usedFallback,
  }
}
```

Route changes:

```ts
const optimization = await optimizeImagePrompt({
  prompt,
  negativePrompt,
  mode: 'text2img',
  hasReferenceImages: false,
  size,
  quality,
  background,
  outputFormat,
  apiKey: config.apiKey,
  baseUrl: config.baseUrl,
})

const finalPrompt = optimization.optimizedPrompt
const finalNegativePrompt = optimization.optimizedNegativePrompt
const parameters = mergeGenerationParameters(baseParameters, optimization)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx tests/promptOptimizer.test.ts`  
Expected: PASS with merged optimization metadata assertions succeeding.

- [ ] **Step 5: Commit**

```bash
git add server/promptOptimizer.ts server/routes/generate.ts tests/promptOptimizer.test.ts
git commit -m "feat: optimize prompts before image generation"
```

### Task 3: Add frontend state for optimization metadata

**Files:**
- Modify: `src/store/useGenerateStore.ts`
- Test: `tests/generateStorePromptOptimizer.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict'
import { useGenerateStore } from '../src/store/useGenerateStore'

useGenerateStore.setState({
  optimizedPrompt: 'studio product shot',
  optimizedNegativePrompt: 'blurry',
  intentSummary: 'product image',
  optimizationNotes: ['added studio lighting'],
  optimizerUsedFallback: false,
})

assert.equal(useGenerateStore.getState().optimizedPrompt, 'studio product shot')
assert.deepEqual(useGenerateStore.getState().optimizationNotes, ['added studio lighting'])

useGenerateStore.getState().reset()

assert.equal(useGenerateStore.getState().optimizedPrompt, null)
assert.deepEqual(useGenerateStore.getState().optimizationNotes, [])
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx tests/generateStorePromptOptimizer.test.ts`  
Expected: FAIL because optimizer fields do not exist in the store type/state.

- [ ] **Step 3: Write minimal implementation**

```ts
optimizedPrompt: null,
optimizedNegativePrompt: null,
intentSummary: null,
optimizationNotes: [],
optimizerUsedFallback: false,
```

Response handling:

```ts
set({
  optimizedPrompt: data.optimizedPrompt ?? null,
  optimizedNegativePrompt: data.optimizedNegativePrompt ?? null,
  intentSummary: data.intentSummary ?? null,
  optimizationNotes: Array.isArray(data.optimizationNotes) ? data.optimizationNotes : [],
  optimizerUsedFallback: Boolean(data.optimizerUsedFallback),
})
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx tests/generateStorePromptOptimizer.test.ts`  
Expected: PASS with reset behavior clearing prompt optimization state.

- [ ] **Step 5: Commit**

```bash
git add src/store/useGenerateStore.ts tests/generateStorePromptOptimizer.test.ts
git commit -m "feat: track prompt optimization state"
```

### Task 4: Show optimization result in the generate page

**Files:**
- Modify: `src/components/generate/GeneratePage.tsx`
- Modify: `src/i18n/locales/en.json`
- Modify: `src/i18n/locales/zh.json`

- [ ] **Step 1: Write the failing test**

No existing component test harness is present, so use a manual UI checklist instead of an automated component test for this task.

- [ ] **Step 2: Run manual pre-check**

Run: `npm run dev`  
Expected: generate page shows no prompt optimization card yet after a generation response.

- [ ] **Step 3: Write minimal implementation**

Add a compact result panel that renders only when `optimizedPrompt` exists:

```tsx
{optimizedPrompt && (
  <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-2">
    <div className="flex items-center justify-between">
      <Label className="text-xs text-muted-foreground">{t('optimizationLabel')}</Label>
      {optimizerUsedFallback && <Badge variant="secondary">{t('optimizationFallback')}</Badge>}
    </div>
    <p className="text-xs text-muted-foreground">{intentSummary}</p>
    <div className="space-y-1">
      <p className="text-[11px] text-muted-foreground">{t('originalPromptLabel')}</p>
      <p className="text-sm text-foreground">{prompt}</p>
    </div>
    <div className="space-y-1">
      <p className="text-[11px] text-muted-foreground">{t('optimizedPromptLabel')}</p>
      <p className="text-sm text-foreground">{optimizedPrompt}</p>
    </div>
  </div>
)}
```

- [ ] **Step 4: Run manual verification**

Run: `npm run dev`  
Expected: after generation, the page shows original prompt, optimized prompt, and fallback badge only when applicable.

- [ ] **Step 5: Commit**

```bash
git add src/components/generate/GeneratePage.tsx src/i18n/locales/en.json src/i18n/locales/zh.json
git commit -m "feat: display optimized prompt details"
```

### Task 5: Add the local repository skill

**Files:**
- Create: `.codex/skills/image-prompt-optimizer/SKILL.md`

- [ ] **Step 1: Write the failing test**

No runtime test is needed; validate by reading the skill and checking that it captures preserve-intent, fallback, and shared-module rules from the spec.

- [ ] **Step 2: Run pre-check**

Run: `test -f .codex/skills/image-prompt-optimizer/SKILL.md`  
Expected: command exits non-zero because the skill does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```md
---
name: image-prompt-optimizer
description: Use when adding or changing image-generation flows in this repository that should interpret user intent and improve prompts before calling a model
---

# Image Prompt Optimizer

## Rules

- Preserve the user's subject and goal.
- Do not invent a new scene.
- For reference-image flows, keep the same identity unless the user explicitly requests a change.
- If optimization fails, fall back to the original prompt rather than blocking generation.
- Reuse `server/promptOptimizer.ts` instead of reimplementing prompt rewriting in routes or stores.
```

- [ ] **Step 4: Run verification**

Run: `sed -n '1,200p' .codex/skills/image-prompt-optimizer/SKILL.md`  
Expected: skill includes preserve-intent, fallback, and shared-module guidance.

- [ ] **Step 5: Commit**

```bash
git add .codex/skills/image-prompt-optimizer/SKILL.md
git commit -m "docs: add image prompt optimizer skill"
```

### Task 6: Final verification

**Files:**
- Verify: `server/promptOptimizer.ts`
- Verify: `server/routes/generate.ts`
- Verify: `src/store/useGenerateStore.ts`
- Verify: `src/components/generate/GeneratePage.tsx`
- Verify: `.codex/skills/image-prompt-optimizer/SKILL.md`

- [ ] **Step 1: Run targeted tests**

Run: `npx tsx tests/promptOptimizer.test.ts`  
Expected: PASS

Run: `npx tsx tests/generateStorePromptOptimizer.test.ts`  
Expected: PASS

- [ ] **Step 2: Run build verification**

Run: `npm run build`  
Expected: Vite build exits 0

- [ ] **Step 3: Review diff**

Run: `git diff -- server/promptOptimizer.ts server/routes/generate.ts src/store/useGenerateStore.ts src/components/generate/GeneratePage.tsx .codex/skills/image-prompt-optimizer/SKILL.md tests/promptOptimizer.test.ts tests/generateStorePromptOptimizer.test.ts`  
Expected: diff contains only prompt optimizer feature changes.

- [ ] **Step 4: Commit final integration**

```bash
git add server/promptOptimizer.ts server/routes/generate.ts src/store/useGenerateStore.ts src/components/generate/GeneratePage.tsx src/i18n/locales/en.json src/i18n/locales/zh.json .codex/skills/image-prompt-optimizer/SKILL.md tests/promptOptimizer.test.ts tests/generateStorePromptOptimizer.test.ts
git commit -m "feat: add image prompt optimizer"
```
