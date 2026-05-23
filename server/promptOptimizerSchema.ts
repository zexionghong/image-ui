import { z } from 'zod'

export const promptOptimizationSchema = z.object({
  optimizedPrompt: z.string().min(1),
  optimizedNegativePrompt: z.string().default(''),
  intentSummary: z.string().default(''),
  optimizationNotes: z.array(z.string()).default([]),
  optimizerSkill: z.string().min(1),
})

export type PromptOptimizationStructuredOutput = z.infer<typeof promptOptimizationSchema>
