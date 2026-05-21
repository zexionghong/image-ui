const OPTIMIZER_MODEL = process.env.OPENAI_PROMPT_OPTIMIZER_MODEL || 'gpt-4.1-mini'

export type PromptOptimizationMode = 'text2img' | 'img2img'

export interface PromptOptimizerInput {
  prompt: string
  negativePrompt?: string
  mode: PromptOptimizationMode
  hasReferenceImages: boolean
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
  }
}

export interface PromptOptimizationResult {
  originalPrompt: string
  originalNegativePrompt: string
  optimizedPrompt: string
  optimizedNegativePrompt: string
  intentSummary: string
  optimizationNotes: string[]
  usedFallback: boolean
}

interface PromptOptimizerFallback {
  prompt: string
  negativePrompt?: string
  reason: string
}

interface RawPromptOptimizerResult {
  optimizedPrompt?: unknown
  optimizedNegativePrompt?: unknown
  intentSummary?: unknown
  optimizationNotes?: unknown
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
    usedFallback: false,
  }
}

function extractJsonObject(content: string): RawPromptOptimizerResult {
  const trimmed = content.trim()
  if (!trimmed) return {}

  try {
    return JSON.parse(trimmed) as RawPromptOptimizerResult
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/)
    if (!match) return {}
    return JSON.parse(match[0]) as RawPromptOptimizerResult
  }
}

export async function optimizeImagePrompt(input: PromptOptimizerInput): Promise<PromptOptimizationResult> {
  const payload = buildPromptOptimizerPayload(input)
  const fallback = {
    prompt: input.prompt,
    negativePrompt: input.negativePrompt || '',
  }

  if (!input.apiKey) {
    return normalizePromptOptimizerResult({}, { ...fallback, reason: 'missing-api-key' })
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
    const raw = typeof content === 'string' ? extractJsonObject(content) : {}
    return normalizePromptOptimizerResult(raw, { ...fallback, reason: 'empty-response' })
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    return normalizePromptOptimizerResult({}, { ...fallback, reason })
  }
}
