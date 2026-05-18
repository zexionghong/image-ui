export interface WorkflowNode {
  id: string
  type: string
  data: Record<string, unknown>
}

export interface WorkflowEdge {
  source: string
  target: string
  sourceHandle?: string | null
  targetHandle?: string | null
}

export function getExecutableNodes(nodes: WorkflowNode[], edges: WorkflowEdge[]) {
  const startNodes = nodes.filter((node) => node.type === 'start')
  if (startNodes.length === 0) {
    throw new Error('Workflow needs a Start node')
  }

  const nodeMap = new Map(nodes.map((node) => [node.id, node]))
  const reachable = new Set<string>()
  const queue = startNodes.map((node) => node.id)

  while (queue.length > 0) {
    const id = queue.shift()!
    if (reachable.has(id)) continue
    reachable.add(id)
    for (const edge of edges) {
      if (edge.source === id && nodeMap.has(edge.target)) {
        queue.push(edge.target)
      }
    }
  }

  const executableNodes = nodes.filter((node) => reachable.has(node.id))
  const executableEdges = edges.filter((edge) => reachable.has(edge.source) && reachable.has(edge.target))

  return topoSort(executableNodes, executableEdges)
}

export function collectSlotInputs(nodeId: string, slot: string, edges: WorkflowEdge[], results: Map<string, unknown>) {
  return edges
    .filter((edge) => edge.target === nodeId && edge.targetHandle === slot && results.has(edge.source))
    .map((edge) => results.get(edge.source))
}

export function collectLegacyInputs(nodeId: string, edges: WorkflowEdge[], results: Map<string, unknown>) {
  return edges
    .filter((edge) => edge.target === nodeId && !edge.targetHandle && results.has(edge.source))
    .map((edge) => results.get(edge.source))
}

export function resolvePromptInput(inputs: unknown[]) {
  return inputs
    .map((input) => input as Record<string, unknown>)
    .filter((input) => input.type === 'text' && input.prompt)
    .map((input) => String(input.prompt).trim())
    .filter(Boolean)
    .join('\n')
}

export function resolveImageInput(inputs: unknown[]) {
  const image = inputs
    .map((input) => input as Record<string, unknown>)
    .find((input) => input.type === 'image' && input.imageUrl)
  return image?.imageUrl ? String(image.imageUrl) : ''
}

export function resolveParamInputs(inputs: unknown[]) {
  const params: Record<string, unknown> = {}
  for (const input of inputs) {
    const value = input as Record<string, unknown>
    if (value.type === 'param' && value.name) {
      params[String(value.name)] = value.value
    }
  }
  return params
}

export function shouldPauseForApproval(node: WorkflowNode, edges: WorkflowEdge[]) {
  if (node.type !== 'imageGenerate') return false
  return edges.some((edge) => edge.source === node.id && edge.targetHandle === 'image')
}

function topoSort(nodes: WorkflowNode[], edges: WorkflowEdge[]) {
  const adj = new Map<string, string[]>()
  const inDeg = new Map<string, number>()
  for (const node of nodes) {
    adj.set(node.id, [])
    inDeg.set(node.id, 0)
  }
  for (const edge of edges) {
    if (!adj.has(edge.source) || !inDeg.has(edge.target)) continue
    adj.get(edge.source)!.push(edge.target)
    inDeg.set(edge.target, (inDeg.get(edge.target) || 0) + 1)
  }

  const queue: string[] = []
  for (const [id, degree] of inDeg) {
    if (degree === 0) queue.push(id)
  }

  const sorted: WorkflowNode[] = []
  const nodeMap = new Map(nodes.map((node) => [node.id, node]))
  while (queue.length > 0) {
    const id = queue.shift()!
    const node = nodeMap.get(id)
    if (node) sorted.push(node)
    for (const next of adj.get(id) || []) {
      inDeg.set(next, inDeg.get(next)! - 1)
      if (inDeg.get(next) === 0) queue.push(next)
    }
  }

  if (sorted.length !== nodes.length) {
    throw new Error('Workflow contains a cycle')
  }

  return sorted
}
