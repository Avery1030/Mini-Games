'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button, Input, closeModal, openModal } from '@/components/ui'

export function promptVfsName(options: {
  title: string
  label: string
  defaultValue: string
  confirmLabel: string
}): Promise<Nullable<string>> {
  return new Promise((resolve) => {
    let settled = false
    const finish = (v: Nullable<string>) => {
      if (settled) return
      settled = true
      resolve(v)
    }
    const id = openModal({
      title: options.title,
      dismissible: true,
      showClose: true,
      widthClassName: 'w-[min(360px,calc(100vw-2rem))]',
      content: (
        <NameForm
          label={options.label}
          initial={options.defaultValue}
          confirmLabel={options.confirmLabel}
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

function NameForm({
  label,
  initial,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  label: string
  initial: string
  confirmLabel: string
  onCancel: () => void
  onConfirm: (name: string) => void
}) {
  const tm = useTranslations('modal')
  const [value, setValue] = useState(initial)
  return (
    <div className='flex flex-col gap-3 p-1'>
      <label className='flex flex-col gap-1 text-[11px]'>
        <span>{label}</span>
        <Input
          size='sm'
          value={value}
          autoFocus
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              const next = value.trim()
              if (next) onConfirm(next)
            }
          }}
        />
      </label>
      <div className='flex justify-end gap-2'>
        <Button size='sm' onClick={onCancel}>
          {tm('cancel')}
        </Button>
        <Button
          size='sm'
          onClick={() => {
            const next = value.trim()
            if (next) onConfirm(next)
          }}
        >
          {confirmLabel}
        </Button>
      </div>
    </div>
  )
}
