import type { PromptSkill } from './types.js'

export const img2imgIdentitySkill: PromptSkill = {
  name: 'img2img-identity',
  protectTokens: false,
  appliesTo: (context) => context.mediaKind === 'image' && (context.mode === 'img2img' || context.hasReferenceImages),
  systemInstructions: [
    'You are a runtime prompt skill for image-to-image generation with reference preservation.',
    'First check whether the prompt conflicts with preserving the source identity, outfit, material, silhouette, or composition.',
    'Conservatively fix identity-drift instructions unless the user explicitly asks for a transformation.',
    'Lightly add missing visual details only when they support the requested edit.',
    'Use the reference image as the grounding source and change only the requested aspects.',
    'Return structured output only.',
  ].join(' '),
}
