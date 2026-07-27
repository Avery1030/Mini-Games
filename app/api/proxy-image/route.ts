import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_BYTES = 10 * 1024 * 1024

/**
 * 外链图片 CORS 代理：拉取后原样回传，不落盘。
 * 供壁纸 / 图片查看器在客户端写入 IndexedDB。
 */
export async function POST(req: NextRequest) {
  let body: { url?: string }
  try {
    body = (await req.json()) as { url?: string }
  } catch {
    return NextResponse.json({ error: '无效 JSON' }, { status: 400 })
  }

  const raw = body.url?.trim()
  if (!raw) return NextResponse.json({ error: '缺少 url' }, { status: 400 })

  let target: URL
  try {
    target = new URL(raw)
  } catch {
    return NextResponse.json({ error: 'url 无效' }, { status: 400 })
  }
  if (target.protocol !== 'https:' && target.protocol !== 'http:') {
    return NextResponse.json({ error: '仅支持 http(s)' }, { status: 400 })
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 30_000)

  try {
    const upstream = await fetch(target.toString(), {
      headers: {
        Accept: 'image/*,*/*;q=0.8',
        'User-Agent': 'mini-windows-desktop-proxy/1.0',
      },
      redirect: 'follow',
      signal: controller.signal,
    })
    if (!upstream.ok) {
      return NextResponse.json({ error: `拉取失败 (${upstream.status})` }, { status: 502 })
    }

    const ct = upstream.headers.get('content-type')
    if (ct && !ct.startsWith('image/') && !ct.includes('octet-stream')) {
      return NextResponse.json({ error: '目标不是图片' }, { status: 400 })
    }

    const buf = Buffer.from(await upstream.arrayBuffer())
    if (buf.length === 0 || buf.length > MAX_BYTES) {
      return NextResponse.json({ error: '图片为空或超过 10MB' }, { status: 400 })
    }

    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': ct && ct.startsWith('image/') ? ct : 'application/octet-stream',
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError'
    return NextResponse.json({ error: aborted ? '拉取超时' : '导入失败' }, { status: 502 })
  } finally {
    clearTimeout(timer)
  }
}
