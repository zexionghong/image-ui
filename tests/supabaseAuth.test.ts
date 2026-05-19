import assert from 'node:assert/strict'
import { getBearerToken } from '../server/supabaseAuth'

assert.equal(getBearerToken({ authorization: 'Bearer abc.def.ghi' }), 'abc.def.ghi')
assert.equal(getBearerToken({ Authorization: 'Bearer token' }), 'token')
assert.equal(getBearerToken({ authorization: 'Basic nope' }), '')
assert.equal(getBearerToken({}), '')

console.log('supabaseAuth tests passed')
