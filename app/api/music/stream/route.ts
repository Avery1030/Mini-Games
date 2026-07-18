import { NextRequest, NextResponse } from 'next/server'
import {
  AUDIUS_TRACK_ID_RE,
  fetchAudiusAudio,
  fetchAudiusTrackStreamInfo,
} from '@/lib/music'

/**
 * 代理 Audius 完整音轨：主节点失败时自动换 mirror。
 */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')?.trim()
  if (!id || !AUDIUS_TRACK_ID_RE.test(id)) {
    return NextResponse.json({ error: '无效曲目 id' }, { status: 400 })
  }

  const range = req.headers.get('range') ?? undefined
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 45_000)

  try {
    const stream = await fetchAudiusTrackStreamInfo(id, controller.signal)
    let upstream = stream
      ? await fetchAudiusAudio(stream, { range, signal: controller.signal, timeoutMs: 15_000 })
      : null

    // 回退：走官方 /stream 重定向
    if (!upstream) {
      try {
        const res = await fetch(`https://api.audius.co/v1/tracks/${id}/stream`, {
          headers: {
            Accept: 'audio/*,*/*;q=0.9',
            'User-Agent': 'mini-app-music-player/1.0',
            ...(range ? { Range: range } : {}),
          },
          redirect: 'follow',
          signal: controller.signal,
          cache: 'no-store',
        })
        if (res.ok || res.status === 206) {
          const ct = res.headers.get('content-type') || ''
          if (!ct.includes('json') && !ct.includes('html') && !ct.includes('text/plain')) {
            upstream = res
          }
        }
      } catch {
        // ignore
      }
    }

    if (!upstream) {
      return NextResponse.json(
        { error: '音源不可用（节点拒绝或版权限制），请换一首或添加本地文件' },
        { status: 403 },
      )
    }

    const headers = new Headers()
    const pass = [
      'content-type',
      'content-length',
      'content-range',
      'accept-ranges',
      'cache-control',
    ] as const
    for (const key of pass) {
      const v = upstream.headers.get(key)
      if (v) headers.set(key, v)
    }
    if (!headers.has('content-type')) headers.set('content-type', 'audio/mpeg')
    if (!headers.has('accept-ranges')) headers.set('accept-ranges', 'bytes')
    headers.set('cache-control', 'private, max-age=300')

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers,
    })
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError'
    return NextResponse.json(
      { error: aborted ? '拉取音源超时' : '代理拉取失败' },
      { status: 502 },
    )
  } finally {
    clearTimeout(timer)
  }
}
