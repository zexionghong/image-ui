import { create } from 'zustand'
import type { FilterParams, ImageLayer } from '@/types'
import { DEFAULT_FILTERS } from '@/types'

interface EditorStore {
  currentImage: string | null
  currentImageId: string | null
  zoom: number
  pan: { x: number; y: number }
  filters: FilterParams
  layers: ImageLayer[]
  activeLayerId: string | null
  tool: 'select' | 'crop' | 'rotate' | 'draw' | 'text'
  history: string[]
  historyIndex: number
  isSaving: boolean

  setCurrentImage: (url: string | null, id?: string) => void
  setZoom: (zoom: number) => void
  setPan: (pan: { x: number; y: number }) => void
  resetView: () => void
  setFilter: (key: keyof FilterParams, value: number) => void
  resetFilters: () => void
  setTool: (tool: EditorStore['tool']) => void
  addLayer: (layer: ImageLayer) => void
  removeLayer: (id: string) => void
  setActiveLayer: (id: string | null) => void
  updateLayer: (id: string, data: Partial<ImageLayer>) => void
  undo: () => void
  redo: () => void
  pushHistory: (state: string) => void
  setSaving: (saving: boolean) => void
}

export const useEditorStore = create<EditorStore>((set, get) => ({
  currentImage: null,
  currentImageId: null,
  zoom: 1,
  pan: { x: 0, y: 0 },
  filters: { ...DEFAULT_FILTERS },
  layers: [],
  activeLayerId: null,
  tool: 'select',
  history: [],
  historyIndex: -1,
  isSaving: false,

  setCurrentImage: (url, id) => set({ currentImage: url, currentImageId: id ?? null }),
  setZoom: (zoom) => set({ zoom: Math.max(0.1, Math.min(5, zoom)) }),
  setPan: (pan) => set({ pan }),
  resetView: () => set({ zoom: 1, pan: { x: 0, y: 0 } }),

  setFilter: (key, value) => set((s) => ({ filters: { ...s.filters, [key]: value } })),
  resetFilters: () => set({ filters: { ...DEFAULT_FILTERS } }),

  setTool: (tool) => set({ tool }),

  addLayer: (layer) => set((s) => ({ layers: [...s.layers, layer], activeLayerId: layer.id })),
  removeLayer: (id) => set((s) => ({
    layers: s.layers.filter((l) => l.id !== id),
    activeLayerId: s.activeLayerId === id ? null : s.activeLayerId,
  })),
  setActiveLayer: (id) => set({ activeLayerId: id }),
  updateLayer: (id, data) => set((s) => ({
    layers: s.layers.map((l) => (l.id === id ? { ...l, ...data } : l)),
  })),

  undo: () => {
    const { historyIndex, history } = get()
    if (historyIndex > 0) set({ historyIndex: historyIndex - 1 })
  },
  redo: () => {
    const { historyIndex, history } = get()
    if (historyIndex < history.length - 1) set({ historyIndex: historyIndex + 1 })
  },
  pushHistory: (state) => set((s) => ({
    history: [...s.history.slice(0, s.historyIndex + 1), state],
    historyIndex: s.historyIndex + 1,
  })),

  setSaving: (saving) => set({ isSaving: saving }),
}))
