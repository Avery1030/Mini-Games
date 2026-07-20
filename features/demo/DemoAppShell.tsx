'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { embeddedAppShell } from '@/lib/embeddedAppShell'
import { Panel } from '@/components/ui'

export type DemoAppShellProps = {
  embedded?: boolean
  title: string
  hint: string
  status?: string
  children: ReactNode
}

/**
 * 演示应用统一壳：说明 + 内容 + 底栏状态。
 */
export function DemoAppShell({ embedded = false, title, hint, status, children }: DemoAppShellProps) {
  return (
    <div
      className={cn(
        embeddedAppShell(embedded, 'flex flex-col text-sm text-on-chrome bg-window font-pixel'),
        !embedded && 'p-4',
      )}
    >
      <div className={cn('flex-1 min-h-0 flex flex-col gap-2 overflow-hidden', embedded ? 'p-3' : 'p-2')}>
        <div className='shrink-0'>
          <h2 className='text-base font-bold'>{title}</h2>
          <p className='text-[11px] text-muted mt-0.5'>{hint}</p>
        </div>
        <Panel inset className='flex-1 min-h-0 overflow-y-auto space-y-3'>
          {children}
        </Panel>
      </div>
      {status != null && status !== '' && (
        <div className='shrink-0 px-3 py-1.5 border-t border-chrome-dark bg-status-bar text-[10px] text-status-bar-fg truncate'>
          {status}
        </div>
      )}
    </div>
  )
}
