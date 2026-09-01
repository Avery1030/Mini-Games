import type { Metadata } from 'next'
import { getMessages } from 'next-intl/server'
import { formatDesktopDocumentTitle } from '@/lib/desktop/documentTitle'

type WindowPageProps = {
  params: Promise<{ slug: string }>
}

function appNameFromMessages(messages: unknown, slug: string): string {
  if (!messages || typeof messages !== 'object' || !('apps' in messages)) return slug
  const apps = (messages as { apps?: unknown }).apps
  if (!apps || typeof apps !== 'object') return slug
  const value = (apps as Record<string, unknown>)[slug]
  return typeof value === 'string' && value.trim() ? value.trim() : slug
}

/** 刷新 `/window/spider` 时首屏 HTML 就要带上应用名，不能等客户端再改。 */
export async function generateMetadata({ params }: WindowPageProps): Promise<Metadata> {
  const { slug } = await params
  let id = slug
  try {
    id = decodeURIComponent(slug)
  } catch {
    /* keep raw */
  }
  const messages = await getMessages()
  return { title: formatDesktopDocumentTitle(appNameFromMessages(messages, id)) }
}

/** 窗口深链标记路由；UI 由父 layout 的 DesktopPage 提供。 */
export default function WindowRoutePage() {
  return null
}
