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

const uploadsDir = path.join(process.cwd(), 'public', 'uploads')
fs.mkdirSync(uploadsDir, { recursive: true })

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } })
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

// POST /api/video/generate
router.post('/generate', upload.single('image'), async (req, res) => {
  const {
    prompt,
    duration = '5',
    resolution = '720p',
    aspectRatio = '16:9',
  } = req.body || {}

  if (!prompt) return res.status(400).json({ error: 'Prompt is required' })

  const config = resolveConfig(req.body)
  if (!config.apiKey) return res.status(400).json({ error: 'Video API Key is not configured' })

  console.log(`[video] POST /generate | model=${config.model} | base=${config.baseUrl}`)

  try {
    const content: any[] = [
      { type: 'text', text: prompt },
    ]

    // If image uploaded (I2V), add as image_url content item
    if (req.file) {
      const base64 = req.file.buffer.toString('base64')
      const mime = req.file.mimetype || 'image/png'
      content.push({
        type: 'image_url',
        image_url: { url: `data:${mime};base64,${base64}` },
      })
    }

    const requestBody = {
      model: config.model,
      content,
      resolution,
      ratio: aspectRatio,
      duration: Number(duration),
    }
    console.log(`[video] Request metadata:`, {
      model: requestBody.model,
      resolution: requestBody.resolution,
      ratio: requestBody.ratio,
      duration: requestBody.duration,
      contentCount: content.length,
      hasImage: Boolean(req.file),
    })

    const apiRes = await fetch(`${config.baseUrl.replace(/\/+$/, '')}/contents/generations/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(requestBody),
    })

    if (!apiRes.ok) {
      const err = await apiRes.text()
      console.error(`[video] API error: ${apiRes.status} ${err}`)
      throw new Error(`API error: ${apiRes.status} ${err}`)
    }

    const data = await apiRes.json()
    const taskId = data.id || data.task_id
    console.log(`[video] Task submitted: ${taskId}`)

    // Save to history
    const paramsJson = JSON.stringify({ duration, resolution, aspectRatio, model: config.model, type: req.file ? 'i2v' : 't2v' })
    db.prepare(
      `INSERT INTO generation_history (type, prompt, parameters, status)
       VALUES ('video', ?, ?, 'processing')`
    ).run(prompt, paramsJson)

    res.json({
      taskId,
      status: 'submitted',
    })
  } catch (err: any) {
    console.error('[video] Generate failed:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/video/status/:taskId
router.get('/status/:taskId', async (req, res) => {
  const { taskId } = req.params
  const videoBaseUrl = req.query.videoBaseUrl as string || ENV_BASE_URL
  const videoApiKey = req.query.videoApiKey as string || ENV_API_KEY

  try {
    const statusRes = await fetch(`${videoBaseUrl.replace(/\/+$/, '')}/contents/generations/tasks/${taskId}`, {
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
    if (data.status === 'succeeded' && (data.content?.video_url || data.video_url)) {
      const videoUrl = data.content?.video_url || data.video_url
      const vidRes = await fetch(videoUrl)
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
        .run(filename, `video-${filename}`, buffer.length, '')

      // Update history
      db.prepare(
        `UPDATE generation_history SET status = 'done', result_image_id = ? WHERE type = 'video' AND status = 'processing' ORDER BY created_at DESC LIMIT 1`
      ).run(imgResult.lastInsertRowid)

      res.json({
        status: 'succeeded',
        videoUrl: `/uploads/${filename}`,
        imageId: imgResult.lastInsertRowid,
      })
    } else if (data.status === 'failed') {
      db.prepare(
        `UPDATE generation_history SET status = 'error' WHERE type = 'video' AND status = 'processing' ORDER BY created_at DESC LIMIT 1`
      ).run()
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
