import { Router } from 'express'
import { v4 as uuid } from 'uuid'
import path from 'path'
import fs from 'fs'
import db from '../db.js'

const uploadsDir = path.join(process.cwd(), 'public', 'uploads')
fs.mkdirSync(uploadsDir, { recursive: true })

const router = Router()

interface WfNode {
  id: string
  type: string
  data: Record<string, unknown>
}

interface WfEdge {
  source: string
  target: string
}

interface WfConfig {
  baseUrl: string
  apiKey: string
  model: string
  videoBaseUrl: string
  videoApiKey: string
  videoModel: string
}

// Topological sort
function topoSort(nodes: WfNode[], edges: WfEdge[]): WfNode[] {
  const adj = new Map<string, string[]>()
  const inDeg = new Map<string, number>()
  for (const n of nodes) {
    adj.set(n.id, [])
    inDeg.set(n.id, 0)
  }
  for (const e of edges) {
    adj.get(e.source)!.push(e.target)
    inDeg.set(e.target, (inDeg.get(e.target) || 0) + 1)
  }
  const queue: string[] = []
  for (const [id, deg] of inDeg) {
    if (deg === 0) queue.push(id)
  }
  const sorted: WfNode[] = []
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))
  while (queue.length > 0) {
    const id = queue.shift()!
    sorted.push(nodeMap.get(id)!)
    for (const next of adj.get(id) || []) {
      inDeg.set(next, inDeg.get(next)! - 1)
      if (inDeg.get(next) === 0) queue.push(next)
    }
  }
  return sorted
}

// Get input data from upstream nodes
function getInputs(nodeId: string, edges: WfEdge[], results: Map<string, unknown>): unknown[] {
  const inputs: unknown[] = []
  for (const e of edges) {
    if (e.target === nodeId && results.has(e.source)) {
      inputs.push(results.get(e.source))
    }
  }
  return inputs
}

// Execute a single node
async function executeNode(node: WfNode, inputs: unknown[], config: WfConfig): Promise<unknown> {
  switch (node.type) {
    case 'textPrompt':
      return { type: 'text', prompt: node.data.prompt || '' }

    case 'imageInput':
      return { type: 'image', imageUrl: node.data.imageUrl || '' }

    case 'parameter':
      return { type: 'param', name: node.data.paramName, value: node.data.paramValue }

    case 'imageGenerate': {
      // Collect prompt from text inputs
      let prompt = ''
      let imageUrl = ''
      for (const inp of inputs) {
        const input = inp as Record<string, unknown>
        if (input.type === 'text' && input.prompt) prompt = input.prompt as string
        if (input.type === 'image' && input.imageUrl) imageUrl = input.imageUrl as string
        if (input.type === 'param') {
          // Override specific params
          if (input.name === 'quality') node.data.quality = input.value
          if (input.name === 'size') node.data.size = input.value
        }
      }
      if (!prompt) throw new Error(`Node ${node.id}: no prompt input`)

      const base = (config.baseUrl || '').replace(/\/+$/, '')
      const apiKey = config.apiKey
      const model = (node.data.model as string) || config.model || 'gpt-image-2'

      if (imageUrl) {
        // img2img - download image and send as edit
        const imgResp = await fetch(imageUrl)
        const imgBuffer = Buffer.from(await imgResp.arrayBuffer())
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
      // Collect prompt and image from inputs
      let prompt = ''
      let imageUrl = ''
      for (const inp of inputs) {
        const input = inp as Record<string, unknown>
        if (input.type === 'text' && input.prompt) prompt = input.prompt as string
        if (input.type === 'image' && input.imageUrl) imageUrl = input.imageUrl as string
      }
      if (!prompt) throw new Error(`Node ${node.id}: no prompt input`)

      const base = (config.videoBaseUrl || '').replace(/\/+$/, '')
      const apiKey = config.videoApiKey
      const model = (node.data.model as string) || config.videoModel || 'doubao-seedance-2-0-260128'

      const content: any[] = [
        { type: 'text', text: prompt },
      ]

      if (imageUrl) {
        // Download image and convert to data URL
        const imgResp = await fetch(imageUrl)
        const imgBuffer = Buffer.from(await imgResp.arrayBuffer())
        content.push({
          type: 'image_url',
          image_url: { url: `data:image/png;base64,${imgBuffer.toString('base64')}` },
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
      // Just pass through input
      return inputs[0] || { type: 'none' }

    default:
      return { type: 'unknown' }
  }
}

// POST /api/workflow/execute
router.post('/execute', async (req, res) => {
  const { nodes, edges, config } = req.body || {}
  if (!nodes || !edges) return res.status(400).json({ error: 'Missing nodes or edges' })

  try {
    const sorted = topoSort(nodes, edges)
    const results = new Map<string, unknown>()
    const output: Record<string, unknown> = {}

    console.log(`[workflow] Executing ${sorted.length} nodes in order: ${sorted.map((n) => n.id).join(' -> ')}`)

    for (const node of sorted) {
      const inputs = getInputs(node.id, edges, results)
      console.log(`[workflow] Executing node ${node.id} (${node.type}) with ${inputs.length} inputs`)
      const result = await executeNode(node, inputs, config)
      results.set(node.id, result)
      output[node.id] = result
    }

    console.log(`[workflow] Execution complete`)
    res.json({ results: output })
  } catch (err: any) {
    console.error('[workflow] Execution failed:', err.message)
    res.status(500).json({ error: err.message })
  }
})

export default router
