import { Router } from 'express'
import sharp from 'sharp'
import { serializeImageRow, type ImageRow } from '../imageRows.js'
import { persistBuffer, readMediaBuffer } from '../mediaStorage.js'
import { requireAuth, type AuthenticatedRequest } from '../supabaseAuth.js'

const router = Router()
router.use(requireAuth)

async function getUserImage(req: AuthenticatedRequest, imageId: string) {
  const { data, error } = await req.supabase
    .from('images')
    .select('*')
    .eq('user_id', req.user.id)
    .eq('id', imageId)
    .maybeSingle()
  if (error) throw error
  return data
}

async function insertDerivedImage(req: AuthenticatedRequest, input: {
  source: any
  buffer: Buffer
  originalName: string
  width: number
  height: number
  parentId: string
}) {
  const stored = await persistBuffer({
    userId: req.user.id,
    buffer: input.buffer,
    contentType: 'image/png',
    originalName: input.originalName,
  })

  const { data, error } = await req.supabase
    .from('images')
    .insert({
      user_id: req.user.id,
      filename: stored.filename,
      original_name: input.originalName,
      url: stored.url,
      storage_key: stored.storageKey,
      width: input.width,
      height: input.height,
      size: input.buffer.length,
      mime_type: 'image/png',
      parent_id: input.parentId,
      category: input.source.category || 'uncategorized',
      tags: input.source.tags || [],
      metadata: input.source.metadata || {},
    })
    .select('*')
    .single()
  if (error) throw error
  return serializeImageRow(data as ImageRow)
}

// POST /api/edit/ai - AI natural language edit
router.post('/ai', async (req, res) => {
  const authed = req as AuthenticatedRequest
  const { imageId, instruction } = req.body || {}
  if (!imageId || !instruction) return res.status(400).json({ error: 'imageId and instruction required' })

  try {
    const row = await getUserImage(authed, String(imageId))
    if (!row) return res.status(404).json({ error: 'Image not found' })

    const history = await authed.supabase.from('generation_history').insert({
      user_id: authed.user.id,
      type: 'ai_edit',
      prompt: instruction,
      reference_image_id: imageId,
      status: 'done',
    })
    if (history.error) throw history.error

    res.json({ success: true, message: 'AI edit queued', image: serializeImageRow(row as ImageRow) })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/edit/crop
router.post('/crop', async (req, res) => {
  const authed = req as AuthenticatedRequest
  const { imageId, x, y, width, height } = req.body || {}
  if (!imageId) return res.status(400).json({ error: 'imageId required' })

  try {
    const row = await getUserImage(authed, String(imageId))
    if (!row) return res.status(404).json({ error: 'Image not found' })

    const source = await readMediaBuffer(row.url)
    const buffer = await sharp(source)
      .extract({ left: x || 0, top: y || 0, width: width || 256, height: height || 256 })
      .png()
      .toBuffer()
    const meta = await sharp(buffer).metadata()

    res.json(await insertDerivedImage(authed, {
      source: row,
      buffer,
      originalName: `cropped-${row.original_name}`,
      width: meta.width || 0,
      height: meta.height || 0,
      parentId: String(imageId),
    }))
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/edit/resize
router.post('/resize', async (req, res) => {
  const authed = req as AuthenticatedRequest
  const { imageId, width, height } = req.body || {}
  if (!imageId || !width || !height) return res.status(400).json({ error: 'imageId, width, height required' })

  try {
    const row = await getUserImage(authed, String(imageId))
    if (!row) return res.status(404).json({ error: 'Image not found' })

    const source = await readMediaBuffer(row.url)
    const buffer = await sharp(source).resize(width, height).png().toBuffer()

    res.json(await insertDerivedImage(authed, {
      source: row,
      buffer,
      originalName: `resized-${row.original_name}`,
      width: Number(width),
      height: Number(height),
      parentId: String(imageId),
    }))
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/edit/filter - Apply sharp filters
router.post('/filter', async (req, res) => {
  const authed = req as AuthenticatedRequest
  const { imageId, brightness, saturation, blur: blurAmount } = req.body || {}
  if (!imageId) return res.status(400).json({ error: 'imageId required' })

  try {
    const row = await getUserImage(authed, String(imageId))
    if (!row) return res.status(404).json({ error: 'Image not found' })

    const source = await readMediaBuffer(row.url)
    let pipeline = sharp(source)
    if (brightness || saturation) {
      pipeline = pipeline.modulate({
        brightness: brightness ? brightness / 100 : 1,
        saturation: saturation ? saturation / 100 : 1,
      })
    }
    if (blurAmount) pipeline = pipeline.blur(blurAmount)

    const buffer = await pipeline.png().toBuffer()
    const meta = await sharp(buffer).metadata()

    res.json(await insertDerivedImage(authed, {
      source: row,
      buffer,
      originalName: `filtered-${row.original_name}`,
      width: meta.width || 0,
      height: meta.height || 0,
      parentId: String(imageId),
    }))
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router
