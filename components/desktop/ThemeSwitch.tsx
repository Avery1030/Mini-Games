'use client'

import { Sun, Moon } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui'

/**
 * 任务栏主题切换：与托盘其他控件同一套 Win95 按钮样式。
 */
export default function ThemeSwitch() {
  const t = useTranslations('theme')
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const isDark = resolvedTheme === 'dark'

  if (!mounted) {
    return <Button size='icon-sm' aria-hidden tabIndex={-1} disabled />
  }

  return (
    <Button
      size='icon-sm'
      aria-label={isDark ? t('toLight') : t('toDark')}
      title={isDark ? t('light') : t('dark')}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
    >
      {isDark ? <Moon size={14} strokeWidth={2} aria-hidden /> : <Sun size={14} strokeWidth={2} aria-hidden />}
    </Button>
  )
}
