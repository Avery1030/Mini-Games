'use client'

import { COOKIE_KEY, COOKIE_MAX_AGE, Locale, defaultLocale, locales } from '@/i18n/config'
import { useRouter } from '@/i18n/routing'
import { useLocale } from 'next-intl'
import { useEffect } from 'react'
import { Select } from '@/components/ui'

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
    <Select
      size='sm'
      className='min-w-[88px]'
      aria-label='Language'
      value={currentLang}
      onValueChange={(v) => handleSwitch(v as Locale)}
      options={[
        { value: 'en-US', label: 'English' },
        { value: 'zh-CN', label: '简体中文' },
      ]}
    />
  )
}
