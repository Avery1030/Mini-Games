'use client'

import { useEffect, useState } from 'react'
import { SystemErrorScreen } from '@/components/desktop/SystemErrorScreen'
import './globals.css'

type GlobalErrorProps = {
  error: Error & { digest?: string }
  reset: () => void
}

const COPY = {
  zh: {
    code: '错误',
    title: 'Avery Mini OS',
    message: '桌面壳遇到严重错误，无法继续显示。\n你可以重试，或返回桌面重新开始。',
    home: '返回桌面',
    retry: '重试',
    lang: 'zh-CN',
  },
  en: {
    code: 'Error',
    title: 'Avery Mini OS',
    message: 'The desktop shell hit a critical error and cannot continue.\nYou can retry, or return to the desktop.',
    home: 'Back to desktop',
    retry: 'Retry',
    lang: 'en-US',
  },
} as const

/**
 * 根 layout 错误：须自带 html/body；文案写死双语以免依赖 intl Provider。
 */
export default function GlobalError({ error, reset }: GlobalErrorProps) {
  const [copy, setCopy] = useState<(typeof COPY)['zh'] | (typeof COPY)['en']>(COPY.zh)

  useEffect(() => {
    console.error(error)
  }, [error])

  useEffect(() => {
    const zh = document.documentElement.lang?.toLowerCase().startsWith('zh') ?? true
    setCopy(zh ? COPY.zh : COPY.en)
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
