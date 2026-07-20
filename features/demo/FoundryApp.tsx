'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui'
import { useDemoAppsStore } from '@/store/demoApps'
import { DemoAppShell } from './DemoAppShell'

const RARITIES = ['common', 'rare', 'epic', 'legendary'] as const
const NAMES = ['Pixel Orb', 'Retro Badge', 'Chrome Cat', 'Floppy Disk', 'Blue Screen'] as const

export function FoundryApp({ embedded = false }: { embedded?: boolean }) {
  const t = useTranslations('demo.foundry')
  const items = useDemoAppsStore((s) => s.foundryItems)
  const mintFoundry = useDemoAppsStore((s) => s.mintFoundry)
  const [status, setStatus] = useState('')

  const mint = () => {
    const name = NAMES[Math.floor(Math.random() * NAMES.length)]!
    const rarity = RARITIES[Math.floor(Math.random() * RARITIES.length)]!
    mintFoundry(name, rarity)
    setStatus(t('minted', { name, rarity: t(`rarity.${rarity}`) }))
  }

  return (
    <DemoAppShell embedded={embedded} title={t('title')} hint={t('hint')} status={status || t('idle')}>
      <Button size='sm' onClick={mint}>
        {t('mint')}
      </Button>
      {items.length === 0 ? (
        <p className='text-[11px] text-muted'>{t('empty')}</p>
      ) : (
        <ul className='space-y-1 max-h-40 overflow-y-auto text-[11px]'>
          {items.map((item) => (
            <li key={item.id} className='border-b border-chrome-dark/40 pb-1'>
              <span className='font-bold'>{item.name}</span>
              <span className='text-muted'> · {t(`rarity.${item.rarity as (typeof RARITIES)[number]}`)}</span>
            </li>
          ))}
        </ul>
      )}
    </DemoAppShell>
  )
}
