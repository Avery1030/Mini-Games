'use client'

import { useTranslations } from 'next-intl'
import { Panel } from '@/components/ui'
import { cn } from '@/lib/cn'
import type { VfsItem } from '@/lib/vfs'
import { ItemIcon } from './ItemIcon'
import { TREE_ROOTS } from './types'

type Props = {
  cwd: string
  items: Record<string, VfsItem>
  onNavigate: (path: string) => void
}

export function ExplorerTree({ cwd, items, onNavigate }: Props) {
  const t = useTranslations('fileExplorer')
  return (
    <Panel inset padded={false} className='w-44 shrink-0 overflow-auto bg-field'>
      <nav className='py-1'>
        {TREE_ROOTS.map((root) => {
          const node = Object.values(items).find((it) => it.path === root.path)
          const active = cwd === root.path || (root.path !== '/' && cwd.startsWith(`${root.path}/`))
          return (
            <button
              key={root.path}
              type='button'
              className={cn(
                'w-full flex items-center gap-1 px-2 py-0.5 text-left text-[11px]',
                active ? 'bg-icon-select text-icon-select-fg' : 'hover:bg-icon-select/30',
              )}
              onClick={() => onNavigate(root.path)}
            >
              <ItemIcon icon={node?.icon ?? 'folder'} size={14} />
              <span className='truncate'>{t(root.labelKey)}</span>
            </button>
          )
        })}
      </nav>
    </Panel>
  )
}
