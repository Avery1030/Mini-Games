/**
 * 透传上游 SSE，同时解析 delta 文本；流结束或取消时回调完整助手回复。
 */
export function proxyChatSseStream(
  upstream: ReadableStream<Uint8Array>,
  onComplete: (assistantText: string) => Promise<void>,
): ReadableStream<Uint8Array> {
  const reader = upstream.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let assistant = ''
  let settled = false

  const finish = async () => {
    if (settled) return
    settled = true
    try {
      await onComplete(assistant)
    } catch (err) {
      console.error('[ai-chat] persist assistant', err)
    }
  }

  const ingest = (chunk: Uint8Array) => {
    buffer += decoder.decode(chunk, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const rawLine of lines) {
      const line = rawLine.trim()
      if (!line || line.startsWith(':')) continue
      if (!line.startsWith('data:')) continue
      const payload = line.slice(5).trim()
      if (payload === '[DONE]') continue

      try {
        const json = JSON.parse(payload) as {
          choices?: Array<{ delta?: { content?: string | null } }>
        }
        const piece = json.choices?.[0]?.delta?.content
        if (typeof piece === 'string' && piece.length > 0) {
          assistant += piece
        }
      } catch {
        // 忽略不完整 JSON 分片
      }
    }
  }

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          controller.enqueue(value)
          ingest(value)
        }
        await finish()
        controller.close()
      } catch (err) {
        await finish()
        try {
          controller.error(err)
        } catch {
          // controller 可能已关闭
        }
      }
    },
    async cancel() {
      try {
        await reader.cancel()
      } catch {
        // ignore
      }
      await finish()
    },
  })
}
