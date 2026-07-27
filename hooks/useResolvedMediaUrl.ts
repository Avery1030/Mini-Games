'use client'

import { useEffect, useState } from 'react'
import { resolveMediaDisplayUrl, resolveMediaThumbUrl } from '@/lib/idb'

/** 将 idb-wp: / http(s) 解析为可展示的 blob/http URL（不信任持久化的死 blob:） */
export function useResolvedMediaUrl(
  src: string | null | undefined,
  kind: 'full' | 'thumb' = 'full',
): string | null {
  const [url, setUrl] = useState<string | null>(() => {
    if (!src) return null
    if (src.startsWith('http://') || src.startsWith('https://')) return src
    return null
  })

  useEffect(() => {
    let cancelled = false
    if (!src) {
      setUrl(null)
      return
    }
    if (src.startsWith('http://') || src.startsWith('https://')) {
      setUrl(src)
      return
    }
    // blob: 可能是刷新前残留，统一走 resolve（仅本会话 live 的才放行）
    const resolve = kind === 'thumb' ? resolveMediaThumbUrl : resolveMediaDisplayUrl
    void resolve(src)
      .then((u) => {
        if (!cancelled) setUrl(u)
      })
      .catch((err) => {
        console.error('[media] resolve failed', src, err)
        if (!cancelled) setUrl(null)
      })
    return () => {
      cancelled = true
    }
  }, [src, kind])

  return url
}
