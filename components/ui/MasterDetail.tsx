'use client'

import { Children, type ReactNode } from 'react'
import { ChevronLeft } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/cn'
import { useIsMobileViewport } from '@/hooks/desktop'
import { SplitPane, type SplitPaneProps } from './SplitPane'

export type MasterDetailProps = {
  /** [master 列表侧栏, detail 主内容] */
  children: ReactNode
  /**
   * 窄屏时是否显示详情。
   * 桌面端忽略，始终左右分栏。
   */
  detailOpen: boolean
  onDetailOpenChange: (open: boolean) => void
  /** 窄屏详情顶栏标题 */
  detailTitle?: string
  /** 窄屏返回按钮文案；默认用 mobile.backToList */
  backLabel?: string
  /** 是否显示窄屏详情顶栏（返回列表） */
  showMobileBack?: boolean
  className?: string
} & Pick<SplitPaneProps, 'defaultSize' | 'minSize' | 'maxSize' | 'storageKey' | 'handleLabel'>

/**
 * 桌面：可拖拽左右分栏。
 * 窄屏：列表 / 详情互斥全屏切换（带返回顶栏）。
 */
export function MasterDetail({
  children,
  detailOpen,
  onDetailOpenChange,
  detailTitle,
  backLabel,
  showMobileBack = true,
  className,
  defaultSize,
  minSize,
  maxSize,
  storageKey,
  handleLabel,
}: MasterDetailProps) {
  const t = useTranslations('mobile')
  const isMobile = useIsMobileViewport()
  const items = Children.toArray(children)
  const master = items[0] ?? null
  const detail = items[1] ?? null

  if (!isMobile) {
    return (
      <SplitPane
        className={className}
        defaultSize={defaultSize}
        minSize={minSize}
        maxSize={maxSize}
        storageKey={storageKey}
        handleLabel={handleLabel}
      >
        {master}
        {detail}
      </SplitPane>
    )
  }

  return (
    <div className={cn('flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden', className)}>
      {!detailOpen ? (
        <div className='flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden'>{master}</div>
      ) : (
        <div className='flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden'>
          {showMobileBack && (
            <div className='flex shrink-0 items-center gap-1 border-b border-chrome-dark bg-chrome-hover/40 px-1 py-1'>
              <button
                type='button'
                className='flex h-9 min-w-0 items-center gap-0.5 rounded-sm px-2 text-[12px] font-bold touch-manipulation active:bg-chrome-hover'
                onClick={() => onDetailOpenChange(false)}
              >
                <ChevronLeft className='size-4 shrink-0' strokeWidth={2.25} aria-hidden />
                <span className='truncate'>{backLabel ?? t('backToList')}</span>
              </button>
              {detailTitle ? (
                <span className='min-w-0 flex-1 truncate pr-2 text-right text-[11px] text-muted'>
                  {detailTitle}
                </span>
              ) : null}
            </div>
          )}
          <div className='flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden'>{detail}</div>
        </div>
      )}
    </div>
  )
}
