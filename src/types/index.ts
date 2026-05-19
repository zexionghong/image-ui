export interface ImageData {
  id: number
  filename: string
  original_name: string
  width: number
  height: number
  size: number
  mime_type: string
  category: string
  tags: string[]
  metadata: Record<string, unknown>
  is_generated: boolean
  prompt: string | null
  parent_id: number | null
  created_at: string
  updated_at: string
  url: string
}

export interface GenerationHistory {
  id: number
  type: 'text2img' | 'img2img' | 'ai_edit' | 'video'
  prompt: string
  negative_prompt: string | null
  style: string | null
  reference_image_id: number | null
  result_image_id: number | null
  parameters: string | Record<string, unknown> | null
  status: 'pending' | 'processing' | 'done' | 'error'
  created_at: string
}

export interface ResourceProjectAsset {
  id: number
  role: 'front' | 'side' | 'back' | string
  sort_order: number
  created_at: string
  image: ImageData
}

export interface ResourceProject {
  id: number
  name: string
  description: string
  subject: string
  style: string
  status: 'draft' | 'ready' | 'generating' | string
  created_at: string
  updated_at: string
  assets: ResourceProjectAsset[]
}

export interface FilterParams {
  brightness: number
  contrast: number
  saturation: number
  blur: number
  hue: number
  sepia: number
  grayscale: number
  invert: number
}

export const DEFAULT_FILTERS: FilterParams = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  blur: 0,
  hue: 0,
  sepia: 0,
  grayscale: 0,
  invert: 0,
}

export interface ImageLayer {
  id: string
  name: string
  visible: boolean
  opacity: number
  filters: FilterParams
  imageUrl: string
}

export type GenerationType = 'text2img' | 'img2img' | 'ai_edit'

export interface PaginationParams {
  page: number
  pageSize: number
  search?: string
  category?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}
