'use client'

import { useEffect, useState } from 'react'
import { resolveMediaDisplayUrl, resolveMediaThumbUrl } from '@/lib/idb'

/** 将 idb-wp: / http(s) 解析为可展示的 blob/http URL */
export function useResolvedMediaUrl(
  src: string | null | undefined,
  kind: 'full' | 'thumb' = 'full',
): string | null {
  const [url, setUrl] = useState<string | null>(() => {
    if (!src) return null
    if (src.startsWith('blob:') || src.startsWith('http://') || src.startsWith('https://')) return src
    return null
  })

  useEffect(() => {
    let cancelled = false
    if (!src) {
      setUrl(null)
      return
    }
    if (src.startsWith('blob:') || src.startsWith('http://') || src.startsWith('https://')) {
      setUrl(src)
      return
    }
    const resolve = kind === 'thumb' ? resolveMediaThumbUrl : resolveMediaDisplayUrl
    void resolve(src).then((u) => {
      if (!cancelled) setUrl(u)
    })
    return () => {
      cancelled = true
    }
  }, [src, kind])

  return url
}
