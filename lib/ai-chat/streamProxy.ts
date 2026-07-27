/**
 * 透传上游 SSE，同时解析 delta 文本；流结束或取消时回调完整助手回复。
 * 支持空闲超时，避免上游挂死导致浏览器一直 pending。
 */
export function proxyChatSseStream(
  upstream: ReadableStream<Uint8Array>,
  onComplete: (assistantText: string) => Promise<void>,
  options?: { idleTimeoutMs?: number; signal?: AbortSignal },
): ReadableStream<Uint8Array> {
  const reader = upstream.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let assistant = ''
  let settled = false
  const idleTimeoutMs = options?.idleTimeoutMs ?? 60_000

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
      let idleTimer: ReturnType<typeof setTimeout> | undefined
      const clearIdle = () => {
        if (idleTimer !== undefined) clearTimeout(idleTimer)
        idleTimer = undefined
      }
      const armIdle = () => {
        clearIdle()
        if (idleTimeoutMs <= 0) return
        idleTimer = setTimeout(() => {
          void reader.cancel().catch(() => {})
          try {
            controller.error(new Error(`Upstream stream idle timeout after ${idleTimeoutMs}ms`))
          } catch {
            // controller 可能已关闭
          }
        }, idleTimeoutMs)
      }

      const onAbort = () => {
        void reader.cancel().catch(() => {})
      }
      options?.signal?.addEventListener('abort', onAbort, { once: true })
      if (options?.signal?.aborted) onAbort()

      try {
        armIdle()
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          armIdle()
          controller.enqueue(value)
          ingest(value)
        }
        clearIdle()
        await finish()
        controller.close()
      } catch (err) {
        clearIdle()
        await finish()
        try {
          controller.error(err)
        } catch {
          // controller 可能已关闭
        }
      } finally {
        options?.signal?.removeEventListener('abort', onAbort)
        clearIdle()
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
