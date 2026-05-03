import { create } from 'zustand'
import type { GenerationHistory } from '@/types'
import { useApiConfigStore } from './useApiConfigStore'

const API_BASE = '/api'

interface VideoGenerateStore {
  prompt: string
  mode: 't2v' | 'i2v'
  imageFile: File | null
  imagePreview: string | null
  duration: string
  resolution: string
  aspectRatio: string
  generating: boolean
  progress: number
  taskId: string | null
  result: string | null
  history: GenerationHistory[]

  setPrompt: (prompt: string) => void
  setMode: (mode: 't2v' | 'i2v') => void
  setImageFile: (file: File | null) => void
  setDuration: (d: string) => void
  setResolution: (r: string) => void
  setAspectRatio: (r: string) => void
  generate: () => Promise<void>
  fetchHistory: () => Promise<void>
  reset: () => void
}

export const useVideoGenerateStore = create<VideoGenerateStore>((set, get) => ({
  prompt: '',
  mode: 't2v',
  imageFile: null,
  imagePreview: null,
  duration: '5',
  resolution: '720p',
  aspectRatio: '16:9',
  generating: false,
  progress: 0,
  taskId: null,
  result: null,
  history: [],

  setPrompt: (prompt) => set({ prompt }),
  setMode: (mode) => set({ mode }),
  setImageFile: (file) => {
    const old = get().imagePreview
    if (old) URL.revokeObjectURL(old)
    set({
      imageFile: file,
      imagePreview: file ? URL.createObjectURL(file) : null,
    })
  },
  setDuration: (duration) => set({ duration }),
  setResolution: (resolution) => set({ resolution }),
  setAspectRatio: (aspectRatio) => set({ aspectRatio }),

  generate: async () => {
    const { prompt, mode, imageFile, duration, resolution, aspectRatio } = get()
    const { videoBaseUrl, videoApiKey, videoModel } = useApiConfigStore.getState()
    set({ generating: true, progress: 0, result: null, taskId: null })

    try {
      const formData = new FormData()
      formData.append('prompt', prompt)
      formData.append('duration', duration)
      formData.append('resolution', resolution)
      formData.append('aspectRatio', aspectRatio)
      formData.append('videoBaseUrl', videoBaseUrl)
      formData.append('videoApiKey', videoApiKey)
      formData.append('videoModel', videoModel)
      if (mode === 'i2v' && imageFile) {
        formData.append('image', imageFile)
      }

      const submitRes = await fetch(`${API_BASE}/video/generate`, {
        method: 'POST',
        body: formData,
      })
      const submitData = await submitRes.json()
      if (submitData.error) throw new Error(submitData.error)

      set({ taskId: submitData.taskId })

      // Poll for status
      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await fetch(
            `${API_BASE}/video/status/${submitData.taskId}?videoBaseUrl=${encodeURIComponent(videoBaseUrl)}&videoApiKey=${encodeURIComponent(videoApiKey)}`
          )
          const statusData = await statusRes.json()

          if (statusData.status === 'succeeded') {
            clearInterval(pollInterval)
            set({ progress: 100, result: statusData.videoUrl, generating: false })
            get().fetchHistory()
          } else if (statusData.status === 'failed') {
            clearInterval(pollInterval)
            set({ generating: false })
          } else {
            set((s) => ({ progress: Math.min(s.progress + 5, 95) }))
          }
        } catch {
          // continue polling
        }
      }, 3000)

      // Timeout after 10 minutes
      setTimeout(() => {
        clearInterval(pollInterval)
        set((s) => {
          if (s.generating) return { generating: false }
          return {}
        })
      }, 600000)
    } catch (err) {
      console.error('Video generation failed:', err)
      set({ generating: false })
    }
  },

  fetchHistory: async () => {
    try {
      const res = await fetch(`${API_BASE}/video/history`)
      const data = await res.json()
      set({ history: data })
    } catch (err) {
      console.error('Failed to fetch video history:', err)
    }
  },

  reset: () => {
    const old = get().imagePreview
    if (old) URL.revokeObjectURL(old)
    set({
      prompt: '',
      mode: 't2v',
      imageFile: null,
      imagePreview: null,
      duration: '5',
      resolution: '720p',
      aspectRatio: '16:9',
      generating: false,
      progress: 0,
      taskId: null,
      result: null,
    })
  },
}))
