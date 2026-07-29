import { http, HttpError } from '@/lib/http'

export type StreamChatOptions = {
  /** 本轮用户输入；不携带历史消息 */
  content: string
  signal?: AbortSignal
  onDelta: (text: string) => void
}

type ChatRequestBody = {
  content: string
}

/**
 * 经全局 http 调用 /api/chat，解析 OpenAI 兼容 SSE。
 * 仅发送本轮 content，不附带历史上下文。
 */
export async function streamChatCompletion(options: StreamChatOptions): Promise<void> {
  let res: Response
  try {
    res = await http.post<Response, ChatRequestBody>(
      '/api/chat',
      { content: options.content },
      {
        headers: {
          Accept: 'text/event-stream',
        },
        responseType: 'stream',
        signal: options.signal,
      },
    )
  } catch (err) {
    if (err instanceof HttpError) {
      throw new Error(err.message)
    }
    throw err
  }

  if (!res.body) {
    throw new Error('Empty stream body')
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const rawLine of lines) {
      const line = rawLine.trim()
      if (!line || line.startsWith(':')) continue
      if (!line.startsWith('data:')) continue
      const payload = line.slice(5).trim()
      if (payload === '[DONE]') return

      try {
        const json = JSON.parse(payload) as {
          choices?: Array<{ delta?: { content?: string | null } }>
        }
        const piece = json.choices?.[0]?.delta?.content
        if (typeof piece === 'string' && piece.length > 0) {
          options.onDelta(piece)
        }
      } catch {
        // 忽略不完整 JSON 分片
      }
    }
  }
}
