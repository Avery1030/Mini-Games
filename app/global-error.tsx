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
  'zh-TW': {
    code: '錯誤',
    title: 'Avery Mini OS',
    message: '桌面殼遇到嚴重錯誤，無法繼續顯示。\n你可以重試，或返回桌面重新開始。',
    home: '返回桌面',
    retry: '重試',
    lang: 'zh-TW',
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
  'ru-RU': {
    code: 'Ошибка',
    title: 'Avery Mini OS',
    message: 'В оболочке рабочего стола произошла критическая ошибка.\nМожно повторить попытку или вернуться на рабочий стол.',
    home: 'На рабочий стол',
    retry: 'Повторить',
    lang: 'ru-RU',
  },
  'de-DE': {
    code: 'Fehler',
    title: 'Avery Mini OS',
    message: 'Die Desktop-Umgebung ist auf einen schweren Fehler gestoßen.\nSie können es erneut versuchen oder zum Desktop zurückkehren.',
    home: 'Zum Desktop',
    retry: 'Erneut versuchen',
    lang: 'de-DE',
  },
  'fr-FR': {
    code: 'Erreur',
    title: 'Avery Mini OS',
    message: "Le bureau a rencontré une erreur critique et ne peut pas continuer.\nVous pouvez réessayer ou revenir au bureau.",
    home: 'Retour au bureau',
    retry: 'Réessayer',
    lang: 'fr-FR',
  },
}

function pickCopy(langAttr: string | null | undefined): Copy {
  const raw = (langAttr || '').toLowerCase()
  if (raw.startsWith('zh-tw') || raw.startsWith('zh-hk') || raw.startsWith('zh-mo')) return COPY['zh-TW']
  if (raw.startsWith('zh')) return COPY['zh-CN']
  if (raw.startsWith('ja')) return COPY['ja-JP']
  if (raw.startsWith('ru')) return COPY['ru-RU']
  if (raw.startsWith('de')) return COPY['de-DE']
  if (raw.startsWith('fr')) return COPY['fr-FR']
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
