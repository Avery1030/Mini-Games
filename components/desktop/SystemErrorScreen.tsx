'use client'

import { cn } from '@/lib/cn'
import { Button } from '@/components/ui'
import { AveryMark } from './AveryMark'
import { winChrome } from '@/lib/winChrome'

export type SystemErrorScreenProps = {
  /** 大号状态码，如 404 */
  code: string
  title: string
  message: string
  homeLabel: string
  /** error 页：重试 */
  retryLabel?: string
  onRetry?: () => void
  /** 可选技术细节（digest / message） */
  detail?: Nullable<string>
  /** 图标变体 */
  variant?: 'notFound' | 'error'
}

/**
 * 全屏系统错误 / 404：桌面底色 + Win95 对话框。
 */
export function SystemErrorScreen({
  code,
  title,
  message,
  homeLabel,
  retryLabel,
  onRetry,
  detail,
  variant = 'error',
}: SystemErrorScreenProps) {
  return (
    <div
      className={cn(
        'fixed inset-0 z-[10000] flex flex-col items-center justify-center p-4 font-pixel select-none',
        'bg-[var(--desktop-bg)] text-on-chrome',
      )}
      style={{
        backgroundImage: `
          radial-gradient(ellipse 80% 50% at 50% 0%, var(--desktop-bg-glow), transparent 55%),
          linear-gradient(180deg, var(--desktop-bg) 0%, var(--desktop-bg-deep) 100%)
        `,
      }}
      role='alert'
    >
      <div
        className={cn(
          winChrome,
          'relative w-[min(420px,calc(100vw-2rem))] flex flex-col',
          'shadow-[4px_4px_0_rgba(0,0,0,0.35)] hover:bg-chrome',
        )}
      >
        <div className='flex items-center gap-2 h-7 px-1 bg-[var(--window-title-active)] text-[var(--window-title-text)]'>
          <AveryMark className='w-4 h-4 shrink-0 ml-1 text-[var(--window-title-text)]' />
          <span className='flex-1 min-w-0 px-1 text-[12px] font-bold truncate'>{title}</span>
        </div>

        <div className='flex gap-3 p-4'>
          <StatusGlyph variant={variant} code={code} />
          <div className='min-w-0 flex-1 space-y-2 pt-0.5'>
            <p className='text-[13px] font-bold text-on-chrome leading-snug'>{code}</p>
            <p className='text-[12px] text-on-chrome leading-relaxed whitespace-pre-wrap'>{message}</p>
            {detail ? (
              <pre
                className={cn(
                  'mt-2 max-h-24 overflow-auto text-[10px] leading-snug text-muted',
                  'bg-[var(--panel-inset)] border-2 border-t-chrome-dark border-l-chrome-dark border-r-chrome-light border-b-chrome-light',
                  'p-1.5 whitespace-pre-wrap break-all',
                )}
              >
                {detail}
              </pre>
            ) : null}
          </div>
        </div>

        <div className='flex justify-end gap-2 px-3 pb-3'>
          {onRetry && retryLabel ? (
            <Button size='md' className='min-w-[72px]' onClick={onRetry}>
              {retryLabel}
            </Button>
          ) : null}
          <Button
            size='md'
            className='min-w-[72px] font-bold'
            onClick={() => {
              window.location.assign('/')
            }}
          >
            {homeLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}

function StatusGlyph({ variant, code }: { variant: 'notFound' | 'error'; code: string }) {
  if (variant === 'notFound') {
    return (
      <div
        className='shrink-0 w-10 h-10 flex items-center justify-center border-2 border-chrome-dark bg-[#ffffcc] text-[#000080] text-lg font-bold shadow-[inset_1px_1px_0_#fff]'
        aria-hidden
        title={code}
      >
        ?
      </div>
    )
  }

  return (
    <div
      className='shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-[#c00000] text-white text-xl font-bold border-2 border-t-[#ff8080] border-l-[#ff8080] border-r-[#800000] border-b-[#800000]'
      aria-hidden
      title={code}
    >
      ×
    </div>
  )
}
