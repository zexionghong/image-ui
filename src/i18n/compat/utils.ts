type Messages = Record<string, unknown>

export function getByPath(obj: Messages, path: string): string | undefined {
  const parts = path.split('.')
  let current: unknown = obj
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return typeof current === 'string' ? current : undefined
}

export function interpolate(template: string, values?: Record<string, string | number>): string {
  if (!values) return template
  return template.replace(/\{(\w+)\}/g, (_, key) =>
    values[key] !== undefined ? String(values[key]) : `{${key}}`
  )
}

export function createTranslator(messages: Messages, namespace?: string) {
  return (key: string, values?: Record<string, string | number>): string => {
    const fullPath = namespace ? `${namespace}.${key}` : key
    const template = getByPath(messages, fullPath)
    if (template === undefined) {
      console.warn(`[i18n] Missing translation: ${fullPath}`)
      return key
    }
    return interpolate(template, values)
  }
}
