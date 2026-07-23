import { getRequestConfig } from 'next-intl/server'
import { cookies } from 'next/headers'
import { locales, defaultLocale, COOKIE_KEY, type Locale } from './config'
import zhCN from '@/messages/zh-CN.json'
import enUS from '@/messages/en-US.json'

/**
 * 静态导入语言包，避免 Turbopack 对
 * `import(\`@/messages/${locale}.json\`)` 的 HMR 偶发报错：
 * Expected module to match pattern: .../messages/*.json [json]
 */
const messagesByLocale: Record<Locale, typeof zhCN> = {
  'zh-CN': zhCN,
  'en-US': enUS,
}

export default getRequestConfig(async () => {
  const cookieStore = await cookies()
  const savedLocale = cookieStore.get(COOKIE_KEY)?.value

  const locale: Locale =
    savedLocale && locales.includes(savedLocale as Locale) ? (savedLocale as Locale) : defaultLocale

  return {
    locale,
    messages: messagesByLocale[locale],
  }
})
