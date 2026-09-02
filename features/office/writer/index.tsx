'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/cn'
import { embeddedAppShell } from '@/lib/embeddedAppShell'
import { modal, toast } from '@/components/ui'
import { winChromeSunken } from '@/lib/winChrome'
import { useOfficeStore } from '../store'
import { pickOfficeFile } from '../fileDialog'
import { EMPTY_WRITER } from '../schema'
import { subscribeOpenOfficeFile, takePendingOpenOfficeFile } from '../pendingOpen'
import { createOfficeFile, fetchOfficeFile, updateWriterFile } from '../vfsApi'
import { sanitizeWriterHtml } from './sanitize'
import { exportWriterDocx, exportWriterPdf, exportWriterTxt } from './exportDoc'
import { WriterToolbar } from './WriterToolbar'

let writerSessionBooted = false

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

export function WriterApp() {
  const t = useTranslations('writer')
  const tm = useTranslations('modal')
  const hydrated = useOfficeStore((s) => s._hasHydrated)
  const lastWriterId = useOfficeStore((s) => s.lastWriterId)
  const setLastOpened = useOfficeStore((s) => s.setLastOpened)

  const editorRef = useRef<HTMLDivElement>(null)
  const htmlRef = useRef(EMPTY_WRITER.html)
  const savedRef = useRef(EMPTY_WRITER.html)
  const dirtyRef = useRef(false)

  const [fileId, setFileId] = useState<Nullable<string>>(null)
  const [name, setName] = useState(t('untitled'))
  const [html, setHtml] = useState(EMPTY_WRITER.html)
  const [block, setBlock] = useState('p')
  const [color, setColor] = useState('#000000')
  const [exporting, setExporting] = useState(false)

  htmlRef.current = html
  const dirty = html !== savedRef.current
  dirtyRef.current = dirty

  const applyFile = useCallback(
    (id: string, nextName: string, nextHtml: string) => {
      const clean = sanitizeWriterHtml(nextHtml)
      setFileId(id)
      setName(nextName)
      setHtml(clean)
      savedRef.current = clean
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
    savedRef.current = clean
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
    if (!hydrated || writerSessionBooted) return
    writerSessionBooted = true
    void (async () => {
      const prefer = takePendingOpenOfficeFile('writer') || lastWriterId
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
  }, [applyBlank, hydrated, lastWriterId, openById])

  useEffect(() => {
    const el = editorRef.current
    if (el) el.innerHTML = htmlRef.current
  }, [fileId])

  const confirmDiscard = useCallback(async () => {
    if (!dirtyRef.current) return true
    return modal.confirm({ title: tm('confirmTitle'), message: t('confirmDiscard') })
  }, [t, tm])

  useEffect(
    () =>
      subscribeOpenOfficeFile('writer', (id) => {
        void (async () => {
          if (id === fileId) return
          if (!(await confirmDiscard())) return
          try {
            await openById(id)
          } catch {
            toast.error(t('loadFail'))
          }
        })()
      }),
    [confirmDiscard, fileId, openById, t],
  )

  const readEditor = () => sanitizeWriterHtml(editorRef.current?.innerHTML ?? htmlRef.current)

  const persistExisting = useCallback(
    async (id: string, nextName?: string) => {
      const next = readEditor()
      setHtml(next)
      try {
        const saved = await updateWriterFile(id, { html: next, name: nextName })
        savedRef.current = next
        setName(saved.name)
        setFileId(saved.id)
        setLastOpened('writer', saved.id)
        toast.success(t('savedOk'))
        return true
      } catch {
        toast.error(t('saveFail'))
        return false
      }
    },
    [setLastOpened, t],
  )

  const persistNew = useCallback(
    async (nextName: string) => {
      const next = readEditor()
      setHtml(next)
      try {
        const created = await createOfficeFile('writer', { name: nextName, html: next })
        applyFile(created.id, created.name, next)
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
    applyFile(picked.file.id, picked.file.name, picked.file.writer?.html ?? EMPTY_WRITER.html)
  }

  const onSave = () => {
    if (fileId) void persistExisting(fileId)
    else void persistNew(name)
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
    await persistNew(picked.name)
  }

  const onExport = async (kind: 'pdf' | 'docx' | 'txt') => {
    const next = readEditor()
    setExporting(true)
    try {
      if (kind === 'txt') exportWriterTxt(next, name)
      else if (kind === 'docx') await exportWriterDocx(next, name)
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
    setBlock(currentBlock())
    setColor(currentColor())
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        onSave()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className={cn(embeddedAppShell('flex flex-col bg-window text-on-chrome font-pixel'))}>
      <WriterToolbar
        block={block}
        color={color}
        exporting={exporting}
        onCommand={(cmd) => {
          if (cmd === 'bold') run('bold')
          else if (cmd === 'ul') run('insertUnorderedList')
          else if (cmd === 'h1') run('formatBlock', '<h1>')
          else if (cmd === 'h2') run('formatBlock', '<h2>')
          else run('formatBlock', '<p>')
        }}
        onColor={(c) => run('foreColor', c)}
        onNew={() => void onNew()}
        onOpen={() => void onOpen()}
        onSave={onSave}
        onSaveAs={() => void onSaveAs()}
        onExport={(k) => void onExport(k)}
      />

      <div className='flex-1 min-h-0 p-2'>
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          spellCheck={false}
          className={cn(
            winChromeSunken,
            'h-full overflow-auto bg-field text-on-chrome p-3 text-[13px] leading-relaxed outline-none',
            '[&_h1]:text-[22px] [&_h1]:font-bold [&_h1]:m-0 [&_h1]:mb-2',
            '[&_h2]:text-[16px] [&_h2]:font-bold [&_h2]:m-0 [&_h2]:mb-2',
            '[&_p]:m-0 [&_p]:mb-2 [&_ul]:m-0 [&_ul]:pl-5',
          )}
          onInput={() => {
            setHtml(readEditor())
            setBlock(currentBlock())
            setColor(currentColor())
          }}
          onMouseUp={() => {
            setBlock(currentBlock())
            setColor(currentColor())
          }}
          onKeyUp={() => {
            setBlock(currentBlock())
            setColor(currentColor())
          }}
        />
      </div>

      <div className='shrink-0 px-2 py-0.5 border-t border-chrome-dark bg-status-bar text-[10px] text-status-bar-fg flex justify-between gap-2'>
        <span className='truncate min-w-0'>{name}</span>
        <span className='shrink-0'>{dirty ? t('unsaved') : t('saved')}</span>
      </div>
    </div>
  )
}
