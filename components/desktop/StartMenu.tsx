'use client'

import { useEffect, useRef, useState, type ComponentType } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/cn'
import { winChrome } from '@/lib/winChrome'
import { confirmModal, alertModal } from '@/components/ui'
import {
  DESKTOP_APP_DEFINITIONS,
  type DesktopAppId,
} from '@/config/desktop'
import { useWindowStore } from '@/store/window'
import { useLockStore } from '@/store/lock'
import { promptSessionLockPassword } from './promptSessionLock'

type StartMenuProps = {
  open: boolean
  onClose: () => void
  onOpenApp: (id: DesktopAppId) => void
}

type MenuItemProps = {
  icon?: ComponentType<{ size?: number; className?: string }>
  label: string
  shortcut?: string
  hasSubmenu?: boolean
  active?: boolean
  onClick?: () => void
  onMouseEnter?: () => void
}

const LAUNCHABLE = DESKTOP_APP_DEFINITIONS.filter((app) => app.app)

function MenuItem({
  icon: Icon,
  label,
  shortcut,
  hasSubmenu,
  active,
  onClick,
  onMouseEnter,
}: MenuItemProps) {
  return (
    <button
      type='button'
      role='menuitem'
      className={cn(
        'w-full flex items-center gap-2 px-2 py-1.5 text-left text-[12px] outline-none cursor-default',
        active
          ? 'bg-[var(--window-title-active)] text-[var(--window-title-text)]'
          : 'text-on-chrome hover:bg-[var(--window-title-active)] hover:text-[var(--window-title-text)]',
      )}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
    >
      <span className='w-5 h-5 flex items-center justify-center shrink-0'>
        {Icon ? <Icon size={16} className='shrink-0' aria-hidden /> : null}
      </span>
      <span className='flex-1 min-w-0 truncate'>{label}</span>
      {shortcut ? <span className='opacity-70 text-[10px] shrink-0'>{shortcut}</span> : null}
      {hasSubmenu ? <ChevronRight size={14} className='shrink-0 opacity-80' aria-hidden /> : null}
    </button>
  )
}

function MenuSeparator() {
  return (
    <div role='separator' className='my-0.5 mx-1 h-[2px] bg-chrome-dark shadow-[0_1px_0_var(--chrome-light)]' />
  )
}

/**
 * Win95 风格开始菜单：程序列表、文档/设置/帮助、关闭与重启。
 */
export function StartMenu({ open, onClose, onOpenApp }: StartMenuProps) {
  const t = useTranslations()
  const ts = useTranslations('startMenu')
  const closeAllWindows = useWindowStore((s) => s.closeAllWindows)
  const lockWithPassword = useLockStore((s) => s.lockWithPassword)
  const rootRef = useRef<HTMLDivElement>(null)
  const [programsOpen, setProgramsOpen] = useState(false)

  useEffect(() => {
    if (!open) {
      setProgramsOpen(false)
      return
    }
    const onPointer = (e: MouseEvent) => {
      const target = e.target as Node
      if (rootRef.current?.contains(target)) return
      if ((e.target as HTMLElement | null)?.closest?.('[data-start-menu-root]')) return
      onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    const timer = window.setTimeout(() => {
      document.addEventListener('mousedown', onPointer)
      document.addEventListener('keydown', onKey)
    }, 0)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null

  const launch = (id: DesktopAppId) => {
    onOpenApp(id)
    onClose()
  }

  const handleLock = async () => {
    onClose()
    const password = await promptSessionLockPassword(ts('lockTitle'))
    if (!password) return
    await lockWithPassword(password)
  }

  const handleShutdown = async () => {
    onClose()
    const ok = await confirmModal({
      title: ts('shutdownTitle'),
      message: ts('shutdownConfirm'),
      confirmText: ts('shutdown'),
      cancelText: t('modal.cancel'),
    })
    if (!ok) return
    closeAllWindows()
    await alertModal({
      title: ts('shutdownTitle'),
      message: ts('shutdownDone'),
      okText: t('modal.ok'),
    })
  }

  const handleRestart = async () => {
    onClose()
    const ok = await confirmModal({
      title: ts('restartTitle'),
      message: ts('restartConfirm'),
      confirmText: ts('restart'),
      cancelText: t('modal.cancel'),
    })
    if (ok) window.location.reload()
  }

  return (
    <div
      ref={rootRef}
      role='menu'
      aria-label={t('index.home')}
      className={cn(
        winChrome,
        'absolute left-2 bottom-[calc(100%+2px)] z-[1200] flex min-w-[220px] shadow-[2px_2px_0_rgba(0,0,0,0.4)] font-pixel',
      )}
    >
      {/* 左侧品牌条 */}
      <div
        className='w-7 shrink-0 flex items-end justify-center py-2 bg-[var(--window-title-active)] text-[var(--window-title-text)]'
        aria-hidden
      >
        <span
          className='text-[11px] font-bold tracking-widest whitespace-nowrap'
          style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
        >
          {ts('brand')}
        </span>
      </div>

      <div className='flex-1 py-0.5 relative min-w-[180px]'>
        <div
          className='relative'
          onMouseEnter={() => setProgramsOpen(true)}
          onMouseLeave={() => setProgramsOpen(false)}
        >
          <MenuItem
            label={ts('programs')}
            hasSubmenu
            active={programsOpen}
            onClick={() => setProgramsOpen((v) => !v)}
            onMouseEnter={() => setProgramsOpen(true)}
          />
          {programsOpen && (
            <ul
              role='menu'
              className={cn(
                winChrome,
                'absolute left-full top-0 z-[1] min-w-[180px] max-h-[min(360px,70vh)] overflow-y-auto py-0.5 shadow-[2px_2px_0_rgba(0,0,0,0.35)]',
              )}
            >
              {LAUNCHABLE.map((app) => {
                const Icon = app.icon
                return (
                  <li key={app.id} role='none'>
                    <MenuItem
                      icon={Icon}
                      label={t(`apps.${app.id}`)}
                      onClick={() => launch(app.id)}
                    />
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <MenuItem label={ts('documents')} onClick={() => launch('document')} onMouseEnter={() => setProgramsOpen(false)} />
        <MenuItem label={ts('settings')} onClick={() => launch('settings')} onMouseEnter={() => setProgramsOpen(false)} />
        <MenuSeparator />
        <MenuItem label={ts('help')} onClick={() => launch('log')} onMouseEnter={() => setProgramsOpen(false)} />
        <MenuSeparator />
        <MenuItem label={ts('lock')} onClick={() => void handleLock()} onMouseEnter={() => setProgramsOpen(false)} />
        <MenuItem label={ts('restart')} onClick={handleRestart} onMouseEnter={() => setProgramsOpen(false)} />
        <MenuItem label={ts('shutdown')} onClick={handleShutdown} onMouseEnter={() => setProgramsOpen(false)} />
      </div>
    </div>
  )
}
