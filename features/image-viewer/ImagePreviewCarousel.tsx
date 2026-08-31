'use client'

import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react'

const SLIDE_MS = 280

export type SlideDirection = -1 | 0 | 1

type Props = {
  src: Nullable<string>
  alt: string
  /** 1=下一张从右入，-1=上一张从左入，0=无动画（点选列表等） */
  direction: SlideDirection
}

type Stage = {
  current: Nullable<string>
  outgoing: Nullable<string>
  dir: -1 | 1
  animating: boolean
}

/**
 * 主预览区轮播：切换时旧图滑出淡出、新图滑入淡入。
 */
export function ImagePreviewCarousel({ src, alt, direction }: Props) {
  const srcRef = useRef(src)
  const [stage, setStage] = useState<Stage>({
    current: src,
    outgoing: null,
    dir: 1,
    animating: false,
  })

  useLayoutEffect(() => {
    if (src === srcRef.current) return
    const from = srcRef.current
    srcRef.current = src

    if (!src || !from || direction === 0) {
      setStage({ current: src, outgoing: null, dir: 1, animating: false })
      return
    }

    const dir: -1 | 1 = direction < 0 ? -1 : 1
    setStage({ current: src, outgoing: from, dir, animating: true })
    const timer = window.setTimeout(() => {
      setStage((s) => ({ ...s, outgoing: null, animating: false }))
    }, SLIDE_MS)
    return () => window.clearTimeout(timer)
  }, [src, direction])

  if (!stage.current && !stage.outgoing) return null

  const leaveStyle: CSSProperties = {
    animation: `${stage.dir === 1 ? 'imgViewerSlideOutLeft' : 'imgViewerSlideOutRight'} ${SLIDE_MS}ms ease-out both`,
  }
  const enterStyle: CSSProperties | undefined =
    stage.animating && stage.outgoing
      ? {
          animation: `${stage.dir === 1 ? 'imgViewerSlideInRight' : 'imgViewerSlideInLeft'} ${SLIDE_MS}ms ease-out both`,
        }
      : undefined

  return (
    <div className='relative w-full h-full flex items-center justify-center overflow-hidden'>
      {stage.outgoing ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={`out-${stage.outgoing}`}
          src={stage.outgoing}
          alt=''
          aria-hidden
          decoding='async'
          draggable={false}
          className='absolute max-w-full max-h-full object-contain border border-chrome-dark bg-chrome/20 pointer-events-none'
          style={leaveStyle}
        />
      ) : null}
      {stage.current ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={`in-${stage.current}`}
          src={stage.current}
          alt={alt}
          decoding='async'
          draggable={false}
          className='absolute max-w-full max-h-full object-contain border border-chrome-dark bg-chrome/20'
          style={enterStyle}
        />
      ) : null}
    </div>
  )
}
