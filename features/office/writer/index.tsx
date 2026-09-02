'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/cn'
import { embeddedAppShell } from '@/lib/embeddedAppShell'
import { modal, toast } from '@/components/ui'
import { winChromeSunken } from '@/lib/winChrome'
import { useWindowStore } from '@/store/window'
import { findOfficeWindowByFile, getOfficeWindow } from '@/lib/desktop/window/officeWindows'
import { useOfficeStore } from '../store'
import { pickOfficeFile } from '../fileDialog'
import { EMPTY_WRITER } from '../schema'
import { fetchOfficeByPath, fetchOfficeFile, saveWriterAtPath, updateWriterFile } from '../vfsApi'
import { officeKindFromPath } from '../fileTypes'
import { preventVfsFileDrag, vfsPathsFromDrag } from '@/lib/desktop/vfsDrop'
import { htmlToPlainText, sanitizeWriterHtml } from './sanitize'
import { exportWriterDocx, exportWriterPdf, exportWriterTxt } from './exportDoc'
import { WriterToolbar, type WriterAlign, type WriterCommand, type WriterFormat } from './WriterToolbar'
import { WriterRuler } from './WriterRuler'

const AUTO_SAVE_MS = 30_000

function currentBlock(): string {
  try {
    const tag = document.queryCommandValue('formatBlock').toLowerCase()
    if (tag === 'h1') return 'h1'
    if (tag === 'h2' || tag === 'h3') return 'h2'
    return 'p'
  } catch {
    return 'p'
  }
}

function currentColor(): string {
  try {
    const v = document.queryCommandValue('foreColor')
    return v || '#000000'
  } catch {
    return '#000000'
  }
}

function queryFlag(cmd: string): boolean {
  try {
    return document.queryCommandState(cmd)
  } catch {
    return false
  }
}

function currentAlign(): WriterAlign {
  if (queryFlag('justifyCenter')) return 'center'
  if (queryFlag('justifyRight')) return 'right'
  if (queryFlag('justifyFull')) return 'justify'
  return 'left'
}

function readFormat(): WriterFormat {
  return {
    block: currentBlock(),
    color: currentColor(),
    bold: queryFlag('bold'),
    italic: queryFlag('italic'),
    underline: queryFlag('underline'),
    list: queryFlag('insertUnorderedList'),
    align: currentAlign(),
  }
}

function writerStats(html: string): { lines: number; chars: number } {
  const text = htmlToPlainText(html)
  const chars = [...text.replace(/\s/g, '')].length
  const lineParts = text.split(/\n/).filter((s) => s.trim().length > 0)
  return { chars, lines: Math.max(1, lineParts.length || (text ? 1 : 1)) }
}

type Props = {
  windowId?: string
  initialFileId?: Nullable<string>
}

export function WriterApp({ windowId, initialFileId }: Props = {}) {
  const t = useTranslations('writer')
  const tm = useTranslations('modal')
  const hydrated = useOfficeStore((s) => s._hasHydrated)
  const lastWriterId = useOfficeStore((s) => s.lastWriterId)
  const setLastOpened = useOfficeStore((s) => s.setLastOpened)
  const hostId = windowId ?? 'writer'
  const isActive = useWindowStore((s) => {
    const w = s.windows[hostId]
    return Boolean(w?.isOpen && w.active && !w.minimized)
  })

  const editorRef = useRef<HTMLDivElement>(null)
  const htmlRef = useRef(EMPTY_WRITER.html)
  const dirtyRef = useRef(false)
  const fileIdRef = useRef<Nullable<string>>(null)
  const booted = useRef(false)

  const [fileId, setFileId] = useState<Nullable<string>>(null)
  const [name, setName] = useState(t('untitled'))
  const [html, setHtml] = useState(EMPTY_WRITER.html)
  const [savedHtml, setSavedHtml] = useState(EMPTY_WRITER.html)
  const [format, setFormat] = useState<WriterFormat>(readFormat)
  const [exporting, setExporting] = useState(false)

  htmlRef.current = html
  fileIdRef.current = fileId
  const dirty = html !== savedHtml
  dirtyRef.current = dirty
  const stats = writerStats(html)

  const syncFormat = () => setFormat(readFormat())

  const applyFile = useCallback(
    (id: string, nextName: string, nextHtml: string) => {
      const clean = sanitizeWriterHtml(nextHtml)
      setFileId(id)
      setName(nextName)
      setHtml(clean)
      setSavedHtml(clean)
      htmlRef.current = clean
      setLastOpened('writer', id)
      const el = editorRef.current
      if (el) el.innerHTML = clean
    },
    [setLastOpened],
  )

  const applyBlank = useCallback(() => {
    const clean = EMPTY_WRITER.html
    setFileId(null)
    setName(t('untitled'))
    setHtml(clean)
    setSavedHtml(clean)
    htmlRef.current = clean
    setLastOpened('writer', null)
    const el = editorRef.current
    if (el) el.innerHTML = clean
  }, [setLastOpened, t])

  const openById = useCallback(
    async (id: string) => {
      const file = await fetchOfficeFile(id)
      if (file.kind !== 'writer') throw new Error('not writer')
      applyFile(file.id, file.name, file.writer?.html ?? EMPTY_WRITER.html)
    },
    [applyFile],
  )

  useEffect(() => {
    if (!hydrated || booted.current) return
    booted.current = true
    void (async () => {
      const prefer = initialFileId || (!windowId ? lastWriterId : null)
      if (prefer) {
        try {
          await openById(prefer)
          return
        } catch {
          /* 空白文档 */
        }
      }
      applyBlank()
    })()
  }, [applyBlank, hydrated, initialFileId, lastWriterId, openById, windowId])

  useEffect(() => {
    const el = editorRef.current
    if (el) el.innerHTML = htmlRef.current
  }, [fileId])

  useEffect(() => {
    if (!windowId) return
    getOfficeWindow(windowId)?.setFileMeta(fileId, name, dirty)
  }, [dirty, fileId, name, windowId])

  const confirmDiscard = useCallback(async () => {
    if (!dirtyRef.current) return true
    return modal.confirm({ title: tm('confirmTitle'), message: t('confirmDiscard') })
  }, [t, tm])

  const readEditor = () => sanitizeWriterHtml(editorRef.current?.innerHTML ?? htmlRef.current)

  const persistExisting = useCallback(
    async (id: string, nextName?: string, silent = false) => {
      const next = readEditor()
      setHtml(next)
      try {
        const saved = await updateWriterFile(id, { html: next, name: nextName })
        setSavedHtml(next)
        setName(saved.name)
        setFileId(saved.id)
        setLastOpened('writer', saved.id)
        if (!silent) toast.success(t('savedOk'))
        return true
      } catch {
        if (!silent) toast.error(t('saveFail'))
        return false
      }
    },
    [setLastOpened, t],
  )

  const persistToPath = useCallback(
    async (path: string) => {
      const next = readEditor()
      setHtml(next)
      try {
        const saved = await saveWriterAtPath(path, next)
        applyFile(saved.id, saved.name, next)
        toast.success(t('savedOk'))
        return true
      } catch {
        toast.error(t('saveFail'))
        return false
      }
    },
    [applyFile, t],
  )

  const onNew = async () => {
    if (!(await confirmDiscard())) return
    applyBlank()
  }

  const onOpen = async () => {
    if (!(await confirmDiscard())) return
    const picked = await pickOfficeFile({
      kind: 'writer',
      mode: 'open',
      title: t('openTitle'),
      confirmLabel: t('open'),
      nameLabel: t('fileName'),
      emptyLabel: t('emptyList'),
    })
    if (!picked) return
    if (!picked.file) {
      toast.error(t('loadFail'))
      return
    }
    if (windowId) {
      const other = findOfficeWindowByFile('writer', picked.file.id)
      if (other && other.id !== windowId) {
        other.open()
        return
      }
    }
    applyFile(picked.file.id, picked.file.name, picked.file.writer?.html ?? EMPTY_WRITER.html)
  }

  const onSaveAs = async () => {
    const picked = await pickOfficeFile({
      kind: 'writer',
      mode: 'save',
      title: t('saveAsTitle'),
      confirmLabel: t('save'),
      nameLabel: t('fileName'),
      emptyLabel: t('emptyList'),
      defaultName: name,
    })
    if (!picked) return
    if (picked.id) {
      await persistExisting(picked.id, picked.name)
      return
    }
    await persistToPath(picked.path)
  }

  const onSave = () => {
    if (fileId) void persistExisting(fileId)
    else void onSaveAs()
  }

  const onExport = async (kind: 'pdf' | 'docx' | 'txt') => {
    const next = readEditor()
    setExporting(true)
    try {
      if (kind === 'txt') exportWriterTxt(next, name)
      else if (kind === 'docx') exportWriterDocx(next, name)
      else await exportWriterPdf(next, name)
      toast.success(t('exported'))
    } catch {
      toast.error(t('exportFail'))
    } finally {
      setExporting(false)
    }
  }

  const run = (cmd: string, value?: string) => {
    editorRef.current?.focus()
    try {
      document.execCommand(cmd, false, value)
    } catch {
      /* ignore */
    }
    setHtml(readEditor())
    syncFormat()
  }

  useEffect(() => {
    if (!fileId || !dirty) return
    const timer = window.setTimeout(() => {
      const id = fileIdRef.current
      if (id && dirtyRef.current) void persistExisting(id, undefined, true)
    }, AUTO_SAVE_MS)
    return () => window.clearTimeout(timer)
  }, [dirty, fileId, html, persistExisting])

  useEffect(() => {
    if (!isActive) return
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return
      const key = e.key.toLowerCase()
      if (key === 's') {
        e.preventDefault()
        onSave()
      } else if (key === 'n') {
        e.preventDefault()
        void onNew()
      } else if (key === 'o') {
        e.preventDefault()
        void onOpen()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div
      className={cn(embeddedAppShell('flex flex-col bg-window text-on-chrome font-pixel'))}
      onDragOver={preventVfsFileDrag}
      onDrop={(e) => {
        e.preventDefault()
        const path = vfsPathsFromDrag(e).find((p) => officeKindFromPath(p) === 'writer')
        if (!path) return
        void (async () => {
          if (!(await confirmDiscard())) return
          try {
            const file = await fetchOfficeByPath(path)
            applyFile(file.id, file.name, file.writer?.html ?? EMPTY_WRITER.html)
          } catch {
            toast.error(t('loadFail'))
          }
        })()
      }}
    >
      <WriterToolbar
        format={format}
        exporting={exporting}
        onCommand={(cmd: WriterCommand) => {
          if (cmd === 'h1') run('formatBlock', '<h1>')
          else if (cmd === 'h2') run('formatBlock', '<h2>')
          else if (cmd === 'p') run('formatBlock', '<p>')
          else if (cmd === 'ul') run('insertUnorderedList')
          else run(cmd)
        }}
        onColor={(c) => run('foreColor', c)}
        onNew={() => void onNew()}
        onOpen={() => void onOpen()}
        onSave={onSave}
        onSaveAs={() => void onSaveAs()}
        onExport={(k) => void onExport(k)}
      />

      <div className='flex-1 min-h-0 p-2 flex flex-col gap-1'>
        <WriterRuler />
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          spellCheck={false}
          className={cn(
            winChromeSunken,
            'flex-1 min-h-0 overflow-auto bg-field text-on-chrome p-3 text-[13px] leading-relaxed outline-none',
            '[&_h1]:text-[22px] [&_h1]:font-bold [&_h1]:m-0 [&_h1]:mb-2',
            '[&_h2]:text-[16px] [&_h2]:font-bold [&_h2]:m-0 [&_h2]:mb-2',
            '[&_p]:m-0 [&_p]:mb-2 [&_ul]:m-0 [&_ul]:pl-5',
          )}
          onInput={() => {
            setHtml(readEditor())
            syncFormat()
          }}
          onMouseUp={syncFormat}
          onKeyUp={syncFormat}
        />
      </div>

      <div className='shrink-0 px-2 py-0.5 border-t border-chrome-dark bg-status-bar text-[10px] text-status-bar-fg flex justify-between gap-2'>
        <span className='truncate min-w-0'>
          {name} · {t('lines', { count: stats.lines })} · {t('words', { count: stats.chars })}
        </span>
        <span className={cn('shrink-0 font-bold', dirty ? 'text-red-700 dark:text-red-400' : 'text-status-bar-fg')}>
          {dirty ? t('unsaved') : t('saved')}
        </span>
      </div>
    </div>
  )
}
