'use client'

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentType,
} from 'react'
import { useTranslations } from 'next-intl'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/cn'
import { winChrome } from '@/lib/winChrome'
import { confirmModal, alertModal } from '@/components/ui'
import { type DesktopAppId } from '@/config/desktop'
import {
  getDesktopAppDefinitionsSnapshot,
  resolveDesktopItemTitle,
  subscribeDesktopRegistry,
} from '@/lib/desktop/window'
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

function MenuItem({ icon: Icon, label, shortcut, hasSubmenu, active, onClick, onMouseEnter }: MenuItemProps) {
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
  return <div role='separator' className='my-0.5 mx-1 h-[2px] bg-chrome-dark shadow-[0_1px_0_var(--chrome-light)]' />
}

/** 预留任务栏高度，避免子菜单被挡住 */
const TASKBAR_SAFE = 48

/**
 * Win95 风格开始菜单：程序列表、文档/设置/帮助、关闭与重启。
 */
export function StartMenu({ open, onClose, onOpenApp }: StartMenuProps) {
  const t = useTranslations()
  const tApps = useTranslations('apps')
  const ts = useTranslations('startMenu')
  const closeAllWindows = useWindowStore((s) => s.closeAllWindows)
  const lockWithPassword = useLockStore((s) => s.lockWithPassword)
  const rootRef = useRef<HTMLDivElement>(null)
  const programsWrapRef = useRef<HTMLDivElement>(null)
  const submenuRef = useRef<HTMLUListElement>(null)
  const [programsOpen, setProgramsOpen] = useState(false)
  const [submenuOffsetTop, setSubmenuOffsetTop] = useState(0)
  const [submenuMaxHeight, setSubmenuMaxHeight] = useState<number | undefined>(undefined)

  const definitions = useSyncExternalStore(
    subscribeDesktopRegistry,
    getDesktopAppDefinitionsSnapshot,
    getDesktopAppDefinitionsSnapshot,
  )
  const launchable = useMemo(
    () => definitions.filter((app) => app.app && app.showInStartMenu !== false),
    [definitions],
  )

  useLayoutEffect(() => {
    if (!programsOpen) {
      setSubmenuOffsetTop(0)
      setSubmenuMaxHeight(undefined)
      return
    }
    const submenu = submenuRef.current
    const wrap = programsWrapRef.current
    if (!submenu || !wrap) return

    // 先解除限制以便测真实高度，再按视口上移/限高
    submenu.style.top = '0px'
    submenu.style.maxHeight = 'none'
    const wrapTop = wrap.getBoundingClientRect().top
    const maxBottom = window.innerHeight - TASKBAR_SAFE
    const contentH = submenu.scrollHeight
    const height = Math.min(contentH, Math.max(120, maxBottom - 4))
    let top = wrapTop
    if (top + height > maxBottom) top = maxBottom - height
    if (top < 4) top = 4
    setSubmenuOffsetTop(top - wrapTop)
    setSubmenuMaxHeight(maxBottom - top)
  }, [programsOpen, launchable.length])

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
        'absolute left-0 bottom-[calc(100%+2px)] z-[10000] flex min-w-[220px] overflow-visible shadow-[2px_2px_0_rgba(0,0,0,0.4)] font-pixel',
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

      <div className='flex-1 py-1 relative min-w-[180px] overflow-visible'>
        <div
          ref={programsWrapRef}
          className='relative overflow-visible'
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
              ref={submenuRef}
              role='menu'
              className={cn(
                winChrome,
                'absolute left-full z-[1] min-w-[180px] overflow-y-auto overflow-x-hidden py-1',
                'shadow-[2px_2px_0_rgba(0,0,0,0.35)]',
              )}
              style={{
                top: submenuOffsetTop,
                maxHeight: submenuMaxHeight,
              }}
            >
              {launchable.map((app) => {
                const Icon = app.icon
                return (
                  <li key={app.id} role='none'>
                    <MenuItem
                      icon={Icon}
                      label={resolveDesktopItemTitle(app, tApps)}
                      onClick={() => launch(app.id)}
                    />
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <MenuItem
          label={ts('documents')}
          onClick={() => launch('document')}
          onMouseEnter={() => setProgramsOpen(false)}
        />
        <MenuItem
          label={ts('settings')}
          onClick={() => launch('settings')}
          onMouseEnter={() => setProgramsOpen(false)}
        />
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
