import assert from 'node:assert/strict'
import {
  buildPromptOptimizerPayload,
  normalizePromptOptimizerResult,
} from '../server/promptOptimizer'
import { mergeGenerationParameters } from '../server/routes/generate'

const payload = buildPromptOptimizerPayload({
  prompt: 'a cool sneaker ad',
  negativePrompt: '',
  mode: 'text2img',
  hasReferenceImages: false,
  size: '1024x1024',
  quality: 'high',
  background: 'auto',
  outputFormat: 'png',
})

assert.match(payload.userPrompt, /a cool sneaker ad/)
assert.equal(payload.context.mode, 'text2img')

const normalized = normalizePromptOptimizerResult({
  optimizedPrompt: 'hero product photo of premium sneakers, studio lighting, sharp details',
  optimizedNegativePrompt: 'blurry, distorted proportions',
  intentSummary: 'premium sneaker product shot',
  optimizationNotes: ['clarified subject', 'added lighting direction'],
})

assert.equal(normalized.optimizedPrompt.includes('premium sneakers'), true)
assert.equal(normalized.usedFallback, false)

const fallback = normalizePromptOptimizerResult({}, {
  prompt: 'rough sketch portrait',
  negativePrompt: 'low quality',
  reason: 'empty-response',
})

assert.equal(fallback.optimizedPrompt, 'rough sketch portrait')
assert.equal(fallback.optimizedNegativePrompt, 'low quality')
assert.equal(fallback.usedFallback, true)
assert.match(fallback.optimizationNotes[0], /empty-response/)

const parameters = mergeGenerationParameters(
  { size: '1024x1024', quality: 'auto', model: 'gpt-image-2' },
  {
    originalPrompt: 'simple portrait',
    originalNegativePrompt: '',
    optimizedPrompt: 'cinematic portrait, soft rim light, clean background',
    optimizedNegativePrompt: 'blurry, extra fingers',
    intentSummary: 'cinematic portrait',
    optimizationNotes: ['added lighting', 'added background control'],
    usedFallback: false,
  }
)

assert.equal(parameters.originalPrompt, 'simple portrait')
assert.equal(String(parameters.optimizedPrompt).includes('cinematic portrait'), true)
assert.deepEqual(parameters.optimizationNotes, ['added lighting', 'added background control'])

console.log('promptOptimizer tests passed')
