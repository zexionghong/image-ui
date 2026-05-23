export interface PromptSkillContext {
  mediaKind: 'image' | 'video'
  mode: string
  hasReferenceImages: boolean
  isThreeView: boolean
  threeViewAngle?: string
}

export interface PromptSkill {
  name: string
  appliesTo: (context: PromptSkillContext) => boolean
  systemInstructions: string
  protectTokens: boolean
}
