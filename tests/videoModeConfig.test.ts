import assert from 'node:assert/strict'
import { VIDEO_MODE_CONFIG, filterMediaForMode, type VideoMode } from '../src/lib/videoModeConfig'

const modes: VideoMode[] = ['t2v', 'i2v', 'first_last', 'multimodal', 'continue']

assert.deepEqual(
  modes.map((mode) => [mode, VIDEO_MODE_CONFIG[mode].visibleInputs]),
  [
    ['t2v', []],
    ['i2v', ['sourceImage']],
    ['first_last', ['sourceImage', 'endFrame']],
    ['multimodal', ['referenceImages', 'referenceVideo', 'referenceAudio']],
    ['continue', ['referenceVideo']],
  ]
)

assert.deepEqual(
  modes.map((mode) => [mode, VIDEO_MODE_CONFIG[mode].requiredInputs]),
  [
    ['t2v', []],
    ['i2v', ['sourceImage']],
    ['first_last', ['sourceImage', 'endFrame']],
    ['multimodal', []],
    ['continue', ['referenceVideo']],
  ]
)

const media = {
  imageFile: new File(['source'], 'source.png', { type: 'image/png' }),
  endFrameFile: new File(['end'], 'end.png', { type: 'image/png' }),
  referenceImages: [
    new File(['reference'], 'reference.png', { type: 'image/png' }),
    new File(['reference-2'], 'reference-2.png', { type: 'image/png' }),
  ],
  referenceVideo: new File(['video'], 'reference.mp4', { type: 'video/mp4' }),
  referenceAudio: new File(['audio'], 'reference.mp3', { type: 'audio/mpeg' }),
}

assert.deepEqual(Object.keys(filterMediaForMode('t2v', media)), [])
assert.deepEqual(Object.keys(filterMediaForMode('i2v', media)), ['imageFile'])
assert.deepEqual(Object.keys(filterMediaForMode('first_last', media)), ['imageFile', 'endFrameFile'])
assert.deepEqual(Object.keys(filterMediaForMode('multimodal', media)), ['referenceImages', 'referenceVideo', 'referenceAudio'])
assert.equal(filterMediaForMode('multimodal', media).referenceImages?.length, 2)
assert.deepEqual(Object.keys(filterMediaForMode('continue', media)), ['referenceVideo'])

console.log('videoModeConfig tests passed')
