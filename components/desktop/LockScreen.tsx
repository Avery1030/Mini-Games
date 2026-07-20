'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/cn'
import { winChrome } from '@/lib/winChrome'
import { Button, Input } from '@/components/ui'
import { useDesktopWallpaper } from '@/hooks/desktop'
import { useLockStore } from '@/store/lock'
import { toast } from '../ui'

/**
 * 锁屏遮罩：仅显示壁纸 + 解锁对话框，挡住桌面其余交互。
 */
export function LockScreen() {
  const t = useTranslations('lock')
  const isLocked = useLockStore((s) => s.isLocked)
  const unlock = useLockStore((s) => s.unlock)
  const wallpaperStyle = useDesktopWallpaper()

  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isLocked) {
      setPassword('')
      toast.clear()
      return
    }
    const id = window.setTimeout(() => inputRef.current?.focus(), 50)
    return () => window.clearTimeout(id)
  }, [isLocked])

  if (!isLocked) return null

  const onSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (submitting) return
    setSubmitting(true)
    toast.clear()
    try {
      const ok = await unlock(password)
      if (!ok) {
        toast.error(t('wrongPassword'))
        setPassword('')
        inputRef.current?.focus()
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className='fixed inset-0 z-[9000] flex items-center justify-center font-pixel select-none'
      style={wallpaperStyle}
      role='dialog'
      aria-modal='true'
      aria-label={t('title')}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className='absolute inset-0 bg-black/25' aria-hidden />

      <form
        className={cn(
          winChrome,
          'relative z-[1] w-[min(320px,calc(100vw-2rem))] p-3 shadow-[4px_4px_0_rgba(0,0,0,0.4)]',
        )}
        onSubmit={(e) => void onSubmit(e)}
      >
        <div className='h-7 px-1 mb-3 flex items-center bg-[var(--window-title-active)] text-[var(--window-title-text)] text-[12px] font-bold'>
          {t('title')}
        </div>
        <p className='text-[12px] text-on-chrome mb-3'>{t('hint')}</p>
        <label className='block text-[11px] text-on-chrome mb-1' htmlFor='lock-password'>
          {t('password')}
        </label>
        <Input
          id='lock-password'
          ref={inputRef}
          type='password'
          autoComplete='current-password'
          value={password}
          onChange={(e) => {
            setPassword(e.target.value)
            toast.clear()
          }}
          size='md'
          tone='field'
          disabled={submitting}
          className='mb-2'
        />
        <div className='flex justify-end gap-2 mt-2'>
          <Button type='submit' size='md' className='px-4' loading={submitting} disabled={submitting}>
            {t('unlock')}
          </Button>
        </div>
      </form>
    </div>
  )
}
