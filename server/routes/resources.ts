import { Router } from 'express'
import { serializeImageRow, type ImageRow } from '../imageRows.js'
import { requireAuth, type AuthenticatedRequest } from '../supabaseAuth.js'

const router = Router()
router.use(requireAuth)

async function parseProject(req: AuthenticatedRequest, row: any) {
  const { data, error } = await req.supabase
    .from('resource_project_assets')
    .select('id, role, sort_order, created_at, image_id')
    .eq('user_id', req.user.id)
    .eq('project_id', row.id)
    .order('sort_order', { ascending: true })
    .order('id', { ascending: true })

  if (error) throw error

  const assets = data || []
  const imageIds = Array.from(new Set(assets.map((asset: any) => asset.image_id).filter(Boolean)))
  let imageById = new Map<string, ImageRow>()

  if (imageIds.length > 0) {
    const { data: images, error: imageError } = await req.supabase
      .from('images')
      .select('*')
      .eq('user_id', req.user.id)
      .in('id', imageIds)
    if (imageError) throw imageError
    imageById = new Map((images || []).map((image: any) => [image.id, image as ImageRow]))
  }

  return {
    ...row,
    assets: assets.map((asset: any) => ({
      id: asset.id,
      role: asset.role,
      sort_order: asset.sort_order,
      created_at: asset.created_at,
      image: imageById.has(asset.image_id) ? serializeImageRow(imageById.get(asset.image_id) as ImageRow) : null,
    })),
  }
}

router.get('/projects', async (req, res) => {
  const authed = req as AuthenticatedRequest
  const { data, error } = await authed.supabase
    .from('resource_projects')
    .select('*')
    .eq('user_id', authed.user.id)
    .order('updated_at', { ascending: false })
    .order('id', { ascending: false })

  if (error) return res.status(500).json({ error: error.message })
  const projects = await Promise.all((data || []).map((row) => parseProject(authed, row)))
  res.json(projects)
})

router.post('/projects', async (req, res) => {
  const authed = req as AuthenticatedRequest
  const { name, description = '', subject = '', style = '' } = req.body || {}
  if (!String(name || '').trim()) return res.status(400).json({ error: 'Project name is required' })

  const { data, error } = await authed.supabase
    .from('resource_projects')
    .insert({
      user_id: authed.user.id,
      name: String(name).trim(),
      description: String(description),
      subject: String(subject),
      style: String(style),
      status: 'draft',
    })
    .select('*')
    .single()

  if (error) return res.status(500).json({ error: error.message })
  res.json(await parseProject(authed, data))
})

router.patch('/projects/:id', async (req, res) => {
  const authed = req as AuthenticatedRequest
  const { name, description, subject, style, status } = req.body || {}
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (name !== undefined) patch.name = String(name).trim()
  if (description !== undefined) patch.description = String(description)
  if (subject !== undefined) patch.subject = String(subject)
  if (style !== undefined) patch.style = String(style)
  if (status !== undefined) patch.status = String(status)

  const { data, error } = await authed.supabase
    .from('resource_projects')
    .update(patch)
    .eq('user_id', authed.user.id)
    .eq('id', req.params.id)
    .select('*')
    .maybeSingle()

  if (error) return res.status(500).json({ error: error.message })
  if (!data) return res.status(404).json({ error: 'Project not found' })
  res.json(await parseProject(authed, data))
})

router.post('/projects/:id/assets', async (req, res) => {
  const authed = req as AuthenticatedRequest
  const { data: project, error: projectError } = await authed.supabase
    .from('resource_projects')
    .select('*')
    .eq('user_id', authed.user.id)
    .eq('id', req.params.id)
    .maybeSingle()
  if (projectError) return res.status(500).json({ error: projectError.message })
  if (!project) return res.status(404).json({ error: 'Project not found' })

  const { imageId, role, sortOrder = 0 } = req.body || {}
  if (!imageId) return res.status(400).json({ error: 'Image id is required' })
  if (!role) return res.status(400).json({ error: 'Asset role is required' })

  const { data: image, error: imageError } = await authed.supabase
    .from('images')
    .select('id')
    .eq('user_id', authed.user.id)
    .eq('id', imageId)
    .maybeSingle()
  if (imageError) return res.status(500).json({ error: imageError.message })
  if (!image) return res.status(404).json({ error: 'Image not found' })

  const deleteResult = await authed.supabase
    .from('resource_project_assets')
    .delete()
    .eq('user_id', authed.user.id)
    .eq('project_id', req.params.id)
    .eq('role', String(role))
  if (deleteResult.error) return res.status(500).json({ error: deleteResult.error.message })

  const insertResult = await authed.supabase
    .from('resource_project_assets')
    .insert({
      user_id: authed.user.id,
      project_id: req.params.id,
      image_id: imageId,
      role: String(role),
      sort_order: Number(sortOrder),
    })
  if (insertResult.error) return res.status(500).json({ error: insertResult.error.message })

  const { data, error } = await authed.supabase
    .from('resource_projects')
    .update({ status: 'ready', updated_at: new Date().toISOString() })
    .eq('user_id', authed.user.id)
    .eq('id', req.params.id)
    .select('*')
    .single()
  if (error) return res.status(500).json({ error: error.message })
  res.json(await parseProject(authed, data))
})

router.delete('/projects/:id', async (req, res) => {
  const authed = req as AuthenticatedRequest
  const assetDelete = await authed.supabase
    .from('resource_project_assets')
    .delete()
    .eq('user_id', authed.user.id)
    .eq('project_id', req.params.id)
  if (assetDelete.error) return res.status(500).json({ error: assetDelete.error.message })

  const { error } = await authed.supabase
    .from('resource_projects')
    .delete()
    .eq('user_id', authed.user.id)
    .eq('id', req.params.id)

  if (error) return res.status(500).json({ error: error.message })
  res.json({ success: true })
})

export default router
