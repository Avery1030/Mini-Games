import { isServer } from '@/lib/env'

/**
 * 托管 WebSocket（浏览器）。
 *
 * **生命周期：** 不用时请调用 `close()` 释放定时器、环境监听与 socket；
 * 仅丢弃引用而不 `close()` 可能导致闭包短期无法被 GC（可控，属调用方责任）。
 */

/** 与 DOM `WebSocket.send` 可接受类型对齐（排除 SharedArrayBuffer） */
export type WebSocketSendData = string | Blob | BufferSource

export type ConnectionStatus = 'idle' | 'connecting' | 'open' | 'closing' | 'closed' | 'reconnecting'

export type WebSocketCloseInfo = {
  code: number
  reason: string
  wasClean: boolean
  /** true = 调用方主动 close，不应自动重连 */
  intentional: boolean
  /** true = 判定为永久失败（如鉴权），不会再重连 */
  permanent: boolean
}

export type WebSocketReadyContext = {
  /** 是否为断线后的再次连通（首次连接为 false） */
  reconnected: boolean
  /** 本次连通前累计的失败重连次数（成功后会清零） */
  reconnectAttempt: number
}

/** 错误分级，便于埋点 / 监控区分 */
export type WebSocketErrorKind = 'send' | 'connect' | 'transform' | 'heartbeat' | 'ready' | 'socket' | 'queue'

export type ManagedWebSocketError = {
  kind: WebSocketErrorKind
  error: Event | Error
  message: string
}

export type WebSocketLogLevel = 'debug' | 'info' | 'warn' | 'error'

export type WebSocketLogEvent =
  | 'connect'
  | 'open'
  | 'close'
  | 'reconnect'
  | 'reconnect-throttled'
  | 'exhausted'
  | 'queue-enqueue'
  | 'queue-overflow'
  | 'queue-expire'
  | 'queue-flush'
  | 'heartbeat'
  | 'heartbeat-fail'
  | 'heartbeat-timeout'
  | 'visibility-probe'
  | 'online'
  | 'offline'
  | 'permanent-close'
  | 'ready-fail'

type QueuedMessage = {
  data: WebSocketSendData
  enqueuedAt: number
}

/**
 * 浏览器握手失败通常只有 onerror + onclose，**拿不到 HTTP 401/403**。
 * 常见表现是 close code `1006`（异常关闭）。若服务端用自定义 code 表示鉴权失败，
 * 请列入 `permanentCloseCodes`，避免无效重连。
 */
export const DEFAULT_PERMANENT_CLOSE_CODES: readonly number[] = [
  1008, // Policy Violation
  4001,
  4003,
  4401,
  4403,
]

export type ManagedWebSocketOptions = {
  /** 单个或多个 URL；异常断开时轮换并指数退避重连 */
  urls: string | string[]

  // —— 心跳 ——
  /**
   * 主动发送心跳的间隔（ms）。需配合 `heartbeatPayload`。
   *
   * **推荐标准 Ping-Pong：**
   * 1. 配置 `heartbeatPayload` 定时发 ping；
   * 2. `resetWatchdogOnAnyMessage: false`；
   * 3. 业务在收到 pong / 心跳应答时调用 `touch()` 才刷新看门狗。
   *
   * 否则默认模式靠「任意入站消息」续命；若出站单向堵塞但入站仍有行情，可能掩耳盗铃。
   * 心跳 `send` 失败会主动断开并重连（见 `heartbeatFailCloses`）。
   *
   * @default 0（不主动发）
   */
  heartbeatInterval?: number
  /**
   * 收包看门狗超时（ms）。超时强制断开并按异常重连。
   * @default 60_000；`0` 关闭
   */
  heartbeatTimeout?: number
  /** 心跳载荷；函数返回 null 表示本轮跳过 */
  heartbeatPayload?: WebSocketSendData | (() => WebSocketSendData | null)
  /**
   * 任意 `message` 是否刷新看门狗。
   * `false` 时仅 `touch()` 可刷新（标准 Ping-Pong）。
   * @default true
   */
  resetWatchdogOnAnyMessage?: boolean
  /**
   * 心跳发送抛错时是否强制断开以触发重连（发现出站单向故障）。
   * @default true
   */
  heartbeatFailCloses?: boolean

  // —— 发送队列 ——
  /** 非 OPEN 时是否入队 @default true */
  enableSendQueue?: boolean
  /** 队列上限，防止内存暴涨 @default 128 */
  maxQueueSize?: number
  /** 队列满时丢弃策略 @default 'drop-oldest' */
  queueOverflow?: 'drop-oldest' | 'drop-newest'
  /**
   * 队列消息存活时间（ms）。flush 时丢弃超时项（行情 / 短时指令防过期重放）。
   * @default 0（不淘汰）
   */
  queueMessageTTL?: number
  /**
   * 冲刷队列时相邻 `send` 的最小间隔（ms），避免重连瞬间打爆服务端。
   * @default 0（同步连续发送）
   */
  flushSendInterval?: number
  /**
   * 冲刷前合并队列（依赖业务协议）。
   * 返回单条、多条或 `null`（全部丢弃）。未提供则逐条发送。
   */
  mergeQueuedMessages?: (items: WebSocketSendData[]) => WebSocketSendData | WebSocketSendData[] | null
  onQueueOverflow?: (dropped: WebSocketSendData) => void

  // —— 消息管道 ——
  /**
   * 入站消息中间件：可做节流 / 去重 / 采样。
   * 返回 `false` / `null` / `undefined` 表示丢弃，不调用 `onMessage`。
   */
  transformMessage?: (ev: MessageEvent) => MessageEvent | false | null | undefined

  // —— 重连 ——
  /** @default true */
  reconnect?: boolean
  /** @default 1_000 */
  reconnectDelay?: number
  /** @default 30_000 */
  maxReconnectDelay?: number
  /** 成功 open 后计数清零；@default Infinity */
  maxRetries?: number
  /**
   * `reconnectNow()` 最小间隔（ms），抑制连点造成的连接抖动。
   * @default 800
   */
  reconnectNowMinInterval?: number
  /**
   * 这些 close code 视为永久失败，不再重连。
   * @default DEFAULT_PERMANENT_CLOSE_CODES
   */
  permanentCloseCodes?: number[]
  /**
   * 连接就绪钩子：鉴权、重新订阅频道等。
   * 在 `onOpen` 与冲刷离线队列之前 await，保证订阅先于积压业务消息。
   */
  onReady?: (ctx: WebSocketReadyContext) => void | Promise<void>

  // —— 环境 ——
  /** 监听 `online` / `offline` @default true */
  listenNetwork?: boolean
  /** 监听 `visibilitychange`（切回前台探活）@default true */
  listenVisibility?: boolean

  // —— 回调 ——
  onStatusChange?: (status: ConnectionStatus, readyState: number) => void
  onOpen?: (ev: Event) => void
  onMessage?: (ev: MessageEvent) => void
  /** 分级错误；`kind` 可用于埋点 */
  onError?: (err: ManagedWebSocketError) => void
  onClose?: (info: WebSocketCloseInfo) => void
  onReconnect?: (attempt: number, delayMs: number) => void
  onExhausted?: () => void
  /** 可选诊断日志（连接切换 / 重连 / 队列 / 心跳等） */
  onLog?: (level: WebSocketLogLevel, event: WebSocketLogEvent, detail?: unknown) => void
}

export type ManagedWebSocket = {
  /** 释放资源；丢弃实例前务必调用 */
  close: () => void
  send: (data: WebSocketSendData) => void
  /** 业务收到心跳应答（pong）时调用，刷新收包看门狗 */
  touch: () => void
  /** 立即重连（节流 + epoch 防护） */
  reconnectNow: () => void
  getSocket: () => WebSocket | null
  getReadyState: () => number
  getStatus: () => ConnectionStatus
  getQueueLength: () => number
  clearQueue: () => void
}

function resolveUrls(urls: string | string[]): string[] {
  const list = (Array.isArray(urls) ? urls : [urls]).map((u) => u.trim()).filter(Boolean)
  if (list.length === 0) throw new Error('createManagedWebSocket: urls must not be empty')
  return list
}

function backoffDelay(attempt: number, base: number, max: number): number {
  const exp = Math.min(attempt - 1, 16)
  const delay = Math.min(max, base * 2 ** exp)
  const jitter = delay * 0.2 * Math.random()
  return Math.round(delay + jitter)
}

function detachSocket(ws: WebSocket): void {
  ws.onopen = null
  ws.onmessage = null
  ws.onerror = null
  ws.onclose = null
}

function toErrorMessage(error: Event | Error): string {
  if (error instanceof Error) return error.message
  return 'WebSocket event error'
}

/**
 * 命令式托管 WebSocket。
 * 不用时请 `close()`，以便定时器 / 监听 / socket 被释放。
 */
export function createManagedWebSocket(options: ManagedWebSocketOptions): ManagedWebSocket {
  const urlList = resolveUrls(options.urls)
  const heartbeatInterval = options.heartbeatInterval ?? 0
  const heartbeatTimeout = options.heartbeatTimeout ?? 60_000
  const resetWatchdogOnAnyMessage = options.resetWatchdogOnAnyMessage !== false
  const heartbeatFailCloses = options.heartbeatFailCloses !== false
  const shouldReconnect = options.reconnect !== false
  const reconnectDelay = options.reconnectDelay ?? 1_000
  const maxReconnectDelay = options.maxReconnectDelay ?? 30_000
  const maxRetries = options.maxRetries ?? Number.POSITIVE_INFINITY
  const reconnectNowMinInterval = options.reconnectNowMinInterval ?? 800
  const permanentCodes = new Set(options.permanentCloseCodes ?? DEFAULT_PERMANENT_CLOSE_CODES)
  const enableSendQueue = options.enableSendQueue !== false
  const maxQueueSize = Math.max(1, options.maxQueueSize ?? 128)
  const queueOverflow = options.queueOverflow ?? 'drop-oldest'
  const queueMessageTTL = Math.max(0, options.queueMessageTTL ?? 0)
  const flushSendInterval = Math.max(0, options.flushSendInterval ?? 0)
  const listenNetwork = options.listenNetwork !== false
  const listenVisibility = options.listenVisibility !== false

  let socket: WebSocket | null = null
  let connectEpoch = 0
  let urlIndex = 0
  let attempt = 0
  let hasOpenedOnce = false
  let stopped = false
  let intentionalClose = false
  let permanentFailure = false
  let connectInFlight = false
  let status: ConnectionStatus = 'idle'
  let lastReconnectNowAt = 0
  let lastActivityAt = 0
  const sendQueue: QueuedMessage[] = []

  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let reconnectNowTimer: ReturnType<typeof setTimeout> | null = null
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null
  let watchdogTimer: ReturnType<typeof setTimeout> | null = null
  let flushTimer: ReturnType<typeof setTimeout> | null = null
  let flushInFlight = false

  const log = (level: WebSocketLogLevel, event: WebSocketLogEvent, detail?: unknown) => {
    options.onLog?.(level, event, detail)
  }

  const emitError = (kind: WebSocketErrorKind, error: Event | Error, message?: string) => {
    const payload: ManagedWebSocketError = {
      kind,
      error,
      message: message ?? toErrorMessage(error),
    }
    options.onError?.(payload)
  }

  const emitStatus = (next: ConnectionStatus) => {
    if (status === next) return
    status = next
    const readyState = socket?.readyState ?? WebSocket.CLOSED
    options.onStatusChange?.(next, readyState)
  }

  const clearReconnectTimer = () => {
    if (reconnectTimer != null) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
  }

  const clearReconnectNowTimer = () => {
    if (reconnectNowTimer != null) {
      clearTimeout(reconnectNowTimer)
      reconnectNowTimer = null
    }
  }

  const clearFlushTimer = () => {
    if (flushTimer != null) {
      clearTimeout(flushTimer)
      flushTimer = null
    }
  }

  const clearHeartbeat = () => {
    if (heartbeatTimer != null) {
      clearInterval(heartbeatTimer)
      heartbeatTimer = null
    }
    if (watchdogTimer != null) {
      clearTimeout(watchdogTimer)
      watchdogTimer = null
    }
  }

  const clearAllTimers = () => {
    clearReconnectTimer()
    clearReconnectNowTimer()
    clearFlushTimer()
    clearHeartbeat()
    flushInFlight = false
  }

  const armWatchdog = () => {
    if (heartbeatTimeout <= 0) return
    lastActivityAt = Date.now()
    if (watchdogTimer != null) clearTimeout(watchdogTimer)
    watchdogTimer = setTimeout(() => {
      watchdogTimer = null
      if (stopped || intentionalClose || permanentFailure) return
      log('warn', 'heartbeat-timeout', { timeout: heartbeatTimeout })
      forceCloseUnhealthy('heartbeat-timeout')
    }, heartbeatTimeout)
  }

  const touch = () => {
    if (stopped || intentionalClose) return
    if (socket?.readyState === WebSocket.OPEN) armWatchdog()
  }

  const dropExpiredFromQueue = (): number => {
    if (queueMessageTTL <= 0 || sendQueue.length === 0) return 0
    const now = Date.now()
    let dropped = 0
    while (sendQueue.length > 0) {
      const head = sendQueue[0]!
      if (now - head.enqueuedAt <= queueMessageTTL) break
      sendQueue.shift()
      dropped += 1
    }
    if (dropped > 0) log('info', 'queue-expire', { dropped, ttl: queueMessageTTL })
    return dropped
  }

  const enqueue = (data: WebSocketSendData) => {
    if (!enableSendQueue) {
      throw new Error('WebSocket is not open')
    }
    dropExpiredFromQueue()
    if (sendQueue.length >= maxQueueSize) {
      if (queueOverflow === 'drop-newest') {
        options.onQueueOverflow?.(data)
        log('warn', 'queue-overflow', { strategy: 'drop-newest' })
        return
      }
      const dropped = sendQueue.shift()
      if (dropped !== undefined) {
        options.onQueueOverflow?.(dropped.data)
        log('warn', 'queue-overflow', { strategy: 'drop-oldest' })
      }
    }
    sendQueue.push({ data, enqueuedAt: Date.now() })
    log('debug', 'queue-enqueue', { size: sendQueue.length })
  }

  const sendRaw = (data: WebSocketSendData) => {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not open')
    }
    socket.send(data)
  }

  const pumpFlush = () => {
    if (stopped || intentionalClose || permanentFailure) {
      flushInFlight = false
      return
    }
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      flushInFlight = false
      return
    }

    dropExpiredFromQueue()
    if (sendQueue.length === 0) {
      flushInFlight = false
      return
    }

    // 批量合并（一次性取出当前快照）
    if (options.mergeQueuedMessages) {
      const batch = sendQueue.splice(0, sendQueue.length).map((q) => q.data)
      let merged: WebSocketSendData | WebSocketSendData[] | null
      try {
        merged = options.mergeQueuedMessages(batch)
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err))
        emitError('queue', error)
        // 合并失败：把原数据塞回队首，避免静默丢失
        for (let i = batch.length - 1; i >= 0; i -= 1) {
          sendQueue.unshift({ data: batch[i]!, enqueuedAt: Date.now() })
        }
        flushInFlight = false
        return
      }
      if (merged == null) {
        flushInFlight = false
        log('info', 'queue-flush', { merged: 0, dropped: batch.length })
        return
      }
      const list = Array.isArray(merged) ? merged : [merged]
      let index = 0
      const sendNextMerged = () => {
        if (stopped || !socket || socket.readyState !== WebSocket.OPEN) {
          // 剩余回队
          while (index < list.length) {
            sendQueue.push({ data: list[index]!, enqueuedAt: Date.now() })
            index += 1
          }
          flushInFlight = false
          return
        }
        if (index >= list.length) {
          flushInFlight = false
          log('info', 'queue-flush', { merged: list.length })
          return
        }
        try {
          sendRaw(list[index]!)
          index += 1
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err))
          emitError('send', error)
          while (index < list.length) {
            sendQueue.push({ data: list[index]!, enqueuedAt: Date.now() })
            index += 1
          }
          flushInFlight = false
          return
        }
        if (index < list.length && flushSendInterval > 0) {
          flushTimer = setTimeout(() => {
            flushTimer = null
            sendNextMerged()
          }, flushSendInterval)
        } else if (index < list.length) {
          sendNextMerged()
        } else {
          flushInFlight = false
          log('info', 'queue-flush', { merged: list.length })
        }
      }
      sendNextMerged()
      return
    }

    const item = sendQueue.shift()
    if (!item) {
      flushInFlight = false
      return
    }
    try {
      sendRaw(item.data)
    } catch (err) {
      sendQueue.unshift(item)
      const error = err instanceof Error ? err : new Error(String(err))
      emitError('send', error)
      flushInFlight = false
      return
    }

    if (sendQueue.length === 0) {
      flushInFlight = false
      log('debug', 'queue-flush', { remaining: 0 })
      return
    }

    if (flushSendInterval > 0) {
      flushTimer = setTimeout(() => {
        flushTimer = null
        pumpFlush()
      }, flushSendInterval)
    } else {
      pumpFlush()
    }
  }

  const flushQueue = () => {
    if (flushInFlight) return
    flushInFlight = true
    clearFlushTimer()
    pumpFlush()
  }

  const startHeartbeat = () => {
    clearHeartbeat()
    armWatchdog()
    if (heartbeatInterval <= 0 || options.heartbeatPayload == null) return
    heartbeatTimer = setInterval(() => {
      if (!socket || socket.readyState !== WebSocket.OPEN) return
      try {
        const payload =
          typeof options.heartbeatPayload === 'function' ? options.heartbeatPayload() : options.heartbeatPayload
        if (payload != null) {
          socket.send(payload)
          log('debug', 'heartbeat')
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err))
        emitError('heartbeat', error)
        log('warn', 'heartbeat-fail', { message: error.message })
        if (heartbeatFailCloses) {
          forceCloseUnhealthy('heartbeat-send-failed')
        }
      }
    }, heartbeatInterval)
  }

  const discardSocket = (ws: WebSocket | null) => {
    if (!ws) return
    detachSocket(ws)
    try {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close(1000, 'replaced')
      }
    } catch {
      // ignore
    }
  }

  const forceCloseUnhealthy = (reason: string) => {
    const ws = socket
    if (!ws) {
      scheduleReconnect()
      return
    }
    try {
      ws.close(4000, reason)
    } catch {
      scheduleReconnect()
    }
  }

  const canReconnect = () => !stopped && !intentionalClose && !permanentFailure && shouldReconnect

  const scheduleReconnect = () => {
    if (!canReconnect()) return
    if (reconnectTimer != null) return
    if (connectInFlight) return

    if (attempt >= maxRetries) {
      emitStatus('closed')
      log('error', 'exhausted', { attempt, maxRetries })
      options.onExhausted?.()
      return
    }

    attempt += 1
    urlIndex = (urlIndex + 1) % urlList.length
    const delay = backoffDelay(attempt, reconnectDelay, maxReconnectDelay)
    emitStatus('reconnecting')
    log('info', 'reconnect', { attempt, delay, urlIndex })
    options.onReconnect?.(attempt, delay)
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      connect()
    }, delay)
  }

  const handlePermanentClose = (info: WebSocketCloseInfo) => {
    permanentFailure = true
    clearAllTimers()
    emitStatus('closed')
    log('error', 'permanent-close', info)
    options.onClose?.(info)
    options.onExhausted?.()
  }

  const connect = () => {
    if (stopped || intentionalClose || permanentFailure) return
    if (connectInFlight) return

    clearReconnectTimer()
    clearFlushTimer()
    flushInFlight = false
    connectInFlight = true
    const epoch = ++connectEpoch

    const prev = socket
    socket = null
    discardSocket(prev)

    emitStatus(attempt > 0 || hasOpenedOnce ? 'reconnecting' : 'connecting')
    const url = urlList[urlIndex]!
    log('info', 'connect', { url, epoch, attempt })

    let next: WebSocket
    try {
      next = new WebSocket(url)
    } catch (err) {
      connectInFlight = false
      const error = err instanceof Error ? err : new Error(String(err))
      emitError('connect', error)
      scheduleReconnect()
      return
    }

    socket = next

    next.onopen = (ev) => {
      if (epoch !== connectEpoch || socket !== next) return
      connectInFlight = false
      const reconnectAttempt = attempt
      const reconnected = hasOpenedOnce
      attempt = 0
      hasOpenedOnce = true
      emitStatus('open')
      log('info', 'open', { reconnected, reconnectAttempt })
      startHeartbeat()

      const finishOpen = () => {
        if (epoch !== connectEpoch || socket !== next) return
        flushQueue()
        options.onOpen?.(ev)
      }

      const readyResult = options.onReady?.({ reconnected, reconnectAttempt })
      if (readyResult != null && typeof (readyResult as Promise<void>).then === 'function') {
        void Promise.resolve(readyResult)
          .then(finishOpen)
          .catch((err) => {
            const error = err instanceof Error ? err : new Error(String(err))
            emitError('ready', error)
            log('error', 'ready-fail', { message: error.message })
            try {
              next.close(4000, 'onReady-failed')
            } catch {
              scheduleReconnect()
            }
          })
      } else {
        finishOpen()
      }
    }

    next.onmessage = (ev) => {
      if (epoch !== connectEpoch || socket !== next) return
      if (resetWatchdogOnAnyMessage) armWatchdog()

      let outgoing: MessageEvent | false | null | undefined = ev
      if (options.transformMessage) {
        try {
          outgoing = options.transformMessage(ev)
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err))
          emitError('transform', error)
          return
        }
      }
      if (outgoing == null || outgoing === false) return
      options.onMessage?.(outgoing)
    }

    next.onerror = (ev) => {
      if (epoch !== connectEpoch || socket !== next) return
      emitError('socket', ev)
    }

    next.onclose = (ev) => {
      if (epoch !== connectEpoch) return
      connectInFlight = false
      clearHeartbeat()
      clearFlushTimer()
      flushInFlight = false
      if (socket === next) socket = null
      detachSocket(next)

      const intentional = intentionalClose
      const permanent = !intentional && permanentCodes.has(ev.code)
      const info: WebSocketCloseInfo = {
        code: ev.code,
        reason: ev.reason,
        wasClean: ev.wasClean,
        intentional,
        permanent,
      }
      log('info', 'close', info)

      if (permanent) {
        handlePermanentClose(info)
        return
      }

      options.onClose?.(info)

      if (intentional || stopped) {
        emitStatus('closed')
        return
      }

      scheduleReconnect()
    }
  }

  const doReconnectNow = () => {
    if (stopped || intentionalClose || permanentFailure) return
    lastReconnectNowAt = Date.now()
    clearReconnectTimer()
    clearReconnectNowTimer()
    clearFlushTimer()
    flushInFlight = false
    if (connectInFlight || socket) {
      connectInFlight = false
      const prev = socket
      socket = null
      discardSocket(prev)
    }
    connect()
  }

  const reconnectNow = () => {
    if (stopped || intentionalClose || permanentFailure) return
    const now = Date.now()
    const elapsed = now - lastReconnectNowAt
    if (lastReconnectNowAt > 0 && elapsed < reconnectNowMinInterval) {
      log('debug', 'reconnect-throttled', { elapsed, min: reconnectNowMinInterval })
      if (reconnectNowTimer == null) {
        reconnectNowTimer = setTimeout(() => {
          reconnectNowTimer = null
          doReconnectNow()
        }, reconnectNowMinInterval - elapsed)
      }
      return
    }
    doReconnectNow()
  }

  const onOnline = () => {
    log('info', 'online')
    if (!canReconnect()) return
    if (socket?.readyState !== WebSocket.OPEN) reconnectNow()
  }

  const onOffline = () => {
    log('warn', 'offline')
    if (status === 'open') emitStatus('reconnecting')
  }

  const onVisibility = () => {
    if (isServer || document.visibilityState !== 'visible') return
    if (!canReconnect()) return
    const state = socket?.readyState
    if (state === WebSocket.OPEN) {
      if (heartbeatTimeout > 0 && lastActivityAt > 0 && Date.now() - lastActivityAt > heartbeatTimeout / 2) {
        log('warn', 'visibility-probe', { staleMs: Date.now() - lastActivityAt })
        reconnectNow()
      }
      return
    }
    log('info', 'visibility-probe', { readyState: state })
    reconnectNow()
  }

  if (!isServer) {
    if (listenNetwork) {
      window.addEventListener('online', onOnline)
      window.addEventListener('offline', onOffline)
    }
    if (listenVisibility) {
      document.addEventListener('visibilitychange', onVisibility)
    }
  }

  const removeEnvListeners = () => {
    if (isServer) return
    window.removeEventListener('online', onOnline)
    window.removeEventListener('offline', onOffline)
    document.removeEventListener('visibilitychange', onVisibility)
  }

  connect()

  return {
    close: () => {
      if (stopped) return
      stopped = true
      intentionalClose = true
      clearAllTimers()
      removeEnvListeners()
      sendQueue.length = 0
      connectInFlight = false
      emitStatus('closing')
      const ws = socket
      socket = null
      if (ws) {
        detachSocket(ws)
        try {
          if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
            ws.close(1000, 'client-close')
          }
        } catch {
          // ignore
        }
      }
      emitStatus('closed')
      log('info', 'close', { intentional: true })
    },
    send: (data) => {
      if (stopped || intentionalClose || permanentFailure) {
        throw new Error('WebSocket is closed')
      }
      if (socket && socket.readyState === WebSocket.OPEN) {
        try {
          socket.send(data)
          return
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err))
          emitError('send', error)
          enqueue(data)
          return
        }
      }
      enqueue(data)
    },
    touch,
    reconnectNow,
    getSocket: () => socket,
    getReadyState: () => socket?.readyState ?? WebSocket.CLOSED,
    getStatus: () => status,
    getQueueLength: () => {
      dropExpiredFromQueue()
      return sendQueue.length
    },
    clearQueue: () => {
      sendQueue.length = 0
      clearFlushTimer()
      flushInFlight = false
    },
  }
}
