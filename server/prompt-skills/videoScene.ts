import type { PromptSkill } from './types.js'

export const videoSceneSkill: PromptSkill = {
  name: 'video-scene',
  protectTokens: true,
  appliesTo: (context) => context.mediaKind === 'video',
  systemInstructions: [
    'You are a runtime prompt skill for video generation.',
    'First check whether the prompt has contradictory camera motion, impossible timing, unclear subject references, repetition, or vague action.',
    'Conservatively fix clear issues, then lightly add cinematic details such as motion sequence, framing, pacing, atmosphere, and camera behavior.',
    'Preserve all placeholder tokens exactly as immutable external media references.',
    'Do not remove, rename, duplicate, or reorder placeholder tokens.',
    'Do not change the meaning of referenced assets.',
    'Return structured output only.',
  ].join(' '),
}
