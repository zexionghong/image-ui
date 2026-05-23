import { baseImageSkill } from './baseImage.js'
import { img2imgIdentitySkill } from './img2imgIdentity.js'
import { threeViewSkill } from './threeView.js'
import { videoSceneSkill } from './videoScene.js'
import type { PromptSkillContext } from './types.js'

export const promptSkills = [
  threeViewSkill,
  img2imgIdentitySkill,
  videoSceneSkill,
  baseImageSkill,
]

export function selectPromptSkill(context: PromptSkillContext) {
  return promptSkills.find((skill) => skill.appliesTo(context)) || baseImageSkill
}

export type { PromptSkillContext } from './types.js'
