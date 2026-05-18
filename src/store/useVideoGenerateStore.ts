import { create } from 'zustand'
import type { GenerationHistory } from '@/types'
import { useApiConfigStore } from './useApiConfigStore'
import { filterMediaForMode, hasVideoModeInput, type VideoMode } from '@/lib/videoModeConfig'

const API_BASE = '/api'
const POLL_INTERVAL_MS = 3000
const GENERATION_TIMEOUT_MS = 600000

let activeGenerationId = 0
let activeHistoryRequestId = 0
let activePollTimer: ReturnType<typeof setTimeout> | null = null
let activeTimeout: ReturnType<typeof setTimeout> | null = null

function clearActiveTimers() {
  if (activePollTimer) {
    clearTimeout(activePollTimer)
    activePollTimer = null
  }
  if (activeTimeout) {
    clearTimeout(activeTimeout)
    activeTimeout = null
  }
}

function startNewGeneration() {
  clearActiveTimers()
  activeGenerationId += 1
  return activeGenerationId
}

function isCurrentGeneration(generationId: number) {
  return generationId === activeGenerationId
}

function invalidateActiveGeneration() {
  activeGenerationId += 1
  activeHistoryRequestId += 1
}

interface VideoGenerateStore {
  prompt: string
  mode: VideoMode
  imageFile: File | null
  imagePreview: string | null
  endFrameFile: File | null
  endFramePreview: string | null
  referenceImages: File[]
  referenceImagePreviews: string[]
  referenceVideo: File | null
  referenceAudio: File | null
  duration: string
  resolution: string
  aspectRatio: string
  seed: string
  watermark: boolean
  generateAudio: boolean
  callbackUrl: string
  advancedJson: string
  generating: boolean
  progress: number
  startedAt: number | null
  taskId: string | null
  status: string | null
  error: string | null
  errorDetails: {
    providerCode?: string | number
    providerMessage?: string
    serverMessage?: string
  } | null
  remoteResult: boolean
  result: string | null
  history: GenerationHistory[]

  setPrompt: (prompt: string) => void
  setMode: (mode: VideoMode) => void
  setImageFile: (file: File | null) => void
  setEndFrameFile: (file: File | null) => void
  setReferenceImages: (files: File[]) => void
  setReferenceVideo: (file: File | null) => void
  setReferenceAudio: (file: File | null) => void
  insertPromptReference: (token: string) => void
  setDuration: (d: string) => void
  setResolution: (r: string) => void
  setAspectRatio: (r: string) => void
  setSeed: (seed: string) => void
  setWatermark: (enabled: boolean) => void
  setGenerateAudio: (enabled: boolean) => void
  setCallbackUrl: (url: string) => void
  setAdvancedJson: (json: string) => void
  generate: () => Promise<void>
  fetchHistory: (generationId?: number) => Promise<void>
  dispose: () => void
  reset: () => void
}

export const useVideoGenerateStore = create<VideoGenerateStore>((set, get) => ({
  prompt: '',
  mode: 't2v',
  imageFile: null,
  imagePreview: null,
  endFrameFile: null,
  endFramePreview: null,
  referenceImages: [],
  referenceImagePreviews: [],
  referenceVideo: null,
  referenceAudio: null,
  duration: '5',
  resolution: '720p',
  aspectRatio: '16:9',
  seed: '',
  watermark: false,
  generateAudio: false,
  callbackUrl: '',
  advancedJson: '',
  generating: false,
  progress: 0,
  startedAt: null,
  taskId: null,
  status: null,
  error: null,
  errorDetails: null,
  remoteResult: false,
  result: null,
  history: [],

  setPrompt: (prompt) => set({ prompt }),
  setMode: (mode) => {
    const state = get()
    const patch: Partial<VideoGenerateStore> = { mode }

    if (!hasVideoModeInput(mode, 'sourceImage')) {
      if (state.imagePreview) URL.revokeObjectURL(state.imagePreview)
      patch.imageFile = null
      patch.imagePreview = null
    }
    if (!hasVideoModeInput(mode, 'endFrame')) {
      if (state.endFramePreview) URL.revokeObjectURL(state.endFramePreview)
      patch.endFrameFile = null
      patch.endFramePreview = null
    }
    if (!hasVideoModeInput(mode, 'referenceImages')) {
      state.referenceImagePreviews.forEach((preview) => URL.revokeObjectURL(preview))
      patch.referenceImages = []
      patch.referenceImagePreviews = []
    }
    if (!hasVideoModeInput(mode, 'referenceVideo')) patch.referenceVideo = null
    if (!hasVideoModeInput(mode, 'referenceAudio')) patch.referenceAudio = null

    set(patch)
  },
  setImageFile: (file) => {
    const old = get().imagePreview
    if (old) URL.revokeObjectURL(old)
    set({
      imageFile: file,
      imagePreview: file ? URL.createObjectURL(file) : null,
    })
  },
  setEndFrameFile: (file) => {
    const old = get().endFramePreview
    if (old) URL.revokeObjectURL(old)
    set({
      endFrameFile: file,
      endFramePreview: file ? URL.createObjectURL(file) : null,
    })
  },
  setReferenceImages: (files) => {
    const oldPreviews = get().referenceImagePreviews
    oldPreviews.forEach((preview) => URL.revokeObjectURL(preview))
    set({
      referenceImages: files,
      referenceImagePreviews: files.map((file) => URL.createObjectURL(file)),
    })
  },
  setReferenceVideo: (file) => set({ referenceVideo: file }),
  setReferenceAudio: (file) => set({ referenceAudio: file }),
  insertPromptReference: (token) => set((state) => ({
    prompt: state.prompt.trim() ? `${state.prompt.trimEnd()} ${token} ` : `${token} `,
  })),
  setDuration: (duration) => set({ duration }),
  setResolution: (resolution) => set({ resolution }),
  setAspectRatio: (aspectRatio) => set({ aspectRatio }),
  setSeed: (seed) => set({ seed }),
  setWatermark: (watermark) => set({ watermark }),
  setGenerateAudio: (generateAudio) => set({ generateAudio }),
  setCallbackUrl: (callbackUrl) => set({ callbackUrl }),
  setAdvancedJson: (advancedJson) => set({ advancedJson }),

  generate: async () => {
    const generationId = startNewGeneration()

    const {
      prompt,
      mode,
      duration,
      resolution,
      aspectRatio,
      seed,
      watermark,
      generateAudio,
      callbackUrl,
      advancedJson,
    } = get()
    const media = filterMediaForMode(mode, {
      imageFile: get().imageFile,
      endFrameFile: get().endFrameFile,
      referenceImages: get().referenceImages,
      referenceVideo: get().referenceVideo,
      referenceAudio: get().referenceAudio,
    })
    const { videoBaseUrl, videoApiKey, videoModel } = useApiConfigStore.getState()
    set({
      generating: true,
      progress: 0,
      startedAt: Date.now(),
      result: null,
      taskId: null,
      status: null,
      error: null,
      errorDetails: null,
      remoteResult: false,
    })

    try {
      const formData = new FormData()
      formData.append('prompt', prompt)
      formData.append('mode', mode)
      formData.append('duration', duration)
      formData.append('resolution', resolution)
      formData.append('aspectRatio', aspectRatio)
      formData.append('seed', seed)
      formData.append('watermark', String(watermark))
      formData.append('generateAudio', String(generateAudio))
      formData.append('callbackUrl', callbackUrl)
      formData.append('advancedJson', advancedJson)
      formData.append('videoBaseUrl', videoBaseUrl)
      formData.append('videoApiKey', videoApiKey)
      formData.append('videoModel', videoModel)
      if (media.imageFile) {
        formData.append('sourceImage', media.imageFile)
      }
      if (media.endFrameFile) {
        formData.append('endFrame', media.endFrameFile)
      }
      for (const file of media.referenceImages || []) {
        formData.append('referenceImages', file)
      }
      if (media.referenceVideo) {
        formData.append('referenceVideo', media.referenceVideo)
      }
      if (media.referenceAudio) {
        formData.append('referenceAudio', media.referenceAudio)
      }

      const submitRes = await fetch(`${API_BASE}/video/generate`, {
        method: 'POST',
        body: formData,
      })
      const submitData = await submitRes.json()
      if (!isCurrentGeneration(generationId)) return
      if (!submitRes.ok) {
        throw Object.assign(new Error(submitData.error || `Video generation request failed (${submitRes.status})`), {
          providerCode: submitData.providerStatus ?? submitRes.status,
          providerMessage: submitData.providerMessage ?? submitData.error ?? '',
          serverMessage: submitData.error || `Video generation request failed (${submitRes.status})`,
        })
      }
      if (submitData.error) throw new Error(submitData.error)
      if (!submitData.taskId) throw new Error('Provider did not return a task ID')

      set({ taskId: submitData.taskId })

      const poll = async () => {
        if (!isCurrentGeneration(generationId)) return
        try {
          const statusRes = await fetch(`${API_BASE}/video/status/${submitData.taskId}`, {
            headers: {
              'x-video-base-url': videoBaseUrl,
              'x-video-api-key': videoApiKey,
            },
          })
          const statusData = await statusRes.json()
          if (!isCurrentGeneration(generationId)) return
          if (!statusRes.ok) {
            throw Object.assign(
              new Error(statusData.error || `Video generation status request failed (${statusRes.status})`),
              {
                providerCode: statusData.providerStatus ?? statusRes.status,
                providerMessage: statusData.providerMessage ?? statusData.error ?? '',
                serverMessage: statusData.error || `Video generation status request failed (${statusRes.status})`,
              }
            )
          }

          if (statusData.status === 'succeeded') {
            clearActiveTimers()
            set({
              progress: 100,
              result: statusData.videoUrl,
              generating: false,
              status: 'succeeded',
              remoteResult: Boolean(statusData.remote),
              error: null,
              errorDetails: null,
            })
            void get().fetchHistory(generationId)
          } else if (statusData.status === 'failed') {
            clearActiveTimers()
            set({
              generating: false,
              status: 'failed',
              error: statusData.error || 'Video generation failed',
              errorDetails: {
                providerCode: statusData.providerStatus ?? statusData.code ?? 'failed',
                providerMessage: statusData.providerMessage ?? statusData.error ?? 'Video generation failed',
                serverMessage: statusData.error || 'Video generation failed',
              },
            })
          } else {
            set((s) => ({
              progress: Math.min(s.progress + 5, 95),
              status: statusData.status || 'running',
            }))
            if (isCurrentGeneration(generationId)) {
              activePollTimer = setTimeout(() => {
                void poll()
              }, POLL_INTERVAL_MS)
            }
          }
        } catch (err) {
          if (!isCurrentGeneration(generationId)) return
          clearActiveTimers()
          const error = err as Error & {
            providerCode?: string | number
            providerMessage?: string
            serverMessage?: string
          }
          set({
            generating: false,
            status: 'failed',
            error: error.serverMessage || error.message || 'Video generation failed',
            errorDetails: {
              providerCode: error.providerCode,
              providerMessage: error.providerMessage || error.message || 'Video generation failed',
              serverMessage: error.serverMessage || error.message || 'Video generation failed',
            },
          })
        }
      }

      activePollTimer = setTimeout(() => {
        void poll()
      }, POLL_INTERVAL_MS)

      // Timeout after 10 minutes
      activeTimeout = setTimeout(() => {
        if (!isCurrentGeneration(generationId)) return
        clearActiveTimers()
        invalidateActiveGeneration()
        set((s) => {
          if (s.generating) {
            return {
              generating: false,
              status: 'timeout',
              error: 'Video generation timed out',
            }
          }
          return {}
        })
      }, GENERATION_TIMEOUT_MS)
    } catch (err) {
      if (!isCurrentGeneration(generationId)) return
      console.error('Video generation failed:', err)
      clearActiveTimers()
      const error = err as Error & {
        providerCode?: string | number
        providerMessage?: string
        serverMessage?: string
      }
      set({
        generating: false,
        status: 'failed',
        error: error.serverMessage || error.message || 'Video generation failed',
        errorDetails: {
          providerCode: error.providerCode,
          providerMessage: error.providerMessage || error.message || 'Video generation failed',
          serverMessage: error.serverMessage || error.message || 'Video generation failed',
        },
      })
    }
  },

  fetchHistory: async (generationId) => {
    try {
      const requestId = ++activeHistoryRequestId
      const res = await fetch(`${API_BASE}/video/history`)
      if (!res.ok) throw new Error(`Failed to load video history (${res.status})`)
      const data = await res.json()
      if (requestId !== activeHistoryRequestId) return
      if (generationId !== undefined && !isCurrentGeneration(generationId)) return
      if (!Array.isArray(data)) throw new Error('Video history response was not an array')
      set({ history: data })
    } catch (err) {
      console.error('Failed to fetch video history:', err)
    }
  },

  dispose: () => {
    get().reset()
  },

  reset: () => {
      clearActiveTimers()
      invalidateActiveGeneration()
      set({ errorDetails: null, startedAt: null })
      const old = get().imagePreview
    if (old) URL.revokeObjectURL(old)
    const oldEndFrame = get().endFramePreview
    if (oldEndFrame) URL.revokeObjectURL(oldEndFrame)
    get().referenceImagePreviews.forEach((preview) => URL.revokeObjectURL(preview))
    set({
      prompt: '',
      mode: 't2v',
      imageFile: null,
      imagePreview: null,
      endFrameFile: null,
      endFramePreview: null,
      referenceImages: [],
      referenceImagePreviews: [],
      referenceVideo: null,
      referenceAudio: null,
      duration: '5',
      resolution: '720p',
      aspectRatio: '16:9',
      seed: '',
      watermark: false,
      generateAudio: false,
      callbackUrl: '',
      advancedJson: '',
      generating: false,
      progress: 0,
      startedAt: null,
      taskId: null,
      status: null,
      error: null,
      errorDetails: null,
      remoteResult: false,
      result: null,
      history: [],
    })
  },
}))
