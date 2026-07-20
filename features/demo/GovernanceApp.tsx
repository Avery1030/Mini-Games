'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui'
import { useDemoAppsStore } from '@/store/demoApps'
import { DemoAppShell } from './DemoAppShell'

const PROPOSALS = ['p1', 'p2', 'p3'] as const

export function GovernanceApp({ embedded = false }: { embedded?: boolean }) {
  const t = useTranslations('demo.governance')
  const votes = useDemoAppsStore((s) => s.votes)
  const proposalFor = useDemoAppsStore((s) => s.proposalFor)
  const proposalAgainst = useDemoAppsStore((s) => s.proposalAgainst)
  const vote = useDemoAppsStore((s) => s.vote)
  const [status, setStatus] = useState('')

  return (
    <DemoAppShell embedded={embedded} title={t('title')} hint={t('hint')} status={status || t('idle')}>
      <ul className='space-y-3'>
        {PROPOSALS.map((id) => {
          const myVote = votes[id]
          return (
            <li key={id} className='border border-chrome-dark p-2 space-y-2 bg-window'>
              <div className='text-[11px] font-bold'>{t(`proposals.${id}.title`)}</div>
              <p className='text-[10px] text-muted'>{t(`proposals.${id}.desc`)}</p>
              <div className='text-[10px]'>
                {t('tally', { for: proposalFor[id] ?? 0, against: proposalAgainst[id] ?? 0 })}
              </div>
              {myVote ? (
                <div className='text-[10px] text-accent'>{t('voted', { side: t(myVote) })}</div>
              ) : (
                <div className='flex gap-2'>
                  <Button
                    size='sm'
                    onClick={() => setStatus(vote(id, 'for') ? t('voteOk') : t('already'))}
                  >
                    {t('for')}
                  </Button>
                  <Button
                    size='sm'
                    onClick={() => setStatus(vote(id, 'against') ? t('voteOk') : t('already'))}
                  >
                    {t('against')}
                  </Button>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </DemoAppShell>
  )
}
