import { getRequestConfig } from 'next-intl/server'
import { cookies } from 'next/headers'
import { locales, defaultLocale, COOKIE_KEY, Locale } from './config'

export default getRequestConfig(async () => {
  // 读取浏览器Cookie里存储的语言
  const cookieStore = await cookies()
  const savedLocale = cookieStore.get(COOKIE_KEY)?.value

  // 校验语言合法性，非法值使用默认中文
  const locale: Locale =
    savedLocale && locales.includes(savedLocale as Locale) ? (savedLocale as Locale) : defaultLocale

  // 加载对应语言文件
  const messages = (await import(`@/messages/${locale}.json`)).default

  return { locale, messages }
})
