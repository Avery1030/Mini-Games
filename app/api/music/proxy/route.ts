import { NextRequest, NextResponse } from 'next/server'

/** 仅允许代理白名单域名，防止被当成开放代理 */
function isAllowedHost(hostname: string): boolean {
  const h = hostname.toLowerCase()
  return (
    h === 'archive.org' ||
    h.endsWith('.archive.org') ||
    h === 'soundhelix.com' ||
    h === 'www.soundhelix.com' ||
    h === 'filesamples.com' ||
    h === 'www.filesamples.com' ||
    h === 'audio-ssl.itunes.apple.com' ||
    h.endsWith('.itunes.apple.com') ||
    h.endsWith('.mzstatic.com') ||
    h.endsWith('.dzcdn.net') ||
    h.endsWith('.deezer.com')
  )
}

/**
 * 同源音频代理：解决浏览器直连外链的 Referer / CORS / 部分 CDN 拦截问题。
 */
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('url')
  if (!raw) {
    return NextResponse.json({ error: '缺少 url' }, { status: 400 })
  }

  let target: URL
  try {
    target = new URL(raw)
  } catch {
    return NextResponse.json({ error: 'url 无效' }, { status: 400 })
  }

  if (target.protocol !== 'https:' && target.protocol !== 'http:') {
    return NextResponse.json({ error: '仅支持 http(s)' }, { status: 400 })
  }
  if (!isAllowedHost(target.hostname)) {
    return NextResponse.json({ error: '该音源域名不在白名单' }, { status: 403 })
  }

  const range = req.headers.get('range') ?? undefined
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 20_000)

  try {
    const upstream = await fetch(target.toString(), {
      headers: {
        'User-Agent': 'mini-app-music-player/1.0',
        Accept: 'audio/*,*/*;q=0.9',
        ...(range ? { Range: range } : {}),
      },
      redirect: 'follow',
      signal: controller.signal,
    })

    if (!upstream.ok && upstream.status !== 206) {
      return NextResponse.json(
        { error: `上游返回 ${upstream.status}` },
        { status: upstream.status === 404 ? 404 : 502 },
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
    if (!headers.has('content-type')) headers.set('content-type', 'audio/mp4')
    headers.set('cache-control', headers.get('cache-control') || 'public, max-age=3600')

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
