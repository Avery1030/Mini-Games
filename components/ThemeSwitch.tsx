'use client'

import { Sun, Moon } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { cn } from '@/utils/cn'

export default function ThemeSwitch() {
  const t = useTranslations('theme')
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const isDark = resolvedTheme === 'dark'

  if (!mounted) {
    return <div className='w-7 h-7 rounded bg-theme-switch border border-theme-switch-border' aria-hidden />
  }

  return (
    <button
      type='button'
      className={cn(
        'w-7 h-7 flex items-center justify-center rounded cursor-pointer transition-colors',
        'bg-theme-switch border border-theme-switch-border text-theme-switch-icon hover:bg-theme-switch-hover',
      )}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? t('toLight') : t('toDark')}
      title={isDark ? t('light') : t('dark')}
    >
      {isDark ? <Moon className='w-4 h-4' /> : <Sun className='w-4 h-4' />}
    </button>
  )
}
