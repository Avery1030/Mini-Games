'use client'

import { useEffect, useState } from 'react'
import { resolveWallpaperDisplayUrl, resolveWallpaperThumbUrl } from '@/lib/wallpaper'

/** 将 VFS / public / http(s) 壁纸引用解析为可展示 URL */
export function useResolvedMediaUrl(
  src: Nullable<string> | undefined,
  kind: 'full' | 'thumb' = 'full',
): Nullable<string> {
  const [url, setUrl] = useState<Nullable<string>>(() => {
    if (!src) return null
    if (src.startsWith('http://') || src.startsWith('https://')) return src
    if (src.startsWith('/wallpapers/')) return src
    return null
  })

  useEffect(() => {
    let cancelled = false
    if (!src) {
      setUrl(null)
      return
    }
    if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('/wallpapers/')) {
      setUrl(src)
      return
    }
    const resolve = kind === 'thumb' ? resolveWallpaperThumbUrl : resolveWallpaperDisplayUrl
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
