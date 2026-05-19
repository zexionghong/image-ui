export type ImageRow = {
  id: string
  user_id?: string
  filename: string
  original_name: string
  width: number
  height: number
  size: number
  mime_type: string
  category: string
  tags: unknown
  metadata: unknown
  is_generated: boolean | number
  prompt: string | null
  parent_id: string | null
  url: string
  storage_key: string | null
  created_at: string
  updated_at: string
}

function parseJsonish(value: unknown, fallback: unknown) {
  if (typeof value !== 'string') return value ?? fallback
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

export function serializeImageRow(row: ImageRow) {
  return {
    id: row.id,
    filename: row.filename,
    original_name: row.original_name,
    width: row.width || 0,
    height: row.height || 0,
    size: row.size || 0,
    mime_type: row.mime_type || '',
    category: row.category || 'uncategorized',
    tags: parseJsonish(row.tags, []),
    metadata: parseJsonish(row.metadata, {}),
    is_generated: Boolean(row.is_generated),
    prompt: row.prompt ?? null,
    parent_id: row.parent_id ?? null,
    storage_key: row.storage_key ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    url: row.url,
  }
}
