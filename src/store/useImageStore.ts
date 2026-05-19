import { create } from 'zustand'
import type { ImageData, PaginationParams, PaginatedResponse } from '@/types'
import { apiFetch } from '@/lib/api'

const API_BASE = '/api'

interface ImageStore {
  images: ImageData[]
  selectedImage: ImageData | null
  loading: boolean
  total: number
  page: number
  pageSize: number
  search: string
  category: string

  fetchImages: (params?: Partial<PaginationParams>) => Promise<void>
  uploadImage: (file: File) => Promise<ImageData>
  deleteImage: (id: string) => Promise<void>
  updateImage: (id: string, data: Partial<ImageData>) => Promise<void>
  setSelectedImage: (image: ImageData | null) => void
  setSearch: (search: string) => void
  setCategory: (category: string) => void
}

export const useImageStore = create<ImageStore>((set, get) => ({
  images: [],
  selectedImage: null,
  loading: false,
  total: 0,
  page: 1,
  pageSize: 20,
  search: '',
  category: '',

  fetchImages: async (params) => {
    set({ loading: true })
    try {
      const { page, pageSize, search, category } = get()
      const p = { page, pageSize, search, category, ...params }
      const query = new URLSearchParams()
      query.set('page', String(p.page))
      query.set('pageSize', String(p.pageSize))
      if (p.search) query.set('search', p.search)
      if (p.category) query.set('category', p.category)

      const res = await apiFetch(`${API_BASE}/images?${query}`)
      const data: PaginatedResponse<ImageData> = await res.json()
      set({ images: data.data, total: data.total, page: data.page, pageSize: data.pageSize })
    } catch (err) {
      console.error('Failed to fetch images:', err)
    } finally {
      set({ loading: false })
    }
  },

  uploadImage: async (file) => {
    const formData = new FormData()
    formData.append('file', file)
    const res = await apiFetch(`${API_BASE}/images/upload`, { method: 'POST', body: formData })
    const image: ImageData = await res.json()
    set((s) => ({ images: [image, ...s.images], total: s.total + 1 }))
    return image
  },

  deleteImage: async (id) => {
    await apiFetch(`${API_BASE}/images/${id}`, { method: 'DELETE' })
    set((s) => ({
      images: s.images.filter((img) => img.id !== id),
      total: s.total - 1,
      selectedImage: s.selectedImage?.id === id ? null : s.selectedImage,
    }))
  },

  updateImage: async (id, data) => {
    const res = await apiFetch(`${API_BASE}/images/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    const updated: ImageData = await res.json()
    set((s) => ({
      images: s.images.map((img) => (img.id === id ? updated : img)),
      selectedImage: s.selectedImage?.id === id ? updated : s.selectedImage,
    }))
  },

  setSelectedImage: (image) => set({ selectedImage: image }),
  setSearch: (search) => set({ search }),
  setCategory: (category) => set({ category }),
}))
