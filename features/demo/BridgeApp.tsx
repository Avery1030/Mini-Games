'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button, Input, Select } from '@/components/ui'
import { useDemoAppsStore } from '@/store/demoApps'
import { DemoAppShell } from './DemoAppShell'

const CHAINS = ['Ethereum', 'Arbitrum', 'Base', 'Solana'] as const

export function BridgeApp({ embedded = false }: { embedded?: boolean }) {
  const t = useTranslations('demo.bridge')
  const fakeBalance = useDemoAppsStore((s) => s.fakeBalance)
  const history = useDemoAppsStore((s) => s.bridgeHistory)
  const addBridge = useDemoAppsStore((s) => s.addBridge)
  const [from, setFrom] = useState<string>(CHAINS[0])
  const [to, setTo] = useState<string>(CHAINS[1])
  const [amount, setAmount] = useState('50')
  const [progress, setProgress] = useState(0)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')

  useEffect(() => {
    if (!busy) return
    if (progress >= 100) {
      const n = Math.floor(Number(amount))
      addBridge(from, to, n)
      setBusy(false)
      setProgress(0)
      setStatus(t('done'))
      return
    }
    const id = window.setTimeout(() => setProgress((p) => Math.min(100, p + 12)), 120)
    return () => window.clearTimeout(id)
  }, [busy, progress, amount, from, to, addBridge, t])

  const start = () => {
    const n = Math.floor(Number(amount))
    if (!Number.isFinite(n) || n <= 0 || n > fakeBalance || from === to) {
      setStatus(t('fail'))
      return
    }
    setBusy(true)
    setProgress(0)
    setStatus(t('bridging'))
  }

  const chainOptions = CHAINS.map((c) => ({ value: c, label: c }))

  return (
    <DemoAppShell embedded={embedded} title={t('title')} hint={t('hint')} status={status || t('idle', { balance: fakeBalance })}>
      <div className='grid grid-cols-2 gap-2'>
        <label className='block space-y-1 text-[11px]'>
          <span className='text-muted'>{t('from')}</span>
          <Select size='sm' options={chainOptions} value={from} onValueChange={setFrom} />
        </label>
        <label className='block space-y-1 text-[11px]'>
          <span className='text-muted'>{t('to')}</span>
          <Select size='sm' options={chainOptions} value={to} onValueChange={setTo} />
        </label>
      </div>
      <label className='block space-y-1 text-[11px]'>
        <span className='text-muted'>{t('amount')}</span>
        <Input type='number' min={1} value={amount} onChange={(e) => setAmount(e.target.value)} disabled={busy} />
      </label>
      {busy && (
        <div className='h-3 border border-chrome-dark bg-field overflow-hidden'>
          <div className='h-full bg-accent transition-[width] duration-100' style={{ width: `${progress}%` }} />
        </div>
      )}
      <Button size='sm' loading={busy} onClick={start}>
        {t('start')}
      </Button>
      {history.length > 0 && (
        <div className='space-y-1'>
          <div className='text-[11px] font-bold'>{t('history')}</div>
          <ul className='space-y-1 text-[10px] max-h-24 overflow-y-auto'>
            {history.slice(0, 5).map((h) => (
              <li key={h.id}>
                {h.amount} · {h.from} → {h.to}
              </li>
            ))}
          </ul>
        </div>
      )}
    </DemoAppShell>
  )
}
