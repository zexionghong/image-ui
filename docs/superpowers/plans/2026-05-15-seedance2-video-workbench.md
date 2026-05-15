# Seedance 2 Video Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full Seedance 2 video generation workbench for image-plus-text video creation, with expanded API controls, safer task polling, preview, and history.

**Architecture:** Keep the existing React/Zustand/Express structure. Move provider-specific Seedance request mapping into focused server helpers, keep browser state in `useVideoGenerateStore`, and render the workbench in the existing `VideoGeneratePage`. Avoid putting API keys into status-poll query strings.

**Tech Stack:** Vite, React 18, TypeScript, Zustand, Express, multer, SQLite via `better-sqlite3`, Tailwind, lucide-react, existing local i18n JSON.

---

## File Structure

- Modify `server/routes/video.ts`: own Seedance request validation, multipart media parsing, task submission, status polling, result download, and normalized responses.
- Modify `src/store/useVideoGenerateStore.ts`: expand form state for Seedance modes/parameters, submit `FormData`, poll safely, expose errors and task metadata.
- Modify `src/components/video/VideoGeneratePage.tsx`: replace the basic form with the approved workbench UI.
- Modify `src/store/useApiConfigStore.ts`: add a video model preset field only if needed by the UI; keep existing persisted settings compatible.
- Modify `src/components/shared/SettingsPage.tsx`: add model preset/custom endpoint affordances if `useApiConfigStore` changes.
- Modify `src/i18n/locales/zh.json` and `src/i18n/locales/en.json`: add labels for the expanded Seedance UI.
- Optionally modify `src/components/workflow/nodes/VideoGenerateNode.tsx` and related workflow files only after the standalone workbench is working.

## Task 1: Server Request Builder And Validation

**Files:**
- Modify: `server/routes/video.ts`

- [ ] **Step 1: Add Seedance mode and parameter types near the top of `server/routes/video.ts`**

```ts
type VideoMode = 't2v' | 'i2v' | 'first_last' | 'multimodal' | 'continue'

type UploadedMedia = {
  fieldname: string
  mimetype: string
  buffer: Buffer
}

type SeedanceGenerateInput = {
  mode: VideoMode
  prompt: string
  duration: number
  resolution: string
  aspectRatio: string
  seed?: number
  watermark?: boolean
  generateAudio?: boolean
  callbackUrl?: string
  model: string
  advanced?: Record<string, unknown>
  media: UploadedMedia[]
}
```

- [ ] **Step 2: Replace `upload.single('image')` with named multipart fields**

Use this upload middleware for `/generate`:

```ts
const videoUpload = upload.fields([
  { name: 'sourceImage', maxCount: 1 },
  { name: 'endFrame', maxCount: 1 },
  { name: 'referenceImages', maxCount: 6 },
  { name: 'referenceVideo', maxCount: 1 },
  { name: 'referenceAudio', maxCount: 1 },
])
```

Expected behavior: existing image-to-video requests migrate from `image` to `sourceImage`; no route should still depend on `req.file`.

- [ ] **Step 3: Add helpers to parse booleans, numbers, advanced JSON, and uploaded media**

```ts
function asBoolean(value: unknown, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback
  return value === true || value === 'true' || value === '1'
}

function asOptionalNumber(value: unknown) {
  if (value === undefined || value === null || value === '') return undefined
  const num = Number(value)
  return Number.isFinite(num) ? num : undefined
}

function parseAdvancedJson(value: unknown) {
  if (!value || typeof value !== 'string' || !value.trim()) return {}
  const parsed = JSON.parse(value)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Advanced JSON must be an object')
  }
  return parsed as Record<string, unknown>
}

function fileToContent(file: UploadedMedia, role?: string) {
  return {
    type: 'image_url',
    image_url: {
      url: `data:${file.mimetype || 'image/png'};base64,${file.buffer.toString('base64')}`,
    },
    ...(role ? { role } : {}),
  }
}

function collectMedia(files: Express.Request['files']) {
  const grouped = files as Record<string, Express.Multer.File[]> | undefined
  const media: UploadedMedia[] = []
  for (const list of Object.values(grouped || {})) {
    for (const file of list) {
      media.push({ fieldname: file.fieldname, mimetype: file.mimetype, buffer: file.buffer })
    }
  }
  return media
}
```

- [ ] **Step 4: Add `buildSeedanceRequestBody`**

```ts
function buildSeedanceRequestBody(input: SeedanceGenerateInput) {
  if (!input.prompt.trim()) throw new Error('Prompt is required')

  const sourceImages = input.media.filter((file) => file.fieldname === 'sourceImage')
  const endFrames = input.media.filter((file) => file.fieldname === 'endFrame')
  const referenceImages = input.media.filter((file) => file.fieldname === 'referenceImages')
  const referenceVideos = input.media.filter((file) => file.fieldname === 'referenceVideo')
  const referenceAudios = input.media.filter((file) => file.fieldname === 'referenceAudio')

  if (input.mode === 'i2v' && sourceImages.length === 0) {
    throw new Error('Source image is required for image-to-video')
  }
  if (input.mode === 'first_last' && (sourceImages.length === 0 || endFrames.length === 0)) {
    throw new Error('Source image and end frame are required for first/last-frame video')
  }

  const content: any[] = [{ type: 'text', text: input.prompt }]
  for (const file of sourceImages) content.push(fileToContent(file, 'source'))
  for (const file of endFrames) content.push(fileToContent(file, 'end_frame'))
  for (const file of referenceImages) content.push(fileToContent(file, 'reference'))

  const body: Record<string, unknown> = {
    model: input.model,
    content,
    resolution: input.resolution,
    ratio: input.aspectRatio,
    duration: input.duration,
    ...input.advanced,
  }

  if (input.seed !== undefined) body.seed = input.seed
  if (input.watermark !== undefined) body.watermark = input.watermark
  if (input.generateAudio !== undefined) body.generate_audio = input.generateAudio
  if (input.callbackUrl) body.callback_url = input.callbackUrl
  if (referenceVideos.length > 0) body.reference_video = `data:${referenceVideos[0].mimetype};base64,${referenceVideos[0].buffer.toString('base64')}`
  if (referenceAudios.length > 0) body.reference_audio = `data:${referenceAudios[0].mimetype};base64,${referenceAudios[0].buffer.toString('base64')}`

  return body
}
```

Expected: advanced JSON can override provider-specific fields, while core fields remain visible in the UI and history.

- [ ] **Step 5: Run TypeScript build**

Run: `npm run build`

Expected: build may fail only if existing unrelated dirty-worktree changes are already broken. If it fails in `server/routes/video.ts`, fix this task before continuing.

## Task 2: Server Routes And Safe Polling

**Files:**
- Modify: `server/routes/video.ts`

- [ ] **Step 1: Update `POST /generate` to use `videoUpload` and `buildSeedanceRequestBody`**

Replace the route signature with:

```ts
router.post('/generate', videoUpload, async (req, res) => {
  const config = resolveConfig(req.body)
  if (!config.apiKey) return res.status(400).json({ error: 'Video API Key is not configured' })

  try {
    const duration = Number(req.body.duration || 5)
    const input: SeedanceGenerateInput = {
      mode: (req.body.mode || 'i2v') as VideoMode,
      prompt: String(req.body.prompt || ''),
      duration,
      resolution: String(req.body.resolution || '720p'),
      aspectRatio: String(req.body.aspectRatio || '16:9'),
      seed: asOptionalNumber(req.body.seed),
      watermark: asBoolean(req.body.watermark, false),
      generateAudio: asBoolean(req.body.generateAudio, false),
      callbackUrl: String(req.body.callbackUrl || ''),
      model: config.model,
      advanced: parseAdvancedJson(req.body.advancedJson),
      media: collectMedia(req.files),
    }

    const requestBody = buildSeedanceRequestBody(input)
    const providerRes = await fetch(`${config.baseUrl.replace(/\/+$/, '')}/contents/generations/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(requestBody),
    })

    if (!providerRes.ok) {
      const err = await providerRes.text()
      return res.status(providerRes.status).json({ error: `API error: ${providerRes.status} ${err}` })
    }

    const data = await providerRes.json()
    const paramsJson = JSON.stringify({
      mode: input.mode,
      duration: input.duration,
      resolution: input.resolution,
      aspectRatio: input.aspectRatio,
      seed: input.seed,
      watermark: input.watermark,
      generateAudio: input.generateAudio,
      callbackUrl: input.callbackUrl,
      model: config.model,
      providerTaskId: data.id,
    })

    db.prepare(
      `INSERT INTO generation_history (type, prompt, parameters, status)
       VALUES ('video', ?, ?, 'processing')`
    ).run(input.prompt, paramsJson)

    res.json({ taskId: data.id, status: data.status || 'submitted' })
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
})
```

- [ ] **Step 2: Change `GET /status/:taskId` to accept API config in headers instead of query string**

Use these headers:

```ts
const videoBaseUrl = String(req.header('x-video-base-url') || ENV_BASE_URL)
const videoApiKey = String(req.header('x-video-api-key') || ENV_API_KEY)
```

Expected: no frontend request URL contains the raw API key.

- [ ] **Step 3: Normalize provider status and result URL extraction**

Add helper:

```ts
function getProviderVideoUrl(data: any) {
  return data?.content?.video_url || data?.video_url || data?.result?.video_url || data?.output?.video_url || ''
}
```

Use it inside the status route before downloading.

- [ ] **Step 4: Preserve remote URL if local download fails**

Wrap download in its own `try/catch`:

```ts
try {
  const vidRes = await fetch(videoUrl)
  if (!vidRes.ok) throw new Error(`Video download failed: ${vidRes.status}`)
  const buffer = Buffer.from(await vidRes.arrayBuffer())
  // existing local save and DB update
} catch (downloadErr: any) {
  return res.json({
    status: 'succeeded',
    videoUrl,
    remote: true,
    warning: downloadErr.message,
  })
}
```

- [ ] **Step 5: Run build**

Run: `npm run build`

Expected: no TypeScript errors from the modified server route.

## Task 3: Zustand Store Expansion

**Files:**
- Modify: `src/store/useVideoGenerateStore.ts`

- [ ] **Step 1: Add form state fields to `VideoGenerateStore`**

Add these fields:

```ts
endFrameFile: File | null
endFramePreview: string | null
referenceImages: File[]
referenceImagePreviews: string[]
referenceVideo: File | null
referenceAudio: File | null
seed: string
watermark: boolean
generateAudio: boolean
callbackUrl: string
advancedJson: string
status: string | null
error: string | null
remoteResult: boolean
```

Add setters:

```ts
setEndFrameFile: (file: File | null) => void
setReferenceImages: (files: File[]) => void
setReferenceVideo: (file: File | null) => void
setReferenceAudio: (file: File | null) => void
setSeed: (seed: string) => void
setWatermark: (enabled: boolean) => void
setGenerateAudio: (enabled: boolean) => void
setCallbackUrl: (url: string) => void
setAdvancedJson: (json: string) => void
```

- [ ] **Step 2: Extend initial state**

Use:

```ts
endFrameFile: null,
endFramePreview: null,
referenceImages: [],
referenceImagePreviews: [],
referenceVideo: null,
referenceAudio: null,
seed: '',
watermark: false,
generateAudio: false,
callbackUrl: '',
advancedJson: '',
status: null,
error: null,
remoteResult: false,
```

- [ ] **Step 3: Update `generate` FormData**

Append these keys:

```ts
formData.append('mode', mode)
formData.append('seed', seed)
formData.append('watermark', String(watermark))
formData.append('generateAudio', String(generateAudio))
formData.append('callbackUrl', callbackUrl)
formData.append('advancedJson', advancedJson)
if (mode === 'i2v' && imageFile) formData.append('sourceImage', imageFile)
if (mode === 'first_last' && imageFile) formData.append('sourceImage', imageFile)
if (mode === 'first_last' && endFrameFile) formData.append('endFrame', endFrameFile)
for (const file of referenceImages) formData.append('referenceImages', file)
if (referenceVideo) formData.append('referenceVideo', referenceVideo)
if (referenceAudio) formData.append('referenceAudio', referenceAudio)
```

Remove the old `formData.append('image', imageFile)` call.

- [ ] **Step 4: Poll with headers instead of query API key**

Use:

```ts
const statusRes = await fetch(`${API_BASE}/video/status/${submitData.taskId}`, {
  headers: {
    'x-video-base-url': videoBaseUrl,
    'x-video-api-key': videoApiKey,
  },
})
```

- [ ] **Step 5: Store status and error**

When submit or polling fails, set:

```ts
set({ generating: false, error: err instanceof Error ? err.message : 'Video generation failed' })
```

When status is non-terminal:

```ts
set((s) => ({
  status: statusData.status || 'running',
  progress: Math.min(s.progress + 5, 95),
}))
```

- [ ] **Step 6: Run build**

Run: `npm run build`

Expected: no TypeScript errors in `useVideoGenerateStore.ts`.

## Task 4: Workbench UI

**Files:**
- Modify: `src/components/video/VideoGeneratePage.tsx`
- Modify: `src/i18n/locales/zh.json`
- Modify: `src/i18n/locales/en.json`

- [ ] **Step 1: Update mode constants**

Use modes:

```ts
const MODES = [
  { value: 't2v', label: '文生视频' },
  { value: 'i2v', label: '图生视频' },
  { value: 'first_last', label: '首尾帧' },
  { value: 'multimodal', label: '多模态' },
  { value: 'continue', label: '续拍' },
] as const
```

- [ ] **Step 2: Add parameter constants**

Use:

```ts
const DURATIONS = ['5', '10', '15']
const RESOLUTIONS = [
  { value: '480p', label: '480p' },
  { value: '720p', label: '720p' },
  { value: '1080p', label: '1080p' },
]
const ASPECT_RATIOS = [
  { value: '16:9', label: '16:9' },
  { value: '9:16', label: '9:16' },
  { value: '1:1', label: '1:1' },
  { value: '4:3', label: '4:3' },
  { value: '3:4', label: '3:4' },
]
```

- [ ] **Step 3: Replace the left panel with workbench sections**

Render sections in this order:

```tsx
<section className="space-y-2">
  <Label>{t('modeLabel')}</Label>
  <div className="grid grid-cols-2 gap-2">
    {MODES.map((item) => (
      <button key={item.value} onClick={() => setMode(item.value)} className={mode === item.value ? activeClass : idleClass}>
        {item.label}
      </button>
    ))}
  </div>
</section>
```

Then render source image, end frame, reference images, prompt, duration, resolution, aspect ratio, seed, watermark switch, audio switch, callback URL, and advanced JSON textarea.

- [ ] **Step 4: Update `handleGenerate` validations**

Use:

```ts
if (!isVideoConfigured()) { toast.error(ts('videoApiNotConfigured')); return }
if (!prompt.trim()) { toast.error(t('enterPrompt')); return }
if ((mode === 'i2v' || mode === 'first_last') && !imagePreview) { toast.error(t('uploadImage')); return }
if (mode === 'first_last' && !endFramePreview) { toast.error(t('uploadEndFrame')); return }
if (advancedJson.trim()) {
  try { JSON.parse(advancedJson) } catch { toast.error(t('invalidAdvancedJson')); return }
}
await generate()
```

- [ ] **Step 5: Rebuild the right preview panel**

Show:

- empty state
- generating state with task ID/status/progress
- error panel when `error` is set
- result `<video>` with download/copy actions
- history list with mode/model/duration/resolution/aspect ratio

- [ ] **Step 6: Add i18n keys**

Add Chinese keys under `video`:

```json
"title": "Seedance 2 视频生成",
"endFrame": "结束帧",
"uploadEndFrame": "请上传结束帧",
"referenceImages": "参考图片",
"referenceVideo": "参考视频",
"referenceAudio": "参考音频",
"seed": "随机种子",
"watermark": "水印",
"generateAudio": "生成音频",
"callbackUrl": "回调 URL",
"advancedJson": "高级 JSON",
"invalidAdvancedJson": "高级 JSON 格式不正确",
"taskStatus": "任务状态",
"copyTaskId": "复制任务 ID",
"copyLink": "复制链接"
```

Add equivalent English keys in `en.json`.

- [ ] **Step 7: Run build**

Run: `npm run build`

Expected: no TypeScript or JSX errors.

## Task 5: Settings Presets

**Files:**
- Modify: `src/components/shared/SettingsPage.tsx`
- Modify: `src/store/useApiConfigStore.ts` only if a new persisted field is required.

- [ ] **Step 1: Keep existing video base URL/key/model fields**

Do not remove existing persisted keys:

```ts
videoBaseUrl
videoApiKey
videoModel
```

- [ ] **Step 2: Add model helper buttons in Settings UI**

Add buttons near the video model input:

```tsx
<div className="flex flex-wrap gap-2">
  <Button type="button" variant="outline" size="sm" onClick={() => setLocalVideoModel('doubao-seedance-2-0-260128')}>
    Seedance 2
  </Button>
  <Button type="button" variant="outline" size="sm" onClick={() => setLocalVideoModel('doubao-seedance-2-0-fast-260128')}>
    Seedance 2 Fast
  </Button>
</div>
```

- [ ] **Step 3: Run build**

Run: `npm run build`

Expected: settings page compiles and existing config persistence remains compatible.

## Task 6: Final Verification

**Files:**
- Verify only, no required edits.

- [ ] **Step 1: Run production build**

Run: `npm run build`

Expected: build completes successfully.

- [ ] **Step 2: Start dev server**

Run: `npm run dev`

Expected:

- Vite client starts.
- Express server starts on port `3456`.
- The video page loads at `/zh/video-generate`.

- [ ] **Step 3: Manual UI checks without credentials**

Expected:

- Generate button blocks when video API key is missing.
- Image-to-video blocks when no image is uploaded.
- First/last-frame blocks when end frame is missing.
- Malformed advanced JSON shows the configured error toast.
- API key is not present in status polling URL.

- [ ] **Step 4: Manual API check with credentials when available**

Expected:

- Text-to-video submits and shows a task ID.
- Image-to-video submits with uploaded image plus prompt.
- Polling updates status.
- Successful result displays a playable video and a history entry.

## Self-Review

- Spec coverage: primary image-plus-text flow, expanded API controls, safe polling, preview, history, settings presets, and verification are covered.
- Placeholder scan: no placeholder markers or vague implementation-only steps remain.
- Type consistency: `first_last`, `advancedJson`, `sourceImage`, `endFrame`, and status polling headers are used consistently across server, store, and UI tasks.
