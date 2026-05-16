import assert from 'node:assert/strict'
import { getMediaKind, acceptsFileType, formatMediaDimensions } from '../src/lib/media'

assert.equal(getMediaKind({ mime_type: 'video/mp4', filename: 'clip.mp4' }), 'video')
assert.equal(getMediaKind({ mime_type: '', filename: 'clip.MP4' }), 'video')
assert.equal(getMediaKind({ mime_type: 'image/png', filename: 'frame.png' }), 'image')
assert.equal(getMediaKind({ mime_type: '', filename: 'frame.webp' }), 'image')
assert.equal(getMediaKind({ mime_type: 'application/octet-stream', filename: 'asset.bin' }), 'unknown')

assert.equal(acceptsFileType(new File(['x'], 'movie.mp4', { type: 'video/mp4' }), 'image/*,video/mp4,video/webm,video/quicktime'), true)
assert.equal(acceptsFileType(new File(['x'], 'movie.mov', { type: '' }), 'image/*,video/mp4,video/webm,video/quicktime'), true)
assert.equal(acceptsFileType(new File(['x'], 'notes.txt', { type: 'text/plain' }), 'image/*,video/mp4,video/webm,video/quicktime'), false)

assert.equal(formatMediaDimensions({ width: 1920, height: 1080, size: 2048 * 1024 }), '1920x1080 · 2048KB')
assert.equal(formatMediaDimensions({ width: 0, height: 0, size: 2048 * 1024 }), '2048KB')

console.log('galleryMedia tests passed')
