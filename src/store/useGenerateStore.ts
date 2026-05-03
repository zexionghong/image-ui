import { create } from 'zustand'
import type { GenerationHistory } from '@/types'
import { useApiConfigStore } from './useApiConfigStore'

const API_BASE = '/api'

interface GenerateStore {
  prompt: string
  negativePrompt: string
  size: string
  quality: string
  background: string
  outputFormat: string
  outputCompression: number
  n: number
  referenceImages: File[]
  referencePreviews: string[]
  maskDataUrl: string | null
  inputFidelity: 'low' | 'high'
  generating: boolean
  progress: number
  result: string | null
  history: GenerationHistory[]

  setPrompt: (prompt: string) => void
  setNegativePrompt: (prompt: string) => void
  setSize: (size: string) => void
  setQuality: (quality: string) => void
  setBackground: (bg: string) => void
  setOutputFormat: (fmt: string) => void
  setOutputCompression: (v: number) => void
  setN: (n: number) => void
  addReferenceImages: (files: File[]) => void
  removeReferenceImage: (index: number) => void
  setMaskDataUrl: (url: string | null) => void
  setInputFidelity: (v: 'low' | 'high') => void
  generate: (type: 'text2img' | 'img2img') => Promise<void>
  fetchHistory: () => Promise<void>
  reset: () => void
}

export const useGenerateStore = create<GenerateStore>((set, get) => ({
  prompt: '',
  negativePrompt: '',
  size: '1024x1024',
  quality: 'auto',
  background: 'auto',
  outputFormat: 'png',
  outputCompression: 100,
  n: 1,
  referenceImages: [],
  referencePreviews: [],
  maskDataUrl: null,
  inputFidelity: 'low',
  generating: false,
  progress: 0,
  result: null,
  history: [],

  setPrompt: (prompt) => set({ prompt }),
  setNegativePrompt: (negativePrompt) => set({ negativePrompt }),
  setSize: (size) => set({ size }),
  setQuality: (quality) => set({ quality }),
  setBackground: (background) => set({ background }),
  setOutputFormat: (outputFormat) => set({ outputFormat }),
  setOutputCompression: (outputCompression) => set({ outputCompression }),
  setN: (n) => set({ n }),

  addReferenceImages: (files) => {
    set((s) => ({
      referenceImages: [...s.referenceImages, ...files],
      referencePreviews: [...s.referencePreviews, ...files.map((f) => URL.createObjectURL(f))],
    }))
  },

  removeReferenceImage: (index) => {
    const { referenceImages, referencePreviews } = get()
    URL.revokeObjectURL(referencePreviews[index])
    set({
      referenceImages: referenceImages.filter((_, i) => i !== index),
      referencePreviews: referencePreviews.filter((_, i) => i !== index),
    })
  },

  setMaskDataUrl: (url) => set({ maskDataUrl: url }),
  setInputFidelity: (v) => set({ inputFidelity: v }),

  generate: async (type) => {
    const { prompt, negativePrompt, size, quality, background, outputFormat, outputCompression, n, referenceImages, maskDataUrl, inputFidelity } = get()
    const { baseUrl, apiKey, model } = useApiConfigStore.getState()
    set({ generating: true, progress: 0, result: null })

    try {
      const formData = new FormData()
      formData.append('prompt', prompt)
      if (negativePrompt) formData.append('negativePrompt', negativePrompt)
      formData.append('size', size)
      formData.append('quality', quality)
      formData.append('background', background)
      formData.append('outputFormat', outputFormat)
      formData.append('outputCompression', String(outputCompression))
      formData.append('n', String(n))
      formData.append('baseUrl', baseUrl)
      formData.append('apiKey', apiKey)
      formData.append('model', model)
      if (type === 'img2img' && referenceImages.length > 0) {
        for (const img of referenceImages) {
          formData.append('reference', img)
        }
      }
      if (maskDataUrl) {
        const maskRes = await fetch(maskDataUrl)
        const maskBlob = await maskRes.blob()
        formData.append('mask', maskBlob, 'mask.png')
      }
      if (inputFidelity === 'high') {
        formData.append('inputFidelity', 'high')
      }

      // Simulate progress
      const progressInterval = setInterval(() => {
        set((s) => ({ progress: Math.min(s.progress + Math.random() * 15, 90) }))
      }, 500)

      const res = await fetch(`${API_BASE}/generate/${type}`, {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()

      clearInterval(progressInterval)
      set({ progress: 100, result: data.url })
      get().fetchHistory()
    } catch (err) {
      console.error('Generation failed:', err)
    } finally {
      set({ generating: false })
    }
  },

  fetchHistory: async () => {
    try {
      const res = await fetch(`${API_BASE}/generate/history`)
      const data = await res.json()
      set({ history: data })
    } catch (err) {
      console.error('Failed to fetch history:', err)
    }
  },

  reset: () => {
    const old = get().referencePreviews
    old.forEach((url) => URL.revokeObjectURL(url))
    set({
      prompt: '',
      negativePrompt: '',
      size: '1024x1024',
      quality: 'auto',
      background: 'auto',
      outputFormat: 'png',
      outputCompression: 100,
      n: 1,
      referenceImages: [],
      referencePreviews: [],
      maskDataUrl: null,
      inputFidelity: 'low',
      generating: false,
      progress: 0,
      result: null,
    })
  },
}))
