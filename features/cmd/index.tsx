'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/cn'
import { embeddedAppShell } from '@/lib/embeddedAppShell'
import type { DesktopAppId } from '@/config/desktop'
import { useDesktopItemsStore } from '@/store/desktopItems'
import { getDesktopWindow } from '@/lib/desktop/window'
import {
  formatCmdPath,
  runCmdCommand,
  type CmdLine,
} from './commands'

export type CmdAppProps = {
  embedded?: boolean
}

/**
 * 简易 DOS 风格命令提示符。
 */
export function CmdApp({ embedded = false }: CmdAppProps) {
  const t = useTranslations('cmd')
  const items = useDesktopItemsStore((s) => s.items)
  const [cwd, setCwd] = useState<DesktopAppId | null>(null)
  const [lines, setLines] = useState<CmdLine[]>(() => [
    {
      id: 'boot-1',
      kind: 'sys',
      text: t('boot1'),
    },
    {
      id: 'boot-2',
      kind: 'sys',
      text: t('boot2'),
    },
    {
      id: 'boot-3',
      kind: 'out',
      text: '',
    },
  ])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const promptPath = formatCmdPath(items, cwd, t('desktop'))

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [lines, busy])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const appendEcho = useCallback((path: string, command: string) => {
    setLines((prev) => [
      ...prev,
      {
        id: `echo-${Date.now()}`,
        kind: 'out',
        text: `${path}>${command}`,
      },
    ])
  }, [])

  const onSubmit = useCallback(async () => {
    if (busy) return
    const command = input
    const pathBefore = formatCmdPath(useDesktopItemsStore.getState().items, cwd, t('desktop'))
    setInput('')
    appendEcho(pathBefore, command)

    const trimmed = command.trim()
    if (!trimmed) return

    setBusy(true)
    try {
      const result = await runCmdCommand(command, { cwd, t })
      if (result.clear) {
        setLines([])
      } else if (result.lines.length) {
        setLines((prev) => [...prev, ...result.lines])
      }
      if (result.cwd !== undefined) {
        setCwd(result.cwd)
      }
      if (result.exit) {
        window.setTimeout(() => {
          try {
            getDesktopWindow('cmd')?.close()
          } catch {
            // ignore
          }
        }, 200)
      }
    } finally {
      setBusy(false)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [busy, input, cwd, t, appendEcho])

  return (
    <div
      className={cn(
        embeddedAppShell(embedded, 'flex flex-col font-mono text-[12px] bg-[#0c0c0c] text-[#c0c0c0]'),
        !embedded && 'p-0',
      )}
      onClick={() => inputRef.current?.focus()}
    >
      <div
        ref={scrollRef}
        className='flex-1 min-h-0 overflow-auto px-2 py-2 space-y-0.5 select-text'
      >
        {lines.map((line) => (
          <div
            key={line.id}
            className={cn(
              'whitespace-pre-wrap break-all leading-snug',
              line.kind === 'err' && 'text-[#ff6b6b]',
              line.kind === 'sys' && 'text-[#6bcb77]',
            )}
          >
            {line.text || '\u00a0'}
          </div>
        ))}

        <div className='flex items-start gap-0 leading-snug'>
          <span className='shrink-0 text-[#c0c0c0]'>{promptPath}&gt;</span>
          <input
            ref={inputRef}
            value={input}
            disabled={busy}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void onSubmit()
              }
            }}
            spellCheck={false}
            autoComplete='off'
            autoCapitalize='off'
            className={cn(
              'flex-1 min-w-0 bg-transparent border-0 outline-none p-0 m-0',
              'text-[#c0c0c0] caret-[#c0c0c0] font-mono text-[12px]',
              'disabled:opacity-60',
            )}
            aria-label={t('inputLabel')}
          />
        </div>
      </div>
    </div>
  )
}
