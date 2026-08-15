'use client'

import { IdeApp } from './IdeApp'
import { HtmlPreviewApp } from './HtmlPreview'

export function bindIdeApp(windowId: string, initialPath: string | null) {
  return function IdeBound({ embedded }: { embedded?: boolean }) {
    return <IdeApp embedded={embedded} windowId={windowId} initialPath={initialPath} />
  }
}

export function bindHtmlPreviewApp(windowId: string) {
  return function PreviewBound({ embedded }: { embedded?: boolean }) {
    return <HtmlPreviewApp embedded={embedded} windowId={windowId} />
  }
}
