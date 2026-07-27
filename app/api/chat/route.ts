import { NextResponse } from 'next/server'
import {
  AI_CHAT_SYSTEM_PROMPT,
  appendAiChatMessages,
  proxyChatSseStream,
} from '@/lib/ai-chat'

export const runtime = 'nodejs'

const SILICONFLOW_URL = 'https://api.siliconflow.cn/v1/chat/completions'
const DEFAULT_MODEL = 'Qwen/Qwen2.5-7B-Instruct'
const MAX_CONTENT_CHARS = 16_000

type LlmMessage = { role: 'system' | 'user' | 'assistant'; content: string }

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

  const messages: LlmMessage[] = [
    { role: 'system', content: AI_CHAT_SYSTEM_PROMPT },
    ...session.messages.map(({ role, content: c }) => ({ role, content: c })),
  ]

  const model =
    (typeof (body as { model?: unknown }).model === 'string' &&
      (body as { model: string }).model.trim()) ||
    DEFAULT_MODEL

  let upstream: Response
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
      }),
      signal: req.signal,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upstream request failed'
    return NextResponse.json({ error: message }, { status: 502 })
  }

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

  const stream = proxyChatSseStream(upstream.body, async (assistantText) => {
    const text = assistantText.trim()
    if (!text) return
    await appendAiChatMessages([
      { id: assistantMessageId, role: 'assistant', content: assistantText },
    ])
  })

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
