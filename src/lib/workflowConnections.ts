import type { Node } from '@xyflow/react'
import type { NodeData } from '@/store/useWorkflowStore'

const HANDLE_RULES: Record<string, Set<string>> = {
  next: new Set(['trigger']),
  prompt: new Set(['prompt']),
  image: new Set(['image', 'input']),
  param: new Set(['param']),
  video: new Set(['input']),
}

type WorkflowConnection = {
  source?: string | null
  target?: string | null
  sourceHandle?: string | null
  targetHandle?: string | null
}

export function isWorkflowConnectionValid(nodes: Node<NodeData>[], connection: WorkflowConnection) {
  if (!connection.source || !connection.target || connection.source === connection.target) return false

  const sourceNode = nodes.find((node) => node.id === connection.source)
  const targetNode = nodes.find((node) => node.id === connection.target)
  if (!sourceNode || !targetNode) return false

  const sourceHandle = connection.sourceHandle || defaultSourceHandle(sourceNode.type)
  const targetHandle = connection.targetHandle || defaultTargetHandle(targetNode.type)
  if (!sourceHandle || !targetHandle) return false

  return HANDLE_RULES[sourceHandle]?.has(targetHandle) ?? false
}

function defaultSourceHandle(type?: string) {
  if (type === 'start') return 'next'
  if (type === 'textPrompt') return 'prompt'
  if (type === 'imageInput' || type === 'imageGenerate') return 'image'
  if (type === 'parameter') return 'param'
  if (type === 'videoGenerate') return 'video'
  return ''
}

function defaultTargetHandle(type?: string) {
  if (type === 'textPrompt' || type === 'imageInput' || type === 'parameter') return 'trigger'
  if (type === 'output') return 'input'
  return ''
}
