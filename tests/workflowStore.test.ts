import assert from 'node:assert/strict'
import { useWorkflowStore } from '../src/store/useWorkflowStore'

useWorkflowStore.getState().clearWorkflow()
useWorkflowStore.getState().addNode('textPrompt', { x: 120, y: 80 })

const state = useWorkflowStore.getState()
const node = state.nodes[0]

assert.equal(state.nodes.length, 1)
assert.equal(state.selectedNodeId, node.id)

useWorkflowStore.getState().updateNodeData(node.id, { prompt: 'hello workflow' })
assert.equal(useWorkflowStore.getState().nodes[0].data.prompt, 'hello workflow')

useWorkflowStore.getState().setNodeStatus(node.id, 'waitingApproval')
useWorkflowStore.getState().approveNodeResult(node.id)
useWorkflowStore.getState().onNodesChange([{ id: node.id, type: 'remove' }])

assert.equal(useWorkflowStore.getState().nodes.some((n) => n.id === node.id), false)
assert.equal(useWorkflowStore.getState().selectedNodeId, null)
assert.equal(useWorkflowStore.getState().nodeStatuses[node.id], undefined)
assert.equal(useWorkflowStore.getState().approvedResults[node.id], undefined)

console.log('workflowStore tests passed')
