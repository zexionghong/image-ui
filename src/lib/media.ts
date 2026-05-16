type MediaLike = {
  mime_type?: string | null
  filename?: string | null
  original_name?: string | null
}

type SizeLike = {
  width: number
  height: number
  size: number
}

export type MediaKind = 'image' | 'video' | 'unknown'

const IMAGE_EXTENSIONS = new Set(['avif', 'gif', 'jpeg', 'jpg', 'png', 'webp'])
const VIDEO_EXTENSIONS = new Set(['m4v', 'mov', 'mp4', 'webm'])

function getExtension(name?: string | null) {
  const match = name?.toLowerCase().match(/\.([a-z0-9]+)$/)
  return match?.[1] ?? ''
}

export function getMediaKind(media: MediaLike): MediaKind {
  const mimeType = media.mime_type?.toLowerCase() ?? ''
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('video/')) return 'video'

  const extension = getExtension(media.filename) || getExtension(media.original_name)
  if (IMAGE_EXTENSIONS.has(extension)) return 'image'
  if (VIDEO_EXTENSIONS.has(extension)) return 'video'

  return 'unknown'
}

export function acceptsFileType(file: File, accept: string) {
  const rules = accept.split(',').map((rule) => rule.trim().toLowerCase()).filter(Boolean)
  if (rules.length === 0) return true

  const fileType = file.type.toLowerCase()
  const fileExtension = getExtension(file.name)

  return rules.some((rule) => {
    if (rule === '*/*') return true
    if (rule.endsWith('/*')) return fileType.startsWith(rule.slice(0, -1))
    if (rule.startsWith('.')) return fileExtension === rule.slice(1)
    if (fileType === rule) return true

    if (!fileType && rule === 'video/quicktime' && fileExtension === 'mov') return true
    if (!fileType && rule === 'video/mp4' && ['m4v', 'mp4'].includes(fileExtension)) return true
    if (!fileType && rule === 'video/webm' && fileExtension === 'webm') return true
    return false
  })
}

export function formatMediaDimensions(media: SizeLike) {
  const dimensions = media.width > 0 && media.height > 0 ? `${media.width}x${media.height} · ` : ''
  return `${dimensions}${(media.size / 1024).toFixed(0)}KB`
}
