'use client'

import { useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { SystemErrorScreen } from '@/components/desktop/SystemErrorScreen'

type ErrorPageProps = {
  error: Error & { digest?: string }
  reset: () => void
}

/**
 * 路由段错误边界：Win95 风格异常对话框。
 */
export default function ErrorPage({ error, reset }: ErrorPageProps) {
  const t = useTranslations('systemError')

  useEffect(() => {
    console.error(error)
  }, [error])

  const detail =
    process.env.NODE_ENV === 'development'
      ? [error.message, error.digest ? `digest: ${error.digest}` : null].filter(Boolean).join('\n')
      : error.digest
        ? `digest: ${error.digest}`
        : null

  return (
    <SystemErrorScreen
      variant='error'
      code={t('errorCode')}
      title={t('errorTitle')}
      message={t('errorMessage')}
      homeLabel={t('backHome')}
      retryLabel={t('retry')}
      onRetry={reset}
      detail={detail}
    />
  )
}
