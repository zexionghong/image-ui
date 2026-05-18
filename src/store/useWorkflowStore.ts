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
import { isWorkflowConnectionValid } from '@/lib/workflowConnections'

export type NodeData = {
  label: string
  [key: string]: unknown
}

type NodeStatus = 'idle' | 'running' | 'done' | 'error' | 'waitingApproval'

interface WorkflowStore {
  nodes: Node<NodeData>[]
  edges: Edge[]
  selectedNodeId: string | null
  executing: boolean
  executionResults: Record<string, unknown>
  nodeStatuses: Record<string, NodeStatus>
  approvedResults: Record<string, unknown>

  onNodesChange: OnNodesChange
  onEdgesChange: OnEdgesChange
  onConnect: OnConnect
  setNodes: (nodes: Node<NodeData>[]) => void
  setEdges: (edges: Edge[]) => void
  addNode: (type: string, position: { x: number; y: number }) => void
  deleteNode: (nodeId: string) => void
  updateNodeData: (nodeId: string, data: Partial<NodeData>) => void
  setSelectedNodeId: (id: string | null) => void
  setExecuting: (v: boolean) => void
  setExecutionResults: (results: Record<string, unknown>) => void
  setNodeResult: (nodeId: string, result: unknown) => void
  approveNodeResult: (nodeId: string) => void
  clearNodeAndDownstreamResults: (nodeId: string) => void
  setNodeStatus: (nodeId: string, status: NodeStatus) => void
  setAllNodeStatus: (status: NodeStatus) => void
  clearWorkflow: () => void
}

const NODE_DEFAULTS: Record<string, { label: string; [key: string]: unknown }> = {
  start: { label: '开始' },
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
  approvedResults: {},
  nodeStatuses: {},

  onNodesChange: (changes) => {
    const removedIds = changes.filter((change) => change.type === 'remove').map((change) => change.id)
    const nodes = applyNodeChanges(changes, get().nodes) as Node<NodeData>[]
    if (removedIds.length === 0) {
      set({ nodes })
      return
    }

    const removed = new Set<string>(removedIds)
    const nodeStatuses = { ...get().nodeStatuses }
    const approvedResults = { ...get().approvedResults }
    const selectedNodeId = get().selectedNodeId
    for (const id of removed) {
      delete nodeStatuses[id]
      delete approvedResults[id]
    }
    set({
      nodes,
      edges: get().edges.filter((edge) => !removed.has(edge.source) && !removed.has(edge.target)),
      selectedNodeId: selectedNodeId !== null && removed.has(selectedNodeId) ? null : selectedNodeId,
      nodeStatuses,
      approvedResults,
    })
  },

  onEdgesChange: (changes) => {
    set({ edges: applyEdgeChanges(changes, get().edges) })
  },

  onConnect: (connection) => {
    if (!isWorkflowConnectionValid(get().nodes, connection)) return
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
    set({ nodes: [...get().nodes, newNode], selectedNodeId: id })
  },

  deleteNode: (nodeId) => {
    get().onNodesChange([{ id: nodeId, type: 'remove' }])
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

  approveNodeResult: (nodeId) => {
    const node = get().nodes.find((n) => n.id === nodeId)
    const result = node?.data.result
    if (!result) return
    set({
      approvedResults: { ...get().approvedResults, [nodeId]: result },
      nodeStatuses: { ...get().nodeStatuses, [nodeId]: 'done' },
    })
  },

  clearNodeAndDownstreamResults: (nodeId) => {
    const edges = get().edges
    const ids = new Set<string>()
    const queue = [nodeId]
    while (queue.length > 0) {
      const id = queue.shift()!
      if (ids.has(id)) continue
      ids.add(id)
      for (const edge of edges) {
        if (edge.source === id) queue.push(edge.target)
      }
    }
    const approvedResults = { ...get().approvedResults }
    const nodeStatuses = { ...get().nodeStatuses }
    for (const id of ids) {
      delete approvedResults[id]
      nodeStatuses[id] = 'idle'
    }
    set({
      approvedResults,
      nodeStatuses,
      nodes: get().nodes.map((node) => ids.has(node.id) ? { ...node, data: { ...node.data, result: undefined } } : node),
    })
  },

  setNodeStatus: (nodeId, status) => {
    set({ nodeStatuses: { ...get().nodeStatuses, [nodeId]: status } })
  },

  setAllNodeStatus: (status) => {
    const statuses: Record<string, NodeStatus> = {}
    for (const n of get().nodes) {
      statuses[n.id] = status
    }
    set({ nodeStatuses: statuses })
  },

  clearWorkflow: () => {
    set({ nodes: [], edges: [], selectedNodeId: null, executionResults: {}, approvedResults: {}, nodeStatuses: {} })
  },
}))
