import assert from 'node:assert/strict'
import { useGenerateStore } from '../src/store/useGenerateStore'

useGenerateStore.setState({
  optimizedPrompt: 'studio product shot',
  optimizedNegativePrompt: 'blurry',
  originalPrompt: 'shoe ad',
  originalNegativePrompt: '',
  intentSummary: 'product image',
  optimizationNotes: ['added studio lighting'],
  optimizerUsedFallback: false,
})

assert.equal(useGenerateStore.getState().optimizedPrompt, 'studio product shot')
assert.deepEqual(useGenerateStore.getState().optimizationNotes, ['added studio lighting'])

useGenerateStore.getState().reset()

assert.equal((useGenerateStore.getState() as any).optimizedPrompt, null)
assert.deepEqual((useGenerateStore.getState() as any).optimizationNotes, [])

console.log('generateStorePromptOptimizer tests passed')
