import assert from 'node:assert/strict'
import { serializeImageRow } from '../server/imageRows'

const row = serializeImageRow({
  id: 'image-id',
  user_id: 'user-id',
  filename: 'stored.png',
  original_name: 'source.png',
  width: 1024,
  height: 768,
  size: 1234,
  mime_type: 'image/png',
  category: 'refs',
  tags: ['front'],
  metadata: { source: 'upload' },
  is_generated: false,
  prompt: null,
  parent_id: null,
  url: 'https://oss.example.com/image2/users/user-id/stored.png',
  storage_key: 'image2/users/user-id/stored.png',
  created_at: '2026-05-19T00:00:00.000Z',
  updated_at: '2026-05-19T00:00:00.000Z',
})

assert.equal(row.url, 'https://oss.example.com/image2/users/user-id/stored.png')
assert.equal(row.url.startsWith('/uploads/'), false)
assert.deepEqual(row.tags, ['front'])
assert.deepEqual(row.metadata, { source: 'upload' })

console.log('imageRows tests passed')
