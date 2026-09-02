/**
 * 更新日志日期清单（ISO YYYY-MM-DD，新到旧）。
 * 展示文案在 messages 下 changelog.<ISO日期>；日期本身用 Intl 格式化，勿在文案里写死。
 */
export const CHANGELOG_DATES = [
  '2026-09-02',
  '2026-08-15',
  '2026-08-12',
  '2026-08-05',
  '2026-08-04',
  '2026-08-03',
  '2026-07-29',
  '2026-07-27',
  '2026-07-26',
  '2026-07-25',
  '2026-07-24',
  '2026-07-23',
  '2026-07-21',
  '2026-07-19',
  '2026-07-18',
  '2026-07-16',
  '2026-07-12',
] as const

export type ChangelogDateId = (typeof CHANGELOG_DATES)[number]

/** 将 ISO 日期按当前语言格式化为本地长日期（如 2026年7月21日 / July 21, 2026） */
export function formatChangelogDate(isoDate: string, locale: string): string {
  const parts = isoDate.split('-').map((n) => Number(n))
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return isoDate
  const [y, m, d] = parts
  const date = new Date(y, m - 1, d)
  if (Number.isNaN(date.getTime())) return isoDate
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date)
}
