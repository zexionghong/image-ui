# Video Multi-Image Prompt References Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make video generation support multi-image text-guided references with `@img1`, `@img2`, etc. prompt insertion.

**Architecture:** Reuse the existing `multimodal` video mode as the multi-image reference workflow. Keep strict first-frame/last-frame behavior in the existing `i2v` and `first_last` modes. The frontend sends multiple `referenceImages`; the backend already uploads them to RustFS and sends each as `role: "reference_image"`.

**Tech Stack:** React, Zustand, Express, TypeScript, AWS S3 SDK for RustFS upload, `tsx` tests.

---

### Task 1: Preserve Media Filtering for Multi-Image References

**Files:**
- Modify: `tests/videoModeConfig.test.ts`
- Modify: `src/lib/videoModeConfig.ts`

- [ ] **Step 1: Extend the failing test**

In `tests/videoModeConfig.test.ts`, assert that `multimodal` keeps all reference images and still excludes first-frame fields:

```ts
assert.deepEqual(Object.keys(filterMediaForMode('multimodal', media)), ['referenceImages', 'referenceVideo', 'referenceAudio'])
assert.equal(filterMediaForMode('multimodal', media).referenceImages?.length, 1)
```

- [ ] **Step 2: Run the test**

Run: `npx tsx tests/videoModeConfig.test.ts`

Expected: pass if current behavior already supports reference images.

### Task 2: Add Prompt Reference Insertion State API

**Files:**
- Modify: `src/store/useVideoGenerateStore.ts`

- [ ] **Step 1: Add an append/insert helper to the store**

Add `insertPromptReference(token: string)` to `VideoGenerateStore`.

Implementation:

```ts
insertPromptReference: (token) => set((state) => ({
  prompt: state.prompt.trim() ? `${state.prompt.trimEnd()} ${token} ` : `${token} `,
})),
```

- [ ] **Step 2: Verify types**

Run: `npx tsc --noEmit`

Expected: no TypeScript errors.

### Task 3: Improve Multi-Image UI

**Files:**
- Modify: `src/components/video/VideoGeneratePage.tsx`

- [ ] **Step 1: Read the store helper**

Destructure `insertPromptReference` from `useVideoGenerateStore()`.

- [ ] **Step 2: Make image previews show reference tokens**

For each `referenceImagePreviews` item, render a small `@img${index + 1}` button. On click call:

```ts
insertPromptReference(`@img${index + 1}`)
```

- [ ] **Step 3: Allow adding images without clearing existing ones**

Change the `DragDropZone` handler for reference images to append and cap at 9:

```ts
onDrop={(files) => setReferenceImages([...referenceImages, ...files].slice(0, 9))}
```

- [ ] **Step 4: Keep per-image removal stable**

Keep the existing remove button:

```ts
onClick={() => setReferenceImages(referenceImages.filter((_, i) => i !== index))}
```

### Task 4: Match Backend Payload to Seedance Multi-Image Roles

**Files:**
- Modify: `tests/videoRequestBody.test.ts`
- Modify: `server/routes/video.ts`

- [ ] **Step 1: Assert multiple reference images**

Add a second `referenceImages` fixture and assert both appear in `content` with `role: "reference_image"`.

- [ ] **Step 2: Run the test**

Run: `npx tsx tests/videoRequestBody.test.ts`

Expected: pass if current backend already maps all reference images correctly.

### Task 5: Final Verification

**Files:**
- No new files.

- [ ] **Step 1: Run focused tests**

Run:

```bash
npx tsx tests/videoModeConfig.test.ts
npx tsx tests/videoRequestBody.test.ts
npx tsx tests/s3Upload.test.ts
```

Expected: all pass.

- [ ] **Step 2: Run typecheck and build**

Run:

```bash
npx tsc --noEmit
npm run build
```

Expected: typecheck passes and Vite build completes.
