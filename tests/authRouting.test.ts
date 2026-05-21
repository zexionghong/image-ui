import assert from 'node:assert/strict'
import {
  buildAuthRedirectPath,
  buildLoginRedirectTarget,
  getPostAuthDestination,
  shouldRedirectOnUnauthorized,
} from '../src/lib/authRouting'

assert.equal(
  buildLoginRedirectTarget('en', '/en/settings?tab=auth'),
  '/en/login?redirect=%2Fen%2Fsettings%3Ftab%3Dauth',
)

assert.equal(
  buildLoginRedirectTarget('fr', '/fr/workflow?view=grid'),
  '/zh/login?redirect=%2Ffr%2Fworkflow%3Fview%3Dgrid',
)

assert.equal(
  buildAuthRedirectPath('/en/settings', '?tab=auth'),
  '/en/login?redirect=%2Fen%2Fsettings%3Ftab%3Dauth',
)

assert.equal(
  buildAuthRedirectPath('/fr/settings', '?tab=security'),
  '/zh/login?redirect=%2Ffr%2Fsettings%3Ftab%3Dsecurity',
)

assert.equal(shouldRedirectOnUnauthorized('/en/settings'), true)
assert.equal(shouldRedirectOnUnauthorized('/zh/generate'), true)
assert.equal(shouldRedirectOnUnauthorized('/fr/settings'), true)
assert.equal(shouldRedirectOnUnauthorized('/en/login'), false)
assert.equal(shouldRedirectOnUnauthorized('/'), false)

assert.equal(getPostAuthDestination('en', '/en/settings?tab=auth'), '/en/settings?tab=auth')
assert.equal(
  getPostAuthDestination('en', '/en/generate?prompt=100%25%20real'),
  '/en/generate?prompt=100%25%20real',
)
assert.equal(getPostAuthDestination('en', 'https://evil.example'), '/en/gallery')
assert.equal(getPostAuthDestination('en', '//evil.example'), '/en/gallery')
assert.equal(getPostAuthDestination('en', '/\\evil.example'), '/en/gallery')
assert.equal(getPostAuthDestination(undefined, null), '/zh/gallery')

console.log('authRouting tests passed')
