const PROTECTED_TOKEN_PATTERN = /@img\d+|@资源库\/[^\s,，。；;！!？?]+/g

export interface ProtectedPromptToken {
  value: string
  placeholder: string
}

export function freezeProtectedPromptTokens(prompt: string) {
  const tokens: ProtectedPromptToken[] = []
  const frozenPrompt = prompt.replace(PROTECTED_TOKEN_PATTERN, (value) => {
    const token = {
      value,
      placeholder: `__PROMPT_TOKEN_${tokens.length}__`,
    }
    tokens.push(token)
    return token.placeholder
  })

  return { prompt: frozenPrompt, tokens }
}

export function restoreProtectedPromptTokens(prompt: string, tokens: ProtectedPromptToken[]) {
  let restored = prompt
  for (const token of tokens) {
    restored = restored.replaceAll(token.placeholder, token.value)
  }

  const restoredTokens = Array.from(restored.matchAll(PROTECTED_TOKEN_PATTERN)).map((match) => match[0])
  const valid = restoredTokens.length === tokens.length
    && restoredTokens.every((value, index) => value === tokens[index].value)

  return { prompt: restored, valid }
}
