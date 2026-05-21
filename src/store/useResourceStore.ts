import { create } from 'zustand'
import type { ImageData, ResourceProject } from '@/types'
import { useApiConfigStore } from './useApiConfigStore'
import { apiFetch } from '@/lib/api'
import {
  buildThreeViewGenerationRequests,
  type ThreeViewAngle,
  type ThreeViewGenerationInput,
} from '@/lib/resourceLibrary'

const API_BASE = '/api'

interface CreateProjectInput {
  name: string
  description?: string
  subject?: string
  style?: string
}

interface ResourceStore {
  projects: ResourceProject[]
  selectedProjectId: string | null
  loading: boolean
  generatingProjectId: string | null
  generationProgress: number

  fetchProjects: () => Promise<void>
  createProject: (input: CreateProjectInput) => Promise<ResourceProject>
  selectProject: (id: string | null) => void
  addProjectAsset: (projectId: string, imageId: string, role: ThreeViewAngle, sortOrder: number) => Promise<ResourceProject>
  generateThreeViews: (projectId: string, input: ThreeViewGenerationInput) => Promise<ResourceProject>
}

function upsertProject(projects: ResourceProject[], project: ResourceProject) {
  const exists = projects.some((item) => item.id === project.id)
  if (!exists) return [project, ...projects]
  return projects.map((item) => (item.id === project.id ? project : item))
}

export const useResourceStore = create<ResourceStore>((set, get) => ({
  projects: [],
  selectedProjectId: null,
  loading: false,
  generatingProjectId: null,
  generationProgress: 0,

  fetchProjects: async () => {
    set({ loading: true })
    try {
      const res = await apiFetch(`${API_BASE}/resources/projects`)
      if (!res.ok) throw new Error(`Failed to load resource projects (${res.status})`)
      const projects: ResourceProject[] = await res.json()
      set((state) => ({
        projects,
        selectedProjectId: state.selectedProjectId ?? projects[0]?.id ?? null,
      }))
    } finally {
      set({ loading: false })
    }
  },

  createProject: async (input) => {
    const res = await apiFetch(`${API_BASE}/resources/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || `Failed to create project (${res.status})`)
    }
    const project: ResourceProject = await res.json()
    set((state) => ({
      projects: upsertProject(state.projects, project),
      selectedProjectId: project.id,
    }))
    return project
  },

  selectProject: (selectedProjectId) => set({ selectedProjectId }),

  addProjectAsset: async (projectId, imageId, role, sortOrder) => {
    const res = await apiFetch(`${API_BASE}/resources/projects/${projectId}/assets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageId, role, sortOrder }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || `Failed to attach resource asset (${res.status})`)
    }
    const project: ResourceProject = await res.json()
    set((state) => ({ projects: upsertProject(state.projects, project) }))
    return project
  },

  generateThreeViews: async (projectId, input) => {
    const requests = buildThreeViewGenerationRequests(input)
    const { baseUrl, apiKey, model } = useApiConfigStore.getState()
    let latestProject = get().projects.find((item) => item.id === projectId)
    let frontImageUrl = ''

    set({ generatingProjectId: projectId, generationProgress: 0 })
    try {
      for (let index = 0; index < requests.length; index += 1) {
        const request = requests[index]
        const formData = new FormData()
        const prompt = request.angle === 'front'
          ? request.prompt
          : `${request.prompt} 请严格参考输入图片中的同一主体身份、服装、比例、材质和配色，只改变当前视角，不改变角色设计。`
        formData.append('prompt', prompt)
        formData.append('size', request.size)
        formData.append('quality', 'auto')
        formData.append('background', 'auto')
        formData.append('outputFormat', 'png')
        formData.append('outputCompression', '100')
        formData.append('n', '1')
        formData.append('baseUrl', baseUrl)
        formData.append('apiKey', apiKey)
        formData.append('model', model)

        const useReference = request.angle === 'front'
          ? Boolean(input.sourceImageFile || input.sourceImageUrl?.trim())
          : Boolean(frontImageUrl)

        if (request.angle === 'front') {
          if (input.sourceImageFile) {
            formData.append('reference', input.sourceImageFile)
          }
          if (input.sourceImageUrl?.trim()) {
            formData.append('referenceUrl', input.sourceImageUrl.trim())
          }
        } else if (frontImageUrl) {
          formData.append('referenceUrl', frontImageUrl)
          formData.append('inputFidelity', 'high')
        }

        const generateRes = await apiFetch(`${API_BASE}/generate/${useReference ? 'img2img' : 'text2img'}`, {
          method: 'POST',
          body: formData,
        })
        const image: ImageData & { error?: string } = await generateRes.json()
        if (!generateRes.ok) throw new Error(image.error || `Failed to generate ${request.label}`)

        if (request.angle === 'front') {
          frontImageUrl = image.url
        }
        latestProject = await get().addProjectAsset(projectId, image.id, request.angle, index)
        set({ generationProgress: Math.round(((index + 1) / requests.length) * 100) })
      }

      if (!latestProject) throw new Error('Resource project not found')
      return latestProject
    } finally {
      set({ generatingProjectId: null, generationProgress: 0 })
    }
  },
}))
