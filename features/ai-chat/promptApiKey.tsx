'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button, Input, closeModal, openModal } from '@/components/ui'

type PromptResult = string | null

export type PromptAiChatApiKeyOptions = {
  /** 预填（更换密钥时用） */
  initialKey?: string
}

/**
 * 智聊 API Key 录入弹窗：确认返回 trim 后的 key，取消/关闭返回 null。
 */
export function promptAiChatApiKey(options: PromptAiChatApiKeyOptions = {}): Promise<PromptResult> {
  const { initialKey = '' } = options

  return new Promise((resolve) => {
    let settled = false
    const finish = (value: PromptResult) => {
      if (settled) return
      settled = true
      resolve(value)
    }

    const id = openModal({
      title: <ApiKeyModalTitle />,
      dismissible: true,
      showClose: true,
      widthClassName: 'w-[min(400px,calc(100vw-2rem))]',
      content: (
        <ApiKeyForm
          initialKey={initialKey}
          onCancel={() => {
            finish(null)
            closeModal(id)
          }}
          onConfirm={(key) => {
            finish(key)
            closeModal(id)
          }}
        />
      ),
      onClose: () => finish(null),
    })
  })
}

function ApiKeyModalTitle() {
  const t = useTranslations('aiChat')
  return <>{t('apiKeyTitle')}</>
}

function ApiKeyForm({
  initialKey,
  onCancel,
  onConfirm,
}: {
  initialKey: string
  onCancel: () => void
  onConfirm: (key: string) => void
}) {
  const t = useTranslations('aiChat')
  const tm = useTranslations('modal')
  const [value, setValue] = useState(initialKey)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.focus()
    el.select()
  }, [])

  const submit = () => {
    const trimmed = value.trim()
    if (!trimmed) {
      setError(t('apiKeyEmpty'))
      return
    }
    onConfirm(trimmed)
  }

  return (
    <div className='space-y-3'>
      <p className='text-[12px] text-muted leading-relaxed'>{t('apiKeyHint')}</p>
      <div>
        <label className='block text-[11px] mb-1' htmlFor='ai-chat-api-key-input'>
          {t('apiKeyLabel')}
        </label>
        <Input
          ref={inputRef}
          id='ai-chat-api-key-input'
          type='password'
          autoComplete='off'
          spellCheck={false}
          value={value}
          placeholder={t('apiKeyPlaceholder')}
          onChange={(e) => {
            setValue(e.target.value)
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
      {error ? <p className='text-[11px] text-[#c00]'>{error}</p> : null}
      <div className='flex justify-end gap-2 pt-1'>
        <Button type='button' size='md' className='px-3' onClick={onCancel}>
          {tm('cancel')}
        </Button>
        <Button type='button' size='md' className='px-3' onClick={submit}>
          {t('apiKeySave')}
        </Button>
      </div>
    </div>
  )
}
