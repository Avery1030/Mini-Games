/** 文件大小展示（资源管理器 / 回收站共用，算法保持一致） */
export function formatBytes(size: number): string {
  if (!Number.isFinite(size) || size < 0) return '—'
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

export function formatShortDateTime(ts: number, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(ts))
  } catch {
    return new Date(ts).toLocaleString()
  }
}

export function formatOptionalShortDateTime(ts: number | undefined, locale: string): string {
  if (ts == null) return '—'
  return formatShortDateTime(ts, locale)
}
