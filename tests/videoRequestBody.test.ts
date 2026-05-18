import assert from 'node:assert/strict'
import { buildSeedanceRequestBody, type UploadedMedia } from '../server/routes/video'

const sourceImage: UploadedMedia = {
  fieldname: 'sourceImage',
  mimetype: 'image/png',
  buffer: Buffer.from('source-image'),
  publicUrl: 'https://example.com/uploads/source.png',
}

const endFrame: UploadedMedia = {
  fieldname: 'endFrame',
  mimetype: 'image/png',
  buffer: Buffer.from('end-frame'),
  publicUrl: 'https://example.com/uploads/end.png',
}

const referenceVideo: UploadedMedia = {
  fieldname: 'referenceVideo',
  mimetype: 'video/mp4',
  buffer: Buffer.from('reference-video'),
  publicUrl: 'https://example.com/uploads/reference.mp4',
}

const referenceImageA: UploadedMedia = {
  fieldname: 'referenceImages',
  mimetype: 'image/png',
  buffer: Buffer.from('reference-image-a'),
  publicUrl: 'https://example.com/uploads/reference-a.png',
}

const referenceImageB: UploadedMedia = {
  fieldname: 'referenceImages',
  mimetype: 'image/png',
  buffer: Buffer.from('reference-image-b'),
  publicUrl: 'https://example.com/uploads/reference-b.png',
}

const referenceAudio: UploadedMedia = {
  fieldname: 'referenceAudio',
  mimetype: 'audio/mpeg',
  buffer: Buffer.from('reference-audio'),
  publicUrl: 'https://example.com/uploads/reference.mp3',
}

assert.deepEqual(
  buildSeedanceRequestBody({
    mode: 'first_last',
    prompt: 'slow push in',
    duration: 5,
    resolution: '720p',
    aspectRatio: '16:9',
    model: 'doubao-seedance-2-0-260128',
    media: [sourceImage, endFrame],
  }).content,
  [
    { type: 'text', text: 'slow push in' },
    {
      type: 'image_url',
      image_url: { url: 'https://example.com/uploads/source.png' },
      role: 'first_frame',
    },
    {
      type: 'image_url',
      image_url: { url: 'https://example.com/uploads/end.png' },
      role: 'last_frame',
    },
  ]
)

assert.deepEqual(
  buildSeedanceRequestBody({
    mode: 'multimodal',
    prompt: 'use the references',
    duration: 5,
    resolution: '720p',
    aspectRatio: '16:9',
    model: 'doubao-seedance-2-0-260128',
    media: [referenceImageA, referenceImageB, referenceVideo, referenceAudio],
  }).content,
  [
    { type: 'text', text: 'use the references' },
    {
      type: 'image_url',
      image_url: { url: 'https://example.com/uploads/reference-a.png' },
      role: 'reference_image',
    },
    {
      type: 'image_url',
      image_url: { url: 'https://example.com/uploads/reference-b.png' },
      role: 'reference_image',
    },
    {
      type: 'video_url',
      video_url: { url: 'https://example.com/uploads/reference.mp4' },
      role: 'reference_video',
    },
    {
      type: 'audio_url',
      audio_url: { url: 'https://example.com/uploads/reference.mp3' },
      role: 'reference_audio',
    },
  ]
)

console.log('videoRequestBody tests passed')
