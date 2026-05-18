import assert from 'node:assert/strict'
import {
  collectSlotInputs,
  getExecutableNodes,
  resolveImageInput,
  resolvePromptInput,
  shouldPauseForApproval,
  type WorkflowEdge,
  type WorkflowNode,
} from '../server/workflowEngine'

const nodes: WorkflowNode[] = [
  { id: 'start', type: 'start', data: {} },
  { id: 'imagePrompt', type: 'textPrompt', data: { prompt: 'make a product photo' } },
  { id: 'imageGenerate', type: 'imageGenerate', data: {} },
  { id: 'videoPromptA', type: 'textPrompt', data: { prompt: 'slow camera push in' } },
  { id: 'videoPromptB', type: 'textPrompt', data: { prompt: 'cinematic lighting' } },
  { id: 'videoGenerate', type: 'videoGenerate', data: {} },
  { id: 'output', type: 'output', data: {} },
  { id: 'unused', type: 'textPrompt', data: { prompt: 'do not run' } },
]

const edges: WorkflowEdge[] = [
  { source: 'start', target: 'imagePrompt' },
  { source: 'imagePrompt', target: 'imageGenerate', targetHandle: 'prompt' },
  { source: 'imageGenerate', target: 'videoGenerate', targetHandle: 'image' },
  { source: 'start', target: 'videoPromptA' },
  { source: 'videoPromptA', target: 'videoPromptB' },
  { source: 'videoPromptA', target: 'videoGenerate', targetHandle: 'prompt' },
  { source: 'videoPromptB', target: 'videoGenerate', targetHandle: 'prompt' },
  { source: 'videoGenerate', target: 'output', targetHandle: 'input' },
]

assert.deepEqual(
  getExecutableNodes(nodes, edges).map((node) => node.id),
  ['start', 'imagePrompt', 'videoPromptA', 'imageGenerate', 'videoPromptB', 'videoGenerate', 'output']
)

const results = new Map<string, unknown>([
  ['videoPromptA', { type: 'text', prompt: 'slow camera push in' }],
  ['videoPromptB', { type: 'text', prompt: 'cinematic lighting' }],
  ['imageGenerate', { type: 'image', imageUrl: '/uploads/image.png' }],
])

assert.equal(
  resolvePromptInput(collectSlotInputs('videoGenerate', 'prompt', edges, results)),
  'slow camera push in\ncinematic lighting'
)
assert.equal(
  resolveImageInput(collectSlotInputs('videoGenerate', 'image', edges, results)),
  '/uploads/image.png'
)
assert.equal(shouldPauseForApproval(nodes[2], edges), true)
assert.equal(shouldPauseForApproval(nodes[5], edges), false)
assert.equal(shouldPauseForApproval(nodes[2], edges.filter((edge) => edge.target !== 'videoGenerate')), false)

assert.throws(
  () => getExecutableNodes(nodes.filter((node) => node.type !== 'start'), edges),
  /Start node/
)

console.log('workflowEngine tests passed')
