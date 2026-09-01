'use client'

import { useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useShallow } from 'zustand/react/shallow'
import { cn } from '@/lib/cn'
import { embeddedAppShell } from '@/lib/embeddedAppShell'
import { Button, Panel, toast } from '@/components/ui'
import type { DesktopAppId, DesktopAppView } from '@/config/desktop'
import { resolveDesktopItemTitle } from '@/lib/desktop/window'
import { useDesktopApps, useDesktopHydrated, useIsMobileViewport } from '@/hooks/desktop'
import { useWindowStore } from '@/store/window'

type RunningRow = {
  id: DesktopAppId
  title: string
  statusKey: 'statusActive' | 'statusMinimized' | 'statusRunning'
  Icon: DesktopAppView['icon']
}

type TabId = 'applications' | 'programs'

/**
 * 仿 Windows 任务管理器：运行窗口 + 程序列表；结束任务 / 切换 / 最小化全部。
 * 状态统一来自 window store（生命周期由 open/close/minimize/forceClose 维护）。
 */
export function TaskManagerApp() {
  const t = useTranslations('taskManager')
  const tApps = useTranslations('apps')
  const locale = useLocale()
  const isMobile = useIsMobileViewport()
  const apps = useDesktopApps()
  const hasHydrated = useDesktopHydrated()
  const { openWindow, forceCloseWindow, minimizeAllWindows } = useWindowStore(
    useShallow((s) => ({
      openWindow: s.openWindow,
      forceCloseWindow: s.forceCloseWindow,
      minimizeAllWindows: s.minimizeAllWindows,
    })),
  )

  const [tab, setTab] = useState<TabId>('applications')
  const [selectedId, setSelectedId] = useState<Nullable<DesktopAppId>>(null)

  const running = useMemo((): RunningRow[] => {
    if (!hasHydrated) return []
    return apps
      .filter((a) => a.isOpen && a.app && a.id !== 'taskManager')
      .slice()
      .sort((a, b) => a.openOrder - b.openOrder || b.zIndex - a.zIndex)
      .map((a) => {
        let statusKey: RunningRow['statusKey'] = 'statusRunning'
        if (a.minimized) statusKey = 'statusMinimized'
        else if (a.active) statusKey = 'statusActive'
        return {
          id: a.id,
          title: resolveDesktopItemTitle(a, tApps, locale),
          statusKey,
          Icon: a.icon,
        }
      })
  }, [apps, hasHydrated, tApps, locale])

  const programs = useMemo(() => {
    if (!hasHydrated) return []
    return apps
      .filter((a) => a.app && a.showInStartMenu !== false && a.id !== 'taskManager')
      .slice()
      .sort((a, b) =>
        resolveDesktopItemTitle(a, tApps, locale).localeCompare(resolveDesktopItemTitle(b, tApps, locale), undefined, {
          sensitivity: 'base',
        }),
      )
  }, [apps, hasHydrated, tApps, locale])

  const selectedRunning = running.find((r) => r.id === selectedId) ?? null
  const selectedProgram = programs.find((p) => p.id === selectedId) ?? null

  const onEndTask = () => {
    if (!selectedRunning) {
      toast.warning(t('selectFirst'))
      return
    }
    const { id, title } = selectedRunning
    forceCloseWindow(id)
    setSelectedId(null)
    toast.success(t('ended', { name: title }))
  }

  const onSwitchTo = (id?: DesktopAppId) => {
    const targetId = id ?? selectedRunning?.id
    if (!targetId) {
      toast.warning(t('selectFirst'))
      return
    }
    setSelectedId(targetId)
    openWindow(targetId)
  }

  const onMinimizeAll = () => {
    const visibleCount = running.filter((r) => r.statusKey !== 'statusMinimized').length
    if (visibleCount === 0) {
      toast.warning(t('alreadyMinimized'))
      return
    }
    minimizeAllWindows({ excludeIds: ['taskManager'] })
    toast.success(t('minimizedAll', { count: visibleCount }))
  }

  const onRunProgram = (id?: DesktopAppId) => {
    const prog = id ? programs.find((p) => p.id === id) : selectedProgram
    if (!prog) {
      toast.warning(t('selectFirst'))
      return
    }
    const title = resolveDesktopItemTitle(prog, tApps, locale)
    openWindow(prog.id)
    setTab('applications')
    setSelectedId(prog.id)
    toast.success(t('launched', { name: title }))
  }

  return (
    <div className={cn(embeddedAppShell(), 'flex flex-col bg-chrome text-on-chrome p-2 gap-2 max-md:p-2.5')}>
      <div className='text-xs font-bold px-0.5 max-md:text-sm'>{t('title')}</div>
      <p className='text-[10px] text-muted px-0.5 -mt-1 max-md:text-[11px]'>{t('hint')}</p>

      <div className='flex items-end gap-0.5 px-0.5' role='tablist'>
        {(
          [
            ['applications', 'tabApplications'],
            ['programs', 'tabPrograms'],
          ] as const
        ).map(([id, labelKey]) => {
          const active = tab === id
          return (
            <button
              key={id}
              type='button'
              role='tab'
              aria-selected={active}
              className={cn(
                'px-3 h-6 text-[11px] border-2 font-pixel text-on-chrome touch-manipulation max-md:h-8 max-md:px-3.5 max-md:text-[12px]',
                active
                  ? 'border-t-chrome-light border-l-chrome-light border-r-chrome-dark border-b-chrome bg-chrome relative top-px z-[1] font-bold'
                  : 'border-t-chrome-light border-l-chrome-light border-r-chrome-dark border-b-chrome-dark bg-chrome hover:brightness-105',
              )}
              onClick={() => {
                setTab(id)
                setSelectedId(null)
              }}
            >
              {t(labelKey)}
            </button>
          )
        })}
      </div>

      {tab === 'applications' ? (
        <>
          <Panel inset className='flex-1 min-h-0 flex flex-col p-0 overflow-hidden -mt-px'>
            <div className='grid grid-cols-[1fr_7rem] gap-0 border-b border-chrome-dark bg-chrome px-2 py-1 text-[10px] font-bold shrink-0 max-md:py-1.5'>
              <span>{t('colTask')}</span>
              <span>{t('colStatus')}</span>
            </div>
            <ul
              className='flex-1 min-h-0 overflow-y-auto bg-field text-on-field'
              role='listbox'
              aria-label={t('tabApplications')}
            >
              {running.length === 0 ? (
                <li className='px-2 py-6 text-center text-[11px] text-muted'>{t('emptyRunning')}</li>
              ) : (
                running.map((row) => {
                  const selected = selectedId === row.id
                  const Icon = row.Icon
                  return (
                    <li key={row.id}>
                      <button
                        type='button'
                        role='option'
                        aria-selected={selected}
                        className={cn(
                          'w-full grid grid-cols-[1fr_7rem] gap-0 items-center px-2 h-7 text-left text-xs touch-manipulation',
                          'max-md:min-h-11 max-md:h-auto max-md:py-2.5 max-md:text-[13px]',
                          'hover:bg-icon-select/30 focus-visible:outline-none focus-visible:bg-icon-select/40',
                          selected && 'bg-icon-select text-icon-select-fg',
                        )}
                        onClick={() => {
                          setSelectedId(row.id)
                          // 触屏无双击：单击直接切换到该窗口
                          if (isMobile) onSwitchTo(row.id)
                        }}
                        onDoubleClick={() => {
                          if (isMobile) return
                          setSelectedId(row.id)
                          openWindow(row.id)
                        }}
                      >
                        <span className='min-w-0 flex items-center gap-1.5 truncate'>
                          <Icon size={14} strokeWidth={1.75} className='shrink-0 max-md:size-4' aria-hidden />
                          <span className='truncate'>{row.title}</span>
                        </span>
                        <span className='truncate text-[11px] max-md:text-[12px]'>{t(row.statusKey)}</span>
                      </button>
                    </li>
                  )
                })
              )}
            </ul>
          </Panel>

          <div className='flex flex-wrap gap-2 shrink-0'>
            <Button size='sm' className='max-md:min-h-9' disabled={!selectedRunning} onClick={onEndTask}>
              {t('endTask')}
            </Button>
            <Button size='sm' className='max-md:min-h-9' disabled={!selectedRunning} onClick={() => onSwitchTo()}>
              {t('switchTo')}
            </Button>
            <Button size='sm' className='max-md:min-h-9' onClick={onMinimizeAll}>
              {t('minimizeAll')}
            </Button>
          </div>
          <p className='text-[10px] text-muted max-md:text-[11px]'>{t('runningCount', { count: running.length })}</p>
        </>
      ) : (
        <>
          <Panel inset className='flex-1 min-h-0 flex flex-col p-0 overflow-hidden -mt-px'>
            <div className='border-b border-chrome-dark bg-chrome px-2 py-1 text-[10px] font-bold shrink-0 max-md:py-1.5'>
              {t('colProgram')}
            </div>
            <ul
              className='flex-1 min-h-0 overflow-y-auto bg-field text-on-field'
              role='listbox'
              aria-label={t('tabPrograms')}
            >
              {programs.map((prog) => {
                const selected = selectedId === prog.id
                const Icon = prog.icon
                const title = resolveDesktopItemTitle(prog, tApps, locale)
                return (
                  <li key={prog.id}>
                    <button
                      type='button'
                      role='option'
                      aria-selected={selected}
                      className={cn(
                        'w-full flex items-center gap-1.5 px-2 h-7 text-left text-xs touch-manipulation',
                        'max-md:min-h-11 max-md:h-auto max-md:py-2.5 max-md:text-[13px]',
                        'hover:bg-icon-select/30 focus-visible:outline-none focus-visible:bg-icon-select/40',
                        selected && 'bg-icon-select text-icon-select-fg',
                      )}
                      onClick={() => {
                        setSelectedId(prog.id)
                        // 触屏无双击：单击直接运行
                        if (isMobile) onRunProgram(prog.id)
                      }}
                      onDoubleClick={() => {
                        if (isMobile) return
                        setSelectedId(prog.id)
                        openWindow(prog.id)
                        setTab('applications')
                      }}
                    >
                      <Icon size={14} strokeWidth={1.75} className='shrink-0 max-md:size-4' aria-hidden />
                      <span className='min-w-0 flex-1 truncate'>{title}</span>
                      {prog.isOpen ? (
                        <span className='shrink-0 text-[10px] opacity-80 max-md:text-[11px]'>{t('badgeRunning')}</span>
                      ) : null}
                    </button>
                  </li>
                )
              })}
            </ul>
          </Panel>

          <div className='flex flex-wrap gap-2 shrink-0'>
            <Button size='sm' className='max-md:min-h-9' disabled={!selectedProgram} onClick={() => onRunProgram()}>
              {t('run')}
            </Button>
          </div>
          <p className='text-[10px] text-muted max-md:text-[11px]'>{t('programCount', { count: programs.length })}</p>
        </>
      )}
    </div>
  )
}
