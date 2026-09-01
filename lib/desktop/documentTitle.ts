/** 与桌面壳、深链 metadata 共用的浏览器标签页标题。 */

export const DESKTOP_DOCUMENT_TITLE = 'Avery Mini OS'

export function formatDesktopDocumentTitle(winTitle: string): string {
  const trimmed = winTitle.trim()
  if (!trimmed) return DESKTOP_DOCUMENT_TITLE
  return `${trimmed} - ${DESKTOP_DOCUMENT_TITLE}`
}
