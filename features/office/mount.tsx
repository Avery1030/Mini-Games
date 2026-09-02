'use client'

import { WriterApp } from './writer'
import { SheetApp } from './sheet'
import type { OfficeKind } from './schema'

export function bindOfficeApp(kind: OfficeKind, windowId: string, initialFileId: Nullable<string>) {
  if (kind === 'sheet') {
    return function SheetBound() {
      return <SheetApp windowId={windowId} initialFileId={initialFileId} />
    }
  }
  return function WriterBound() {
    return <WriterApp windowId={windowId} initialFileId={initialFileId} />
  }
}
