import { NextResponse } from 'next/server'
import {
  AI_CHAT_SYSTEM_PROMPT,
  appendAiChatMessages,
  proxyChatSseStream,
} from '@/lib/ai-chat'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SILICONFLOW_URL = 'https://api.siliconflow.cn/v1/chat/completions'
const DEFAULT_MODEL = 'Qwen/Qwen2.5-7B-Instruct'
const MAX_CONTENT_CHARS = 16_000
/** 发给模型的最近消息条数（含本轮），避免超长上下文拖慢首包 */
const MAX_CONTEXT_MESSAGES = 40
const MAX_TOKENS = 2048
/** 等待上游响应头的超时 */
const UPSTREAM_HEADERS_TIMEOUT_MS = 45_000
/** 上游流空闲超时 */
const UPSTREAM_IDLE_TIMEOUT_MS = 60_000

type LlmMessage = { role: 'system' | 'user' | 'assistant'; content: string }

function mergeAbortSignals(signals: AbortSignal[]): AbortSignal {
  if (typeof AbortSignal !== 'undefined' && 'any' in AbortSignal && typeof AbortSignal.any === 'function') {
    return AbortSignal.any(signals)
  }
  const controller = new AbortController()
  const onAbort = () => controller.abort()
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort()
      return controller.signal
    }
    signal.addEventListener('abort', onAbort, { once: true })
  }
  return controller.signal
}

/**
 * 客户端只传本轮用户内容；服务端读会话、拼上下文、流式代理并落盘。
 * API Key 来自环境变量 SILICONFLOW_API_KEY。
 */
export async function POST(req: Request) {
  const apiKey = process.env.SILICONFLOW_API_KEY?.trim() ?? ''
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Missing SILICONFLOW_API_KEY. Set it in .env / .env.local.' },
      { status: 503 },
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const rawContent = (body as { content?: unknown })?.content
  if (typeof rawContent !== 'string') {
    return NextResponse.json({ error: 'content must be a string' }, { status: 400 })
  }
  const content = rawContent.trim()
  if (!content) {
    return NextResponse.json({ error: 'content must be non-empty' }, { status: 400 })
  }
  if ([...content].length > MAX_CONTENT_CHARS) {
    return NextResponse.json({ error: 'content too long' }, { status: 400 })
  }

  const bodyObj = body as {
    userMessageId?: unknown
    assistantMessageId?: unknown
  }
  const userMessageId =
    typeof bodyObj.userMessageId === 'string' ? bodyObj.userMessageId.trim() : undefined
  const assistantMessageId =
    typeof bodyObj.assistantMessageId === 'string' ? bodyObj.assistantMessageId.trim() : undefined

  let session
  try {
    session = await appendAiChatMessages([{ id: userMessageId, role: 'user', content }])
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to save user message'
    console.error('[ai-chat] append user', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }

  const recent = session.messages.slice(-MAX_CONTEXT_MESSAGES)
  const messages: LlmMessage[] = [
    { role: 'system', content: AI_CHAT_SYSTEM_PROMPT },
    ...recent.map(({ role, content: c }) => ({ role, content: c })),
  ]

  const model =
    (typeof (body as { model?: unknown }).model === 'string' &&
      (body as { model: string }).model.trim()) ||
    DEFAULT_MODEL

  /** 仅约束「拿到响应头」；拿到后立即 clear，避免拖死后续 SSE body */
  const headersTimeoutController = new AbortController()
  const headersTimeoutId = setTimeout(
    () => headersTimeoutController.abort(),
    UPSTREAM_HEADERS_TIMEOUT_MS,
  )
  const upstreamSignal = mergeAbortSignals([req.signal, headersTimeoutController.signal])

  let upstream: Response
  const t0 = Date.now()
  try {
    upstream = await fetch(SILICONFLOW_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        Accept: 'text/event-stream',
      },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        max_tokens: MAX_TOKENS,
      }),
      signal: upstreamSignal,
    })
  } catch (err) {
    const timedOut = headersTimeoutController.signal.aborted && !req.signal.aborted
    const message = timedOut
      ? `SiliconFlow timeout after ${UPSTREAM_HEADERS_TIMEOUT_MS}ms`
      : err instanceof Error
        ? err.message
        : 'Upstream request failed'
    console.error('[ai-chat] upstream fetch', message, `${Date.now() - t0}ms`)
    return NextResponse.json({ error: message }, { status: timedOut ? 504 : 502 })
  } finally {
    clearTimeout(headersTimeoutId)
  }

  console.info('[ai-chat] upstream headers', upstream.status, `${Date.now() - t0}ms`)

  if (!upstream.ok || !upstream.body) {
    let detail = `HTTP ${upstream.status}`
    try {
      const errJson = (await upstream.json()) as {
        message?: string
        error?: string | { message?: string }
        code?: number | string
      }
      if (typeof errJson.error === 'string') detail = errJson.error
      else if (errJson.error && typeof errJson.error === 'object' && errJson.error.message) {
        detail = errJson.error.message
      } else if (errJson.message) {
        detail = errJson.message
      }
    } catch {
      try {
        detail = (await upstream.text()) || detail
      } catch {
        // ignore
      }
    }

    const lower = detail.toLowerCase()
    const balanceRelated =
      upstream.status === 402 ||
      lower.includes('insufficient') ||
      lower.includes('balance') ||
      lower.includes('余额')
    if (balanceRelated) {
      detail = '硅基流动账户余额不足，请到控制台充值，或更换 .env 中的 SILICONFLOW_API_KEY。'
    }

    return NextResponse.json({ error: detail }, { status: upstream.status || 502 })
  }

  const stream = proxyChatSseStream(
    upstream.body,
    async (assistantText) => {
      const text = assistantText.trim()
      if (!text) return
      await appendAiChatMessages([
        { id: assistantMessageId, role: 'assistant', content: assistantText },
      ])
    },
    { idleTimeoutMs: UPSTREAM_IDLE_TIMEOUT_MS, signal: req.signal },
  )

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
