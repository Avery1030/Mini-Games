'use client'

import { useEffect, useState } from 'react'
import { SystemErrorScreen } from '@/components/desktop/SystemErrorScreen'
import './globals.css'

type GlobalErrorProps = {
  error: Error & { digest?: string }
  reset: () => void
}

type Copy = {
  code: string
  title: string
  message: string
  home: string
  retry: string
  lang: string
}

const COPY: Record<string, Copy> = {
  'zh-CN': {
    code: '错误',
    title: 'Avery Mini OS',
    message: '桌面壳遇到严重错误，无法继续显示。\n你可以重试，或返回桌面重新开始。',
    home: '返回桌面',
    retry: '重试',
    lang: 'zh-CN',
  },
  'en-US': {
    code: 'Error',
    title: 'Avery Mini OS',
    message: 'The desktop shell hit a critical error and cannot continue.\nYou can retry, or return to the desktop.',
    home: 'Back to desktop',
    retry: 'Retry',
    lang: 'en-US',
  },
  'ja-JP': {
    code: 'エラー',
    title: 'Avery Mini OS',
    message: 'デスクトップで重大なエラーが発生し、表示を続けられません。\n再試行するか、デスクトップに戻ってください。',
    home: 'デスクトップへ',
    retry: '再試行',
    lang: 'ja-JP',
  },
}

function pickCopy(langAttr: Nullable<string> | undefined): Copy {
  const raw = (langAttr || '').toLowerCase()
  if (raw.startsWith('zh')) return COPY['zh-CN']
  if (raw.startsWith('ja')) return COPY['ja-JP']
  if (raw.startsWith('en')) return COPY['en-US']
  return COPY['zh-CN']
}

/**
 * 根 layout 错误：须自带 html/body；文案写死以免依赖 intl Provider。
 */
export default function GlobalError({ error, reset }: GlobalErrorProps) {
  const [copy, setCopy] = useState<Copy>(COPY['zh-CN'])

  useEffect(() => {
    console.error(error)
  }, [error])

  useEffect(() => {
    setCopy(pickCopy(document.documentElement.lang))
  }, [])

  const detail =
    process.env.NODE_ENV === 'development'
      ? [error.message, error.digest ? `digest: ${error.digest}` : null].filter(Boolean).join('\n')
      : error.digest
        ? `digest: ${error.digest}`
        : null

  return (
    <html lang={copy.lang} suppressHydrationWarning>
      <body className='antialiased'>
        <SystemErrorScreen
          variant='error'
          code={copy.code}
          title={copy.title}
          message={copy.message}
          homeLabel={copy.home}
          retryLabel={copy.retry}
          onRetry={reset}
          detail={detail}
        />
      </body>
    </html>
  )
}
