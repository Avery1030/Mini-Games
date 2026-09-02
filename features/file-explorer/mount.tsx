'use client'

import { FileExplorerApp } from './ExplorerApp'

export function bindExplorerApp(windowId: string, initialPath: string) {
  return function ExplorerBound() {
    return <FileExplorerApp windowId={windowId} initialPath={initialPath} />
  }
}
