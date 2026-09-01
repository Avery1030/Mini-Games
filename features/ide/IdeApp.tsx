'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/cn'
import { embeddedAppShell } from '@/lib/embeddedAppShell'
import { modal, toast } from '@/components/ui'
import {
  findExistingHtmlPreview,
  findIdeWindowByPath,
  getHtmlPreviewWindow,
  getIdeEditorWindow,
  spawnHtmlPreview,
} from '@/lib/desktop/window/ideWindows'
import { isDesktopVfsPath, refreshDesktopVfs, writeTextToDesktop } from '@/lib/desktop/vfsFileActions'
import { getBasename, joinPath, vfs } from '@/lib/vfs'
import { useWindowStore } from '@/store/window'
import { readIdeText, writeIdeText } from './api'
import { CodeEditor } from './CodeEditor'
import { isVfsFileDrag, readVfsPathFromDataTransfer } from './dnd'
import { pickIdeFile } from './FilePicker'
import { FindReplacePanel } from './FindReplace'
import { formatIdeText } from './format'
import { isHtmlPath, isIdeFilePath, languageFromPath, mimeFromPath } from './languages'
import { IdeToolbar } from './Toolbar'

const FORMAT_ON_SAVE_KEY = 'ide:formatOnSave'

function readFormatOnSavePref(): boolean {
  try {
    const raw = localStorage.getItem(FORMAT_ON_SAVE_KEY)
    if (raw == null) return true
    return raw === '1'
  } catch {
    return true
  }
}

export type IdeAppProps = {
  windowId?: string
  initialPath?: Nullable<string>
}

function untitledName(t: (key: string) => string) {
  return t('untitled')
}

export function IdeApp({ windowId, initialPath = null }: IdeAppProps = {}) {
  const t = useTranslations('ide')
  const tm = useTranslations('modal')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const contentRef = useRef('')
  const pathRef = useRef<Nullable<string>>(null)
  const savedRef = useRef('')

  const [path, setPath] = useState<Nullable<string>>(null)
  const [content, setContent] = useState('')
  const [savedContent, setSavedContent] = useState('')
  const [cursor, setCursor] = useState({ line: 1, col: 1 })
  const [findOpen, setFindOpen] = useState(false)
  const [findMode, setFindMode] = useState<'find' | 'replace'>('find')
  const [search, setSearch] = useState({ query: '', matchCase: false, activeStart: -1 })
  const [busy, setBusy] = useState(false)
  const [formatOnSave, setFormatOnSave] = useState(readFormatOnSavePref)
  const [historyEpoch, setHistoryEpoch] = useState(0)
  const formatOnSaveRef = useRef(formatOnSave)
  formatOnSaveRef.current = formatOnSave

  const isActive = useWindowStore((s) => (windowId ? s.windows[windowId]?.active === true : true))
  const dirty = content !== savedContent
  const language = languageFromPath(path)

  contentRef.current = content
  pathRef.current = path
  savedRef.current = savedContent

  const syncWindowMeta = useCallback(
    (nextPath: Nullable<string>, nextDirty: boolean) => {
      if (!windowId) return
      getIdeEditorWindow(windowId)?.setFileMeta(nextPath, nextDirty, t('untitled'))
    },
    [t, windowId],
  )

  useEffect(() => {
    const win = windowId ? getIdeEditorWindow(windowId) : undefined
    if (!win) return
    win.unsavedTitle = tm('confirmTitle')
    win.unsavedMessage = t('confirmUnsavedClose')
    win.closeSaveLabel = t('save')
    win.closeDiscardLabel = t('closeDiscard')
    win.closeCancelLabel = t('cancel')
  }, [t, tm, windowId])

  useEffect(() => {
    syncWindowMeta(path, dirty)
  }, [path, dirty, syncWindowMeta])

  const applyLoaded = useCallback(
    (nextPath: Nullable<string>, text: string, resetHistory = true) => {
      setPath(nextPath)
      setContent(text)
      setSavedContent(text)
      pathRef.current = nextPath
      contentRef.current = text
      savedRef.current = text
      if (resetHistory) setHistoryEpoch((n) => n + 1)
      syncWindowMeta(nextPath, false)
    },
    [syncWindowMeta],
  )

  const confirmDiscard = useCallback(async () => {
    if (contentRef.current === savedRef.current) return true
    return modal.confirm({
      title: tm('confirmTitle'),
      message: t('confirmUnsaved'),
    })
  }, [t, tm])

  const loadPath = useCallback(
    async (filePath: string) => {
      setBusy(true)
      try {
        const result = await readIdeText(filePath)
        if (!result.ok) {
          const key =
            result.reason === 'notFound'
              ? 'errNotFound'
              : result.reason === 'binary'
                ? 'errBinary'
                : result.reason === 'directory'
                  ? 'errDirectory'
                  : 'errRead'
          applyLoaded(null, '')
          await modal.alert({ title: t('errorTitle'), message: t(key, { path: result.message }) })
          return false
        }
        applyLoaded(result.path, result.text)
        return true
      } finally {
        setBusy(false)
      }
    },
    [applyLoaded, t],
  )

  const openInThisWindow = useCallback(
    async (filePath: string) => {
      const existing = findIdeWindowByPath(filePath)
      if (existing) {
        if (existing.id !== windowId) existing.open()
        return true
      }
      return loadPath(filePath)
    },
    [loadPath, windowId],
  )

  useEffect(() => {
    if (!initialPath) return
    void loadPath(initialPath)
    // 仅按构造时路径加载一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onNew = async () => {
    if (!(await confirmDiscard())) return
    applyLoaded(null, '')
  }

  const onOpen = async () => {
    if (!(await confirmDiscard())) return
    const picked = await pickIdeFile({
      title: t('openTitle'),
      mode: 'open',
      defaultPath: path ?? '/Documents',
      confirmLabel: t('open'),
      filenameLabel: t('filename'),
    })
    if (!picked) return
    await openInThisWindow(picked)
  }

  const writeTo = async (filePath: string) => {
    setBusy(true)
    try {
      let text = contentRef.current
      if (formatOnSaveRef.current) {
        const formatted = formatIdeText(text, languageFromPath(filePath))
        if (!formatted.ok) {
          toast.warning(t('formatFailed'))
        } else {
          text = formatted.text
        }
      }
      await writeIdeText(filePath, text, mimeFromPath(filePath))
      applyLoaded(filePath, text, false)
      if (isDesktopVfsPath(filePath)) refreshDesktopVfs()
      toast.success(t('savedOk'))
      return true
    } catch (err) {
      await modal.alert({
        title: t('errorTitle'),
        message: err instanceof Error ? err.message : t('errSave'),
      })
      return false
    } finally {
      setBusy(false)
    }
  }

  const onSaveAs = async (): Promise<boolean> => {
    const picked = await pickIdeFile({
      title: t('saveAsTitle'),
      mode: 'save',
      defaultPath: path ?? joinPath('/Desktop', `${untitledName(t)}.html`),
      confirmLabel: t('save'),
      filenameLabel: t('filename'),
    })
    if (!picked) return false
    try {
      const exists = await vfs.exists(picked)
      if (exists) {
        try {
          await vfs.readDir(picked)
          await modal.alert({ title: t('errorTitle'), message: t('errDirectory', { path: picked }) })
          return false
        } catch {
          const ok = await modal.confirm({
            title: tm('confirmTitle'),
            message: t('confirmOverwrite', { name: getBasename(picked) }),
          })
          if (!ok) return false
        }
      }
    } catch {
      // exists 失败时仍尝试写入，由 writeTo 报错
    }
    return writeTo(picked)
  }

  const onSave = async (): Promise<boolean> => {
    if (!pathRef.current) return onSaveAs()
    return writeTo(pathRef.current)
  }

  const onSaveToDesktop = async (): Promise<boolean> => {
    const current = pathRef.current
    if (current && isDesktopVfsPath(current) && current !== '/Desktop') {
      return writeTo(current)
    }
    setBusy(true)
    try {
      let text = contentRef.current
      const fileName = current ? getBasename(current) : `${untitledName(t)}.html`
      const destHint = joinPath('/Desktop', fileName)
      if (formatOnSaveRef.current) {
        const formatted = formatIdeText(text, languageFromPath(current ?? destHint))
        if (!formatted.ok) toast.warning(t('formatFailed'))
        else text = formatted.text
      }
      const dest = await writeTextToDesktop(fileName, text, mimeFromPath(destHint))
      applyLoaded(dest, text, false)
      toast.success(t('savedToDesktop'))
      return true
    } catch (err) {
      await modal.alert({
        title: t('errorTitle'),
        message: err instanceof Error ? err.message : t('errSave'),
      })
      return false
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    const win = windowId ? getIdeEditorWindow(windowId) : undefined
    if (!win) return
    win.onRetargetPath = (nextPath) => {
      setPath(nextPath)
      pathRef.current = nextPath
    }
    return () => {
      win.onRetargetPath = null
    }
  }, [windowId])

  useEffect(() => {
    const win = windowId ? getIdeEditorWindow(windowId) : undefined
    if (!win) return
    win.saveHandler = () => onSave()
    return () => {
      win.saveHandler = null
    }
  })

  useEffect(() => {
    const win = windowId ? getIdeEditorWindow(windowId) : undefined
    const preview = (win?.previewId ? getHtmlPreviewWindow(win.previewId) : undefined) ?? findExistingHtmlPreview()
    if (!preview) return
    preview.setTitle(t('previewWindowTitle', { name: path ? getBasename(path) : untitledName(t) }))
  }, [path, t, windowId])

  const onPreview = () => {
    const currentPath = pathRef.current
    if (!isHtmlPath(currentPath)) {
      void modal.alert({ title: t('errorTitle'), message: t('previewOnlyHtml') })
      return
    }
    const win = windowId ? getIdeEditorWindow(windowId) : undefined
    const title = t('previewWindowTitle', { name: currentPath ? getBasename(currentPath) : untitledName(t) })
    const spawned = spawnHtmlPreview({
      html: contentRef.current,
      title,
      reuseId: win?.previewId,
    })
    if (win && spawned) win.previewId = spawned.id
    spawned?.open()
  }

  const applySelection = (start: number, end: number) => {
    const ta = textareaRef.current
    if (!ta) return
    ta.focus()
    ta.setSelectionRange(start, end)
    const lineHeight = 20
    const before = contentRef.current.slice(0, start)
    const line = before.split('\n').length
    ta.scrollTop = Math.max(0, (line - 3) * lineHeight)
  }

  const replaceRange = (start: number, end: number, text: string) => {
    const prev = contentRef.current
    const next = `${prev.slice(0, start)}${text}${prev.slice(end)}`
    setContent(next)
    requestAnimationFrame(() => applySelection(start, start + text.length))
  }

  const replaceAll = (search: string, replacement: string, caseSensitive: boolean) => {
    if (!search) return 0
    const prev = contentRef.current
    const hay = caseSensitive ? prev : prev.toLowerCase()
    const needle = caseSensitive ? search : search.toLowerCase()
    const parts: string[] = []
    let count = 0
    let from = 0
    while (from <= prev.length) {
      const idx = hay.indexOf(needle, from)
      if (idx < 0) {
        parts.push(prev.slice(from))
        break
      }
      parts.push(prev.slice(from, idx), replacement)
      count++
      from = idx + search.length
    }
    if (count === 0) return 0
    setContent(parts.join(''))
    return count
  }

  const onDropFile = async (filePath: string) => {
    if (!isIdeFilePath(filePath)) {
      await modal.alert({ title: t('errorTitle'), message: t('errUnsupportedDrop', { path: filePath }) })
      return
    }
    if (!(await confirmDiscard())) return
    await openInThisWindow(filePath)
  }

  useEffect(() => {
    if (!isActive) return
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (!mod) {
        if (e.key === 'Escape' && findOpen) {
          e.preventDefault()
          setFindOpen(false)
        }
        return
      }
      const key = e.key.toLowerCase()
      if (key === 's') {
        e.preventDefault()
        if (!busy) void onSave()
      } else if (key === 'f') {
        e.preventDefault()
        setFindMode('find')
        setFindOpen(true)
      } else if (key === 'h') {
        e.preventDefault()
        setFindMode('replace')
        setFindOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const pathLabel = path ?? untitledName(t)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const onVfsDrop = (e: Event) => {
      const path = (e as CustomEvent<{ path?: string }>).detail?.path
      if (path) void onDropFile(path)
    }
    el.addEventListener('vfs-drop', onVfsDrop)
    return () => el.removeEventListener('vfs-drop', onVfsDrop)
  })

  return (
    <div
      ref={rootRef}
      data-vfs-drop='1'
      className={cn(
        embeddedAppShell('relative flex flex-col text-sm text-on-chrome bg-window font-pixel min-h-0'),
      )}
      onDragOver={(e) => {
        if (!isVfsFileDrag(e.dataTransfer)) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'copy'
      }}
      onDrop={(e) => {
        if (!isVfsFileDrag(e.dataTransfer)) return
        e.preventDefault()
        const dropped = readVfsPathFromDataTransfer(e.dataTransfer)
        if (dropped) void onDropFile(dropped)
      }}
    >
      <IdeToolbar
        labels={{
          newFile: t('newFile'),
          open: t('open'),
          save: t('save'),
          saveAs: t('saveAs'),
          saveToDesktop: t('saveToDesktop'),
          preview: t('preview'),
          find: t('find'),
          replace: t('replace'),
          formatOnSave: t('formatOnSave'),
        }}
        canPreview={isHtmlPath(path)}
        formatOnSave={formatOnSave}
        onFormatOnSaveChange={(value) => {
          setFormatOnSave(value)
          try {
            localStorage.setItem(FORMAT_ON_SAVE_KEY, value ? '1' : '0')
          } catch {
            // 忽略隐私模式等写入失败
          }
        }}
        onNew={() => void onNew()}
        onOpen={() => void onOpen()}
        onSave={() => void onSave()}
        onSaveAs={() => void onSaveAs()}
        onSaveToDesktop={() => void onSaveToDesktop()}
        onPreview={onPreview}
        onFind={() => {
          setFindMode('find')
          setFindOpen(true)
        }}
        onReplace={() => {
          setFindMode('replace')
          setFindOpen(true)
        }}
      />

      <div className='relative flex-1 min-h-0 flex flex-col p-1.5 pt-1'>
        <FindReplacePanel
          open={findOpen}
          mode={findMode}
          labels={{
            find: t('findPlaceholder'),
            replace: t('replacePlaceholder'),
            findNext: t('findNext'),
            replaceOne: t('replaceOne'),
            replaceAll: t('replaceAll'),
            close: t('close'),
            notFound: t('findNotFound'),
            matchCase: t('matchCase'),
            formatReplaced: (count) => t('replacedCount', { count }),
            formatMatchCount: (current, total) => t('findMatchCount', { current, total }),
          }}
          haystack={content}
          getHaystack={() => contentRef.current}
          getSelectionStart={() => textareaRef.current?.selectionStart ?? 0}
          applySelection={applySelection}
          replaceRange={replaceRange}
          replaceAll={replaceAll}
          onClose={() => setFindOpen(false)}
          onSearchChange={setSearch}
        />
        <CodeEditor
          value={content}
          language={language}
          historyEpoch={historyEpoch}
          searchQuery={search.query}
          searchMatchCase={search.matchCase}
          searchActiveStart={search.activeStart}
          ariaLabel={t('editorLabel')}
          textareaRef={textareaRef}
          onChange={setContent}
          onCursorChange={(line, col) => setCursor({ line, col })}
        />
      </div>

      <div className='shrink-0 px-2 py-0.5 border-t border-chrome-dark bg-status-bar text-[10px] text-status-bar-fg flex justify-between gap-2'>
        <span className='truncate min-w-0'>{pathLabel}</span>
        <span className='shrink-0 tabular-nums'>
          {t('statusLnCol', { line: cursor.line, col: cursor.col })}
          {' · '}
          {language}
          {dirty ? ` · ${t('unsaved')}` : ''}
        </span>
      </div>
    </div>
  )
}
