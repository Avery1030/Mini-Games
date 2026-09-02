'use client'

import { useTranslations } from 'next-intl'
import { Button, Input, toast } from '@/components/ui'
import { cn } from '@/lib/cn'
import { winChromeSunken } from '@/lib/winChrome'
import type { VfsItem } from '@/lib/vfs'

type Props = {
  address: string
  items: Record<string, VfsItem>
  onAddressChange: (value: string) => void
  onGo: (path: string) => void
}

export function ExplorerAddressBar({ address, items, onAddressChange, onGo }: Props) {
  const t = useTranslations('fileExplorer')

  const submit = () => {
    const next = address.trim() || '/'
    if (Object.values(items).some((it) => it.path === next && it.type === 'folder')) onGo(next)
    else toast.warning(t('invalidPath'))
  }

  return (
    <div className='shrink-0 flex items-center gap-1 px-1 py-1 border-b border-chrome-dark bg-chrome'>
      <span className='text-[10px] shrink-0'>{t('address')}</span>
      <div className={cn(winChromeSunken, 'flex-1 min-w-0 bg-field')}>
        <Input
          size='sm'
          tone='field'
          value={address}
          className='border-0 h-6'
          onChange={(e) => onAddressChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              submit()
            }
          }}
        />
      </div>
      <Button size='sm' onClick={submit}>
        {t('go')}
      </Button>
    </div>
  )
}
