'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui'
import { useDemoAppsStore } from '@/store/demoApps'
import { DemoAppShell } from './DemoAppShell'

const PRODUCTS = [
  { id: 'hat', price: 40 },
  { id: 'mug', price: 25 },
  { id: 'poster', price: 15 },
  { id: 'sticker', price: 8 },
] as const

export function MarketApp({ embedded = false }: { embedded?: boolean }) {
  const t = useTranslations('demo.market')
  const fakeBalance = useDemoAppsStore((s) => s.fakeBalance)
  const spend = useDemoAppsStore((s) => s.spend)
  const [status, setStatus] = useState('')

  return (
    <DemoAppShell embedded={embedded} title={t('title')} hint={t('hint')} status={status || t('idle', { balance: fakeBalance })}>
      <div className='grid grid-cols-2 gap-2'>
        {PRODUCTS.map((p) => (
          <div key={p.id} className='border border-chrome-dark p-2 space-y-2 bg-window'>
            <div className='text-[11px] font-bold'>{t(`items.${p.id}`)}</div>
            <div className='text-[10px] text-muted'>{t('price', { price: p.price })}</div>
            <Button
              size='sm'
              className='w-full'
              onClick={() => {
                if (spend(p.price)) setStatus(t('bought', { name: t(`items.${p.id}`), price: p.price }))
                else setStatus(t('fail'))
              }}
            >
              {t('buy')}
            </Button>
          </div>
        ))}
      </div>
    </DemoAppShell>
  )
}
