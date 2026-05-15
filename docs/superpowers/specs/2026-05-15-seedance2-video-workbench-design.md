# Seedance 2 Video Workbench Design

Date: 2026-05-15
Project: image2-ui
Status: Design approved for implementation planning

## Goal

Add a Seedance 2 video generation workspace to this project so the user can generate video from an image plus text, while still exposing the full API surface needed for serious production work.

The UI should feel like a creator operations tool: upload/select source media, describe the shot in text, tune every relevant API option, submit an asynchronous generation task, track task status, preview the resulting video, download it, and revisit history.

## Current Project Context

The project is a Vite React app with a local Express server.

Relevant existing files:

- `src/components/video/VideoGeneratePage.tsx`: existing video UI with text-to-video and image-to-video modes.
- `src/store/useVideoGenerateStore.ts`: video generation form state, submit flow, and polling.
- `server/routes/video.ts`: Express route that submits Seedance-style video tasks and polls task status.
- `src/store/useApiConfigStore.ts`: API base URL, key, and model settings.
- `src/components/shared/SettingsPage.tsx`: UI for storing video API configuration.
- `src/components/workflow/*`: workflow nodes already include video generation concepts.

The existing route already targets a Volcengine Ark-compatible task endpoint:

- Submit: `POST /contents/generations/tasks`
- Poll: `GET /contents/generations/tasks/:taskId`
- Default base URL: `https://ark.cn-beijing.volces.com/api/v3`
- Default model: `doubao-seedance-2-0-260128`

The implementation should extend this existing shape instead of introducing a second unrelated API stack.

## External API Assumptions

Seedance 2 information changes quickly. These assumptions must be verified against the user's actual Ark console/API docs during implementation.

Likely Ark-compatible shape:

- Authentication uses `Authorization: Bearer <ARK_API_KEY>`.
- Generation is asynchronous: submit a task, receive a task ID, poll until a terminal status.
- Request body includes `model`, `content`, and output controls.
- Text input is represented as a content item with `type: "text"`.
- Image input is represented as a content item with `type: "image_url"` and either a data URL or hosted URL.
- Common model IDs include standard and fast variants, such as `doubao-seedance-2-0-260128` and `doubao-seedance-2-0-fast-260128`; newer endpoint IDs may also be used.
- Common output controls include duration, resolution, ratio/aspect ratio, optional audio generation, callback URL, watermark, seed, and reference media.

Implementation should avoid hard-coding undocumented parameter names deep in UI components. Put provider-specific request mapping in one server-side adapter so it can be corrected without rewriting the interface.

## Product Scope

### Primary Workflow

The first-class workflow is image plus text to video:

1. User uploads or selects a source image.
2. User writes a camera/scene prompt describing how the image should move or transform.
3. User configures Seedance 2 generation parameters.
4. User submits the task.
5. UI shows task ID, status, progress estimate, and errors.
6. When complete, UI downloads or proxies the video into local uploads.
7. Result appears in preview and history.

### Supported Modes

Expose modes as tabs or segmented controls:

- Text to video
- Image to video
- First/last frame video
- Multimodal references
- Video continuation, if supported by the configured endpoint

Modes should share the same task lifecycle, history, and preview area. Inputs that do not apply to the selected mode should be hidden or disabled with clear labels.

### API Coverage

The form should expose the full practical API surface:

- Provider/base URL
- API key and model/endpoint ID from settings
- Model preset: standard, fast, custom endpoint
- Prompt text
- Source image
- Optional end frame image
- Optional reference images
- Optional reference video
- Optional reference audio
- Duration
- Resolution
- Aspect ratio
- Seed
- Watermark toggle
- Audio generation toggle
- Callback URL
- Advanced raw JSON override for provider-specific parameters

The raw JSON override is important because Seedance 2 parameters may evolve faster than the UI. It should merge into the server request after validation, with clear error handling for invalid JSON.

## UI Design

Use the concept mockup direction already approved by the user.

Layout:

- Existing app sidebar stays unchanged.
- Main page title: `Seedance 2 视频生成`.
- Left panel is a compact control surface around 380-420px wide.
- Right panel is the preview and task console.
- History appears as a right-side or bottom panel depending on available width.

Left panel sections:

- Mode selector: 文生视频, 图生视频, 首尾帧, 多模态, 续拍.
- Source media: upload/select image, optional end frame, optional references.
- Prompt: large textarea labeled `镜头描述 / Prompt`.
- Core parameters: model, duration, resolution, aspect ratio.
- Motion/audio controls: audio generation, reference audio, reference video.
- Delivery controls: callback URL, watermark, seed.
- Advanced: raw JSON override.
- Submit button: `生成视频`.

Right panel sections:

- Video preview stage with stable aspect-ratio framing.
- Task status strip: task ID, status badge, elapsed time, polling state.
- Actions: download, copy result link, copy task ID, cancel task when supported.
- Error panel that surfaces provider error code/message and the server-side normalized message.
- Recent tasks list with status, mode, prompt excerpt, parameters, and result link when done.

Visual direction:

- Serious dark creative workspace.
- Neutral graphite/slate base with restrained warm amber accents.
- Compact controls, 8px or smaller radii, crisp borders.
- No marketing hero, no decorative gradients as the main visual idea.
- Icons in action buttons using existing `lucide-react`.

## Data Flow

### Client

`useVideoGenerateStore` should own the expanded form state and task state:

- selected mode
- prompt
- uploaded source media
- parameter values
- advanced JSON
- current task ID
- current task status
- result video URL
- error
- history

The store submits a `FormData` request to the local server because source media may be local files.

### Server

`server/routes/video.ts` should become a clearer provider adapter:

1. Validate required fields by mode.
2. Parse uploaded media and JSON parameters.
3. Build Ark-compatible request content.
4. Merge supported advanced parameters.
5. Submit to `POST /contents/generations/tasks`.
6. Persist a history row with prompt, mode, parameters, and provider task ID.
7. Poll status via `GET /contents/generations/tasks/:taskId`.
8. On success, download the result video to `public/uploads` when possible.
9. Return a normalized response to the client.

Do not expose provider API keys in browser query strings. Status polling should send task ID to the server, and the server should resolve API credentials from environment or saved configuration in the request body/session-safe mechanism.

## Error Handling

Client validation:

- Prompt required for all modes.
- Source image required for image-to-video.
- End frame required only for first/last-frame mode.
- Duration/resolution/aspect ratio restricted to supported combinations when known.
- Advanced JSON must parse before submit.

Server validation:

- Missing API key returns a configuration error.
- Missing required media returns a mode-specific 400 response.
- Provider errors return status, provider code when available, and message.
- Download failures should not discard the provider video URL; return the remote URL with a warning.

Task states:

- submitted
- queued
- running
- succeeded
- failed
- canceled, if provider supports it
- expired, if remote result URL is no longer available

## Persistence

Reuse the existing SQLite tables where practical, but history should store enough task metadata to debug and retry:

- provider task ID
- mode
- prompt
- model
- duration
- resolution
- aspect ratio
- seed
- audio/watermark flags
- result URL/local file
- status
- provider error
- created/updated timestamps

If the existing `generation_history` schema is insufficient, add a narrow migration or store extra metadata in the existing `parameters` JSON field.

## Testing And Verification

Implementation should include:

- TypeScript build verification.
- Server request-body builder tests if the project has a test harness, or a small isolated function that can be manually verified.
- Manual UI verification in browser for desktop and mobile widths.
- Mock-task mode or documented dry-run path if real Seedance API credentials are unavailable.

Minimum manual checks:

- Text-to-video submits without image.
- Image-to-video blocks without image, submits with image.
- Advanced JSON validation catches malformed input.
- Provider error is visible in UI.
- Completed task shows preview and history entry.

## Implementation Notes

Recommended order:

1. Refactor server-side video request building into small functions.
2. Expand store state and normalized task status handling.
3. Build the Seedance 2 workbench UI in the existing video page.
4. Update settings for model presets and custom endpoint IDs.
5. Update workflow video node only after the main page works.
6. Verify build and run the dev server for visual inspection.

## Open Verification Items

Before final implementation, verify these against the user's active provider documentation:

- Exact latest model IDs and whether standard/fast names differ by region.
- Exact field names for ratio vs aspect ratio.
- Exact support matrix for duration/resolution/audio by model.
- Whether cancellation is supported.
- Whether callback URL is supported on the selected endpoint.
- Whether result URLs expire and how long local download should be retried.
