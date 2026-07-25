'use client'

import { useEffect, useRef } from 'react'

export const FIREWORKS_BG = '#000000'

export type FireworksViewProps = {
  /** 设置页小预览：隐藏控件 */
  preview?: boolean
  className?: string
}

/**
 * 原生 Canvas 烟花（Caleb Miller），iframe 嵌入；设置存独立 localStorage。
 */
export function FireworksView({ preview = false, className }: FireworksViewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const src = preview ? '/fireworks/index.html?preview=1' : '/fireworks/index.html?embedded=1'

  useEffect(() => {
    if (preview) return
    const iframe = iframeRef.current
    if (!iframe) return

    const focusIframe = () => {
      try {
        iframe.contentWindow?.focus()
      } catch {
        /* cross-origin noop */
      }
    }
    focusIframe()
    iframe.addEventListener('load', focusIframe)
    return () => iframe.removeEventListener('load', focusIframe)
  }, [preview])

  return (
    <iframe
      ref={iframeRef}
      title='Fireworks screensaver'
      src={src}
      className={className}
      allow='autoplay'
      style={{
        border: 0,
        width: '100%',
        height: '100%',
        display: 'block',
        background: FIREWORKS_BG,
      }}
    />
  )
}

/** 向烟花 iframe 转发 Esc（由屏保壳处理） */
export function postFireworksEsc(iframe: HTMLIFrameElement | null) {
  try {
    iframe?.contentWindow?.postMessage({ type: 'avery-fireworks-esc' }, '*')
  } catch {
    /* ignore */
  }
}
