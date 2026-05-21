import assert from 'node:assert/strict'
import { getDefaultAuthState, normalizeAuthProfile } from '../src/store/useAuthStore'

assert.deepEqual(getDefaultAuthState(), {
  initialized: false,
  loading: false,
  session: null,
  user: null,
  profile: null,
  error: null,
})

assert.deepEqual(
  normalizeAuthProfile({ id: 'u1', current_plan: 'pro', full_name: 'Ada' }),
  { id: 'u1', currentPlan: 'pro', fullName: 'Ada' },
)

assert.equal(normalizeAuthProfile(null), null)

console.log('authStore tests passed')
