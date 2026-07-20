'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/cn'
import { embeddedAppShell } from '@/lib/embeddedAppShell'
import { SplitPane, modal, toast } from '@/components/ui'
import { useNotepadStore } from '@/store/notepad'
import {
  createNoteApi,
  deleteNoteApi,
  fetchNote,
  fetchNoteList,
  updateNoteApi,
} from './api'
import { NoteEditor } from './NoteEditor'
import { NoteSidebar } from './NoteSidebar'
import type { NoteMeta } from './types'

export interface NotepadProps {
  embedded?: boolean
}

export function NotepadApp({ embedded = false }: NotepadProps = {}) {
  const t = useTranslations('notepad')
  const tm = useTranslations('modal')
  const lastNoteId = useNotepadStore((s) => s.lastNoteId)
  const wordWrap = useNotepadStore((s) => s.wordWrap)
  const setLastNoteId = useNotepadStore((s) => s.setLastNoteId)
  const setWordWrap = useNotepadStore((s) => s.setWordWrap)

  const [notes, setNotes] = useState<NoteMeta[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [savedTitle, setSavedTitle] = useState('')
  const [savedContent, setSavedContent] = useState('')
  const [listLoading, setListLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [saving, setSaving] = useState(false)

  const activeIdRef = useRef<string | null>(null)
  activeIdRef.current = activeId

  const dirty = activeId != null && (title !== savedTitle || content !== savedContent)

  const applyNote = useCallback(
    (note: { id: string; title: string; content: string }) => {
      setActiveId(note.id)
      setTitle(note.title)
      setContent(note.content)
      setSavedTitle(note.title)
      setSavedContent(note.content)
      setLastNoteId(note.id)
    },
    [setLastNoteId],
  )

  const refreshList = useCallback(async () => {
    const list = await fetchNoteList()
    setNotes(list)
    return list
  }, [])

  const openNote = useCallback(
    async (id: string) => {
      if (id === activeIdRef.current) return
      if (dirty) {
        const ok = await modal.confirm({
          title: tm('confirmTitle'),
          message: t('confirmDiscard'),
        })
        if (!ok) return
      }
      setBusy(true)
      try {
        const note = await fetchNote(id)
        applyNote(note)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t('loadFail'))
      } finally {
        setBusy(false)
      }
    },
    [applyNote, dirty, t, tm],
  )

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setListLoading(true)
      try {
        const list = await refreshList()
        if (cancelled) return
        const prefer =
          (lastNoteId && list.find((n) => n.id === lastNoteId)?.id) || list[0]?.id || null
        if (prefer) {
          const note = await fetchNote(prefer)
          if (!cancelled) applyNote(note)
        }
      } catch (err) {
        if (!cancelled) toast.error(err instanceof Error ? err.message : t('loadFail'))
      } finally {
        if (!cancelled) setListLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
    // 仅首屏加载
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onCreate = async () => {
    if (dirty) {
      const ok = await modal.confirm({
        title: tm('confirmTitle'),
        message: t('confirmDiscard'),
      })
      if (!ok) return
    }
    setBusy(true)
    try {
      const note = await createNoteApi({ title: t('untitled'), content: '' })
      await refreshList()
      applyNote(note)
      toast.success(t('created'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('createFail'))
    } finally {
      setBusy(false)
    }
  }

  const onSave = async () => {
    if (!activeId || !dirty) return
    setSaving(true)
    try {
      const note = await updateNoteApi(activeId, {
        title: title.trim() || t('untitled'),
        content,
      })
      setSavedTitle(note.title)
      setSavedContent(note.content)
      setTitle(note.title)
      await refreshList()
      toast.success(t('savedOk'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('saveFail'))
    } finally {
      setSaving(false)
    }
  }

  const onDelete = async (id: string) => {
    const target = notes.find((n) => n.id === id)
    const ok = await modal.confirm({
      title: tm('confirmTitle'),
      message: t('confirmDelete', { title: target?.title || t('untitled') }),
    })
    if (!ok) return

    setBusy(true)
    try {
      await deleteNoteApi(id)
      const list = await refreshList()
      if (id === activeId) {
        const next = list[0]
        if (next) {
          const note = await fetchNote(next.id)
          applyNote(note)
        } else {
          setActiveId(null)
          setTitle('')
          setContent('')
          setSavedTitle('')
          setSavedContent('')
          setLastNoteId(null)
        }
      }
      toast.success(t('deleted'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('deleteFail'))
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        void onSave()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div
      className={cn(
        embeddedAppShell(embedded, 'flex flex-col text-sm text-on-chrome bg-window font-pixel'),
        !embedded && 'p-4',
      )}
    >
      <div className={cn('flex-1 min-h-0 flex p-2', embedded && 'p-3')}>
        <SplitPane defaultSize={168} minSize={120} maxSize={320} storageKey='split:notepad'>
          <NoteSidebar
            notes={notes}
            activeId={activeId}
            loading={listLoading}
            busy={busy || saving}
            onSelect={(id) => void openNote(id)}
            onCreate={() => void onCreate()}
            onDelete={(id) => void onDelete(id)}
          />
          <NoteEditor
            title={title}
            content={content}
            wordWrap={wordWrap}
            dirty={dirty}
            saving={saving}
            disabled={!activeId}
            onTitleChange={setTitle}
            onContentChange={setContent}
            onWordWrapChange={setWordWrap}
            onSave={() => void onSave()}
          />
        </SplitPane>
      </div>

      <div className='shrink-0 px-3 py-1.5 border-t border-chrome-dark bg-status-bar text-[10px] text-status-bar-fg flex justify-between gap-2'>
        <span className='truncate min-w-0'>{t('footer', { count: notes.length })}</span>
        <span className='shrink-0 opacity-80'>{t('shortcutSave')}</span>
      </div>
    </div>
  )
}
