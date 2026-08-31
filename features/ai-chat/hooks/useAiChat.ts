'use client'

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { useTranslations } from 'next-intl'
import { modal, toast } from '@/components/ui'
import {
  appendChatMessage,
  clearChatHistory,
  createChatSession,
  deleteChatMessage,
  ensureChatSession,
  exportChatSession,
  fetchChatHistoryPage,
  fetchSessionList,
  importChatSession,
  listImportableChatFiles,
  removeChatSession,
  renameChatSession,
  switchChatSession,
  type AiChatSessionMeta,
} from '../api'
import { streamChatCompletion } from '../stream'
import type { UiMessage } from '../types'
import { mapStreamErrorMessage, nextId } from '../utils'
import { promptSessionTitle } from '../promptNewSessionTitle'

export type UseAiChatResult = {
  sessions: AiChatSessionMeta[]
  activeSessionId: Nullable<string>
  messages: UiMessage[]
  historyLoading: boolean
  historyLoadingMore: boolean
  hasMoreHistory: boolean
  streaming: boolean
  sessionEpoch: number
  inputRef: RefObject<Nullable<HTMLTextAreaElement>>
  stop: () => void
  clearChat: () => Promise<void>
  deleteMessage: (id: string) => Promise<void>
  loadOlderMessages: () => Promise<void>
  sendText: (rawText: string) => Promise<void>
  newSession: () => Promise<void>
  selectSession: (sessionId: string) => Promise<void>
  renameSessionById: (sessionId: string) => Promise<void>
  deleteSessionById: (sessionId: string) => Promise<void>
  exportActiveSession: () => Promise<void>
  importFromVfs: () => Promise<void>
}

/**
 * 智聊：多会话 + 分页历史；消息增量写入独立 IndexedDB；请求仅发本轮 content。
 */
export function useAiChat(): UseAiChatResult {
  const t = useTranslations('aiChat')
  const [sessions, setSessions] = useState<AiChatSessionMeta[]>([])
  const [activeSessionId, setActiveSessionIdState] = useState<Nullable<string>>(null)
  const [messages, setMessages] = useState<UiMessage[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [historyLoadingMore, setHistoryLoadingMore] = useState(false)
  const [hasMoreHistory, setHasMoreHistory] = useState(false)
  const [streaming, setStreaming] = useState(false)
  const [sessionEpoch, setSessionEpoch] = useState(0)
  const abortRef = useRef<Nullable<AbortController>>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const messagesRef = useRef(messages)
  const activeSessionIdRef = useRef(activeSessionId)
  const loadingMoreRef = useRef(false)
  messagesRef.current = messages
  activeSessionIdRef.current = activeSessionId

  const refreshSessions = useCallback(async () => {
    const list = await fetchSessionList()
    setSessions(list)
    return list
  }, [])

  const loadSessionMessages = useCallback(async (sessionId: string) => {
    setHistoryLoading(true)
    try {
      const page = await fetchChatHistoryPage(sessionId)
      setMessages(page.messages)
      setHasMoreHistory(page.hasMore)
      setSessionEpoch((n) => n + 1)
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const session = await ensureChatSession()
        if (cancelled) return
        setActiveSessionIdState(session.id)
        await refreshSessions()
        if (cancelled) return
        await loadSessionMessages(session.id)
      } catch (err) {
        if (!cancelled) {
          toast.error(err instanceof Error ? err.message : t('historyLoadFail'))
          setHistoryLoading(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only
  }, [])

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  const stop = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setStreaming(false)
  }, [])

  const loadOlderMessages = useCallback(async () => {
    const sessionId = activeSessionIdRef.current
    if (!sessionId || loadingMoreRef.current || !hasMoreHistory) return
    const before = messagesRef.current[0]?.id
    if (!before) return

    loadingMoreRef.current = true
    setHistoryLoadingMore(true)
    try {
      const page = await fetchChatHistoryPage(sessionId, { before })
      if (page.messages.length === 0) {
        setHasMoreHistory(false)
        return
      }
      setMessages((prev) => {
        const seen = new Set(prev.map((m) => m.id))
        const unique = page.messages.filter((m) => !seen.has(m.id))
        return unique.length === 0 ? prev : [...unique, ...prev]
      })
      setHasMoreHistory(page.hasMore)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('historyLoadFail'))
    } finally {
      loadingMoreRef.current = false
      setHistoryLoadingMore(false)
    }
  }, [hasMoreHistory, t])

  const newSession = useCallback(async () => {
    if (streaming) stop()
    const title = await promptSessionTitle({
      mode: 'create',
      defaultTitle: t('sessionNamePlaceholder'),
    })
    if (title == null) return
    try {
      const session = await createChatSession(title)
      setActiveSessionIdState(session.id)
      setMessages([])
      setHasMoreHistory(false)
      setSessionEpoch((n) => n + 1)
      await refreshSessions()
      toast.success(t('sessionCreated'))
      requestAnimationFrame(() => inputRef.current?.focus())
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('sessionCreateFail'))
    }
  }, [streaming, stop, refreshSessions, t])

  const selectSession = useCallback(
    async (sessionId: string) => {
      if (sessionId === activeSessionIdRef.current) return
      if (streaming) stop()
      try {
        await switchChatSession(sessionId)
        setActiveSessionIdState(sessionId)
        await loadSessionMessages(sessionId)
        requestAnimationFrame(() => inputRef.current?.focus())
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t('historyLoadFail'))
      }
    },
    [streaming, stop, loadSessionMessages, t],
  )

  const renameSessionById = useCallback(
    async (sessionId: string) => {
      const current = sessions.find((s) => s.id === sessionId)
      const title = await promptSessionTitle({
        mode: 'edit',
        defaultTitle: current?.title ?? t('sessionNamePlaceholder'),
      })
      if (title == null) return
      try {
        await renameChatSession(sessionId, title)
        await refreshSessions()
        toast.success(t('sessionRenamed'))
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t('sessionRenameFail'))
      }
    },
    [sessions, refreshSessions, t],
  )

  const deleteSessionById = useCallback(
    async (sessionId: string) => {
      const ok = await modal.confirm({
        title: t('deleteSessionTitle'),
        message: t('deleteSessionConfirm'),
        confirmText: t('delete'),
        cancelText: t('cancel'),
      })
      if (!ok) return
      if (streaming && sessionId === activeSessionIdRef.current) stop()
      try {
        const wasActive = sessionId === activeSessionIdRef.current
        await removeChatSession(sessionId)
        const list = await refreshSessions()
        if (!wasActive) {
          toast.success(t('sessionDeleted'))
          return
        }
        if (list[0]) {
          await switchChatSession(list[0].id)
          setActiveSessionIdState(list[0].id)
          await loadSessionMessages(list[0].id)
        } else {
          const created = await createChatSession(t('sessionNamePlaceholder'))
          setActiveSessionIdState(created.id)
          setMessages([])
          setHasMoreHistory(false)
          setSessionEpoch((n) => n + 1)
          await refreshSessions()
        }
        toast.success(t('sessionDeleted'))
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t('sessionDeleteFail'))
      }
    },
    [streaming, stop, refreshSessions, loadSessionMessages, t],
  )

  const clearChat = useCallback(async () => {
    const sessionId = activeSessionIdRef.current
    if (!sessionId) return
    if (messages.length === 0 && !streaming) return
    const ok = await modal.confirm({
      title: t('clearConfirmTitle'),
      message: t('clearConfirm'),
      confirmText: t('clear'),
      cancelText: t('cancel'),
    })
    if (!ok) return
    if (streaming) stop()
    try {
      await clearChatHistory(sessionId)
      setMessages([])
      setHasMoreHistory(false)
      setSessionEpoch((n) => n + 1)
      await refreshSessions()
      toast.success(t('historyCleared'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('historyClearFail'))
    }
    requestAnimationFrame(() => inputRef.current?.focus())
  }, [messages.length, streaming, stop, refreshSessions, t])

  const deleteMessage = useCallback(
    async (id: string) => {
      const sessionId = activeSessionIdRef.current
      if (!sessionId) return
      const list = messagesRef.current
      const target = list.find((m) => m.id === id)
      if (!target) return
      if (streaming) {
        const last = list[list.length - 1]
        const prev = list[list.length - 2]
        if (id === last?.id || id === prev?.id) return
      }

      const ok = await modal.confirm({
        title: t('deleteConfirmTitle'),
        message: t('deleteConfirm'),
        confirmText: t('delete'),
        cancelText: t('cancel'),
      })
      if (!ok) return

      try {
        await deleteChatMessage(sessionId, id)
        setMessages((prev) => prev.filter((m) => m.id !== id))
        await refreshSessions()
        toast.success(t('messageDeleted'))
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t('messageDeleteFail'))
      }
    },
    [streaming, refreshSessions, t],
  )

  const exportActiveSession = useCallback(async () => {
    const sessionId = activeSessionIdRef.current
    if (!sessionId) return
    try {
      const { path } = await exportChatSession(sessionId)
      toast.success(t('exportOk', { path }))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('exportFail'))
    }
  }, [t])

  const importFromVfs = useCallback(async () => {
    try {
      const files = await listImportableChatFiles()
      if (files.length === 0) {
        toast.warning(t('importEmpty'))
        return
      }
      const latest = files[0]!
      const ok = await modal.confirm({
        title: t('importTitle'),
        message: t('importConfirm', { name: latest.name }),
        confirmText: t('import'),
        cancelText: t('cancel'),
      })
      if (!ok) return
      if (streaming) stop()
      const session = await importChatSession(latest.path)
      await switchChatSession(session.id)
      setActiveSessionIdState(session.id)
      await refreshSessions()
      await loadSessionMessages(session.id)
      toast.success(t('importOk'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('importFail'))
    }
  }, [streaming, stop, refreshSessions, loadSessionMessages, t])

  const sendText = useCallback(
    async (rawText: string) => {
      const sessionId = activeSessionIdRef.current
      const text = rawText.trim()
      if (!text || streaming || !sessionId) return

      const prior = messagesRef.current
      const now = Date.now()

      const userMsg: UiMessage = { id: nextId('u'), role: 'user', content: text, createdAt: now }
      const assistantId = nextId('a')
      const assistantMsg: UiMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        createdAt: now + 1,
      }

      setMessages([...prior, userMsg, assistantMsg])
      setStreaming(true)

      const controller = new AbortController()
      abortRef.current = controller

      try {
        await appendChatMessage(sessionId, {
          id: userMsg.id,
          role: 'user',
          content: text,
          createdAt: userMsg.createdAt,
        })
        void refreshSessions()

        let assistantText = ''
        await streamChatCompletion({
          content: text,
          signal: controller.signal,
          onDelta: (piece) => {
            assistantText += piece
            setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + piece } : m)))
          },
        })

        if (assistantText.trim()) {
          await appendChatMessage(sessionId, {
            id: assistantId,
            role: 'assistant',
            content: assistantText,
            createdAt: assistantMsg.createdAt,
          })
          void refreshSessions()
        }
      } catch (err) {
        if (controller.signal.aborted) {
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId && !m.content ? { ...m, content: t('stopped') } : m)),
          )
        } else {
          const raw = err instanceof Error ? err.message : t('error')
          const message = mapStreamErrorMessage(raw, t('balanceInsufficient'))
          toast.error(message)
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId && !m.content ? { ...m, content: t('errorPrefix', { message }) } : m,
            ),
          )
        }
      } finally {
        abortRef.current = null
        setStreaming(false)
        requestAnimationFrame(() => inputRef.current?.focus())
      }
    },
    [streaming, refreshSessions, t],
  )

  return {
    sessions,
    activeSessionId,
    messages,
    historyLoading,
    historyLoadingMore,
    hasMoreHistory,
    streaming,
    sessionEpoch,
    inputRef,
    stop,
    clearChat,
    deleteMessage,
    loadOlderMessages,
    sendText,
    newSession,
    selectSession,
    renameSessionById,
    deleteSessionById,
    exportActiveSession,
    importFromVfs,
  }
}
