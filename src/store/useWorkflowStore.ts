import { create } from 'zustand'
import {
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
} from '@xyflow/react'

export type NodeData = {
  label: string
  [key: string]: unknown
}

interface WorkflowStore {
  nodes: Node<NodeData>[]
  edges: Edge[]
  selectedNodeId: string | null
  executing: boolean
  executionResults: Record<string, unknown>
  nodeStatuses: Record<string, 'idle' | 'running' | 'done' | 'error'>

  onNodesChange: OnNodesChange
  onEdgesChange: OnEdgesChange
  onConnect: OnConnect
  setNodes: (nodes: Node<NodeData>[]) => void
  setEdges: (edges: Edge[]) => void
  addNode: (type: string, position: { x: number; y: number }) => void
  updateNodeData: (nodeId: string, data: Partial<NodeData>) => void
  setSelectedNodeId: (id: string | null) => void
  setExecuting: (v: boolean) => void
  setExecutionResults: (results: Record<string, unknown>) => void
  setNodeResult: (nodeId: string, result: unknown) => void
  setNodeStatus: (nodeId: string, status: 'idle' | 'running' | 'done' | 'error') => void
  setAllNodeStatus: (status: 'idle' | 'running' | 'done' | 'error') => void
  clearWorkflow: () => void
}

const NODE_DEFAULTS: Record<string, { label: string; [key: string]: unknown }> = {
  textPrompt: { label: '文本提示词', prompt: '' },
  imageInput: { label: '图片输入', imageUrl: '' },
  imageGenerate: { label: '图片生成', model: 'gpt-image-2', size: '1024x1024', quality: 'auto' },
  videoGenerate: { label: '视频生成', model: 'doubao-seedance-2-0-260128', duration: '5', resolution: '720p', aspectRatio: '16:9' },
  parameter: { label: '参数配置', paramName: 'quality', paramValue: 'high' },
  output: { label: '输出预览', resultUrl: '' },
}

let nodeIdCounter = 0

export const useWorkflowStore = create<WorkflowStore>((set, get) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,
  executing: false,
  executionResults: {},
  nodeStatuses: {},

  onNodesChange: (changes) => {
    set({ nodes: applyNodeChanges(changes, get().nodes) as Node<NodeData>[] })
  },

  onEdgesChange: (changes) => {
    set({ edges: applyEdgeChanges(changes, get().edges) })
  },

  onConnect: (connection) => {
    set({ edges: addEdge(connection, get().edges) })
  },

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),

  addNode: (type, position) => {
    const defaults = NODE_DEFAULTS[type] || { label: type }
    const id = `node_${++nodeIdCounter}`
    const newNode: Node<NodeData> = {
      id,
      type,
      position,
      data: { ...defaults },
    }
    set({ nodes: [...get().nodes, newNode] })
  },

  updateNodeData: (nodeId, data) => {
    set({
      nodes: get().nodes.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n
      ),
    })
  },

  setSelectedNodeId: (id) => set({ selectedNodeId: id }),
  setExecuting: (v) => set({ executing: v }),
  setExecutionResults: (results) => set({ executionResults: results }),

  setNodeResult: (nodeId, result) => {
    set({
      nodes: get().nodes.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, result } } : n
      ),
    })
  },

  setNodeStatus: (nodeId, status) => {
    set({ nodeStatuses: { ...get().nodeStatuses, [nodeId]: status } })
  },

  setAllNodeStatus: (status) => {
    const statuses: Record<string, 'idle' | 'running' | 'done' | 'error'> = {}
    for (const n of get().nodes) {
      statuses[n.id] = status
    }
    set({ nodeStatuses: statuses })
  },

  clearWorkflow: () => {
    set({ nodes: [], edges: [], selectedNodeId: null, executionResults: {}, nodeStatuses: {} })
  },
}))
