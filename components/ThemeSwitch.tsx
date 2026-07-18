'use client'

import { Sun, Moon } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { cn } from '@/utils/cn'

export default function ThemeSwitch() {
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
      aria-label={isDark ? '切换到浅色主题' : '切换到深色主题'}
      title={isDark ? '浅色' : '深色'}
    >
      {isDark ? <Moon className='w-4 h-4' /> : <Sun className='w-4 h-4' />}
    </button>
  )
}
