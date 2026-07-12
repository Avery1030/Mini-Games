export const locales = ['zh-CN', 'en-US'] as const
export type Locale = (typeof locales)[number]
export const defaultLocale: Locale = 'zh-CN'
export const COOKIE_KEY = 'NEXT_LOCALE'
// Cookie有效期30天
export const COOKIE_MAX_AGE = 30 * 24 * 60 * 60
