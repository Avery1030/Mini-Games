import { HttpError } from '@/lib/http'

/** 经服务端代理拉取外链图片（绕过 CORS），不落盘 */
export async function fetchRemoteImageBlob(url: string): Promise<{ blob: Blob; contentType: Nullable<string> }> {
  const res = await fetch('/api/proxy-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })
  if (!res.ok) {
    let message = `HTTP ${res.status}`
    try {
      const data = (await res.json()) as { error?: string }
      if (data.error) message = data.error
    } catch {
      // ignore
    }
    throw new HttpError(message, res.status, null, res)
  }
  const contentType = res.headers.get('content-type')
  const blob = await res.blob()
  return { blob, contentType }
}
