import assert from 'node:assert/strict'
import {
  freezeProtectedPromptTokens,
  restoreProtectedPromptTokens,
} from '../server/promptTokenGuards'

const frozen = freezeProtectedPromptTokens('use @img1 with @资源库/角色A/三视图/正面 and keep motion soft')

assert.equal(frozen.tokens.length, 2)
assert.match(frozen.prompt, /__PROMPT_TOKEN_0__/)
assert.match(frozen.prompt, /__PROMPT_TOKEN_1__/)

const restored = restoreProtectedPromptTokens(
  'use __PROMPT_TOKEN_0__ with __PROMPT_TOKEN_1__ and keep motion soft',
  frozen.tokens,
)

assert.equal(restored.prompt, 'use @img1 with @资源库/角色A/三视图/正面 and keep motion soft')
assert.equal(restored.valid, true)

const mismatch = restoreProtectedPromptTokens('use __PROMPT_TOKEN_1__ before __PROMPT_TOKEN_0__', frozen.tokens)
assert.equal(mismatch.valid, false)

console.log('promptTokenGuards tests passed')
