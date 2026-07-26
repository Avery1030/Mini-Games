import { NextRequest, NextResponse } from 'next/server'
import { importImageFromUrl, listImages, saveImageFromFile, toPublicImage } from '@/lib/image-viewer'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const images = await listImages()
    return NextResponse.json({
      images: images.map(toPublicImage),
    })
  } catch (err) {
    console.error('[image-viewer] list', err)
    return NextResponse.json({ error: '加载图片列表失败' }, { status: 500 })
  }
}

/**
 * POST multipart：字段 file（可多个）上传本地图
 * POST JSON：{ url } 从外链导入并落盘
 */
export async function POST(req: NextRequest) {
  const ct = req.headers.get('content-type') || ''

  if (ct.includes('application/json')) {
    let body: { url?: string }
    try {
      body = (await req.json()) as { url?: string }
    } catch {
      return NextResponse.json({ error: '无效 JSON' }, { status: 400 })
    }
    try {
      const image = await importImageFromUrl(body.url ?? '')
      return NextResponse.json({ image: toPublicImage(image) }, { status: 201 })
    } catch (err) {
      const message = err instanceof Error ? err.message : '导入失败'
      const status = /缺少|无效|仅支持|不是|拉取|超时|上限|小于|为空/i.test(message) ? 400 : 502
      return NextResponse.json({ error: message }, { status })
    }
  }

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: '无效的表单数据' }, { status: 400 })
  }

  const files = form
    .getAll('file')
    .filter((f): f is File => f instanceof File && f.size > 0)

  if (files.length === 0) {
    return NextResponse.json({ error: '请选择图片文件' }, { status: 400 })
  }

  try {
    const images = []
    for (const file of files) {
      const image = await saveImageFromFile(file)
      images.push(toPublicImage(image))
    }
    return NextResponse.json({ images }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : '上传失败'
    const status = /请选择|仅支持|小于|上限|为空/i.test(message) ? 400 : 500
    console.error('[image-viewer] upload', err)
    return NextResponse.json({ error: message }, { status })
  }
}
