import assert from 'node:assert/strict'
import { applyVideoPromptOptimizationResult } from '../server/routes/video'

const result = applyVideoPromptOptimizationResult({
  originalPrompt: 'use @img1 and @资源库/角色A/三视图/正面, slow orbit shot',
  originalNegativePrompt: '',
  optimizedPrompt: 'Use @img1 and @资源库/角色A/三视图/正面 as the visual anchors, with a slow orbit shot and cinematic easing.',
  optimizedNegativePrompt: '',
  intentSummary: 'reference anchored orbit shot',
  optimizationNotes: ['clarified reference role'],
  protectedTokens: ['@img1', '@资源库/角色A/三视图/正面'],
  optimizerSkill: 'video-scene',
  usedFallback: false,
})

assert.match(result.prompt, /@img1/)
assert.match(result.prompt, /@资源库\/角色A\/三视图\/正面/)
assert.equal(result.optimizerSkill, 'video-scene')
assert.equal(result.optimizerUsedFallback, false)

const fallback = applyVideoPromptOptimizationResult({
  originalPrompt: 'use @img1',
  originalNegativePrompt: '',
  optimizedPrompt: 'use broken reference',
  optimizedNegativePrompt: '',
  intentSummary: 'fallback',
  optimizationNotes: ['token mismatch'],
  protectedTokens: ['@img1'],
  optimizerSkill: 'video-scene',
  usedFallback: true,
})

assert.equal(fallback.prompt, 'use @img1')

console.log('videoPromptOptimizer tests passed')
