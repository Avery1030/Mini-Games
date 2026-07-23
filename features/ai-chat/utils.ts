export function nextId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function formatTime(ts: number, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(ts))
  } catch {
    return ''
  }
}

export function insertAtCursor(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  insert: string,
): { next: string; caret: number } {
  const start = Math.max(0, selectionStart)
  const end = Math.max(start, selectionEnd)
  const next = value.slice(0, start) + insert + value.slice(end)
  return { next, caret: start + insert.length }
}

/** 将上游错误文案映射为更友好的余额不足提示（若匹配）。 */
export function mapStreamErrorMessage(raw: string, balanceLabel: string): string {
  const lower = raw.toLowerCase()
  if (lower.includes('insufficient') || lower.includes('balance') || lower.includes('余额')) {
    return balanceLabel
  }
  return raw
}
