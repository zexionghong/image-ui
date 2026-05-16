import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface ApiConfigStore {
  baseUrl: string
  apiKey: string
  model: string
  videoBaseUrl: string
  videoApiKey: string
  videoModel: string
  setBaseUrl: (url: string) => void
  setApiKey: (key: string) => void
  setModel: (model: string) => void
  setVideoBaseUrl: (url: string) => void
  setVideoApiKey: (key: string) => void
  setVideoModel: (model: string) => void
  isConfigured: () => boolean
  isVideoConfigured: () => boolean
}

export const useApiConfigStore = create<ApiConfigStore>()(
  persist(
    (set, get) => ({
      baseUrl: 'https://api.openai.com/v1',
      apiKey: '',
      model: 'gpt-image-2',
      videoBaseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
      videoApiKey: '',
      videoModel: 'doubao-seedance-2-0-260128',

      setBaseUrl: (baseUrl) => set({ baseUrl }),
      setApiKey: (apiKey) => set({ apiKey }),
      setModel: (model) => set({ model }),
      setVideoBaseUrl: (videoBaseUrl) => set({ videoBaseUrl }),
      setVideoApiKey: (videoApiKey) => set({ videoApiKey }),
      setVideoModel: (videoModel) => set({ videoModel }),
      isConfigured: () => !!get().apiKey,
      isVideoConfigured: () => !!get().videoApiKey,
    }),
    {
      name: 'image2-api-config',
    }
  )
)
