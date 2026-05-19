import { Router } from 'express'
import db from '../db.js'

const router = Router()

function parseProject(row: any) {
  const assets = db
    .prepare(
      `SELECT
        rpa.id AS asset_id,
        rpa.role,
        rpa.sort_order,
        rpa.created_at AS asset_created_at,
        i.*
       FROM resource_project_assets rpa
       JOIN images i ON i.id = rpa.image_id
       WHERE rpa.project_id = ?
       ORDER BY rpa.sort_order ASC, rpa.id ASC`
    )
    .all(row.id) as any[]

  return {
    ...row,
    assets: assets.map((asset) => ({
      id: asset.asset_id,
      role: asset.role,
      sort_order: asset.sort_order,
      created_at: asset.asset_created_at,
      image: {
        id: asset.id,
        filename: asset.filename,
        original_name: asset.original_name,
        width: asset.width,
        height: asset.height,
        size: asset.size,
        mime_type: asset.mime_type,
        category: asset.category,
        tags: JSON.parse(asset.tags || '[]'),
        metadata: JSON.parse(asset.metadata || '{}'),
        is_generated: asset.is_generated,
        prompt: asset.prompt,
        parent_id: asset.parent_id,
        created_at: asset.created_at,
        updated_at: asset.updated_at,
        url: `/uploads/${asset.filename}`,
      },
    })),
  }
}

router.get('/projects', (_req, res) => {
  const rows = db.prepare('SELECT * FROM resource_projects ORDER BY updated_at DESC, id DESC').all() as any[]
  res.json(rows.map(parseProject))
})

router.post('/projects', (req, res) => {
  const { name, description = '', subject = '', style = '' } = req.body || {}
  if (!String(name || '').trim()) return res.status(400).json({ error: 'Project name is required' })

  const result = db
    .prepare(
      `INSERT INTO resource_projects (name, description, subject, style, status)
       VALUES (?, ?, ?, ?, 'draft')`
    )
    .run(String(name).trim(), String(description), String(subject), String(style))

  const row = db.prepare('SELECT * FROM resource_projects WHERE id = ?').get(result.lastInsertRowid) as any
  res.json(parseProject(row))
})

router.patch('/projects/:id', (req, res) => {
  const { name, description, subject, style, status } = req.body || {}
  const updates: string[] = []
  const params: unknown[] = []

  if (name !== undefined) {
    updates.push('name = ?')
    params.push(String(name).trim())
  }
  if (description !== undefined) {
    updates.push('description = ?')
    params.push(String(description))
  }
  if (subject !== undefined) {
    updates.push('subject = ?')
    params.push(String(subject))
  }
  if (style !== undefined) {
    updates.push('style = ?')
    params.push(String(style))
  }
  if (status !== undefined) {
    updates.push('status = ?')
    params.push(String(status))
  }

  updates.push('updated_at = CURRENT_TIMESTAMP')
  db.prepare(`UPDATE resource_projects SET ${updates.join(', ')} WHERE id = ?`).run(...params, req.params.id)

  const row = db.prepare('SELECT * FROM resource_projects WHERE id = ?').get(req.params.id) as any
  if (!row) return res.status(404).json({ error: 'Project not found' })
  res.json(parseProject(row))
})

router.post('/projects/:id/assets', (req, res) => {
  const project = db.prepare('SELECT * FROM resource_projects WHERE id = ?').get(req.params.id) as any
  if (!project) return res.status(404).json({ error: 'Project not found' })

  const { imageId, role, sortOrder = 0 } = req.body || {}
  if (!imageId) return res.status(400).json({ error: 'Image id is required' })
  if (!role) return res.status(400).json({ error: 'Asset role is required' })

  db.prepare('DELETE FROM resource_project_assets WHERE project_id = ? AND role = ?').run(req.params.id, String(role))
  db.prepare(
    `INSERT INTO resource_project_assets (project_id, image_id, role, sort_order)
     VALUES (?, ?, ?, ?)`
  ).run(req.params.id, Number(imageId), String(role), Number(sortOrder))
  db.prepare("UPDATE resource_projects SET status = 'ready', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(req.params.id)

  const row = db.prepare('SELECT * FROM resource_projects WHERE id = ?').get(req.params.id) as any
  res.json(parseProject(row))
})

router.delete('/projects/:id', (req, res) => {
  db.prepare('DELETE FROM resource_project_assets WHERE project_id = ?').run(req.params.id)
  db.prepare('DELETE FROM resource_projects WHERE id = ?').run(req.params.id)
  res.json({ success: true })
})

export default router
