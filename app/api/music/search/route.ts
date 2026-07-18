import { NextRequest, NextResponse } from 'next/server'
import { isAudiusStreamPlayable, type AudiusStreamInfo } from '@/utils/audiusStream'

type AudiusUser = {
  name?: string
  handle?: string
}

type AudiusTrack = {
  id?: string
  title?: string
  duration?: number
  is_streamable?: boolean
  is_stream_gated?: boolean
  user?: AudiusUser
  artwork?: Record<string, string>
  stream?: AudiusStreamInfo
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const i = next++
      results[i] = await fn(items[i])
    }
  }
  const n = Math.min(concurrency, Math.max(1, items.length))
  await Promise.all(Array.from({ length: n }, () => worker()))
  return results
}

/**
 * 搜索 Audius 开放曲库，并过滤掉实际无法拉取的音源（如版权 403）。
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q) {
    return NextResponse.json({ error: '请输入关键词' }, { status: 400 })
  }
  if (q.length > 80) {
    return NextResponse.json({ error: '关键词过长' }, { status: 400 })
  }

  const rows = Math.min(30, Math.max(5, Number(req.nextUrl.searchParams.get('rows') || 20)))
  // 多搜一些，过滤后仍够用
  const fetchLimit = Math.min(40, rows * 2)

  const url = new URL('https://api.audius.co/v1/tracks/search')
  url.searchParams.set('query', q)
  url.searchParams.set('limit', String(fetchLimit))

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 20_000)

  try {
    const res = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
      cache: 'no-store',
    })
    if (!res.ok) {
      return NextResponse.json({ error: `搜索失败 (${res.status})` }, { status: 502 })
    }

    const data = (await res.json()) as { data?: AudiusTrack[] }
    const candidates = (data.data ?? []).filter(
      (t) =>
        t.id &&
        t.title &&
        t.is_stream_gated !== true &&
        typeof t.duration === 'number' &&
        t.duration > 20 &&
        t.stream?.url,
    )

    const playableFlags = await mapWithConcurrency(candidates, 6, async (t) => {
      if (controller.signal.aborted) return false
      return isAudiusStreamPlayable(t.stream, controller.signal)
    })

    const results = candidates
      .filter((_, i) => playableFlags[i])
      .slice(0, rows)
      .map((t) => {
        const artist = t.user?.name || t.user?.handle || '未知艺人'
        const artwork =
          t.artwork?.['150x150'] || t.artwork?.['480x480'] || t.artwork?.['1000x1000']
        return {
          id: t.id!,
          title: t.title!,
          artist,
          artwork,
          previewUrl: `/api/music/stream?id=${encodeURIComponent(t.id!)}`,
          durationHint: t.duration,
          source: 'audius' as const,
          full: true,
        }
      })

    if (results.length === 0) {
      return NextResponse.json({
        results: [],
        total: 0,
        error:
          '没有可播放的完整音源。热门正版歌在 Audius 上常被节点拒绝（403），请换关键词（如 lofi、chill）或用「本地」导入自己的文件。',
      })
    }

    return NextResponse.json({
      results,
      total: results.length,
      note: '已过滤不可播放音源；结果为 Audius 开放曲库完整音轨',
    })
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError'
    return NextResponse.json(
      { error: aborted ? '搜索超时，请稍后重试' : '搜索服务暂时不可用' },
      { status: 502 },
    )
  } finally {
    clearTimeout(timer)
  }
}
