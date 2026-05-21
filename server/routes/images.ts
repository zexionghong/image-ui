import { Router } from 'express'
import multer from 'multer'
import sharp from 'sharp'
import { serializeImageRow, type ImageRow } from '../imageRows.js'
import { persistBuffer } from '../mediaStorage.js'
import { requireAuth, type AuthenticatedRequest } from '../supabaseAuth.js'

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } })
const router = Router()

router.use(requireAuth)

// GET /api/images
router.get('/', async (req, res) => {
  const authed = req as AuthenticatedRequest
  const page = Math.max(1, Number(req.query.page) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20))
  const search = String(req.query.search || '')
  const category = String(req.query.category || '')
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = authed.supabase
    .from('images')
    .select('*', { count: 'exact' })
    .eq('user_id', authed.user.id)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (search) {
    query = query.ilike('original_name', `%${search}%`)
  }
  if (category) {
    query = query.eq('category', category)
  }

  const { data, error, count } = await query
  if (error) return res.status(500).json({ error: error.message })

  res.json({
    data: (data || []).map((row) => serializeImageRow(row as ImageRow)),
    total: count || 0,
    page,
    pageSize,
    totalPages: Math.ceil((count || 0) / pageSize),
  })
})

// GET /api/images/:id
router.get('/:id', async (req, res) => {
  const authed = req as AuthenticatedRequest
  const { data, error } = await authed.supabase
    .from('images')
    .select('*')
    .eq('user_id', authed.user.id)
    .eq('id', req.params.id)
    .maybeSingle()

  if (error) return res.status(500).json({ error: error.message })
  if (!data) return res.status(404).json({ error: 'Not found' })
  res.json(serializeImageRow(data as ImageRow))
})

// POST /api/images/upload
router.post('/upload', upload.single('file'), async (req, res) => {
  const authed = req as AuthenticatedRequest
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' })

  console.log(`[images] upload received | userId=${authed.user.id} | name=${req.file.originalname} | type=${req.file.mimetype} | size=${req.file.size}`)

  try {
    let width = 0
    let height = 0
    const meta = await sharp(req.file.buffer).metadata()
    width = meta.width || 0
    height = meta.height || 0

    const stored = await persistBuffer({
      userId: authed.user.id,
      buffer: req.file.buffer,
      contentType: req.file.mimetype,
      originalName: req.file.originalname,
    })
    console.log(`[images] upload stored | storageKey=${stored.storageKey} | url=${stored.url}`)

    const { data, error } = await authed.supabase
      .from('images')
      .insert({
        user_id: authed.user.id,
        filename: stored.filename,
        original_name: req.file.originalname,
        url: stored.url,
        storage_key: stored.storageKey,
        width,
        height,
        size: req.file.size,
        mime_type: req.file.mimetype,
      })
      .select('*')
      .single()

    if (error) {
      console.error('[images] upload image insert failed:', error)
      return res.status(500).json({ error: error.message })
    }

    console.log(`[images] upload image row inserted | imageId=${data.id} | url=${data.url}`)
    res.json(serializeImageRow(data as ImageRow))
  } catch (err: any) {
    console.error('[images] upload failed:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// PATCH /api/images/:id
router.patch('/:id', async (req, res) => {
  const authed = req as AuthenticatedRequest
  const { category, tags } = req.body
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (category !== undefined) patch.category = category
  if (tags !== undefined) patch.tags = tags

  const { data, error } = await authed.supabase
    .from('images')
    .update(patch)
    .eq('user_id', authed.user.id)
    .eq('id', req.params.id)
    .select('*')
    .maybeSingle()

  if (error) return res.status(500).json({ error: error.message })
  if (!data) return res.status(404).json({ error: 'Not found' })
  res.json(serializeImageRow(data as ImageRow))
})

// DELETE /api/images/:id
router.delete('/:id', async (req, res) => {
  const authed = req as AuthenticatedRequest
  const imageId = req.params.id

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

  const { error } = await authed.supabase
    .from('images')
    .delete()
    .eq('user_id', authed.user.id)
    .eq('id', imageId)

  if (error) return res.status(500).json({ error: error.message })
  res.json({ success: true })
})

export default router
