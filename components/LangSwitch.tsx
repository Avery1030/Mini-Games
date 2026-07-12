'use client'

import { COOKIE_KEY, COOKIE_MAX_AGE, Locale, defaultLocale, locales } from '@/i18n/config'
import { useRouter } from '@/i18n/routing'
import { useLocale } from 'next-intl'
import { useEffect } from 'react'

export default function LangSwitch() {
  const router = useRouter()
  const currentLang = useLocale() as Locale

  const handleSwitch = (newLang: Locale) => {
    if (newLang === currentLang) return
    document.cookie = `${COOKIE_KEY}=${newLang}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`
    router.refresh()
  }

  useEffect(() => {
    const hasCookie = document.cookie.includes(COOKIE_KEY)
    if (!hasCookie) {
      const browserLang = navigator.language
      const match = locales.find((lang) => lang.startsWith(browserLang.slice(0, 2)))
      const targetLang = match || defaultLocale
      document.cookie = `${COOKIE_KEY}=${targetLang}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`
      router.refresh()
    }
  }, [router])

  return (
    <select
      className='text-xs bg-[#c0c0c0] border-2 border-t-[#808080] 
        border-l-[#808080] border-r-white border-b-white px-2 py-1 cursor-pointer min-w-[72px]'
      defaultValue={currentLang}
      onChange={(e) => handleSwitch(e.target.value as Locale)}
    >
      <option value='en-US'>English</option>
      <option value='zh-CN'>简体中文</option>
    </select>
  )
}
