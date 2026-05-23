import { ChatPromptTemplate } from '@langchain/core/prompts'
import { ChatOpenAI } from '@langchain/openai'
import { promptOptimizationSchema } from './promptOptimizerSchema.js'
import { freezeProtectedPromptTokens, restoreProtectedPromptTokens } from './promptTokenGuards.js'
import { selectPromptSkill, type PromptSkillContext } from './prompt-skills/index.js'

const OPTIMIZER_MODEL = process.env.OPENAI_PROMPT_OPTIMIZER_MODEL || 'gpt-4.1-mini'

export type PromptOptimizationMode = 'text2img' | 'img2img' | 't2v' | 'i2v' | 'first_last' | 'multimodal' | 'continue'

export interface PromptOptimizerInput {
  prompt: string
  negativePrompt?: string
  mode: PromptOptimizationMode
  mediaKind?: 'image' | 'video'
  hasReferenceImages: boolean
  isThreeView?: boolean
  threeViewAngle?: string
  size: string
  quality: string
  background: string
  outputFormat: string
  baseUrl: string
  apiKey: string
  model?: string
}

export interface PromptOptimizerPayload {
  userPrompt: string
  userNegativePrompt: string
  context: {
    mode: PromptOptimizationMode
    hasReferenceImages: boolean
    size: string
    quality: string
    background: string
    outputFormat: string
    mediaKind: 'image' | 'video'
    isThreeView: boolean
    threeViewAngle?: string
  }
}

export interface PromptOptimizationResult {
  originalPrompt: string
  originalNegativePrompt: string
  optimizedPrompt: string
  optimizedNegativePrompt: string
  intentSummary: string
  optimizationNotes: string[]
  optimizerSkill: string
  protectedTokens: string[]
  usedFallback: boolean
}

interface PromptOptimizerFallback {
  prompt: string
  negativePrompt?: string
  reason: string
  optimizerSkill?: string
  protectedTokens?: string[]
}

interface RawPromptOptimizerResult {
  optimizedPrompt?: unknown
  optimizedNegativePrompt?: unknown
  intentSummary?: unknown
  optimizationNotes?: unknown
  optimizerSkill?: unknown
}

export function buildPromptOptimizerPayload(input: Omit<PromptOptimizerInput, 'apiKey' | 'baseUrl' | 'model'>): PromptOptimizerPayload {
  return {
    userPrompt: input.prompt,
    userNegativePrompt: input.negativePrompt || '',
    context: {
      mode: input.mode,
      hasReferenceImages: input.hasReferenceImages,
      size: input.size,
      quality: input.quality,
      background: input.background,
      outputFormat: input.outputFormat,
      mediaKind: input.mediaKind || 'image',
      isThreeView: Boolean(input.isThreeView),
      threeViewAngle: input.threeViewAngle,
    },
  }
}

export function normalizePromptOptimizerResult(
  raw: RawPromptOptimizerResult,
  fallback?: PromptOptimizerFallback,
): PromptOptimizationResult {
  const optimizedPrompt = typeof raw.optimizedPrompt === 'string' ? raw.optimizedPrompt.trim() : ''
  const optimizedNegativePrompt = typeof raw.optimizedNegativePrompt === 'string' ? raw.optimizedNegativePrompt.trim() : ''
  const intentSummary = typeof raw.intentSummary === 'string' ? raw.intentSummary.trim() : ''
  const optimizationNotes = Array.isArray(raw.optimizationNotes)
    ? raw.optimizationNotes.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : []
  const optimizerSkill = typeof raw.optimizerSkill === 'string' && raw.optimizerSkill.trim()
    ? raw.optimizerSkill.trim()
    : fallback?.optimizerSkill || 'base-image'
  const protectedTokens = fallback?.protectedTokens || []

  if (!optimizedPrompt) {
    if (!fallback) {
      throw new Error('Prompt optimizer returned no optimizedPrompt')
    }

    return {
      originalPrompt: fallback.prompt,
      originalNegativePrompt: fallback.negativePrompt || '',
      optimizedPrompt: fallback.prompt,
      optimizedNegativePrompt: fallback.negativePrompt || '',
      intentSummary: fallback.prompt,
      optimizationNotes: [`optimizer fallback: ${fallback.reason}`],
      optimizerSkill,
      protectedTokens,
      usedFallback: true,
    }
  }

  return {
    originalPrompt: fallback?.prompt || optimizedPrompt,
    originalNegativePrompt: fallback?.negativePrompt || '',
    optimizedPrompt,
    optimizedNegativePrompt,
    intentSummary,
    optimizationNotes,
    optimizerSkill,
    protectedTokens,
    usedFallback: false,
  }
}

export async function optimizeImagePrompt(input: PromptOptimizerInput): Promise<PromptOptimizationResult> {
  const mediaKind = input.mediaKind || 'image'
  const skillContext: PromptSkillContext = {
    mediaKind,
    mode: input.mode,
    hasReferenceImages: input.hasReferenceImages,
    isThreeView: Boolean(input.isThreeView),
    threeViewAngle: input.threeViewAngle,
  }
  const skill = selectPromptSkill(skillContext)
  const frozen = skill.protectTokens ? freezeProtectedPromptTokens(input.prompt) : { prompt: input.prompt, tokens: [] }
  const protectedTokens = frozen.tokens.map((token) => token.value)
  const payload = buildPromptOptimizerPayload({
    ...input,
    prompt: frozen.prompt,
    mediaKind,
  })
  const fallback = {
    prompt: input.prompt,
    negativePrompt: input.negativePrompt || '',
    optimizerSkill: skill.name,
    protectedTokens,
  }

  if (!input.apiKey) {
    return normalizePromptOptimizerResult({}, { ...fallback, reason: 'missing-api-key' })
  }

  const baseURL = (process.env.OPENAI_PROMPT_OPTIMIZER_BASE_URL || input.baseUrl).replace(/\/+$/, '')
  const apiKey = process.env.OPENAI_PROMPT_OPTIMIZER_API_KEY || input.apiKey

  try {
    const prompt = ChatPromptTemplate.fromMessages([
      ['system', skill.systemInstructions],
      ['user', '{userPromptPayload}'],
    ])
    const llm = new ChatOpenAI({
      model: OPTIMIZER_MODEL,
      apiKey,
      configuration: { baseURL },
      temperature: 0.4,
    })
    const chain = prompt.pipe(
      llm.withStructuredOutput(promptOptimizationSchema, { name: 'prompt_optimization_result' }),
    )

    const raw = await chain.invoke({
      userPromptPayload: JSON.stringify({
        ...payload,
        outputContract: {
          optimizedPrompt: 'string',
          optimizedNegativePrompt: 'string',
          intentSummary: 'string',
          optimizationNotes: 'short string[]',
          optimizerSkill: skill.name,
        },
        reasoningPolicy: [
          'First identify unreasonable, conflicting, repetitive, or vague prompt parts.',
          'Conservatively fix those issues.',
          'Then lightly add missing visual or cinematic details when useful.',
          'Preserve the user intent and do not replace the main subject.',
        ],
        protectedTokenPolicy: skill.protectTokens
          ? {
            placeholders: frozen.tokens,
            rule: 'Preserve placeholders exactly and keep their order unchanged.',
          }
          : null,
      }),
    }) as RawPromptOptimizerResult

    const restoredPrompt = typeof raw.optimizedPrompt === 'string' && skill.protectTokens
      ? restoreProtectedPromptTokens(raw.optimizedPrompt, frozen.tokens)
      : { prompt: typeof raw.optimizedPrompt === 'string' ? raw.optimizedPrompt : '', valid: true }

    if (!restoredPrompt.valid) {
      return normalizePromptOptimizerResult({}, { ...fallback, reason: 'protected-token-mismatch' })
    }

    return normalizePromptOptimizerResult({
      ...raw,
      optimizedPrompt: restoredPrompt.prompt,
      optimizerSkill: skill.name,
    }, { ...fallback, reason: 'empty-response' })
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    return normalizePromptOptimizerResult({}, { ...fallback, reason })
  }
}

export const optimizePrompt = optimizeImagePrompt

/* c8 ignore start */
export async function optimizeImagePromptWithFetchFallback(input: PromptOptimizerInput): Promise<PromptOptimizationResult> {
  const payload = buildPromptOptimizerPayload(input)
  const fallback = {
    prompt: input.prompt,
    negativePrompt: input.negativePrompt || '',
  }
  const base = input.baseUrl.replace(/\/+$/, '')
  const endpoint = `${base}/chat/completions`

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${input.apiKey}`,
      },
      body: JSON.stringify({
        model: OPTIMIZER_MODEL,
        temperature: 0.4,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: [
              'You optimize prompts for image generation.',
              'Preserve the user intent, subject, and requested changes.',
              'Do not invent a different subject, scene, or style unless implied by the input.',
              'If reference images are present, preserve identity and composition unless the user asked to transform them.',
              'Return strict JSON with keys optimizedPrompt, optimizedNegativePrompt, intentSummary, optimizationNotes.',
              'optimizationNotes must be a short string array.',
            ].join(' '),
          },
          {
            role: 'user',
            content: JSON.stringify(payload),
          },
        ],
      }),
    })

    if (!response.ok) {
      const message = await response.text()
      return normalizePromptOptimizerResult({}, { ...fallback, reason: `http-${response.status}: ${message}` })
    }

    const data = await response.json()
    const content = data?.choices?.[0]?.message?.content
    const raw = typeof content === 'string' ? JSON.parse(content) : {}
    return normalizePromptOptimizerResult(raw, { ...fallback, reason: 'empty-response' })
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    return normalizePromptOptimizerResult({}, { ...fallback, reason })
  }
}
/* c8 ignore stop */
