import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { v4 as uuid } from 'uuid'
import sharp from 'sharp'
import db from '../db.js'

const uploadsDir = path.join(process.cwd(), 'public', 'uploads')
fs.mkdirSync(uploadsDir, { recursive: true })

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname)
    cb(null, `${uuid()}${ext}`)
  },
})
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } })

const router = Router()

// GET /api/images
router.get('/', (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20))
  const search = (req.query.search as string) || ''
  const category = (req.query.category as string) || ''

  let where = 'WHERE 1=1'
  const params: unknown[] = []

  if (search) {
    where += ' AND (original_name LIKE ? OR tags LIKE ?)'
    params.push(`%${search}%`, `%${search}%`)
  }
  if (category) {
    where += ' AND category = ?'
    params.push(category)
  }

  const countRow = db.prepare(`SELECT COUNT(*) as total FROM images ${where}`).get(...params) as { total: number }
  const rows = db
    .prepare(`SELECT * FROM images ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
    .all(...params, pageSize, (page - 1) * pageSize)

  const data = (rows as any[]).map((row) => ({
    ...row,
    tags: JSON.parse(row.tags || '[]'),
    metadata: JSON.parse(row.metadata || '{}'),
    url: `/uploads/${row.filename}`,
  }))

  res.json({
    data,
    total: countRow.total,
    page,
    pageSize,
    totalPages: Math.ceil(countRow.total / pageSize),
  })
})

// GET /api/images/:id
router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM images WHERE id = ?').get(req.params.id) as any
  if (!row) return res.status(404).json({ error: 'Not found' })
  res.json({
    ...row,
    tags: JSON.parse(row.tags || '[]'),
    metadata: JSON.parse(row.metadata || '{}'),
    url: `/uploads/${row.filename}`,
  })
})

// POST /api/images/upload
router.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' })

  let width = 0, height = 0
  try {
    const meta = await sharp(req.file.path).metadata()
    width = meta.width || 0
    height = meta.height || 0
  } catch {}

  const result = db
    .prepare(
      `INSERT INTO images (filename, original_name, width, height, size, mime_type)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(req.file.filename, req.file.originalname, width, height, req.file.size, req.file.mimetype)

  const row = db.prepare('SELECT * FROM images WHERE id = ?').get(result.lastInsertRowid) as any
  res.json({
    ...row,
    tags: JSON.parse(row.tags || '[]'),
    metadata: JSON.parse(row.metadata || '{}'),
    url: `/uploads/${row.filename}`,
  })
})

// PATCH /api/images/:id
router.patch('/:id', (req, res) => {
  const { category, tags } = req.body
  const updates: string[] = []
  const params: unknown[] = []

  if (category !== undefined) { updates.push('category = ?'); params.push(category) }
  if (tags !== undefined) { updates.push('tags = ?'); params.push(JSON.stringify(tags)) }
  updates.push('updated_at = CURRENT_TIMESTAMP')

  if (updates.length > 1) {
    db.prepare(`UPDATE images SET ${updates.join(', ')} WHERE id = ?`).run(...params, req.params.id)
  }

  const row = db.prepare('SELECT * FROM images WHERE id = ?').get(req.params.id) as any
  if (!row) return res.status(404).json({ error: 'Not found' })
  res.json({
    ...row,
    tags: JSON.parse(row.tags || '[]'),
    metadata: JSON.parse(row.metadata || '{}'),
    url: `/uploads/${row.filename}`,
  })
})

// DELETE /api/images/:id
router.delete('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM images WHERE id = ?').get(req.params.id) as any
  if (!row) return res.status(404).json({ error: 'Not found' })

  const filePath = path.join(uploadsDir, row.filename)
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath)

  db.prepare('DELETE FROM images WHERE id = ?').run(req.params.id)
  res.json({ success: true })
})

export default router
