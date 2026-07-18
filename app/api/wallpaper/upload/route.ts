import { NextRequest, NextResponse } from 'next/server'

type ImgBBResponse = {
  success?: boolean
  status?: number
  error?: { message?: string }
  data?: {
    url?: string
    display_url?: string
    delete_url?: string
    image?: { url?: string }
  }
}

/**
 * 上传壁纸到 ImgBB，返回 CDN 直链。
 * 需在环境变量配置 IMGBB_API_KEY（https://api.imgbb.com/ 免费申请）
 */
export async function POST(req: NextRequest) {
  const apiKey = process.env.IMGBB_API_KEY?.trim()
  if (!apiKey) {
    return NextResponse.json(
      {
        error: '未配置 IMGBB_API_KEY。请到 https://api.imgbb.com/ 申请免费 Key，写入 .env.local',
      },
      { status: 503 },
    )
  }

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: '无效的表单数据' }, { status: 400 })
  }

  const file = form.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: '请选择图片文件' }, { status: 400 })
  }
  if (!file.type.startsWith('image/') && !/\.(jpe?g|png|gif|webp|bmp)$/i.test(file.name)) {
    return NextResponse.json({ error: '仅支持图片文件' }, { status: 400 })
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: '上传文件请小于 10MB（请先压缩）' }, { status: 400 })
  }

  const bytes = Buffer.from(await file.arrayBuffer())
  const base64 = bytes.toString('base64')

  const body = new FormData()
  body.append('image', base64)
  body.append('name', `wallpaper-${Date.now()}`)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 30_000)

  try {
    const upstream = await fetch(`https://api.imgbb.com/1/upload?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      body,
      signal: controller.signal,
    })

    const json = (await upstream.json()) as ImgBBResponse
    if (!upstream.ok || !json.success) {
      return NextResponse.json(
        { error: json.error?.message || `图床上传失败 (${upstream.status})` },
        { status: 502 },
      )
    }

    // 优先原图直链；display_url 常为中等缩略图，全屏会糊
    const url = json.data?.image?.url || json.data?.url || json.data?.display_url
    if (!url) {
      return NextResponse.json({ error: '图床未返回图片地址' }, { status: 502 })
    }

    return NextResponse.json({
      url,
      deleteUrl: json.data?.delete_url,
      provider: 'imgbb',
    })
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError'
    return NextResponse.json(
      { error: aborted ? '上传超时，请稍后重试' : '上传服务暂时不可用' },
      { status: 502 },
    )
  } finally {
    clearTimeout(timer)
  }
}
