import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface ApiConfigStore {
  baseUrl: string
  apiKey: string
  model: string
  setBaseUrl: (url: string) => void
  setApiKey: (key: string) => void
  setModel: (model: string) => void
  isConfigured: () => boolean
}

export const useApiConfigStore = create<ApiConfigStore>()(
  persist(
    (set, get) => ({
      baseUrl: 'https://api.openai.com/v1',
      apiKey: '',
      model: 'gpt-image-2',

      setBaseUrl: (baseUrl) => set({ baseUrl }),
      setApiKey: (apiKey) => set({ apiKey }),
      setModel: (model) => set({ model }),
      isConfigured: () => !!get().apiKey,
    }),
    {
      name: 'image2-api-config',
    }
  )
)
