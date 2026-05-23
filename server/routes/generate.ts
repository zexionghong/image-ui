import { Router } from 'express'
import multer from 'multer'
import { serializeImageRow, type ImageRow } from '../imageRows.js'
import { persistBuffer, readMediaBuffer } from '../mediaStorage.js'
import { requireAuth, type AuthenticatedRequest } from '../supabaseAuth.js'
import { optimizeImagePrompt, type PromptOptimizationResult } from '../promptOptimizer.js'

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

function bufferToBlobPart(buffer: Buffer): BlobPart {
  const bytes = new Uint8Array(buffer.length)
  bytes.set(buffer)
  return bytes
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
      const blob = new Blob([bufferToBlobPart(referenceImages![i])], { type: 'image/png' })
      form.append('image', blob, `reference_${i}.png`)
    }

    if (maskBuffer) {
      const maskBlob = new Blob([bufferToBlobPart(maskBuffer)], { type: 'image/png' })
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

export function mergeGenerationParameters(
  parameters: Record<string, unknown>,
  optimization: PromptOptimizationResult,
) {
  return {
    ...parameters,
    originalPrompt: optimization.originalPrompt,
    originalNegativePrompt: optimization.originalNegativePrompt,
    optimizedPrompt: optimization.optimizedPrompt,
    optimizedNegativePrompt: optimization.optimizedNegativePrompt,
    intentSummary: optimization.intentSummary,
    optimizationNotes: optimization.optimizationNotes,
    optimizerSkill: optimization.optimizerSkill,
    protectedTokens: optimization.protectedTokens,
    optimizerUsedFallback: optimization.usedFallback,
  }
}

async function createGenerationTask(req: AuthenticatedRequest, input: {
  type: string
  prompt: string
  negativePrompt?: string | null
  parameters: Record<string, unknown>
}) {
  const { data, error } = await req.supabase
    .from('generation_history')
    .insert({
      user_id: req.user.id,
      type: input.type,
      prompt: input.prompt,
      negative_prompt: input.negativePrompt || null,
      parameters: input.parameters,
      status: 'processing',
    })
    .select('id')
    .single()
  if (error) {
    console.error(`[generate] ${input.type} task insert failed:`, error)
    throw error
  }
  console.log(`[generate] ${input.type} task inserted | historyId=${data.id}`)
  return data.id as string
}

async function updateGenerationTask(req: AuthenticatedRequest, historyId: string, patch: Record<string, unknown>) {
  const { error } = await req.supabase
    .from('generation_history')
    .update(patch)
    .eq('user_id', req.user.id)
    .eq('id', historyId)
  if (error) {
    console.error(`[generate] task update failed | historyId=${historyId}:`, error)
    throw error
  }
}

async function markGenerationTaskFailed(req: AuthenticatedRequest, historyId: string | null, error: unknown, parameters: Record<string, unknown>) {
  if (!historyId) return
  const message = error instanceof Error ? error.message : String(error)
  try {
    await updateGenerationTask(req, historyId, {
      status: 'error',
      parameters: { ...parameters, error: message },
    })
    console.log(`[generate] task marked error | historyId=${historyId} | error=${message}`)
  } catch (updateError) {
    console.error(`[generate] failed to mark task error | historyId=${historyId}:`, updateError)
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

  const baseParameters = { size, quality, background, outputFormat, outputCompression, n, model: config.model }
  let historyId: string | null = null

  try {
    const optimization = await optimizeImagePrompt({
      prompt: String(prompt),
      negativePrompt: negativePrompt ? String(negativePrompt) : '',
      mode: 'text2img',
      hasReferenceImages: false,
      size: String(size),
      quality: String(quality),
      background: String(background),
      outputFormat: String(outputFormat),
      mediaKind: 'image',
      isThreeView: String(req.body.promptContext || '') === 'three-view',
      threeViewAngle: req.body.threeViewAngle ? String(req.body.threeViewAngle) : undefined,
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      model: config.model,
    })
    const parameters = mergeGenerationParameters(baseParameters, optimization)

    historyId = await createGenerationTask(authed, {
      type: 'text2img',
      prompt,
      negativePrompt: negativePrompt || null,
      parameters,
    })

    const buffers = await callImageApi({
      prompt: optimization.optimizedPrompt,
      negativePrompt: optimization.optimizedNegativePrompt,
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
        prompt: optimization.originalPrompt,
      })
      .select('*')
      .single()
    if (imageError) {
      console.error('[generate] text2img image insert failed:', imageError)
      throw imageError
    }
    console.log(`[generate] text2img image row inserted | imageId=${row.id} | url=${row.url}`)

    await updateGenerationTask(authed, historyId, {
      result_image_id: row.id,
      parameters,
      status: 'done',
    })
    console.log(`[generate] text2img task done | historyId=${historyId} | imageId=${row.id}`)

    console.log(`[generate] text2img done | saved=${stored.url} | size=${buffers[0].length} bytes | id=${row.id}`)
    res.json({
      ...serializeImageRow(row as ImageRow),
      generation_history_id: historyId,
      originalPrompt: optimization.originalPrompt,
      originalNegativePrompt: optimization.originalNegativePrompt,
      optimizedPrompt: optimization.optimizedPrompt,
      optimizedNegativePrompt: optimization.optimizedNegativePrompt,
      intentSummary: optimization.intentSummary,
      optimizationNotes: optimization.optimizationNotes,
      optimizerSkill: optimization.optimizerSkill,
      protectedTokens: optimization.protectedTokens,
      optimizerUsedFallback: optimization.usedFallback,
    })
  } catch (err: any) {
    await markGenerationTaskFailed(authed, historyId, err, baseParameters)
    console.error('[generate] text2img failed:', err.message)
    res.status(500).json({ error: err.message, generation_history_id: historyId })
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
    referenceUrl,
  } = req.body || {}

  if (!prompt) return res.status(400).json({ error: 'Prompt is required' })
  const fields = req.files as Record<string, Express.Multer.File[]>
  const files = fields?.reference || []
  if (files.length === 0 && !referenceUrl) return res.status(400).json({ error: 'Reference image is required' })
  const maskFile = fields?.mask?.[0] || null

  const config = resolveConfig(req.body)
  console.log(`[generate] POST /img2img | model=${config.model} | base=${config.baseUrl} | apiKey=${config.apiKey ? '***' : '(empty)'} | images=${files.length} | mask=${!!maskFile} | fidelity=${inputFidelity || 'default'}`)

  const baseParameters = { size, quality, n, model: config.model, inputFidelity: inputFidelity || null, hasReferenceUrl: Boolean(referenceUrl) }
  let historyId: string | null = null

  try {
    const optimization = await optimizeImagePrompt({
      prompt: String(prompt),
      negativePrompt: negativePrompt ? String(negativePrompt) : '',
      mode: 'img2img',
      hasReferenceImages: true,
      size: String(size),
      quality: String(quality),
      background: 'auto',
      outputFormat: 'png',
      mediaKind: 'image',
      isThreeView: String(req.body.promptContext || '') === 'three-view',
      threeViewAngle: req.body.threeViewAngle ? String(req.body.threeViewAngle) : undefined,
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      model: config.model,
    })
    const parameters = mergeGenerationParameters(baseParameters, optimization)

    historyId = await createGenerationTask(authed, {
      type: 'img2img',
      prompt,
      negativePrompt: negativePrompt || null,
      parameters,
    })

    const referenceBuffers = files.map((f) => f.buffer)
    if (referenceUrl) {
      referenceBuffers.push(await readMediaBuffer(String(referenceUrl)))
    }

    const buffers = await callImageApi({
      prompt: optimization.optimizedPrompt,
      negativePrompt: optimization.optimizedNegativePrompt,
      size,
      quality,
      background: 'auto',
      outputFormat: 'png',
      outputCompression: 100,
      n: Number(n),
      ...config,
      referenceImages: referenceBuffers,
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
        prompt: optimization.originalPrompt,
      })
      .select('*')
      .single()
    if (imageError) {
      console.error('[generate] img2img image insert failed:', imageError)
      throw imageError
    }
    console.log(`[generate] img2img image row inserted | imageId=${row.id} | url=${row.url}`)

    await updateGenerationTask(authed, historyId, {
      result_image_id: row.id,
      parameters,
      status: 'done',
    })
    console.log(`[generate] img2img task done | historyId=${historyId} | imageId=${row.id}`)

    console.log(`[generate] img2img done | saved=${stored.url} | size=${buffers[0].length} bytes | id=${row.id}`)
    res.json({
      ...serializeImageRow(row as ImageRow),
      generation_history_id: historyId,
      originalPrompt: optimization.originalPrompt,
      originalNegativePrompt: optimization.originalNegativePrompt,
      optimizedPrompt: optimization.optimizedPrompt,
      optimizedNegativePrompt: optimization.optimizedNegativePrompt,
      intentSummary: optimization.intentSummary,
      optimizationNotes: optimization.optimizationNotes,
      optimizerSkill: optimization.optimizerSkill,
      protectedTokens: optimization.protectedTokens,
      optimizerUsedFallback: optimization.usedFallback,
    })
  } catch (err: any) {
    await markGenerationTaskFailed(authed, historyId, err, baseParameters)
    console.error('[generate] img2img failed:', err.message)
    res.status(500).json({ error: err.message, generation_history_id: historyId })
  }
})

// GET /api/generate/history
router.get('/history', async (req, res) => {
  const authed = req as AuthenticatedRequest
  const { data, error } = await authed.supabase
    .from('generation_history')
    .select('*')
    .eq('user_id', authed.user.id)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) return res.status(500).json({ error: error.message })

  const rows = data || []
  const imageIds = Array.from(new Set(rows.map((row: any) => row.result_image_id).filter(Boolean)))
  if (imageIds.length === 0) {
    return res.json(rows.map((row: any) => ({ ...row, result_image: null })))
  }

  const { data: images, error: imageError } = await authed.supabase
    .from('images')
    .select('id,url')
    .eq('user_id', authed.user.id)
    .in('id', imageIds)
  if (imageError) return res.status(500).json({ error: imageError.message })

  const imageById = new Map((images || []).map((image: any) => [image.id, { url: image.url }]))
  res.json(rows.map((row: any) => ({
    ...row,
    result_image: row.result_image_id ? imageById.get(row.result_image_id) ?? null : null,
  })))
})

// DELETE /api/generate/history/:id
router.delete('/history/:id', async (req, res) => {
  const authed = req as unknown as AuthenticatedRequest
  const { data: row, error: historyError } = await authed.supabase
    .from('generation_history')
    .select('*')
    .eq('user_id', authed.user.id)
    .eq('id', req.params.id)
    .maybeSingle()
  if (historyError) return res.status(500).json({ error: historyError.message })
  if (!row) return res.status(404).json({ error: 'Generation history not found' })

  const imageId = row.result_image_id as string | null
  if (imageId) {
    const assetCleanup = await authed.supabase
      .from('resource_project_assets')
      .delete()
      .eq('user_id', authed.user.id)
      .eq('image_id', imageId)
    if (assetCleanup.error) return res.status(500).json({ error: assetCleanup.error.message })

    const referenceCleanup = await authed.supabase
      .from('generation_history')
      .update({ reference_image_id: null })
      .eq('user_id', authed.user.id)
      .eq('reference_image_id', imageId)
    if (referenceCleanup.error) return res.status(500).json({ error: referenceCleanup.error.message })

    const resultCleanup = await authed.supabase
      .from('generation_history')
      .update({ result_image_id: null })
      .eq('user_id', authed.user.id)
      .eq('result_image_id', imageId)
    if (resultCleanup.error) return res.status(500).json({ error: resultCleanup.error.message })

    const parentCleanup = await authed.supabase
      .from('images')
      .update({ parent_id: null })
      .eq('user_id', authed.user.id)
      .eq('parent_id', imageId)
    if (parentCleanup.error) return res.status(500).json({ error: parentCleanup.error.message })

    const imageDelete = await authed.supabase
      .from('images')
      .delete()
      .eq('user_id', authed.user.id)
      .eq('id', imageId)
    if (imageDelete.error) return res.status(500).json({ error: imageDelete.error.message })
  }

  const deleteHistory = await authed.supabase
    .from('generation_history')
    .delete()
    .eq('user_id', authed.user.id)
    .eq('id', req.params.id)
  if (deleteHistory.error) return res.status(500).json({ error: deleteHistory.error.message })

  res.json({ success: true })
})

export default router
