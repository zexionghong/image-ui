import { Router, type Request } from 'express'
import multer from 'multer'
import path from 'path'
import { persistBuffer } from '../mediaStorage.js'
import { optimizePrompt, type PromptOptimizationResult } from '../promptOptimizer.js'
import { requireAuth, type AuthenticatedRequest } from '../supabaseAuth.js'
import {
  extractResourcePaths,
  parseResourcePath,
  RESOURCE_THREE_VIEW_FOLDER,
  THREE_VIEW_ANGLE_LABELS,
  type ThreeViewAngle,
} from '../../src/lib/resourceLibrary.js'

type VideoMode = 't2v' | 'i2v' | 'first_last' | 'multimodal' | 'continue'

export type UploadedMedia = {
  fieldname: string
  mimetype: string
  buffer: Buffer
  publicUrl: string
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

const VIDEO_MODES: VideoMode[] = ['t2v', 'i2v', 'first_last', 'multimodal', 'continue']
const MAX_UPLOAD_BYTES = 120 * 1024 * 1024

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024,
    files: 10,
  },
})
// Task 2 wires this named multipart middleware into /generate.
const videoUpload = upload.fields([
  { name: 'sourceImage', maxCount: 1 },
  { name: 'endFrame', maxCount: 1 },
  { name: 'referenceImages', maxCount: 6 },
  { name: 'referenceVideo', maxCount: 1 },
  { name: 'referenceAudio', maxCount: 1 },
])
const router = Router()
router.use(requireAuth)

const ENV_API_KEY = process.env.ARK_API_KEY || process.env.OPENAI_API_KEY || ''
const ENV_BASE_URL = process.env.ARK_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3'

function resolveConfig(body: any) {
  return {
    baseUrl: body.videoBaseUrl || ENV_BASE_URL,
    apiKey: body.videoApiKey || ENV_API_KEY,
    model: body.videoModel || 'doubao-seedance-2-0-260128',
  }
}

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

function getExtension(file: Express.Multer.File) {
  const ext = path.extname(file.originalname)
  if (ext) return ext
  if (file.mimetype === 'image/png') return '.png'
  if (file.mimetype === 'image/jpeg') return '.jpg'
  if (file.mimetype === 'image/webp') return '.webp'
  if (file.mimetype === 'video/mp4') return '.mp4'
  if (file.mimetype === 'video/quicktime') return '.mov'
  if (file.mimetype === 'audio/mpeg') return '.mp3'
  if (file.mimetype === 'audio/wav') return '.wav'
  return ''
}

function getRequestBaseUrl(req: Request) {
  const configured = process.env.PUBLIC_UPLOAD_BASE_URL || process.env.PUBLIC_BASE_URL
  if (configured) return assertHttpUrl(configured, 'Public upload base URL')

  const forwardedProto = String(req.header('x-forwarded-proto') || '').split(',')[0]?.trim()
  const proto = forwardedProto || req.protocol
  return assertHttpUrl(`${proto}://${req.get('host')}`, 'Request base URL')
}

function getPublicUploadUrl(filename: string, baseUrl: string) {
  return new URL(`/uploads/${encodeURIComponent(filename)}`, baseUrl).toString()
}

async function persistUploadedMedia(file: Express.Multer.File, userId: string) {
  const stored = await persistBuffer({
    userId,
    buffer: file.buffer,
    contentType: file.mimetype || 'application/octet-stream',
    originalName: file.originalname || `upload${getExtension(file)}`,
  })
  console.log(`[video] Stored media: filename=${stored.filename} url=${stored.url}`)
  return { filename: stored.filename, publicUrl: stored.url }
}

function fileToContent(file: UploadedMedia, role?: string) {
  return {
    type: 'image_url',
    image_url: {
      url: file.publicUrl,
    },
    ...(role ? { role } : {}),
  }
}

function videoToContent(file: UploadedMedia) {
  return {
    type: 'video_url',
    video_url: {
      url: file.publicUrl,
    },
    role: 'reference_video',
  }
}

function audioToContent(file: UploadedMedia) {
  return {
    type: 'audio_url',
    audio_url: {
      url: file.publicUrl,
    },
    role: 'reference_audio',
  }
}

async function collectMedia(files: Express.Request['files'], userId: string) {
  const grouped = files as Record<string, Express.Multer.File[]> | undefined
  const media: UploadedMedia[] = []
  for (const list of Object.values(grouped || {})) {
    for (const file of list) {
      const { publicUrl } = await persistUploadedMedia(file, userId)
      media.push({
        fieldname: file.fieldname,
        mimetype: file.mimetype,
        buffer: file.buffer,
        publicUrl,
      })
    }
  }
  return media
}

function findThreeViewRole(assetName: string) {
  return (Object.entries(THREE_VIEW_ANGLE_LABELS) as Array<[ThreeViewAngle, string]>)
    .find(([, label]) => label === assetName)?.[0]
}

async function getResourceProject(req: AuthenticatedRequest, projectPath: string) {
  const { data, error } = await req.supabase
    .from('resource_projects')
    .select('*')
    .eq('user_id', req.user.id)
    .or(`name.eq.${projectPath},name.eq.${projectPath.replace(/-/g, ' ')}`)
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
}

async function resolveResourcePathToMedia(req: AuthenticatedRequest, resourcePath: string): Promise<UploadedMedia | null> {
  const parsed = parseResourcePath(resourcePath)
  if (!parsed || parsed.folder !== RESOURCE_THREE_VIEW_FOLDER) return null

  const role = findThreeViewRole(parsed.assetName)
  if (!role) return null

  const project = await getResourceProject(req, parsed.projectName)
  if (!project) return null

  const { data, error } = await req.supabase
    .from('resource_project_assets')
    .select('image_id')
    .eq('user_id', req.user.id)
    .eq('project_id', project.id)
    .eq('role', role)
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  const imageId = (data as any)?.image_id
  if (!imageId) return null

  const { data: row, error: imageError } = await req.supabase
    .from('images')
    .select('*')
    .eq('user_id', req.user.id)
    .eq('id', imageId)
    .maybeSingle()
  if (imageError) throw imageError
  if (!row?.url) return null

  return {
    fieldname: 'referenceImages',
    mimetype: row.mime_type || 'image/png',
    buffer: Buffer.alloc(Number(row.size) || 0),
    publicUrl: row.url,
  }
}

async function collectResourcePromptMedia(req: AuthenticatedRequest, prompt: string) {
  const paths = extractResourcePaths(prompt)
  const media = (await Promise.all(paths.map((resourcePath) => resolveResourcePathToMedia(req, resourcePath))))
    .filter((item): item is UploadedMedia => Boolean(item))
  return media.slice(0, 6)
}

function isVideoMode(value: unknown): value is VideoMode {
  return typeof value === 'string' && VIDEO_MODES.includes(value as VideoMode)
}

function assertHttpUrl(value: string, label: string) {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error(`${label} must be a valid URL`)
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`${label} must use http or https`)
  }
  return url.toString().replace(/\/+$/, '')
}

function getTotalMediaBytes(media: UploadedMedia[]) {
  return media.reduce((total, file) => total + file.buffer.length, 0)
}

export function buildSeedanceRequestBody(input: SeedanceGenerateInput) {
  if (!input.prompt.trim()) throw new Error('Prompt is required')

  const sourceImages = input.mode === 'i2v' || input.mode === 'first_last'
    ? input.media.filter((file) => file.fieldname === 'sourceImage')
    : []
  const endFrames = input.mode === 'first_last'
    ? input.media.filter((file) => file.fieldname === 'endFrame')
    : []
  const referenceImages = input.mode === 'multimodal'
    ? input.media.filter((file) => file.fieldname === 'referenceImages')
    : []
  const referenceVideos = input.mode === 'multimodal' || input.mode === 'continue'
    ? input.media.filter((file) => file.fieldname === 'referenceVideo')
    : []
  const referenceAudios = input.mode === 'multimodal'
    ? input.media.filter((file) => file.fieldname === 'referenceAudio')
    : []

  if (input.mode === 'i2v' && sourceImages.length === 0) {
    throw new Error('Source image is required for image-to-video')
  }
  if (input.mode === 'first_last' && (sourceImages.length === 0 || endFrames.length === 0)) {
    throw new Error('Source image and end frame are required for first/last-frame video')
  }
  if (input.mode === 'continue' && referenceVideos.length === 0) {
    throw new Error('Reference video is required for video continuation')
  }

  const content: any[] = [{ type: 'text', text: input.prompt }]
  for (const file of sourceImages) content.push(fileToContent(file, 'first_frame'))
  for (const file of endFrames) content.push(fileToContent(file, 'last_frame'))
  for (const file of referenceImages) content.push(fileToContent(file, 'reference_image'))
  for (const file of referenceVideos) content.push(videoToContent(file))
  for (const file of referenceAudios) content.push(audioToContent(file))

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

  return body
}

function getProviderVideoUrl(data: any) {
  return data?.content?.video_url || data?.video_url || data?.result?.video_url || data?.output?.video_url || ''
}

function parseHistoryParameters(value: unknown) {
  if (!value || typeof value !== 'string') return {}
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}
  } catch {
    return {}
  }
}

async function getHistoryByProviderTaskId(req: AuthenticatedRequest, taskId: string) {
  const { data, error } = await req.supabase
    .from('generation_history')
    .select('*')
    .eq('user_id', req.user.id)
    .eq('type', 'video')
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw error
  return (data || []).find((row) => parseHistoryParameters(row.parameters).providerTaskId === taskId)
}

async function mergeHistoryParameters(req: AuthenticatedRequest, row: any, patch: Record<string, unknown>) {
  const parameters = {
    ...parseHistoryParameters(row?.parameters),
    ...patch,
  }
  const { error } = await req.supabase
    .from('generation_history')
    .update({ parameters })
    .eq('user_id', req.user.id)
    .eq('id', row.id)
  if (error) throw error
  return parameters
}

async function getExistingVideoUrl(req: AuthenticatedRequest, row: any) {
  if (!row?.result_image_id) return ''
  const { data, error } = await req.supabase
    .from('images')
    .select('url')
    .eq('user_id', req.user.id)
    .eq('id', row.result_image_id)
    .maybeSingle()
  if (error) throw error
  return data?.url || ''
}

export function applyVideoPromptOptimizationResult(optimization: PromptOptimizationResult) {
  return {
    prompt: optimization.usedFallback ? optimization.originalPrompt : optimization.optimizedPrompt,
    optimizerSkill: optimization.optimizerSkill,
    protectedTokens: optimization.protectedTokens,
    optimizerUsedFallback: optimization.usedFallback,
  }
}

// POST /api/video/generate
router.post('/generate', videoUpload, async (req, res) => {
  const authed = req as AuthenticatedRequest
  const config = resolveConfig(req.body)
  if (!config.apiKey) return res.status(400).json({ error: 'Video API Key is not configured' })

  console.log(`[video] POST /generate | model=${config.model} | base=${config.baseUrl}`)

  try {
    const providerBaseUrl = assertHttpUrl(String(config.baseUrl), 'Video base URL')
    const duration = Number(req.body.duration || 5)
    if (!Number.isFinite(duration) || duration <= 0) {
      throw new Error('Duration must be a finite number greater than 0')
    }

    const mode = req.body.mode || 'i2v'
    if (!isVideoMode(mode)) {
      throw new Error('Invalid video mode')
    }

    const publicBaseUrl = getRequestBaseUrl(req)
    const media = await collectMedia(req.files, authed.user.id)
    const resourceMedia = await collectResourcePromptMedia(authed, String(req.body.prompt || ''))
    media.push(...resourceMedia)
    if (getTotalMediaBytes(media) > MAX_UPLOAD_BYTES) {
      throw new Error('Total uploaded media must not exceed 120MB')
    }

    const originalPrompt = String(req.body.prompt || '')
    const optimization = await optimizePrompt({
      prompt: originalPrompt,
      negativePrompt: '',
      mediaKind: 'video',
      mode,
      hasReferenceImages: media.some((item) => item.fieldname === 'sourceImage' || item.fieldname === 'referenceImages'),
      isThreeView: false,
      size: String(req.body.aspectRatio || '16:9'),
      quality: String(req.body.resolution || '720p'),
      background: '',
      outputFormat: 'mp4',
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      model: config.model,
    })
    const optimizedVideoPrompt = applyVideoPromptOptimizationResult(optimization)

    const input: SeedanceGenerateInput = {
      mode,
      prompt: optimizedVideoPrompt.prompt,
      duration,
      resolution: String(req.body.resolution || '720p'),
      aspectRatio: String(req.body.aspectRatio || '16:9'),
      seed: asOptionalNumber(req.body.seed),
      watermark: asBoolean(req.body.watermark, false),
      generateAudio: asBoolean(req.body.generateAudio, false),
      callbackUrl: String(req.body.callbackUrl || ''),
      model: config.model,
      advanced: parseAdvancedJson(req.body.advancedJson),
      media,
    }

    const requestBody = buildSeedanceRequestBody(input)
    console.log(`[video] Request metadata:`, {
      model: input.model,
      mode: input.mode,
      resolution: input.resolution,
      ratio: input.aspectRatio,
      duration: input.duration,
      mediaCount: input.media.length,
    })

    const providerRes = await fetch(`${providerBaseUrl}/contents/generations/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(requestBody),
    })

    if (!providerRes.ok) {
      const err = await providerRes.text()
      console.error(`[video] API error: ${providerRes.status} ${err}`)
      return res.status(providerRes.status).json({
        error: `API error: ${providerRes.status} ${err}`,
        providerStatus: providerRes.status,
        providerMessage: err,
      })
    }

    const data = await providerRes.json()
    const taskId = data.id || data.task_id
    if (!taskId) return res.status(502).json({ error: 'Provider did not return a task ID' })

    console.log(`[video] Task submitted: ${taskId}`)

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
      videoBaseUrl: providerBaseUrl,
      videoApiKey: config.apiKey,
      providerTaskId: taskId,
      originalPrompt: optimization.originalPrompt,
      optimizedPrompt: optimization.optimizedPrompt,
      intentSummary: optimization.intentSummary,
      optimizationNotes: optimization.optimizationNotes,
      optimizerSkill: optimization.optimizerSkill,
      protectedTokens: optimization.protectedTokens,
      optimizerUsedFallback: optimization.usedFallback,
    })
    const historyResult = await authed.supabase.from('generation_history').insert({
      user_id: authed.user.id,
      type: 'video',
      prompt: originalPrompt,
      parameters: JSON.parse(paramsJson),
      status: 'processing',
    })
      .select('id')
      .single()
    if (historyResult.error) throw historyResult.error

    res.json({
      taskId,
      historyId: historyResult.data.id,
      status: data.status || 'submitted',
      originalPrompt: optimization.originalPrompt,
      optimizedPrompt: optimization.optimizedPrompt,
      intentSummary: optimization.intentSummary,
      optimizationNotes: optimization.optimizationNotes,
      optimizerSkill: optimization.optimizerSkill,
      optimizerUsedFallback: optimization.usedFallback,
    })
  } catch (err: any) {
    console.error('[video] Generate failed:', err.message)
    res.status(400).json({ error: err.message })
  }
})

// GET /api/video/status/:taskId
router.get('/status/:taskId', async (req, res) => {
  const authed = req as unknown as AuthenticatedRequest
  const { taskId } = req.params
  try {
    const historyRow = await getHistoryByProviderTaskId(authed, taskId)
    const historyParameters = parseHistoryParameters(historyRow?.parameters)
    const videoBaseUrl = String(req.header('x-video-base-url') || historyParameters.videoBaseUrl || ENV_BASE_URL)
    const videoApiKey = String(req.header('x-video-api-key') || historyParameters.videoApiKey || ENV_API_KEY)
    if (!videoApiKey) return res.status(400).json({ error: 'Video API Key is not configured' })

    const providerBaseUrl = assertHttpUrl(videoBaseUrl, 'Video base URL')
    const existingVideoUrl = await getExistingVideoUrl(authed, historyRow)
    if (historyRow?.status === 'done' && existingVideoUrl) {
      return res.json({
        status: 'succeeded',
        videoUrl: existingVideoUrl,
        historyId: historyRow.id,
        imageId: historyRow.result_image_id,
      })
    }
    if (historyRow?.status === 'done' && typeof historyParameters.remoteVideoUrl === 'string') {
      return res.json({
        status: 'succeeded',
        videoUrl: historyParameters.remoteVideoUrl,
        historyId: historyRow.id,
        remote: true,
        warning: typeof historyParameters.warning === 'string' ? historyParameters.warning : undefined,
      })
    }

    const statusRes = await fetch(`${providerBaseUrl}/contents/generations/tasks/${taskId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${videoApiKey}`,
      },
    })

    if (!statusRes.ok) {
      const err = await statusRes.text()
      return res.status(statusRes.status).json({
        error: `Status API error: ${statusRes.status} ${err}`,
        providerStatus: statusRes.status,
        providerMessage: err,
      })
    }

    const data = await statusRes.json()
    console.log(`[video] Task ${taskId} status: ${data.status}`)
    console.log(`[video] Task ${taskId} data: ${JSON.stringify(data)}`)

    // If completed, download and save video
    const videoUrl = getProviderVideoUrl(data)
    if (data.status === 'succeeded' && videoUrl) {
      assertHttpUrl(videoUrl, 'Provider video URL')
      try {
        const vidRes = await fetch(videoUrl)
        if (!vidRes.ok) throw new Error(`Video download failed: ${vidRes.status}`)
        const buffer = Buffer.from(await vidRes.arrayBuffer())
        const stored = await persistBuffer({
          userId: authed.user.id,
          buffer,
          contentType: 'video/mp4',
          originalName: 'generated-video.mp4',
        })

        const { data: image, error: imageError } = await authed.supabase
          .from('images')
          .insert({
            user_id: authed.user.id,
            filename: stored.filename,
            original_name: `video-${stored.filename}`,
            url: stored.url,
            storage_key: stored.storageKey,
            width: 0,
            height: 0,
            size: buffer.length,
            mime_type: 'video/mp4',
            is_generated: true,
            prompt: historyRow?.prompt || '',
          })
          .select('*')
          .single()
        if (imageError) throw imageError

        if (historyRow) {
          const updateResult = await authed.supabase
            .from('generation_history')
            .update({ status: 'done', result_image_id: image.id })
            .eq('user_id', authed.user.id)
            .eq('id', historyRow.id)
          if (updateResult.error) throw updateResult.error
        }

        res.json({
          status: 'succeeded',
          videoUrl: stored.url,
          historyId: historyRow?.id || null,
          imageId: image.id,
        })
      } catch (downloadErr: any) {
        if (historyRow) {
          await mergeHistoryParameters(authed, historyRow, {
            remoteVideoUrl: videoUrl,
            warning: downloadErr.message,
          })
          await authed.supabase
            .from('generation_history')
            .update({ status: 'done' })
            .eq('user_id', authed.user.id)
            .eq('id', historyRow.id)
        }
        return res.json({
          status: 'succeeded',
          videoUrl,
          historyId: historyRow.id,
          remote: true,
          warning: downloadErr.message,
        })
      }
    } else if (data.status === 'failed') {
      if (historyRow) {
        await authed.supabase
          .from('generation_history')
          .update({ status: 'error' })
          .eq('user_id', authed.user.id)
          .eq('id', historyRow.id)
      }
      const providerMessage = typeof data.error === 'string' ? data.error : data.message || 'Generation failed'
      res.json({
        status: 'failed',
        error: 'Generation failed',
        providerStatus: data.code || data.status || 'failed',
        providerMessage,
        serverMessage: 'Generation failed',
      })
    } else {
      res.json({ status: data.status || 'running' })
    }
  } catch (err: any) {
    console.error('[video] Status check failed:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/video/history
router.get('/history', async (req, res) => {
  const authed = req as AuthenticatedRequest
  const { data, error } = await authed.supabase
    .from('generation_history')
    .select('*')
    .eq('user_id', authed.user.id)
    .eq('type', 'video')
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) return res.status(500).json({ error: error.message })
  res.json(data || [])
})

export default router
