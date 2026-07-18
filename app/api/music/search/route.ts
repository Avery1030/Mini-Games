import { NextRequest, NextResponse } from 'next/server'

type ITunesTrack = {
  trackId?: number
  trackName?: string
  artistName?: string
  collectionName?: string
  previewUrl?: string
  artworkUrl100?: string
  trackTimeMillis?: number
}

/**
 * 使用 Apple iTunes Search API（官方公开接口）搜索曲目，返回约 30 秒试听链接。
 * 不爬取任何商业流媒体平台私有接口。
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
  const country = req.nextUrl.searchParams.get('country')?.trim() || 'CN'

  const url = new URL('https://itunes.apple.com/search')
  url.searchParams.set('term', q)
  url.searchParams.set('media', 'music')
  url.searchParams.set('entity', 'song')
  url.searchParams.set('limit', String(rows))
  url.searchParams.set('country', country)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 12_000)

  try {
    const res = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
      cache: 'no-store',
    })
    if (!res.ok) {
      return NextResponse.json({ error: `搜索失败 (${res.status})` }, { status: 502 })
    }

    const data = (await res.json()) as { results?: ITunesTrack[]; resultCount?: number }
    const results = (data.results ?? [])
      .filter((t) => t.trackId && t.previewUrl && t.trackName)
      .map((t) => ({
        id: String(t.trackId),
        title: t.trackName!,
        artist: t.artistName || t.collectionName || '未知艺人',
        album: t.collectionName,
        artwork: t.artworkUrl100,
        previewUrl: t.previewUrl!,
        durationHint: t.trackTimeMillis ? t.trackTimeMillis / 1000 : undefined,
        source: 'itunes' as const,
      }))

    return NextResponse.json({
      results,
      total: results.length,
      note: '试听约为官方 30 秒预览',
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
