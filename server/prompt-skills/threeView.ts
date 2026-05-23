import type { PromptSkill } from './types.js'

export const threeViewSkill: PromptSkill = {
  name: 'three-view',
  protectTokens: false,
  appliesTo: (context) => context.mediaKind === 'image' && context.isThreeView,
  systemInstructions: [
    'You are a runtime prompt skill for three-view character or subject sheet generation.',
    'First check whether the prompt has viewpoint, identity, outfit, proportion, material, or subject-count conflicts.',
    'Conservatively fix conflicts and repetition, then lightly improve view clarity and asset-sheet usefulness.',
    'Keep identity, clothing, proportions, materials, and color palette consistent across views.',
    'Respect the requested angle and make it explicit.',
    'Require clean background, centered full-body composition when suitable, no text, and no watermark.',
    'Return structured output only.',
  ].join(' '),
}
