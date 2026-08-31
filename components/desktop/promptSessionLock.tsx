'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button, Input, closeModal, openModal } from '@/components/ui'

type PromptResult = Nullable<string>

/**
 * 锁屏前弹出：设置本次临时密码（仅本次锁屏有效）。
 * 确认返回密码字符串，取消/关闭返回 null。
 */
export function promptSessionLockPassword(title: string): Promise<PromptResult> {
  return new Promise((resolve) => {
    let settled = false
    const finish = (value: PromptResult) => {
      if (settled) return
      settled = true
      resolve(value)
    }

    const id = openModal({
      title,
      dismissible: true,
      showClose: true,
      widthClassName: 'w-[min(360px,calc(100vw-2rem))]',
      content: (
        <LockSetupForm
          onCancel={() => {
            finish(null)
            closeModal(id)
          }}
          onConfirm={(password) => {
            // 必须先 settle 密码，再关 Modal；否则 onClose 会先 finish(null)
            finish(password)
            closeModal(id)
          }}
        />
      ),
      onClose: () => finish(null),
    })
  })
}

function LockSetupForm({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void
  onConfirm: (password: string) => void
}) {
  const t = useTranslations('lock')
  const tm = useTranslations('modal')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<Nullable<string>>(null)

  const submit = () => {
    const a = password.trim()
    const b = confirm.trim()
    if (!a) {
      setError(t('emptyPassword'))
      return
    }
    if (a !== b) {
      setError(t('mismatch'))
      return
    }
    onConfirm(a)
  }

  return (
    <div className='space-y-3'>
      <p className='text-[12px] text-on-chrome'>{t('setupHint')}</p>
      <div>
        <label className='block text-[11px] mb-1' htmlFor='lock-setup-password'>
          {t('password')}
        </label>
        <Input
          id='lock-setup-password'
          type='password'
          autoComplete='new-password'
          autoFocus
          value={password}
          onChange={(e) => {
            setPassword(e.target.value)
            if (error) setError(null)
          }}
          size='md'
          tone='field'
        />
      </div>
      <div>
        <label className='block text-[11px] mb-1' htmlFor='lock-setup-confirm'>
          {t('confirmPassword')}
        </label>
        <Input
          id='lock-setup-confirm'
          type='password'
          autoComplete='new-password'
          value={confirm}
          onChange={(e) => {
            setConfirm(e.target.value)
            if (error) setError(null)
          }}
          size='md'
          tone='field'
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              submit()
            }
          }}
        />
      </div>
      {error && <p className='text-[11px] text-[#c00]'>{error}</p>}
      <div className='flex justify-end gap-2 pt-1'>
        <Button type='button' size='md' className='px-3' onClick={onCancel}>
          {tm('cancel')}
        </Button>
        <Button type='button' size='md' className='px-3' onClick={submit}>
          {t('lockNow')}
        </Button>
      </div>
    </div>
  )
}
