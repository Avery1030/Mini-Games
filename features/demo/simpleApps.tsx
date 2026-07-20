'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button, Input } from '@/components/ui'
import { DEMO_STAKE_APY, useDemoAppsStore } from '@/store/demoApps'
import { DemoAppShell } from './DemoAppShell'

export function ReferralApp({ embedded = false }: { embedded?: boolean }) {
  const t = useTranslations('demo.referral')
  const code = useDemoAppsStore((s) => s.referralCode)
  const invites = useDemoAppsStore((s) => s.referralInvites)
  const points = useDemoAppsStore((s) => s.referralPoints)
  const refresh = useDemoAppsStore((s) => s.refreshReferralCode)
  const [status, setStatus] = useState('')

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setStatus(t('copied'))
    } catch {
      setStatus(t('copyFail'))
    }
  }

  return (
    <DemoAppShell embedded={embedded} title={t('title')} hint={t('hint')} status={status || t('idle')}>
      <div className='space-y-1'>
        <div className='text-[11px] text-muted'>{t('codeLabel')}</div>
        <div className='font-bold text-sm tracking-wide'>{code}</div>
      </div>
      <div className='flex flex-wrap gap-2'>
        <Button size='sm' onClick={() => void copy()}>
          {t('copy')}
        </Button>
        <Button
          size='sm'
          onClick={() => {
            refresh()
            setStatus(t('refreshed'))
          }}
        >
          {t('refresh')}
        </Button>
      </div>
      <div className='grid grid-cols-2 gap-2 text-[11px]'>
        <div>
          <div className='text-muted'>{t('invites')}</div>
          <div className='font-bold text-sm'>{invites}</div>
        </div>
        <div>
          <div className='text-muted'>{t('points')}</div>
          <div className='font-bold text-sm'>{points}</div>
        </div>
      </div>
    </DemoAppShell>
  )
}

export function ClaimApp({ embedded = false }: { embedded?: boolean }) {
  const t = useTranslations('demo.claim')
  const claimPoints = useDemoAppsStore((s) => s.claimPoints)
  const fakeBalance = useDemoAppsStore((s) => s.fakeBalance)
  const claim = useDemoAppsStore((s) => s.claim)
  const [status, setStatus] = useState('')

  const onClaim = () => {
    const result = claim()
    if (result.ok) {
      setStatus(t('success', { points: result.points ?? 0 }))
    } else {
      const hours = Math.ceil((result.waitMs ?? 0) / (60 * 60 * 1000))
      setStatus(t('cooldown', { hours: Math.max(1, hours) }))
    }
  }

  return (
    <DemoAppShell embedded={embedded} title={t('title')} hint={t('hint')} status={status || t('idle')}>
      <div className='grid grid-cols-2 gap-2 text-[11px]'>
        <div>
          <div className='text-muted'>{t('earned')}</div>
          <div className='font-bold text-sm'>{claimPoints}</div>
        </div>
        <div>
          <div className='text-muted'>{t('balance')}</div>
          <div className='font-bold text-sm'>{fakeBalance}</div>
        </div>
      </div>
      <Button size='sm' onClick={onClaim}>
        {t('claim')}
      </Button>
    </DemoAppShell>
  )
}

export function StakeApp({ embedded = false }: { embedded?: boolean }) {
  const t = useTranslations('demo.stake')
  const fakeBalance = useDemoAppsStore((s) => s.fakeBalance)
  const staked = useDemoAppsStore((s) => s.staked)
  const stake = useDemoAppsStore((s) => s.stake)
  const unstake = useDemoAppsStore((s) => s.unstake)
  const [amount, setAmount] = useState('100')
  const [status, setStatus] = useState('')
  const apyPct = DEMO_STAKE_APY * 100
  const n = Math.floor(Number(amount)) || 0
  const yearly = (staked || n) * DEMO_STAKE_APY

  return (
    <DemoAppShell embedded={embedded} title={t('title')} hint={t('hint')} status={status || t('idle')}>
      <div className='grid grid-cols-2 gap-2 text-[11px]'>
        <div>
          <div className='text-muted'>{t('balance')}</div>
          <div className='font-bold text-sm'>{fakeBalance}</div>
        </div>
        <div>
          <div className='text-muted'>{t('staked')}</div>
          <div className='font-bold text-sm'>{staked}</div>
        </div>
        <div>
          <div className='text-muted'>{t('apy')}</div>
          <div className='font-bold text-sm'>{apyPct.toFixed(1)}%</div>
        </div>
        <div>
          <div className='text-muted'>{t('estimate')}</div>
          <div className='font-bold text-sm'>{yearly.toFixed(1)}</div>
        </div>
      </div>
      <label className='block space-y-1 text-[11px]'>
        <span className='text-muted'>{t('amount')}</span>
        <Input type='number' min={1} value={amount} onChange={(e) => setAmount(e.target.value)} />
      </label>
      <div className='flex flex-wrap gap-2'>
        <Button
          size='sm'
          onClick={() => setStatus(stake(n) ? t('stakedOk') : t('fail'))}
        >
          {t('stake')}
        </Button>
        <Button
          size='sm'
          onClick={() => setStatus(unstake(n) ? t('unstakedOk') : t('fail'))}
        >
          {t('unstake')}
        </Button>
      </div>
    </DemoAppShell>
  )
}

export function DonationApp({ embedded = false }: { embedded?: boolean }) {
  const t = useTranslations('demo.donation')
  const fakeBalance = useDemoAppsStore((s) => s.fakeBalance)
  const donationTotal = useDemoAppsStore((s) => s.donationTotal)
  const donate = useDemoAppsStore((s) => s.donate)
  const [amount, setAmount] = useState('10')
  const [status, setStatus] = useState('')
  const presets = [5, 10, 50, 100]

  return (
    <DemoAppShell embedded={embedded} title={t('title')} hint={t('hint')} status={status || t('idle')}>
      <div className='grid grid-cols-2 gap-2 text-[11px]'>
        <div>
          <div className='text-muted'>{t('balance')}</div>
          <div className='font-bold text-sm'>{fakeBalance}</div>
        </div>
        <div>
          <div className='text-muted'>{t('total')}</div>
          <div className='font-bold text-sm'>{donationTotal}</div>
        </div>
      </div>
      <div className='flex flex-wrap gap-1'>
        {presets.map((p) => (
          <Button key={p} size='sm' active={amount === String(p)} onClick={() => setAmount(String(p))}>
            {p}
          </Button>
        ))}
      </div>
      <label className='block space-y-1 text-[11px]'>
        <span className='text-muted'>{t('amount')}</span>
        <Input type='number' min={1} value={amount} onChange={(e) => setAmount(e.target.value)} />
      </label>
      <Button
        size='sm'
        onClick={() => {
          const n = Math.floor(Number(amount))
          setStatus(donate(n) ? t('thanks') : t('fail'))
        }}
      >
        {t('donate')}
      </Button>
    </DemoAppShell>
  )
}
