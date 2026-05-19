export const RESOURCE_ROOT_LABEL = '\u8d44\u6e90\u5e93'
export const RESOURCE_THREE_VIEW_FOLDER = '\u4e09\u89c6\u56fe'
export const RESOURCE_PATH_PREFIX = `@${RESOURCE_ROOT_LABEL}`

export const THREE_VIEW_ANGLES = ['front', 'side', 'back'] as const

export type ThreeViewAngle = (typeof THREE_VIEW_ANGLES)[number]

export const THREE_VIEW_ANGLE_LABELS: Record<ThreeViewAngle, string> = {
  front: '\u6b63\u9762',
  side: '\u4fa7\u9762',
  back: '\u80cc\u9762',
}

export interface ThreeViewGenerationInput {
  subject: string
  style?: string
  notes?: string
  size: string
}

export interface ThreeViewGenerationRequest {
  angle: ThreeViewAngle
  label: string
  prompt: string
  size: string
}

export interface ParsedResourcePath {
  projectName: string
  folder: string
  assetName: string
}

function cleanPathSegment(value: string) {
  return value.trim().replace(/^\/+|\/+$/g, '').replace(/\s+/g, '-')
}

export function buildThreeViewGenerationRequests(input: ThreeViewGenerationInput): ThreeViewGenerationRequest[] {
  const subject = input.subject.trim()
  const style = input.style?.trim()
  const notes = input.notes?.trim()
  const sharedParts = [
    `\u4e3b\u4f53\uff1a${subject}`,
    style ? `\u98ce\u683c\uff1a${style}` : '',
    notes ? `\u7ec6\u8282\uff1a${notes}` : '',
    '\u4e09\u89c6\u56fe\u8bbe\u5b9a\u56fe\uff0c\u7eaf\u51c0\u80cc\u666f\uff0c\u89d2\u8272\u6bd4\u4f8b\u4e00\u81f4\uff0c\u670d\u88c5\u548c\u6750\u8d28\u4e00\u81f4\uff0c\u9002\u5408\u540e\u7eed\u89c6\u9891\u751f\u6210\u53c2\u8003\u3002',
  ].filter(Boolean)

  return THREE_VIEW_ANGLES.map((angle) => {
    const label = THREE_VIEW_ANGLE_LABELS[angle]
    return {
      angle,
      label,
      size: input.size,
      prompt: `${sharedParts.join(' ')} \u5f53\u524d\u89c6\u89d2\uff1a${label}\uff0c\u5355\u4eba\u5168\u8eab\uff0c\u6784\u56fe\u5c45\u4e2d\uff0c\u65e0\u6587\u5b57\uff0c\u65e0\u6c34\u5370\u3002`,
    }
  })
}

export function buildThreeViewVideoPrompt(subject: string) {
  const normalizedSubject = subject.trim() || '\u4e3b\u4f53'
  return `\u4f7f\u7528 @img1 @img2 @img3 \u4f5c\u4e3a\u540c\u4e00${normalizedSubject}\u7684\u6b63\u9762\u3001\u4fa7\u9762\u3001\u80cc\u9762\u53c2\u8003\uff0c\u751f\u6210\u4e00\u6bb5\u89d2\u8272\u5c55\u793a\u89c6\u9891\u3002\u4fdd\u6301\u4e3b\u4f53\u8eab\u4efd\u3001\u670d\u88c5\u3001\u6bd4\u4f8b\u548c\u6750\u8d28\u4e00\u81f4\uff0c\u955c\u5934\u56f4\u7ed5\u4e3b\u4f53\u5e73\u6ed1\u73af\u7ed5\uff0c\u9002\u5408\u89c6\u9891\u5236\u4f5c\u3002`
}

export function buildResourceAssetPath(projectName: string, angle: ThreeViewAngle) {
  return `${RESOURCE_PATH_PREFIX}/${cleanPathSegment(projectName)}/${RESOURCE_THREE_VIEW_FOLDER}/${THREE_VIEW_ANGLE_LABELS[angle]}`
}

export function extractResourcePaths(prompt: string) {
  const escapedRoot = RESOURCE_PATH_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const matches = prompt.match(new RegExp(`${escapedRoot}\\/[^\\s,，。；;！!？?]+`, 'g')) || []
  return Array.from(new Set(matches))
}

export function parseResourcePath(value: string): ParsedResourcePath | null {
  const normalized = value.trim()
  const prefix = `${RESOURCE_PATH_PREFIX}/`
  if (!normalized.startsWith(prefix)) return null

  const parts = normalized.slice(prefix.length).split('/').filter(Boolean)
  if (parts.length < 3) return null

  return {
    projectName: parts[0],
    folder: parts[1],
    assetName: parts.slice(2).join('/'),
  }
}
