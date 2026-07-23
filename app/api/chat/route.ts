import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

const SILICONFLOW_URL = 'https://api.siliconflow.cn/v1/chat/completions'

type ChatRole = 'system' | 'user' | 'assistant'
type ChatMessage = { role: ChatRole; content: string }

function isChatMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== 'object') return false
  const m = value as { role?: unknown; content?: unknown }
  return (
    (m.role === 'system' || m.role === 'user' || m.role === 'assistant') &&
    typeof m.content === 'string'
  )
}

/**
 * 代理硅基流动 Chat Completions，流式 SSE 透传给浏览器。
 * Key 仅存在于服务端环境变量。
 */
export async function POST(req: Request) {
  const apiKey = process.env.SILICONFLOW_API_KEY?.trim()
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Missing SILICONFLOW_API_KEY. Copy .env.example to .env.local.' },
      { status: 500 },
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const messages = (body as { messages?: unknown })?.messages
  if (!Array.isArray(messages) || messages.length === 0 || !messages.every(isChatMessage)) {
    return NextResponse.json({ error: 'messages must be a non-empty ChatMessage[]' }, { status: 400 })
  }

  const model =
    (typeof (body as { model?: unknown }).model === 'string' &&
      (body as { model: string }).model.trim()) ||
    process.env.SILICONFLOW_MODEL?.trim() ||
    'Qwen/Qwen2.5-7B-Instruct'

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
      detail =
        '硅基流动账户余额不足，请到控制台充值，或在 .env.local 更换仍可用的 SILICONFLOW_MODEL / API Key。'
    }

    return NextResponse.json({ error: detail }, { status: upstream.status || 502 })
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
