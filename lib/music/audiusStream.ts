/** Audius 音轨 id */
export const AUDIUS_TRACK_ID_RE = /^[a-zA-Z0-9]{4,32}$/

export type AudiusStreamInfo = {
  url?: string
  mirrors?: string[]
}

/**
 * 从主节点 + mirrors 拼出候选播放地址（签名在 query 上，可换 host）。
 */
export function buildAudiusStreamCandidates(stream: AudiusStreamInfo | null | undefined): string[] {
  const primary = stream?.url?.trim()
  if (!primary) return []
  const out: string[] = [primary]
  try {
    const u = new URL(primary)
    const pathq = u.pathname + u.search
    for (const mirror of stream?.mirrors ?? []) {
      if (!mirror) continue
      try {
        const base = new URL(mirror)
        const candidate = `${base.origin}${pathq}`
        if (!out.includes(candidate)) out.push(candidate)
      } catch {
        // ignore bad mirror
      }
    }
  } catch {
    // primary invalid
  }
  return out
}

async function fetchAudioPartial(
  url: string,
  init?: { range?: string; signal?: AbortSignal },
): Promise<Response | null> {
  try {
    const res = await fetch(url, {
      headers: {
        Accept: 'audio/*,*/*;q=0.9',
        'User-Agent': 'mini-windows-desktop-music-player/1.0',
        ...(init?.range ? { Range: init.range } : { Range: 'bytes=0-1023' }),
      },
      redirect: 'follow',
      signal: init?.signal,
      cache: 'no-store',
    })
    if (res.ok || res.status === 206) {
      const ct = res.headers.get('content-type') || ''
      // 排除 JSON/HTML 错误页
      if (ct.includes('json') || ct.includes('text/html') || ct.includes('text/plain')) {
        // 少数节点用 octet-stream；若 body 很小且是 plain，视为失败
        if (ct.includes('text/plain') || ct.includes('json') || ct.includes('html')) {
          return null
        }
      }
      return res
    }
    return null
  } catch {
    return null
  }
}

/**
 * 依次尝试主节点与 mirrors，返回首个可用的完整 Response（可带 Range）。
 */
export async function fetchAudiusAudio(
  stream: AudiusStreamInfo | null | undefined,
  opts?: { range?: string; signal?: AbortSignal; timeoutMs?: number },
): Promise<Response | null> {
  const candidates = buildAudiusStreamCandidates(stream)
  if (!candidates.length) return null

  const timeoutMs = opts?.timeoutMs ?? 12_000
  for (const url of candidates) {
    if (opts?.signal?.aborted) return null
    const controller = new AbortController()
    const onAbort = () => controller.abort()
    opts?.signal?.addEventListener('abort', onAbort)
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      // 先用小 Range 探测；若调用方要完整流且探测成功，再按 Range 拉
      if (opts?.range) {
        const res = await fetch(url, {
          headers: {
            Accept: 'audio/*,*/*;q=0.9',
            'User-Agent': 'mini-windows-desktop-music-player/1.0',
            Range: opts.range,
          },
          redirect: 'follow',
          signal: controller.signal,
          cache: 'no-store',
        })
        if (res.ok || res.status === 206) {
          const ct = res.headers.get('content-type') || ''
          if (ct.includes('json') || ct.includes('html') || ct.includes('text/plain')) continue
          return res
        }
      } else {
        // 无 Range：直接拉整轨（用于代理给 <audio> 首次请求）
        const res = await fetch(url, {
          headers: {
            Accept: 'audio/*,*/*;q=0.9',
            'User-Agent': 'mini-windows-desktop-music-player/1.0',
          },
          redirect: 'follow',
          signal: controller.signal,
          cache: 'no-store',
        })
        if (res.ok || res.status === 206) {
          const ct = res.headers.get('content-type') || ''
          if (ct.includes('json') || ct.includes('html') || ct.includes('text/plain')) continue
          return res
        }
      }
    } catch {
      // try next
    } finally {
      clearTimeout(timer)
      opts?.signal?.removeEventListener('abort', onAbort)
    }
  }
  return null
}

/** 轻量探测：该 stream 是否真能下到音频（版权删除的曲目常为 403） */
export async function isAudiusStreamPlayable(
  stream: AudiusStreamInfo | null | undefined,
  signal?: AbortSignal,
): Promise<boolean> {
  const candidates = buildAudiusStreamCandidates(stream)
  for (const url of candidates) {
    if (signal?.aborted) return false
    const controller = new AbortController()
    const onAbort = () => controller.abort()
    signal?.addEventListener('abort', onAbort)
    const timer = setTimeout(() => controller.abort(), 6_000)
    try {
      const res = await fetchAudioPartial(url, { signal: controller.signal })
      if (res) {
        // 读一点确认不是空错误页
        const buf = await res.arrayBuffer()
        if (buf.byteLength > 64) return true
      }
    } catch {
      // next
    } finally {
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
    }
  }
  return false
}

export async function fetchAudiusTrackStreamInfo(
  trackId: string,
  signal?: AbortSignal,
): Promise<AudiusStreamInfo | null> {
  const res = await fetch(`https://api.audius.co/v1/tracks/${trackId}`, {
    headers: { Accept: 'application/json' },
    signal,
    cache: 'no-store',
  })
  if (!res.ok) return null
  const json = (await res.json()) as {
    data?:
      | { stream?: AudiusStreamInfo; is_stream_gated?: boolean }
      | Array<{ stream?: AudiusStreamInfo; is_stream_gated?: boolean }>
  }
  const track = Array.isArray(json.data) ? json.data[0] : json.data
  if (!track || track.is_stream_gated) return null
  return track.stream ?? null
}
