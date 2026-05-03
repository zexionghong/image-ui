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

// Env fallbacks
const ENV_API_KEY = process.env.OPENAI_API_KEY || ''
const ENV_BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'

// Parse size string to width/height
function parseSize(size: string): { width: number; height: number } {
  if (size === 'auto' || !size) return { width: 1024, height: 1024 }
  const [w, h] = size.split('x').map(Number)
  return { width: w || 1024, height: h || 1024 }
}

// Call OpenAI-compatible image API
async function callImageApi(params: {
  prompt: string
  negativePrompt?: string
  size: string
  quality: string
  background: string
  outputFormat: string
  outputCompression: number
  n: number
  model: string
  baseUrl: string
  apiKey: string
  referenceImages?: Buffer[]
  maskBuffer?: Buffer
  inputFidelity?: string
}): Promise<Buffer[]> {
  const { prompt, negativePrompt, size, quality, background, outputFormat, outputCompression, n, model, baseUrl, apiKey, referenceImages, maskBuffer, inputFidelity } = params

  if (!apiKey) {
    throw new Error('API Key is not configured. Please set it in Settings or .env file.')
  }

  // Normalize base URL (strip trailing slash)
  const base = baseUrl.replace(/\/+$/, '')

  const isImg2Img = !!(referenceImages && referenceImages.length > 0)
  const endpoint = isImg2Img ? `${base}/images/edits` : `${base}/images/generations`

  console.log(`[generate] Calling ${endpoint} | model=${model} | size=${size} | quality=${quality} | n=${n}`)
  console.log(`[generate] Prompt: ${prompt.slice(0, 100)}${prompt.length > 100 ? '...' : ''}`)

  if (isImg2Img) {
    const form = new FormData()
    form.append('model', model)
    form.append('prompt', prompt)
    if (negativePrompt) form.append('negative_prompt', negativePrompt)
    form.append('size', size)
    form.append('quality', quality)
    form.append('n', String(n))

    for (let i = 0; i < referenceImages!.length; i++) {
      const blob = new Blob([referenceImages![i]], { type: 'image/png' })
      form.append('image', blob, `reference_${i}.png`)
    }

    if (maskBuffer) {
      const maskBlob = new Blob([maskBuffer], { type: 'image/png' })
      form.append('mask', maskBlob, 'mask.png')
    }
    if (inputFidelity) {
      form.append('input_fidelity', inputFidelity)
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    })

    if (!res.ok) {
      const err = await res.text()
      console.error(`[generate] img2img API error: ${res.status} ${err}`)
      throw new Error(`API error: ${res.status} ${err}`)
    }

    const data = await res.json()
    console.log(`[generate] img2img API response: ${data.data?.length || 0} image(s) returned`)
    const buffers: Buffer[] = []
    for (const item of data.data) {
      if (item.b64_json) {
        buffers.push(Buffer.from(item.b64_json, 'base64'))
      } else if (item.url) {
        const imgRes = await fetch(item.url)
        buffers.push(Buffer.from(await imgRes.arrayBuffer()))
      }
    }
    return buffers
  }

  // text2img - JSON body
  const body: Record<string, unknown> = {
    model,
    prompt,
    size,
    quality,
    n,
    background,
    output_format: outputFormat,
    output_compression: outputCompression,
  }
  if (negativePrompt) body.negative_prompt = negativePrompt

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error(`[generate] text2img API error: ${res.status} ${err}`)
    throw new Error(`API error: ${res.status} ${err}`)
  }

  const data = await res.json()
  console.log(`[generate] text2img API response: ${data.data?.length || 0} image(s) returned`)
  const buffers: Buffer[] = []
  for (const item of data.data) {
    if (item.b64_json) {
      buffers.push(Buffer.from(item.b64_json, 'base64'))
    } else if (item.url) {
      const imgRes = await fetch(item.url)
      buffers.push(Buffer.from(await imgRes.arrayBuffer()))
    }
  }
  return buffers
}

// Resolve API config: request body > env vars
function resolveConfig(body: any) {
  return {
    baseUrl: body.baseUrl || ENV_BASE_URL,
    apiKey: body.apiKey || ENV_API_KEY,
    model: body.model || 'gpt-image-2',
  }
}

// POST /api/generate/text2img
router.post('/text2img', upload.none(), async (req, res) => {
  const {
    prompt,
    negativePrompt,
    size = '1024x1024',
    quality = 'auto',
    background = 'auto',
    outputFormat = 'png',
    outputCompression = 100,
    n = 1,
  } = req.body || {}

  if (!prompt) return res.status(400).json({ error: 'Prompt is required' })

  const config = resolveConfig(req.body)
  console.log(`[generate] POST /text2img | model=${config.model} | base=${config.baseUrl} | apiKey=${config.apiKey ? '***' : '(empty)'}`)

  try {
    const buffers = await callImageApi({
      prompt,
      negativePrompt,
      size,
      quality,
      background,
      outputFormat,
      outputCompression: Number(outputCompression),
      n: Number(n),
      ...config,
    })

    const { width, height } = parseSize(size)
    const ext = outputFormat === 'jpeg' ? 'jpg' : outputFormat
    const filename = `${uuid()}.${ext}`
    const filePath = path.join(uploadsDir, filename)
    fs.writeFileSync(filePath, buffers[0])

    const imgResult = db
      .prepare(
        `INSERT INTO images (filename, original_name, width, height, size, mime_type, is_generated, prompt)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?)`
      )
      .run(filename, `generated-${filename}`, width, height, buffers[0].length, `image/${outputFormat}`, prompt)

    const paramsJson = JSON.stringify({ size, quality, background, outputFormat, outputCompression, n, model: config.model })
    db.prepare(
      `INSERT INTO generation_history (type, prompt, negative_prompt, style, result_image_id, parameters, status)
       VALUES ('text2img', ?, ?, ?, ?, ?, 'done')`
    ).run(prompt, negativePrompt || null, null, imgResult.lastInsertRowid, paramsJson)

    const row = db.prepare('SELECT * FROM images WHERE id = ?').get(imgResult.lastInsertRowid) as any
    console.log(`[generate] text2img done | saved=${filename} | size=${buffers[0].length} bytes | id=${row.id}`)
    res.json({
      ...row,
      tags: JSON.parse(row.tags || '[]'),
      metadata: JSON.parse(row.metadata || '{}'),
      url: `/uploads/${row.filename}`,
    })
  } catch (err: any) {
    console.error('[generate] text2img failed:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// POST /api/generate/img2img
router.post('/img2img', upload.fields([
  { name: 'reference', maxCount: 10 },
  { name: 'mask', maxCount: 1 },
]), async (req, res) => {
  const {
    prompt,
    negativePrompt,
    size = '1024x1024',
    quality = 'auto',
    n = 1,
    inputFidelity,
  } = req.body || {}

  if (!prompt) return res.status(400).json({ error: 'Prompt is required' })
  const fields = req.files as Record<string, Express.Multer.File[]>
  const files = fields?.reference || []
  if (files.length === 0) return res.status(400).json({ error: 'Reference image is required' })
  const maskFile = fields?.mask?.[0] || null

  const config = resolveConfig(req.body)
  console.log(`[generate] POST /img2img | model=${config.model} | base=${config.baseUrl} | apiKey=${config.apiKey ? '***' : '(empty)'} | images=${files.length} | mask=${!!maskFile} | fidelity=${inputFidelity || 'default'}`)

  try {
    const buffers = await callImageApi({
      prompt,
      negativePrompt,
      size,
      quality,
      background: 'auto',
      outputFormat: 'png',
      outputCompression: 100,
      n: Number(n),
      ...config,
      referenceImages: files.map((f) => f.buffer),
      maskBuffer: maskFile ? maskFile.buffer : undefined,
      inputFidelity: inputFidelity || undefined,
    })

    const { width, height } = parseSize(size)
    const filename = `${uuid()}.png`
    const filePath = path.join(uploadsDir, filename)
    fs.writeFileSync(filePath, buffers[0])

    const imgResult = db
      .prepare(
        `INSERT INTO images (filename, original_name, width, height, size, mime_type, is_generated, prompt)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?)`
      )
      .run(filename, `img2img-${filename}`, width, height, buffers[0].length, 'image/png', prompt)

    const paramsJson = JSON.stringify({ size, quality, n, model: config.model })
    db.prepare(
      `INSERT INTO generation_history (type, prompt, negative_prompt, style, result_image_id, parameters, status)
       VALUES ('img2img', ?, ?, ?, ?, ?, 'done')`
    ).run(prompt, negativePrompt || null, null, imgResult.lastInsertRowid, paramsJson)

    const row = db.prepare('SELECT * FROM images WHERE id = ?').get(imgResult.lastInsertRowid) as any
    console.log(`[generate] img2img done | saved=${filename} | size=${buffers[0].length} bytes | id=${row.id}`)
    res.json({
      ...row,
      tags: JSON.parse(row.tags || '[]'),
      metadata: JSON.parse(row.metadata || '{}'),
      url: `/uploads/${row.filename}`,
    })
  } catch (err: any) {
    console.error('[generate] img2img failed:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/generate/history
router.get('/history', (_req, res) => {
  const rows = db
    .prepare('SELECT * FROM generation_history ORDER BY created_at DESC LIMIT 50')
    .all()
  res.json(rows)
})

export default router
