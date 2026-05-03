import { Router } from 'express'
import multer from 'multer'
import { v4 as uuid } from 'uuid'
import path from 'path'
import fs from 'fs'
import db from '../db.js'

const uploadsDir = path.join(process.cwd(), 'public', 'uploads')
fs.mkdirSync(uploadsDir, { recursive: true })

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } })
const router = Router()

const ENV_API_KEY = process.env.ARK_API_KEY || process.env.OPENAI_API_KEY || ''
const ENV_BASE_URL = process.env.ARK_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3'

function resolveConfig(body: any) {
  return {
    baseUrl: body.videoBaseUrl || ENV_BASE_URL,
    apiKey: body.videoApiKey || ENV_API_KEY,
    model: body.videoModel || 'seedance-2.0',
  }
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
    const content: Record<string, unknown> = {
      type: 'video_generation',
      prompt,
      duration: Number(duration),
      resolution,
      aspect_ratio: aspectRatio,
    }

    // If image uploaded (I2V), convert to base64 data URL
    if (req.file) {
      const base64 = req.file.buffer.toString('base64')
      const mime = req.file.mimetype || 'image/png'
      content.image_url = `data:${mime};base64,${base64}`
    }

    const res = await fetch(`${config.baseUrl.replace(/\/+$/, '')}/contents/generations/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        content,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error(`[video] API error: ${res.status} ${err}`)
      throw new Error(`API error: ${res.status} ${err}`)
    }

    const data = await res.json()
    console.log(`[video] Task submitted: ${data.id || data.task_id}`)

    // Save to history
    const paramsJson = JSON.stringify({ duration, resolution, aspectRatio, model: config.model, type: req.file ? 'i2v' : 't2v' })
    db.prepare(
      `INSERT INTO generation_history (type, prompt, parameters, status)
       VALUES ('video', ?, ?, 'processing')`
    ).run(prompt, paramsJson)

    res.json({
      taskId: data.id || data.task_id,
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
