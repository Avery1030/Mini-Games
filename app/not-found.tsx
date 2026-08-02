'use client'

import { SystemErrorScreen } from '@/components/desktop/SystemErrorScreen'
import { useTranslations } from 'next-intl'

/**
 * 未匹配路由：Win95 风格 404。
 */
export default function NotFoundPage() {
  const t = useTranslations('systemError')

  return (
    <SystemErrorScreen
      variant='notFound'
      code='404'
      title={t('notFoundTitle')}
      message={t('notFoundMessage')}
      homeLabel={t('backHome')}
    />
  )
}
