'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { FileText } from 'lucide-react'
import { cn } from '@/lib/cn'
import { embeddedAppShell } from '@/lib/embeddedAppShell'
import { Button, toast } from '@/components/ui'
import type { DesktopAppId } from '@/config/desktop'
import { NoteEditor } from '@/features/notepad/NoteEditor'
import { fetchNote, updateNoteApi } from '@/features/notepad/api'
import { useNotepadStore } from '@/features/notepad/store'
import { useDesktopItemsStore } from '@/store/desktopItems'
import { getDesktopWindow } from '@/lib/desktop/window'

export type TextDocumentAppProps = {
  itemId: DesktopAppId
  noteId: string
}

/**
 * 桌面文本文档窗口：单文件编辑（不带记事本侧栏）。
 */
export function TextDocumentApp({ itemId, noteId }: TextDocumentAppProps) {
  const t = useTranslations('textDocument')
  const tn = useTranslations('notepad')
  const td = useTranslations('desktop')
  const wordWrap = useNotepadStore((s) => s.wordWrap)
  const setWordWrap = useNotepadStore((s) => s.setWordWrap)
  const itemTitle = useDesktopItemsStore(
    (s) => s.items.find((i) => i.id === itemId)?.title,
  )
  const setItemTitle = useDesktopItemsStore((s) => s.setItemTitle)
  const moveToRecycleBin = useDesktopItemsStore((s) => s.moveToRecycleBin)

  const [title, setTitle] = useState(itemTitle ?? '')
  const [content, setContent] = useState('')
  const [savedTitle, setSavedTitle] = useState('')
  const [savedContent, setSavedContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const note = await fetchNote(noteId)
        if (cancelled) return
        setTitle(note.title)
        setContent(note.content)
        setSavedTitle(note.title)
        setSavedContent(note.content)
        setMissing(false)
      } catch {
        if (cancelled) return
        setMissing(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [noteId])

  const dirty = title !== savedTitle || content !== savedContent

  const onSave = useCallback(async () => {
    setSaving(true)
    try {
      const note = await updateNoteApi(noteId, { title: title.trim() || tn('untitled'), content })
      setTitle(note.title)
      setContent(note.content)
      setSavedTitle(note.title)
      setSavedContent(note.content)
      if (note.title !== itemTitle) {
        setItemTitle(itemId, note.title)
      }
      toast.success(tn('savedOk'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tn('saveFail'))
    } finally {
      setSaving(false)
    }
  }, [noteId, title, content, tn, itemId, itemTitle, setItemTitle])

  const onDelete = useCallback(() => {
    if (!moveToRecycleBin(itemId)) return
    try {
      getDesktopWindow(itemId)?.close()
    } catch {
      // ignore
    }
  }, [itemId, moveToRecycleBin])

  return (
    <div
      className={cn(
        embeddedAppShell('flex flex-col text-sm text-on-chrome bg-window font-pixel'),
      )}
    >
      <div className='shrink-0 flex flex-wrap items-center gap-2 px-3 py-2 border-b border-chrome-dark bg-chrome'>
        <Button size='sm' onClick={onDelete}>
          {td('delete')}
        </Button>
      </div>

      <div className='flex-1 min-h-0 flex flex-col gap-2 overflow-hidden p-3'>
        <div className='shrink-0 flex items-center gap-2'>
          <FileText size={18} strokeWidth={2} className='shrink-0 text-muted' aria-hidden />
          <div className='min-w-0 flex-1'>
            <h2 className='text-base font-bold truncate'>{title || itemTitle || t('untitled')}</h2>
            <p className='text-[11px] text-muted mt-0.5'>{t('hint')}</p>
          </div>
        </div>

        {loading ? (
          <div className='flex-1 min-h-0 flex items-center justify-center text-[11px] text-muted'>
            {tn('loading')}
          </div>
        ) : missing ? (
          <div className='flex-1 min-h-0 flex items-center justify-center text-[11px] text-muted px-4 text-center'>
            {t('missing')}
          </div>
        ) : (
          <div className='flex-1 min-h-0 overflow-hidden'>
            <NoteEditor
              title={title}
              content={content}
              wordWrap={wordWrap}
              dirty={dirty}
              saving={saving}
              disabled={false}
              onTitleChange={setTitle}
              onContentChange={setContent}
              onWordWrapChange={setWordWrap}
              onSave={() => void onSave()}
            />
          </div>
        )}
      </div>

      <div className='shrink-0 px-3 py-1.5 border-t border-chrome-dark bg-status-bar text-[10px] text-status-bar-fg truncate'>
        {dirty ? t('statusDirty') : t('status', { name: title || t('untitled') })}
      </div>
    </div>
  )
}
