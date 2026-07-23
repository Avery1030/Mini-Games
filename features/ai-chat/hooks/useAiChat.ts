'use client'

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { useTranslations } from 'next-intl'
import { modal, toast } from '@/components/ui'
import { clearChatHistory, fetchChatHistory, saveChatHistory } from '../api'
import { streamChatCompletion } from '../stream'
import type { UiMessage } from '../types'
import { buildRequestMessages, mapStreamErrorMessage, nextId } from '../utils'

export type UseAiChatResult = {
  messages: UiMessage[]
  historyLoading: boolean
  streaming: boolean
  /** 清空会话时递增，供输入区重置 */
  sessionEpoch: number
  listRef: RefObject<HTMLDivElement | null>
  inputRef: RefObject<HTMLTextAreaElement | null>
  stop: () => void
  clearChat: () => Promise<void>
  sendText: (rawText: string) => Promise<void>
  copyMessage: (content: string) => Promise<void>
}

/**
 * 智聊会话：历史加载/自动保存、流式发送与中止。
 */
export function useAiChat(): UseAiChatResult {
  const t = useTranslations('aiChat')
  const [messages, setMessages] = useState<UiMessage[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [streaming, setStreaming] = useState(false)
  const [sessionEpoch, setSessionEpoch] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const messagesRef = useRef(messages)
  const skipSaveRef = useRef(true)
  messagesRef.current = messages

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setHistoryLoading(true)
      try {
        const list = await fetchChatHistory()
        if (cancelled) return
        setMessages(
          list.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            createdAt: m.createdAt,
          })),
        )
      } catch (err) {
        if (!cancelled) {
          toast.error(err instanceof Error ? err.message : t('historyLoadFail'))
        }
      } finally {
        if (!cancelled) {
          setHistoryLoading(false)
          // 跳过载入后的第一次自动保存
          skipSaveRef.current = true
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [t])

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages, streaming])

  useEffect(() => {
    if (historyLoading) return
    if (skipSaveRef.current) {
      skipSaveRef.current = false
      return
    }
    // 流式过程中不写盘，结束后再落盘
    if (streaming) return

    const toSave = messages.filter((m) => m.content.trim().length > 0)
    const timer = window.setTimeout(() => {
      void saveChatHistory(toSave).catch((err) => {
        toast.error(err instanceof Error ? err.message : t('historySaveFail'))
      })
    }, 400)
    return () => window.clearTimeout(timer)
  }, [messages, streaming, historyLoading, t])

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
      skipSaveRef.current = true
      setMessages([])
      setSessionEpoch((n) => n + 1)
      toast.success(t('historyCleared'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('historyClearFail'))
    }
    requestAnimationFrame(() => inputRef.current?.focus())
  }, [messages.length, streaming, stop, t])

  const copyMessage = useCallback(
    async (content: string) => {
      try {
        await navigator.clipboard.writeText(content)
        toast.success(t('copied'))
      } catch {
        toast.error(t('copyFail'))
      }
    },
    [t],
  )

  const sendText = useCallback(
    async (rawText: string) => {
      const text = rawText.trim()
      if (!text || streaming) return

      const prior = messagesRef.current
      const requestMessages = buildRequestMessages(prior, text)
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
          messages: requestMessages,
          signal: controller.signal,
          onDelta: (piece) => {
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + piece } : m)),
            )
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
    streaming,
    sessionEpoch,
    listRef,
    inputRef,
    stop,
    clearChat,
    sendText,
    copyMessage,
  }
}
