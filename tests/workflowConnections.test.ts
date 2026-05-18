import assert from 'node:assert/strict'
import type { Node } from '@xyflow/react'
import { isWorkflowConnectionValid } from '../src/lib/workflowConnections'
import type { NodeData } from '../src/store/useWorkflowStore'

const nodes: Node<NodeData>[] = [
  { id: 'start', type: 'start', position: { x: 0, y: 0 }, data: { label: '开始' } },
  { id: 'text', type: 'textPrompt', position: { x: 0, y: 0 }, data: { label: '文本' } },
  { id: 'image', type: 'imageGenerate', position: { x: 0, y: 0 }, data: { label: '图片' } },
  { id: 'video', type: 'videoGenerate', position: { x: 0, y: 0 }, data: { label: '视频' } },
  { id: 'output', type: 'output', position: { x: 0, y: 0 }, data: { label: '输出' } },
]

assert.equal(isWorkflowConnectionValid(nodes, { source: 'start', sourceHandle: 'next', target: 'text', targetHandle: 'trigger' }), true)
assert.equal(isWorkflowConnectionValid(nodes, { source: 'text', sourceHandle: 'prompt', target: 'image', targetHandle: 'prompt' }), true)
assert.equal(isWorkflowConnectionValid(nodes, { source: 'text', sourceHandle: 'prompt', target: 'video', targetHandle: 'prompt' }), true)
assert.equal(isWorkflowConnectionValid(nodes, { source: 'image', sourceHandle: 'image', target: 'video', targetHandle: 'image' }), true)
assert.equal(isWorkflowConnectionValid(nodes, { source: 'video', sourceHandle: 'video', target: 'output', targetHandle: 'input' }), true)

assert.equal(isWorkflowConnectionValid(nodes, { source: 'text', sourceHandle: 'prompt', target: 'video', targetHandle: 'image' }), false)
assert.equal(isWorkflowConnectionValid(nodes, { source: 'image', sourceHandle: 'image', target: 'video', targetHandle: 'prompt' }), false)
assert.equal(isWorkflowConnectionValid(nodes, { source: 'video', sourceHandle: 'video', target: 'image', targetHandle: 'image' }), false)

console.log('workflowConnections tests passed')
