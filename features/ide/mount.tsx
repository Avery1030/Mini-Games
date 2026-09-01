'use client'

import { IdeApp } from './IdeApp'
import { HtmlPreviewApp } from './HtmlPreview'

export function bindIdeApp(windowId: string, initialPath: Nullable<string>) {
  return function IdeBound() {
    return <IdeApp windowId={windowId} initialPath={initialPath} />
  }
}

export function bindHtmlPreviewApp(windowId: string) {
  return function PreviewBound() {
    return <HtmlPreviewApp windowId={windowId} />
  }
}
