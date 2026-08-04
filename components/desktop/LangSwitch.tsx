'use client'

import { COOKIE_KEY, COOKIE_MAX_AGE, LOCALE_LABELS, type Locale, locales, matchBrowserLocale } from '@/i18n/config'
import { useRouter } from '@/i18n/routing'
import { useLocale, useTranslations } from 'next-intl'
import { useEffect } from 'react'
import { Select } from '@/components/ui'

export default function LangSwitch() {
  const router = useRouter()
  const t = useTranslations('lang')
  const currentLang = useLocale() as Locale

  const handleSwitch = (newLang: Locale) => {
    if (newLang === currentLang) return
    document.cookie = `${COOKIE_KEY}=${newLang}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`
    router.refresh()
  }

  useEffect(() => {
    const hasCookie = document.cookie.split(';').some((c) => c.trim().startsWith(`${COOKIE_KEY}=`))
    if (!hasCookie) {
      const targetLang = matchBrowserLocale(navigator.language || defaultBrowserFallback())
      document.cookie = `${COOKIE_KEY}=${targetLang}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`
      router.refresh()
    }
  }, [router])

  return (
    <Select
      size='sm'
      className='min-w-[108px]'
      aria-label={t('label')}
      value={currentLang}
      onValueChange={(v) => handleSwitch(v as Locale)}
      options={locales.map((value) => ({ value, label: LOCALE_LABELS[value] }))}
    />
  )
}

function defaultBrowserFallback(): string {
  return 'zh-CN'
}
