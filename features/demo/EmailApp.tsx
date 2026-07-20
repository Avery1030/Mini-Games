'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button, Input } from '@/components/ui'
import { useDemoAppsStore } from '@/store/demoApps'
import { DemoAppShell } from './DemoAppShell'

type View = 'inbox' | 'read' | 'compose' | 'drafts'

const INBOX = [
  { id: 'm1', from: 'system@avery.demo', subjectKey: 'welcome', bodyKey: 'welcomeBody' },
  { id: 'm2', from: 'tips@avery.demo', subjectKey: 'tips', bodyKey: 'tipsBody' },
  { id: 'm3', from: 'news@avery.demo', subjectKey: 'news', bodyKey: 'newsBody' },
] as const

export function EmailApp({ embedded = false }: { embedded?: boolean }) {
  const t = useTranslations('demo.email')
  const drafts = useDemoAppsStore((s) => s.emailDrafts)
  const addEmailDraft = useDemoAppsStore((s) => s.addEmailDraft)
  const removeEmailDraft = useDemoAppsStore((s) => s.removeEmailDraft)
  const [view, setView] = useState<View>('inbox')
  const [activeId, setActiveId] = useState<string | null>(null)
  const [to, setTo] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [status, setStatus] = useState('')

  const activeMail = useMemo(() => INBOX.find((m) => m.id === activeId), [activeId])

  return (
    <DemoAppShell embedded={embedded} title={t('title')} hint={t('hint')} status={status || t('idle')}>
      <div className='flex flex-wrap gap-1'>
        <Button size='sm' active={view === 'inbox'} onClick={() => { setView('inbox'); setStatus('') }}>
          {t('inbox')}
        </Button>
        <Button size='sm' active={view === 'compose'} onClick={() => { setView('compose'); setStatus('') }}>
          {t('compose')}
        </Button>
        <Button size='sm' active={view === 'drafts'} onClick={() => { setView('drafts'); setStatus('') }}>
          {t('drafts')} ({drafts.length})
        </Button>
      </div>

      {view === 'inbox' && (
        <ul className='space-y-1'>
          {INBOX.map((m) => (
            <li key={m.id}>
              <button
                type='button'
                className='w-full text-left border border-chrome-dark px-2 py-1.5 hover:bg-chrome-hover text-[11px]'
                onClick={() => {
                  setActiveId(m.id)
                  setView('read')
                }}
              >
                <div className='font-bold truncate'>{t(`mail.${m.subjectKey}`)}</div>
                <div className='text-muted truncate'>{m.from}</div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {view === 'read' && activeMail && (
        <div className='space-y-2 text-[11px]'>
          <Button size='sm' onClick={() => setView('inbox')}>
            {t('back')}
          </Button>
          <div className='font-bold text-sm'>{t(`mail.${activeMail.subjectKey}`)}</div>
          <div className='text-muted'>{t('from')}: {activeMail.from}</div>
          <p className='leading-relaxed'>{t(`mail.${activeMail.bodyKey}`)}</p>
        </div>
      )}

      {view === 'compose' && (
        <div className='space-y-2'>
          <label className='block space-y-1 text-[11px]'>
            <span className='text-muted'>{t('to')}</span>
            <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder='friend@demo.local' />
          </label>
          <label className='block space-y-1 text-[11px]'>
            <span className='text-muted'>{t('subject')}</span>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </label>
          <label className='block space-y-1 text-[11px]'>
            <span className='text-muted'>{t('body')}</span>
            <textarea
              className='w-full min-h-[80px] p-2 text-xs font-pixel bg-field border border-chrome-dark outline-none'
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </label>
          <Button
            size='sm'
            onClick={() => {
              if (!to.trim()) {
                setStatus(t('needTo'))
                return
              }
              addEmailDraft({ to, subject, body })
              setTo('')
              setSubject('')
              setBody('')
              setView('drafts')
              setStatus(t('savedDraft'))
            }}
          >
            {t('saveDraft')}
          </Button>
          <p className='text-[10px] text-muted'>{t('noSend')}</p>
        </div>
      )}

      {view === 'drafts' && (
        drafts.length === 0 ? (
          <p className='text-[11px] text-muted'>{t('noDrafts')}</p>
        ) : (
          <ul className='space-y-2'>
            {drafts.map((d) => (
              <li key={d.id} className='border border-chrome-dark p-2 text-[11px] space-y-1'>
                <div className='font-bold'>{d.subject}</div>
                <div className='text-muted'>{t('to')}: {d.to}</div>
                <p className='line-clamp-2'>{d.body || '—'}</p>
                <Button size='sm' onClick={() => { removeEmailDraft(d.id); setStatus(t('deleted')) }}>
                  {t('delete')}
                </Button>
              </li>
            ))}
          </ul>
        )
      )}
    </DemoAppShell>
  )
}
