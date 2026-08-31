'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button, Input, closeModal, openModal } from '@/components/ui'

type PromptSessionTitleOptions = {
  mode: 'create' | 'edit'
  defaultTitle?: string
}

/**
 * 新建 / 重命名会话：弹窗输入名称；确认返回标题，取消/关闭返回 null。
 */
export function promptSessionTitle(options: PromptSessionTitleOptions): Promise<Nullable<string>> {
  const defaultTitle = options.defaultTitle ?? ''
  const mode = options.mode

  return new Promise((resolve) => {
    let settled = false
    const finish = (value: Nullable<string>) => {
      if (settled) return
      settled = true
      resolve(value)
    }

    const id = openModal({
      title: <SessionTitleModalHeading mode={mode} />,
      dismissible: true,
      showClose: true,
      widthClassName: 'w-[min(360px,calc(100vw-2rem))]',
      content: (
        <SessionTitleForm
          mode={mode}
          initialName={defaultTitle}
          onCancel={() => {
            finish(null)
            closeModal(id)
          }}
          onConfirm={(name) => {
            finish(name)
            closeModal(id)
          }}
        />
      ),
      onClose: () => finish(null),
    })
  })
}

function SessionTitleModalHeading({ mode }: { mode: 'create' | 'edit' }) {
  const t = useTranslations('aiChat')
  return <>{mode === 'edit' ? t('renameSessionTitle') : t('newSessionTitle')}</>
}

function SessionTitleForm({
  mode,
  initialName,
  onCancel,
  onConfirm,
}: {
  mode: 'create' | 'edit'
  initialName: string
  onCancel: () => void
  onConfirm: (name: string) => void
}) {
  const t = useTranslations('aiChat')
  const [name, setName] = useState(initialName)
  const [error, setError] = useState<Nullable<string>>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.focus()
    el.select()
  }, [])

  const submit = () => {
    const trimmed = name.trim()
    if (!trimmed) {
      setError(t('sessionNameEmpty'))
      return
    }
    onConfirm(trimmed.slice(0, 80))
  }

  return (
    <div className='flex flex-col gap-3 p-1'>
      <p className='text-[11px] text-muted'>{mode === 'edit' ? t('renameSessionHint') : t('newSessionHint')}</p>
      <label className='flex flex-col gap-1 text-[11px]'>
        <span>{t('sessionNameLabel')}</span>
        <Input
          ref={inputRef}
          value={name}
          size='md'
          tone='field'
          maxLength={80}
          placeholder={t('sessionNamePlaceholder')}
          onChange={(e) => {
            setName(e.target.value)
            if (error) setError(null)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              submit()
            }
            if (e.key === 'Escape') {
              e.preventDefault()
              onCancel()
            }
          }}
        />
      </label>
      {error ? <p className='text-[11px] text-[#c00]'>{error}</p> : null}
      <div className='flex justify-end gap-2'>
        <Button size='md' onClick={onCancel}>
          {t('cancel')}
        </Button>
        <Button size='md' className='font-bold' onClick={submit}>
          {mode === 'edit' ? t('saveSessionName') : t('createSession')}
        </Button>
      </div>
    </div>
  )
}
