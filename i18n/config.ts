export const locales = ['zh-CN', 'zh-TW', 'en-US', 'ja-JP', 'ru-RU', 'de-DE', 'fr-FR'] as const
export type Locale = (typeof locales)[number]
export const defaultLocale: Locale = 'zh-CN'
export const COOKIE_KEY = 'NEXT_LOCALE'
// Cookie有效期30天
export const COOKIE_MAX_AGE = 30 * 24 * 60 * 60

/** 语言切换下拉显示名（本族语） */
export const LOCALE_LABELS: Record<Locale, string> = {
  'zh-CN': '简体中文',
  'zh-TW': '繁體中文',
  'en-US': 'English',
  'ja-JP': '日本語',
  'ru-RU': 'Русский',
  'de-DE': 'Deutsch',
  'fr-FR': 'Français',
}

/** 浏览器语言 → 应用 locale 粗匹配 */
export function matchBrowserLocale(browserLang: string): Locale {
  const lower = browserLang.toLowerCase()
  const exact = locales.find((l) => l.toLowerCase() === lower)
  if (exact) return exact
  if (lower.startsWith('zh-tw') || lower.startsWith('zh-hk') || lower.startsWith('zh-mo') || lower === 'zh-hant') {
    return 'zh-TW'
  }
  if (lower.startsWith('zh')) return 'zh-CN'
  const prefix = lower.slice(0, 2)
  const byPrefix: Record<string, Locale> = {
    en: 'en-US',
    ja: 'ja-JP',
    ru: 'ru-RU',
    de: 'de-DE',
    fr: 'fr-FR',
  }
  return byPrefix[prefix] ?? defaultLocale
}
