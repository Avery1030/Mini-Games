'use client'

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { useTranslations } from 'next-intl'
import { modal, toast } from '@/components/ui'
import { clearChatHistory, deleteChatMessage, fetchChatHistoryPage } from '../api'
import { streamChatCompletion } from '../stream'
import type { UiMessage } from '../types'
import { mapStreamErrorMessage, nextId } from '../utils'
import { useAiChatStore } from '@/store/aiChat'

export type UseAiChatResult = {
  messages: UiMessage[]
  historyLoading: boolean
  historyLoadingMore: boolean
  hasMoreHistory: boolean
  streaming: boolean
  /** 清空会话时递增，供输入区重置 */
  sessionEpoch: number
  inputRef: RefObject<HTMLTextAreaElement | null>
  stop: () => void
  clearChat: () => Promise<void>
  deleteMessage: (id: string) => Promise<void>
  loadOlderMessages: () => Promise<void>
  sendText: (rawText: string) => Promise<void>
}

function toUiMessages(
  list: Array<{ id: string; role: 'user' | 'assistant'; content: string; createdAt: number }>,
): UiMessage[] {
  return list.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    createdAt: m.createdAt,
  }))
}

/**
 * 智聊会话：分页加载历史、流式发送；落盘由服务端 /api/chat 负责。
 */
export function useAiChat(): UseAiChatResult {
  const t = useTranslations('aiChat')
  const [messages, setMessages] = useState<UiMessage[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [historyLoadingMore, setHistoryLoadingMore] = useState(false)
  const [hasMoreHistory, setHasMoreHistory] = useState(false)
  const [streaming, setStreaming] = useState(false)
  const [sessionEpoch, setSessionEpoch] = useState(0)
  const abortRef = useRef<AbortController | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const messagesRef = useRef(messages)
  const loadingMoreRef = useRef(false)
  messagesRef.current = messages

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setHistoryLoading(true)
      try {
        const page = await fetchChatHistoryPage()
        if (cancelled) return
        setMessages(toUiMessages(page.messages))
        setHasMoreHistory(page.hasMore)
      } catch (err) {
        if (!cancelled) {
          toast.error(err instanceof Error ? err.message : t('historyLoadFail'))
        }
      } finally {
        if (!cancelled) setHistoryLoading(false)
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
    if (loadingMoreRef.current || !hasMoreHistory) return
    const before = messagesRef.current[0]?.id
    if (!before) return

    loadingMoreRef.current = true
    setHistoryLoadingMore(true)
    try {
      const page = await fetchChatHistoryPage({ before })
      const older = toUiMessages(page.messages)
      if (older.length === 0) {
        setHasMoreHistory(false)
        return
      }
      setMessages((prev) => {
        const seen = new Set(prev.map((m) => m.id))
        const unique = older.filter((m) => !seen.has(m.id))
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

  const clearChat = useCallback(async () => {
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
      await clearChatHistory()
      setMessages([])
      setHasMoreHistory(false)
      setSessionEpoch((n) => n + 1)
      toast.success(t('historyCleared'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('historyClearFail'))
    }
    requestAnimationFrame(() => inputRef.current?.focus())
  }, [messages.length, streaming, stop, t])

  const deleteMessage = useCallback(
    async (id: string) => {
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
        await deleteChatMessage(id)
        setMessages((prev) => prev.filter((m) => m.id !== id))
        toast.success(t('messageDeleted'))
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t('messageDeleteFail'))
      }
    },
    [streaming, t],
  )

  const sendText = useCallback(
    async (rawText: string) => {
      const text = rawText.trim()
      if (!text || streaming) return

      const apiKey = useAiChatStore.getState().apiKey.trim()
      if (!apiKey) {
        toast.error(t('apiKeyRequired'))
        return
      }

      const prior = messagesRef.current
      const now = Date.now()

      const userMsg: UiMessage = { id: nextId('u'), role: 'user', content: text, createdAt: now }
      const assistantId = nextId('a')
      const assistantMsg: UiMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        createdAt: now,
      }

      setMessages([...prior, userMsg, assistantMsg])
      setStreaming(true)

      const controller = new AbortController()
      abortRef.current = controller

      try {
        await streamChatCompletion({
          content: text,
          userMessageId: userMsg.id,
          assistantMessageId: assistantId,
          apiKey,
          signal: controller.signal,
          onDelta: (piece) => {
            setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + piece } : m)))
          },
        })
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
    [streaming, t],
  )

  return {
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
  }
}
