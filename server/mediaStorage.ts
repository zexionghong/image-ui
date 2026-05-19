import fs from 'fs'
import path from 'path'
import { v4 as uuid } from 'uuid'
import {
  getS3UploadConfig,
  isS3UploadConfigured,
  uploadBufferToS3,
} from './s3Upload.js'

const uploadsDir = path.join(process.cwd(), 'public', 'uploads')
fs.mkdirSync(uploadsDir, { recursive: true })

export type PersistedMedia = {
  filename: string
  storageKey: string
  url: string
}

function extensionFromMime(mimeType: string) {
  if (mimeType === 'image/png') return '.png'
  if (mimeType === 'image/jpeg') return '.jpg'
  if (mimeType === 'image/webp') return '.webp'
  if (mimeType === 'image/gif') return '.gif'
  if (mimeType === 'video/mp4') return '.mp4'
  if (mimeType === 'video/quicktime') return '.mov'
  if (mimeType === 'audio/mpeg') return '.mp3'
  if (mimeType === 'audio/wav') return '.wav'
  return ''
}

export function getUploadExtension(originalName: string, mimeType: string) {
  return path.extname(originalName) || extensionFromMime(mimeType)
}

export async function persistBuffer(input: {
  userId: string
  buffer: Buffer
  contentType: string
  originalName?: string
  filename?: string
}) {
  const filename = input.filename || `${uuid()}${getUploadExtension(input.originalName || '', input.contentType)}`

  if (isS3UploadConfigured()) {
    const config = getS3UploadConfig()
    const storageKey = `${config.keyPrefix}/users/${input.userId}/${filename}`
    const url = await uploadBufferToS3({
      key: storageKey,
      body: input.buffer,
      contentType: input.contentType || 'application/octet-stream',
      config,
    })
    return { filename, storageKey, url }
  }

  fs.writeFileSync(path.join(uploadsDir, filename), input.buffer)
  return {
    filename,
    storageKey: `local/${filename}`,
    url: `/uploads/${filename}`,
  }
}

export async function readMediaBuffer(url: string) {
  if (url.startsWith('/uploads/')) {
    return fs.readFileSync(path.join(uploadsDir, path.basename(url)))
  }

  const response = await fetch(url)
  if (!response.ok) throw new Error(`Failed to fetch media: ${response.status}`)
  return Buffer.from(await response.arrayBuffer())
}
