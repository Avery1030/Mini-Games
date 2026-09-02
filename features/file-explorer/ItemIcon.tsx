'use client'

import {
  File,
  FileCode,
  FileText,
  Folder,
  Gamepad2,
  HardDrive,
  Image as ImageIcon,
  Monitor,
  ScrollText,
  Table2,
  Trash2,
} from 'lucide-react'
import type { VfsIconKey } from '@/lib/vfs'

export function ItemIcon({ icon, size = 16 }: { icon: VfsIconKey; size?: number }) {
  const props = { size, className: 'shrink-0' as const }
  if (icon === 'folder' || icon === 'documents') return <Folder {...props} />
  if (icon === 'desktop') return <Monitor {...props} />
  if (icon === 'computer') return <HardDrive {...props} />
  if (icon === 'games') return <Gamepad2 {...props} />
  if (icon === 'trash') return <Trash2 {...props} />
  if (icon === 'wps') return <ScrollText {...props} />
  if (icon === 'et') return <Table2 {...props} />
  if (icon === 'txt') return <FileText {...props} />
  if (icon === 'image') return <ImageIcon {...props} />
  if (icon === 'code') return <FileCode {...props} />
  if (icon === 'exe') return <Gamepad2 {...props} />
  return <File {...props} />
}
