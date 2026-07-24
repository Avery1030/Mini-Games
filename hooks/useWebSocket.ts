'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  createManagedWebSocket,
  type ConnectionStatus,
  type ManagedWebSocket,
  type ManagedWebSocketError,
  type ManagedWebSocketOptions,
  type WebSocketCloseInfo,
  type WebSocketErrorKind,
  type WebSocketLogEvent,
  type WebSocketLogLevel,
  type WebSocketSendData,
  DEFAULT_PERMANENT_CLOSE_CODES,
} from '@/lib/websocket'

export type {
  ConnectionStatus,
  ManagedWebSocket,
  ManagedWebSocketError,
  ManagedWebSocketOptions,
  WebSocketCloseInfo,
  WebSocketErrorKind,
  WebSocketLogEvent,
  WebSocketLogLevel,
  WebSocketSendData,
}
export { createManagedWebSocket, DEFAULT_PERMANENT_CLOSE_CODES }

export type UseWebSocketOptions = ManagedWebSocketOptions & {
  /** 为 false 时不连接 @default true */
  enabled?: boolean
}

/**
 * React 封装：响应式 `status` / `readyState`；卸载时会调用 `close()` 释放资源。
 */
export function useWebSocket(options: UseWebSocketOptions) {
  const {
    urls,
    enabled = true,
    heartbeatInterval,
    heartbeatTimeout,
    heartbeatPayload,
    resetWatchdogOnAnyMessage,
    heartbeatFailCloses,
    enableSendQueue,
    maxQueueSize,
    queueOverflow,
    queueMessageTTL,
    flushSendInterval,
    reconnect,
    reconnectDelay,
    maxReconnectDelay,
    maxRetries,
    reconnectNowMinInterval,
    permanentCloseCodes,
    listenNetwork,
    listenVisibility,
    onOpen,
    onMessage,
    onError,
    onClose,
    onReconnect,
    onExhausted,
    onReady,
    onStatusChange,
    onQueueOverflow,
    onLog,
    transformMessage,
    mergeQueuedMessages,
  } = options

  const [readyState, setReadyState] = useState<number>(WebSocket.CLOSED)
  const [status, setStatus] = useState<ConnectionStatus>('idle')
  const [queueLength, setQueueLength] = useState(0)
  const clientRef = useRef<ManagedWebSocket | null>(null)

  const onOpenRef = useRef(onOpen)
  const onMessageRef = useRef(onMessage)
  const onErrorRef = useRef(onError)
  const onCloseRef = useRef(onClose)
  const onReconnectRef = useRef(onReconnect)
  const onExhaustedRef = useRef(onExhausted)
  const onReadyRef = useRef(onReady)
  const onStatusChangeRef = useRef(onStatusChange)
  const onQueueOverflowRef = useRef(onQueueOverflow)
  const onLogRef = useRef(onLog)
  const transformMessageRef = useRef(transformMessage)
  const mergeQueuedMessagesRef = useRef(mergeQueuedMessages)
  const heartbeatPayloadRef = useRef(heartbeatPayload)
  const hasMergeQueuedMessages = mergeQueuedMessages != null

  onOpenRef.current = onOpen
  onMessageRef.current = onMessage
  onErrorRef.current = onError
  onCloseRef.current = onClose
  onReconnectRef.current = onReconnect
  onExhaustedRef.current = onExhausted
  onReadyRef.current = onReady
  onStatusChangeRef.current = onStatusChange
  onQueueOverflowRef.current = onQueueOverflow
  onLogRef.current = onLog
  transformMessageRef.current = transformMessage
  mergeQueuedMessagesRef.current = mergeQueuedMessages
  heartbeatPayloadRef.current = heartbeatPayload

  const urlsKey = Array.isArray(urls) ? urls.join('\0') : urls
  const permanentCodesKey = (permanentCloseCodes ?? DEFAULT_PERMANENT_CLOSE_CODES).join(',')

  useEffect(() => {
    if (!enabled) {
      setReadyState(WebSocket.CLOSED)
      setStatus('closed')
      setQueueLength(0)
      return
    }

    const syncQueue = () => setQueueLength(clientRef.current?.getQueueLength() ?? 0)

    const client = createManagedWebSocket({
      urls: urlsKey.includes('\0') ? urlsKey.split('\0') : urlsKey,
      heartbeatInterval,
      heartbeatTimeout,
      resetWatchdogOnAnyMessage,
      heartbeatFailCloses,
      enableSendQueue,
      maxQueueSize,
      queueOverflow,
      queueMessageTTL,
      flushSendInterval,
      reconnect,
      reconnectDelay,
      maxReconnectDelay,
      maxRetries,
      reconnectNowMinInterval,
      permanentCloseCodes: permanentCodesKey
        ? permanentCodesKey.split(',').map((n) => Number(n))
        : undefined,
      listenNetwork,
      listenVisibility,
      heartbeatPayload:
        heartbeatPayloadRef.current == null
          ? undefined
          : () => {
              const payload = heartbeatPayloadRef.current
              return typeof payload === 'function' ? payload() : (payload ?? null)
            },
      transformMessage: (ev) => {
        const fn = transformMessageRef.current
        if (!fn) return ev
        return fn(ev)
      },
      ...(hasMergeQueuedMessages
        ? {
            mergeQueuedMessages: (items: WebSocketSendData[]) =>
              mergeQueuedMessagesRef.current?.(items) ?? items,
          }
        : {}),
      onReady: (ctx) => onReadyRef.current?.(ctx),
      onStatusChange: (next, rs) => {
        setStatus(next)
        setReadyState(rs)
        onStatusChangeRef.current?.(next, rs)
      },
      onOpen: (ev) => {
        setReadyState(WebSocket.OPEN)
        setStatus('open')
        syncQueue()
        onOpenRef.current?.(ev)
      },
      onMessage: (ev) => onMessageRef.current?.(ev),
      onError: (err) => onErrorRef.current?.(err),
      onClose: (info) => {
        setReadyState(WebSocket.CLOSED)
        syncQueue()
        onCloseRef.current?.(info)
      },
      onReconnect: (attempt, delayMs) => {
        setStatus('reconnecting')
        setReadyState(WebSocket.CONNECTING)
        onReconnectRef.current?.(attempt, delayMs)
      },
      onExhausted: () => onExhaustedRef.current?.(),
      onQueueOverflow: (dropped) => {
        syncQueue()
        onQueueOverflowRef.current?.(dropped)
      },
      onLog: (level, event, detail) => onLogRef.current?.(level, event, detail),
    })

    clientRef.current = client
    setStatus(client.getStatus())
    setReadyState(client.getReadyState())
    setQueueLength(client.getQueueLength())

    return () => {
      client.close()
      clientRef.current = null
      setReadyState(WebSocket.CLOSED)
      setStatus('closed')
      setQueueLength(0)
    }
  }, [
    enabled,
    urlsKey,
    heartbeatInterval,
    heartbeatTimeout,
    resetWatchdogOnAnyMessage,
    heartbeatFailCloses,
    enableSendQueue,
    maxQueueSize,
    queueOverflow,
    queueMessageTTL,
    flushSendInterval,
    reconnect,
    reconnectDelay,
    maxReconnectDelay,
    maxRetries,
    reconnectNowMinInterval,
    permanentCodesKey,
    listenNetwork,
    listenVisibility,
    hasMergeQueuedMessages,
  ])

  const send = useCallback((data: WebSocketSendData) => {
    clientRef.current?.send(data)
    setQueueLength(clientRef.current?.getQueueLength() ?? 0)
  }, [])

  const close = useCallback(() => {
    clientRef.current?.close()
    clientRef.current = null
    setReadyState(WebSocket.CLOSED)
    setStatus('closed')
    setQueueLength(0)
  }, [])

  const touch = useCallback(() => {
    clientRef.current?.touch()
  }, [])

  const reconnectNow = useCallback(() => {
    clientRef.current?.reconnectNow()
  }, [])

  const clearQueue = useCallback(() => {
    clientRef.current?.clearQueue()
    setQueueLength(0)
  }, [])

  return {
    readyState,
    status,
    queueLength,
    send,
    close,
    touch,
    reconnectNow,
    clearQueue,
  }
}
