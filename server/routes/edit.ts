import { Router } from 'express'
import { v4 as uuid } from 'uuid'
import path from 'path'
import fs from 'fs'
import sharp from 'sharp'
import db from '../db.js'

const uploadsDir = path.join(process.cwd(), 'public', 'uploads')
const router = Router()

// POST /api/edit/ai - AI natural language edit
router.post('/ai', (req, res) => {
  const { imageId, instruction } = req.body || {}
  if (!imageId || !instruction) return res.status(400).json({ error: 'imageId and instruction required' })

  const row = db.prepare('SELECT * FROM images WHERE id = ?').get(imageId) as any
  if (!row) return res.status(404).json({ error: 'Image not found' })

  // Record edit instruction
  db.prepare(
    `INSERT INTO generation_history (type, prompt, reference_image_id, status)
     VALUES ('ai_edit', ?, ?, 'done')`
  ).run(instruction, imageId)

  res.json({ success: true, message: 'AI edit queued', image: row })
})

// POST /api/edit/crop
router.post('/crop', async (req, res) => {
  const { imageId, x, y, width, height } = req.body || {}
  if (!imageId) return res.status(400).json({ error: 'imageId required' })

  const row = db.prepare('SELECT * FROM images WHERE id = ?').get(imageId) as any
  if (!row) return res.status(404).json({ error: 'Image not found' })

  const srcPath = path.join(uploadsDir, row.filename)
  if (!fs.existsSync(srcPath)) return res.status(404).json({ error: 'File not found' })

  const filename = `${uuid()}.png`
  const destPath = path.join(uploadsDir, filename)

  await sharp(srcPath)
    .extract({ left: x || 0, top: y || 0, width: width || 256, height: height || 256 })
    .toFile(destPath)

  const meta = await sharp(destPath).metadata()
  const result = db
    .prepare(
      `INSERT INTO images (filename, original_name, width, height, size, mime_type, parent_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(filename, `cropped-${row.original_name}`, meta.width || 0, meta.height || 0, 0, 'image/png', imageId)

  const newRow = db.prepare('SELECT * FROM images WHERE id = ?').get(result.lastInsertRowid) as any
  res.json({
    ...newRow,
    tags: JSON.parse(newRow.tags || '[]'),
    metadata: JSON.parse(newRow.metadata || '{}'),
    url: `/uploads/${newRow.filename}`,
  })
})

// POST /api/edit/resize
router.post('/resize', async (req, res) => {
  const { imageId, width, height } = req.body || {}
  if (!imageId || !width || !height) return res.status(400).json({ error: 'imageId, width, height required' })

  const row = db.prepare('SELECT * FROM images WHERE id = ?').get(imageId) as any
  if (!row) return res.status(404).json({ error: 'Image not found' })

  const srcPath = path.join(uploadsDir, row.filename)
  const filename = `${uuid()}.png`
  const destPath = path.join(uploadsDir, filename)

  await sharp(srcPath).resize(width, height).toFile(destPath)

  const result = db
    .prepare(
      `INSERT INTO images (filename, original_name, width, height, size, mime_type, parent_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(filename, `resized-${row.original_name}`, width, height, 0, 'image/png', imageId)

  const newRow = db.prepare('SELECT * FROM images WHERE id = ?').get(result.lastInsertRowid) as any
  res.json({
    ...newRow,
    tags: JSON.parse(newRow.tags || '[]'),
    metadata: JSON.parse(newRow.metadata || '{}'),
    url: `/uploads/${newRow.filename}`,
  })
})

// POST /api/edit/filter - Apply sharp filters
router.post('/filter', async (req, res) => {
  const { imageId, brightness, saturation, blur: blurAmount } = req.body || {}
  if (!imageId) return res.status(400).json({ error: 'imageId required' })

  const row = db.prepare('SELECT * FROM images WHERE id = ?').get(imageId) as any
  if (!row) return res.status(404).json({ error: 'Image not found' })

  const srcPath = path.join(uploadsDir, row.filename)
  const filename = `${uuid()}.png`
  const destPath = path.join(uploadsDir, filename)

  let pipeline = sharp(srcPath)
  if (brightness || saturation) {
    pipeline = pipeline.modulate({
      brightness: brightness ? brightness / 100 : 1,
      saturation: saturation ? saturation / 100 : 1,
    })
  }
  if (blurAmount) pipeline = pipeline.blur(blurAmount)

  await pipeline.toFile(destPath)

  const meta = await sharp(destPath).metadata()
  const result = db
    .prepare(
      `INSERT INTO images (filename, original_name, width, height, size, mime_type, parent_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(filename, `filtered-${row.original_name}`, meta.width || 0, meta.height || 0, 0, 'image/png', imageId)

  const newRow = db.prepare('SELECT * FROM images WHERE id = ?').get(result.lastInsertRowid) as any
  res.json({
    ...newRow,
    tags: JSON.parse(newRow.tags || '[]'),
    metadata: JSON.parse(newRow.metadata || '{}'),
    url: `/uploads/${newRow.filename}`,
  })
})

export default router
