import { Router } from 'express'
import { v4 as uuid } from 'uuid'
import path from 'path'
import fs from 'fs'
import {
  collectLegacyInputs,
  collectSlotInputs,
  getExecutableNodes,
  resolveImageInput,
  resolveParamInputs,
  resolvePromptInput,
  shouldPauseForApproval,
  type WorkflowEdge,
  type WorkflowNode,
} from '../workflowEngine.js'
import { getS3UploadConfig, isS3UploadConfigured, uploadBufferToS3 } from '../s3Upload.js'

const uploadsDir = path.join(process.cwd(), 'public', 'uploads')
fs.mkdirSync(uploadsDir, { recursive: true })

const router = Router()

interface WfConfig {
  baseUrl: string
  apiKey: string
  model: string
  videoBaseUrl: string
  videoApiKey: string
  videoModel: string
  publicBaseUrl?: string
}

// Execute a single node
async function executeNode(node: WorkflowNode, edges: WorkflowEdge[], results: Map<string, unknown>, config: WfConfig): Promise<unknown> {
  switch (node.type) {
    case 'start':
      return { type: 'start' }

    case 'textPrompt':
      return { type: 'text', prompt: node.data.prompt || '' }

    case 'imageInput':
      return { type: 'image', imageUrl: node.data.imageUrl || '' }

    case 'parameter':
      return { type: 'param', name: node.data.paramName, value: node.data.paramValue }

    case 'imageGenerate': {
      const legacyInputs = collectLegacyInputs(node.id, edges, results)
      const promptInputs = collectSlotInputs(node.id, 'prompt', edges, results)
      const imageInputs = collectSlotInputs(node.id, 'image', edges, results)
      const prompt = resolvePromptInput([...promptInputs, ...legacyInputs])
      const imageUrl = resolveImageInput([...imageInputs, ...legacyInputs])
      const params = resolveParamInputs([...collectSlotInputs(node.id, 'param', edges, results), ...legacyInputs])
      if (params.quality) node.data.quality = params.quality
      if (params.size) node.data.size = params.size
      if (!prompt && hasTextInput(imageInputs)) {
        throw new Error(`Node ${node.id}: text prompt is connected to image input; reconnect it to the prompt input`)
      }
      if (!prompt) throw new Error(`Node ${node.id}: no prompt input`)

      const base = (config.baseUrl || '').replace(/\/+$/, '')
      const apiKey = config.apiKey
      const model = (node.data.model as string) || config.model || 'gpt-image-2'

      if (imageUrl) {
        // img2img - download image and send as edit
        const imgBuffer = await readImageBuffer(imageUrl)
        const form = new FormData()
        form.append('model', model)
        form.append('prompt', prompt)
        form.append('size', (node.data.size as string) || '1024x1024')
        form.append('quality', (node.data.quality as string) || 'auto')
        form.append('n', '1')
        const blob = new Blob([imgBuffer], { type: 'image/png' })
        form.append('image', blob, 'input.png')
        const res = await fetch(`${base}/images/edits`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}` },
          body: form,
        })
        if (!res.ok) throw new Error(`Image API error: ${res.status} ${await res.text()}`)
        const data = await res.json()
        const b64 = data.data?.[0]?.b64_json
        const url = data.data?.[0]?.url
        let buffer: Buffer
        if (b64) {
          buffer = Buffer.from(b64, 'base64')
        } else if (url) {
          const r = await fetch(url)
          buffer = Buffer.from(await r.arrayBuffer())
        } else {
          throw new Error('No image in response')
        }
        const filename = `${uuid()}.png`
        fs.writeFileSync(path.join(uploadsDir, filename), buffer)
        return { type: 'image', imageUrl: `/uploads/${filename}` }
      } else {
        // text2img
        const res = await fetch(`${base}/images/generations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model,
            prompt,
            size: (node.data.size as string) || '1024x1024',
            quality: (node.data.quality as string) || 'auto',
            n: 1,
            background: 'auto',
            output_format: 'png',
          }),
        })
        if (!res.ok) throw new Error(`Image API error: ${res.status} ${await res.text()}`)
        const data = await res.json()
        const b64 = data.data?.[0]?.b64_json
        const url = data.data?.[0]?.url
        let buffer: Buffer
        if (b64) {
          buffer = Buffer.from(b64, 'base64')
        } else if (url) {
          const r = await fetch(url)
          buffer = Buffer.from(await r.arrayBuffer())
        } else {
          throw new Error('No image in response')
        }
        const filename = `${uuid()}.png`
        fs.writeFileSync(path.join(uploadsDir, filename), buffer)
        return { type: 'image', imageUrl: `/uploads/${filename}` }
      }
    }

    case 'videoGenerate': {
      const legacyInputs = collectLegacyInputs(node.id, edges, results)
      const promptInputs = collectSlotInputs(node.id, 'prompt', edges, results)
      const imageInputs = collectSlotInputs(node.id, 'image', edges, results)
      const prompt = resolvePromptInput([...promptInputs, ...legacyInputs])
      const imageUrl = resolveImageInput([...imageInputs, ...legacyInputs])
      if (!prompt && hasTextInput(imageInputs)) {
        throw new Error(`Node ${node.id}: text prompt is connected to image input; reconnect it to the prompt input`)
      }
      if (!prompt) throw new Error(`Node ${node.id}: no prompt input`)

      const base = (config.videoBaseUrl || '').replace(/\/+$/, '')
      const apiKey = config.videoApiKey
      const model = (node.data.model as string) || config.videoModel || 'doubao-seedance-2-0-260128'

      const content: any[] = [
        { type: 'text', text: prompt },
      ]

      if (imageUrl) {
        content.push({
          type: 'image_url',
          image_url: { url: await toProviderMediaUrl(imageUrl, config.publicBaseUrl) },
          role: 'first_frame',
        })
      }

      // Submit task
      const submitRes = await fetch(`${base}/contents/generations/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          content,
          resolution: node.data.resolution || '720p',
          ratio: node.data.aspectRatio || '16:9',
          duration: Number(node.data.duration) || 5,
        }),
      })
      if (!submitRes.ok) throw new Error(`Video API error: ${submitRes.status} ${await submitRes.text()}`)
      const submitData = await submitRes.json()
      const taskId = submitData.id

      // Poll until complete (max 10 minutes)
      for (let i = 0; i < 200; i++) {
        await new Promise((r) => setTimeout(r, 3000))
        const statusRes = await fetch(`${base}/contents/generations/tasks/${taskId}`, {
          headers: { Authorization: `Bearer ${apiKey}` },
        })
        const statusData = await statusRes.json()
        console.log('[video] Task status:', 111111)
        console.log('[video] Task data:', statusData)
        if (statusData.status === 'succeeded') {
          const videoUrl = statusData.content?.video_url
          const vidResp = await fetch(videoUrl)
          const vidBuffer = Buffer.from(await vidResp.arrayBuffer())
          const filename = `${uuid()}.mp4`
          fs.writeFileSync(path.join(uploadsDir, filename), vidBuffer)
          return { type: 'video', videoUrl: `/uploads/${filename}` }
        }
        if (statusData.status === 'failed') {
          throw new Error(`Video generation failed: ${statusData.error || 'unknown error'}`)
        }
      }
      throw new Error('Video generation timed out')
    }

    case 'output':
      return collectSlotInputs(node.id, 'input', edges, results)[0] || collectLegacyInputs(node.id, edges, results)[0] || { type: 'none' }

    default:
      return { type: 'unknown' }
  }
}

function hasTextInput(inputs: unknown[]) {
  return inputs.some((input) => {
    const value = input as Record<string, unknown>
    return value.type === 'text' && value.prompt
  })
}

async function readImageBuffer(imageUrl: string) {
  if (imageUrl.startsWith('/uploads/')) {
    const filename = path.basename(imageUrl)
    return fs.readFileSync(path.join(uploadsDir, filename))
  }

  const imgResp = await fetch(imageUrl)
  if (!imgResp.ok) throw new Error(`Failed to fetch image input: ${imgResp.status}`)
  return Buffer.from(await imgResp.arrayBuffer())
}

async function toProviderMediaUrl(mediaUrl: string, publicBaseUrl?: string) {
  if (mediaUrl.startsWith('/uploads/')) {
    if (isS3UploadConfigured()) {
      const filename = path.basename(mediaUrl)
      const filePath = path.join(uploadsDir, filename)
      const buffer = fs.readFileSync(filePath)
      const s3Config = getS3UploadConfig()
      return uploadBufferToS3({
        key: `${s3Config.keyPrefix}/${filename}`,
        body: buffer,
        contentType: getContentType(filename),
        config: s3Config,
      })
    }
    if (!publicBaseUrl) throw new Error('Public upload base URL is required for workflow video inputs')
    return new URL(mediaUrl, publicBaseUrl).toString()
  }

  const parsed = new URL(mediaUrl)
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Video input media must be an HTTP-accessible URL')
  }
  return parsed.toString()
}

function getContentType(filename: string) {
  const ext = path.extname(filename).toLowerCase()
  if (ext === '.png') return 'image/png'
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
  if (ext === '.webp') return 'image/webp'
  if (ext === '.mp4') return 'video/mp4'
  if (ext === '.mov') return 'video/quicktime'
  return 'application/octet-stream'
}

function getRequestBaseUrl(req: { protocol: string; get(name: string): string | undefined; header(name: string): string | undefined }) {
  const configured = process.env.PUBLIC_UPLOAD_BASE_URL || process.env.PUBLIC_BASE_URL
  if (configured) return new URL(configured).toString()

  const forwardedProto = String(req.header('x-forwarded-proto') || '').split(',')[0]?.trim()
  const proto = forwardedProto || req.protocol
  return new URL(`${proto}://${req.get('host')}`).toString()
}

// POST /api/workflow/execute
router.post('/execute', async (req, res) => {
  const { nodes, edges, config, approvedResults } = req.body || {}
  if (!nodes || !edges) return res.status(400).json({ error: 'Missing nodes or edges' })

  try {
    const sorted = getExecutableNodes(nodes, edges)
    const workflowConfig = {
      ...config,
      publicBaseUrl: getRequestBaseUrl(req),
    }
    const approved = (approvedResults || {}) as Record<string, unknown>
    const results = new Map<string, unknown>(Object.entries(approved))
    const output: Record<string, unknown> = {}
    for (const [nodeId, result] of results) {
      output[nodeId] = result
    }

    console.log(`[workflow] Executing ${sorted.length} nodes in order: ${sorted.map((n) => n.id).join(' -> ')}`)

    for (const node of sorted) {
      if (results.has(node.id)) continue
      console.log(`[workflow] Executing node ${node.id} (${node.type})`)
      const result = await executeNode(node, edges, results, workflowConfig)
      results.set(node.id, result)
      output[node.id] = result
      if (shouldPauseForApproval(node, edges)) {
        console.log(`[workflow] Paused for approval at ${node.id}`)
        return res.json({ status: 'paused', pausedNodeId: node.id, result, results: output })
      }
    }

    console.log(`[workflow] Execution complete`)
    res.json({ status: 'done', results: output })
  } catch (err: any) {
    console.error('[workflow] Execution failed:', err.message)
    res.status(500).json({ error: err.message })
  }
})

export default router
