import { Router } from 'express'
import multer from 'multer'
import { v4 as uuid } from 'uuid'
import path from 'path'
import fs from 'fs'
import db from '../db.js'

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

const VIDEO_MODES: VideoMode[] = ['t2v', 'i2v', 'first_last', 'multimodal', 'continue']
const MAX_UPLOAD_BYTES = 120 * 1024 * 1024

const uploadsDir = path.join(process.cwd(), 'public', 'uploads')
fs.mkdirSync(uploadsDir, { recursive: true })

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

function getHistoryByProviderTaskId(taskId: string) {
  const rows = db
    .prepare(`SELECT * FROM generation_history WHERE type = 'video' ORDER BY created_at DESC`)
    .all() as any[]
  return rows.find((row) => parseHistoryParameters(row.parameters).providerTaskId === taskId)
}

function mergeHistoryParameters(row: any, patch: Record<string, unknown>) {
  const parameters = {
    ...parseHistoryParameters(row?.parameters),
    ...patch,
  }
  db.prepare(`UPDATE generation_history SET parameters = ? WHERE id = ?`).run(JSON.stringify(parameters), row.id)
  return parameters
}

function getExistingLocalVideoUrl(row: any) {
  if (!row?.result_image_id) return ''
  const image = db.prepare(`SELECT filename FROM images WHERE id = ?`).get(row.result_image_id) as { filename?: string } | undefined
  if (!image?.filename) return ''
  const filePath = path.join(uploadsDir, image.filename)
  return fs.existsSync(filePath) ? `/uploads/${image.filename}` : ''
}

// POST /api/video/generate
router.post('/generate', videoUpload, async (req, res) => {
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

    const media = collectMedia(req.files)
    if (getTotalMediaBytes(media) > MAX_UPLOAD_BYTES) {
      throw new Error('Total uploaded media must not exceed 120MB')
    }

    const input: SeedanceGenerateInput = {
      mode,
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
      return res.status(providerRes.status).json({ error: `API error: ${providerRes.status} ${err}` })
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
    })
    db.prepare(
      `INSERT INTO generation_history (type, prompt, parameters, status)
       VALUES ('video', ?, ?, 'processing')`
    ).run(input.prompt, paramsJson)

    res.json({
      taskId,
      status: data.status || 'submitted',
    })
  } catch (err: any) {
    console.error('[video] Generate failed:', err.message)
    res.status(400).json({ error: err.message })
  }
})

// GET /api/video/status/:taskId
router.get('/status/:taskId', async (req, res) => {
  const { taskId } = req.params
  try {
    const historyRow = getHistoryByProviderTaskId(taskId)
    const historyParameters = parseHistoryParameters(historyRow?.parameters)
    const videoBaseUrl = String(req.header('x-video-base-url') || historyParameters.videoBaseUrl || ENV_BASE_URL)
    const videoApiKey = String(req.header('x-video-api-key') || historyParameters.videoApiKey || ENV_API_KEY)
    if (!videoApiKey) return res.status(400).json({ error: 'Video API Key is not configured' })

    const providerBaseUrl = assertHttpUrl(videoBaseUrl, 'Video base URL')
    const existingLocalVideoUrl = getExistingLocalVideoUrl(historyRow)
    if (historyRow?.status === 'done' && existingLocalVideoUrl) {
      return res.json({
        status: 'succeeded',
        videoUrl: existingLocalVideoUrl,
        imageId: historyRow.result_image_id,
      })
    }
    if (historyRow?.status === 'done' && typeof historyParameters.remoteVideoUrl === 'string') {
      return res.json({
        status: 'succeeded',
        videoUrl: historyParameters.remoteVideoUrl,
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
      throw new Error(`Status API error: ${statusRes.status} ${err}`)
    }

    const data = await statusRes.json()
    console.log(`[video] Task ${taskId} status: ${data.status}`)

    // If completed, download and save video
    const videoUrl = getProviderVideoUrl(data)
    if (data.status === 'succeeded' && videoUrl) {
      assertHttpUrl(videoUrl, 'Provider video URL')
      try {
        const vidRes = await fetch(videoUrl)
        if (!vidRes.ok) throw new Error(`Video download failed: ${vidRes.status}`)
        const buffer = Buffer.from(await vidRes.arrayBuffer())
        const filename = `${uuid()}.mp4`
        const filePath = path.join(uploadsDir, filename)
        fs.writeFileSync(filePath, buffer)

        // Save to images table (reuse for video)
        const imgResult = db
          .prepare(
            `INSERT INTO images (filename, original_name, width, height, size, mime_type, is_generated, prompt)
             VALUES (?, ?, 0, 0, ?, 'video/mp4', 1, ?)`
          )
          .run(filename, `video-${filename}`, buffer.length, historyRow?.prompt || '')

        if (historyRow) {
          db.prepare(`UPDATE generation_history SET status = 'done', result_image_id = ? WHERE id = ?`)
            .run(imgResult.lastInsertRowid, historyRow.id)
        }

        res.json({
          status: 'succeeded',
          videoUrl: `/uploads/${filename}`,
          imageId: imgResult.lastInsertRowid,
        })
      } catch (downloadErr: any) {
        if (historyRow) {
          mergeHistoryParameters(historyRow, {
            remoteVideoUrl: videoUrl,
            warning: downloadErr.message,
          })
          db.prepare(`UPDATE generation_history SET status = 'done' WHERE id = ?`).run(historyRow.id)
        }
        return res.json({
          status: 'succeeded',
          videoUrl,
          remote: true,
          warning: downloadErr.message,
        })
      }
    } else if (data.status === 'failed') {
      if (historyRow) {
        db.prepare(`UPDATE generation_history SET status = 'error' WHERE id = ?`).run(historyRow.id)
      }
      res.json({ status: 'failed', error: data.error || 'Generation failed' })
    } else {
      res.json({ status: data.status || 'running' })
    }
  } catch (err: any) {
    console.error('[video] Status check failed:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/video/history
router.get('/history', (_req, res) => {
  const rows = db
    .prepare(`SELECT * FROM generation_history WHERE type = 'video' ORDER BY created_at DESC LIMIT 50`)
    .all()
  res.json(rows)
})

export default router
