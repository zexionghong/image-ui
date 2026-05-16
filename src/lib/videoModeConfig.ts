export type VideoMode = 't2v' | 'i2v' | 'first_last' | 'multimodal' | 'continue'

export type VideoModeInput = 'sourceImage' | 'endFrame' | 'referenceImages' | 'referenceVideo' | 'referenceAudio'

export type VideoModeMedia = {
  imageFile: File | null
  endFrameFile: File | null
  referenceImages: File[]
  referenceVideo: File | null
  referenceAudio: File | null
}

export const VIDEO_MODE_CONFIG: Record<
  VideoMode,
  {
    visibleInputs: VideoModeInput[]
    requiredInputs: VideoModeInput[]
  }
> = {
  t2v: {
    visibleInputs: [],
    requiredInputs: [],
  },
  i2v: {
    visibleInputs: ['sourceImage'],
    requiredInputs: ['sourceImage'],
  },
  first_last: {
    visibleInputs: ['sourceImage', 'endFrame'],
    requiredInputs: ['sourceImage', 'endFrame'],
  },
  multimodal: {
    visibleInputs: ['referenceImages', 'referenceVideo', 'referenceAudio'],
    requiredInputs: [],
  },
  continue: {
    visibleInputs: ['referenceVideo'],
    requiredInputs: ['referenceVideo'],
  },
}

export function hasVideoModeInput(mode: VideoMode, input: VideoModeInput) {
  return VIDEO_MODE_CONFIG[mode].visibleInputs.includes(input)
}

export function isVideoModeInputRequired(mode: VideoMode, input: VideoModeInput) {
  return VIDEO_MODE_CONFIG[mode].requiredInputs.includes(input)
}

export function filterMediaForMode(mode: VideoMode, media: VideoModeMedia) {
  const filtered: Partial<VideoModeMedia> = {}

  if (hasVideoModeInput(mode, 'sourceImage')) filtered.imageFile = media.imageFile
  if (hasVideoModeInput(mode, 'endFrame')) filtered.endFrameFile = media.endFrameFile
  if (hasVideoModeInput(mode, 'referenceImages')) filtered.referenceImages = media.referenceImages
  if (hasVideoModeInput(mode, 'referenceVideo')) filtered.referenceVideo = media.referenceVideo
  if (hasVideoModeInput(mode, 'referenceAudio')) filtered.referenceAudio = media.referenceAudio

  return filtered
}
