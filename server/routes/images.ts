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

  let width = 0
  let height = 0
  try {
    const meta = await sharp(req.file.buffer).metadata()
    width = meta.width || 0
    height = meta.height || 0
  } catch {}

  const stored = await persistBuffer({
    userId: authed.user.id,
    buffer: req.file.buffer,
    contentType: req.file.mimetype,
    originalName: req.file.originalname,
  })

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

  if (error) return res.status(500).json({ error: error.message })
  res.json(serializeImageRow(data as ImageRow))
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
  const { error } = await authed.supabase
    .from('images')
    .delete()
    .eq('user_id', authed.user.id)
    .eq('id', req.params.id)

  if (error) return res.status(500).json({ error: error.message })
  res.json({ success: true })
})

export default router
