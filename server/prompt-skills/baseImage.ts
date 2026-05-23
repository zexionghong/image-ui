import type { PromptSkill } from './types.js'

export const baseImageSkill: PromptSkill = {
  name: 'base-image',
  protectTokens: false,
  appliesTo: (context) => context.mediaKind === 'image',
  systemInstructions: [
    'You are a runtime prompt skill for image generation.',
    'First check whether the prompt is unreasonable, contradictory, repetitive, or too vague for a good image result.',
    'Conservatively fix clear issues, then lightly add missing visual details such as subject clarity, composition, lighting, material, and rendering style.',
    'Preserve the user intent, main subject, and requested style.',
    'Do not invent a different scene, subject, or story.',
    'Return structured output only.',
  ].join(' '),
}
