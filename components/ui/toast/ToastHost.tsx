'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, Check, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { winChrome } from '@/lib/winChrome'
import { Button } from '@/components/ui/Button'
import { WinCloseIcon } from '@/components/ui/WindowChromeIcons'
import { dismissToast } from './api'
import { useToastStore } from './store'
import type { ToastEntry, ToastType } from './types'

/** Win95 消息框式色块图标 */
const TYPE_STYLE: Record<
  ToastType,
  { iconBg: string; iconFg: string; Icon: typeof Check; label: string }
> = {
  success: {
    iconBg: 'bg-[#008000]',
    iconFg: 'text-white',
    Icon: Check,
    label: 'OK',
  },
  error: {
    iconBg: 'bg-[#c00000]',
    iconFg: 'text-white',
    Icon: X,
    label: 'Error',
  },
  warning: {
    iconBg: 'bg-[#808000]',
    iconFg: 'text-[#ffff00]',
    Icon: AlertTriangle,
    label: 'Warning',
  },
}

function ToastCard({ entry }: { entry: ToastEntry }) {
  const [leaving, setLeaving] = useState(false)
  const style = TYPE_STYLE[entry.type]
  const Icon = style.Icon

  useEffect(() => {
    if (entry.duration === false || leaving) return
    const t = window.setTimeout(() => setLeaving(true), entry.duration)
    return () => window.clearTimeout(t)
  }, [entry.duration, entry.id, leaving])

  return (
    <div
      role='status'
      aria-live='polite'
      className={cn(
        winChrome,
        // 保持凸起态，避免整块被 hover/active 压成凹陷
        'hover:bg-chrome active:bg-chrome',
        'active:border-t-chrome-light active:border-l-chrome-light',
        'active:border-r-chrome-dark active:border-b-chrome-dark',
        'pointer-events-auto relative flex w-[min(300px,calc(100vw-2rem))] items-center gap-2 p-2 font-pixel will-change-transform',
        'shadow-[4px_4px_0_rgba(0,0,0,0.45)]',
        leaving ? 'toast-slide-out' : 'toast-slide-in',
      )}
      onAnimationEnd={(e) => {
        if (e.target !== e.currentTarget) return
        if (leaving) dismissToast(entry.id)
      }}
    >
      <span
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center',
          'border-2 border-t-chrome-light border-l-chrome-light border-r-chrome-dark border-b-chrome-dark',
          style.iconBg,
          style.iconFg,
        )}
        title={style.label}
        aria-hidden
      >
        <Icon size={18} strokeWidth={3} />
      </span>

      <div className='min-w-0 flex-1 py-0.5 text-[12px] leading-snug text-on-chrome break-words'>
        {typeof entry.message === 'string' || typeof entry.message === 'number' ? (
          <p>{entry.message}</p>
        ) : (
          entry.message
        )}
      </div>

      <Button
        variant='raised'
        size='icon-sm'
        className='shrink-0 self-start'
        aria-label='Close'
        onClick={() => setLeaving(true)}
      >
        <WinCloseIcon />
      </Button>
    </div>
  )
}

/**
 * 根级宿主：右上角 Toast 栈。放在 layout 一次即可。
 */
export function ToastHost() {
  const items = useToastStore((s) => s.items)

  if (items.length === 0) return null

  return (
    <div
      className='pointer-events-none fixed top-3 right-3 z-[12000] flex flex-col items-end gap-2'
      aria-label='Notifications'
    >
      {items.map((entry) => (
        <ToastCard key={entry.id} entry={entry} />
      ))}
    </div>
  )
}
