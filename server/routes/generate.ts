import { Router } from 'express'
import multer from 'multer'
import { serializeImageRow, type ImageRow } from '../imageRows.js'
import { persistBuffer } from '../mediaStorage.js'
import { requireAuth, type AuthenticatedRequest } from '../supabaseAuth.js'

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } })
const router = Router()
router.use(requireAuth)

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
    for (const item of (data.data ?? [])) {
      if (item.b64_json) {
        buffers.push(Buffer.from(item.b64_json, 'base64'))
      } else if (item.url) {
        const imgRes = await fetch(item.url)
        buffers.push(Buffer.from(await imgRes.arrayBuffer()))
      }
    }
    if (buffers.length === 0) throw new Error(`img2img API returned no images: ${JSON.stringify(data)}`)
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
  for (const item of (data.data ?? [])) {
    if (item.b64_json) {
      buffers.push(Buffer.from(item.b64_json, 'base64'))
    } else if (item.url) {
      const imgRes = await fetch(item.url)
      buffers.push(Buffer.from(await imgRes.arrayBuffer()))
    }
  }
  if (buffers.length === 0) throw new Error(`text2img API returned no images: ${JSON.stringify(data)}`)
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
  const authed = req as AuthenticatedRequest
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
    const mimeType = `image/${outputFormat === 'jpg' ? 'jpeg' : outputFormat}`
    const stored = await persistBuffer({
      userId: authed.user.id,
      buffer: buffers[0],
      contentType: mimeType,
      originalName: `generated.${outputFormat === 'jpeg' ? 'jpg' : outputFormat}`,
    })
    const { data: row, error: imageError } = await authed.supabase
      .from('images')
      .insert({
        user_id: authed.user.id,
        filename: stored.filename,
        original_name: `generated-${stored.filename}`,
        url: stored.url,
        storage_key: stored.storageKey,
        width,
        height,
        size: buffers[0].length,
        mime_type: mimeType,
        is_generated: true,
        prompt,
      })
      .select('*')
      .single()
    if (imageError) throw imageError
    const paramsJson = JSON.stringify({ size, quality, background, outputFormat, outputCompression, n, model: config.model })
    const historyResult = await authed.supabase.from('generation_history').insert({
      user_id: authed.user.id,
      type: 'text2img',
      prompt,
      negative_prompt: negativePrompt || null,
      style: null,
      result_image_id: row.id,
      parameters: JSON.parse(paramsJson),
      status: 'done',
    })
    if (historyResult.error) throw historyResult.error

    console.log(`[generate] text2img done | saved=${stored.url} | size=${buffers[0].length} bytes | id=${row.id}`)
    res.json(serializeImageRow(row as ImageRow))
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
  const authed = req as AuthenticatedRequest
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
    const stored = await persistBuffer({
      userId: authed.user.id,
      buffer: buffers[0],
      contentType: 'image/png',
      originalName: 'img2img.png',
    })
    const { data: row, error: imageError } = await authed.supabase
      .from('images')
      .insert({
        user_id: authed.user.id,
        filename: stored.filename,
        original_name: `img2img-${stored.filename}`,
        url: stored.url,
        storage_key: stored.storageKey,
        width,
        height,
        size: buffers[0].length,
        mime_type: 'image/png',
        is_generated: true,
        prompt,
      })
      .select('*')
      .single()
    if (imageError) throw imageError
    const paramsJson = JSON.stringify({ size, quality, n, model: config.model })
    const historyResult = await authed.supabase.from('generation_history').insert({
      user_id: authed.user.id,
      type: 'img2img',
      prompt,
      negative_prompt: negativePrompt || null,
      style: null,
      result_image_id: row.id,
      parameters: JSON.parse(paramsJson),
      status: 'done',
    })
    if (historyResult.error) throw historyResult.error

    console.log(`[generate] img2img done | saved=${stored.url} | size=${buffers[0].length} bytes | id=${row.id}`)
    res.json(serializeImageRow(row as ImageRow))
  } catch (err: any) {
    console.error('[generate] img2img failed:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/generate/history
router.get('/history', async (req, res) => {
  const authed = req as AuthenticatedRequest
  const { data, error } = await authed.supabase
    .from('generation_history')
    .select('*, result_image:images(url)')
    .eq('user_id', authed.user.id)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) return res.status(500).json({ error: error.message })
  res.json(data || [])
})

export default router
