'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button, Input, closeModal, openModal } from '@/components/ui'
import type { DesktopAppId } from '@/config/desktop'
import { isFolderTitleTaken } from '@/lib/desktop/window'

type PromptResult = string | null

export type PromptRenameFolderOptions = {
  currentName: string
  title: string
  /** 当前文件夹 id，校验重名时排除自身 */
  folderId: DesktopAppId
}

/**
 * 重命名文件夹：确认返回新名称，取消/关闭返回 null。
 */
export function promptRenameFolder(options: PromptRenameFolderOptions): Promise<PromptResult> {
  const { currentName, title, folderId } = options

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
        <RenameFolderForm
          initialName={currentName}
          folderId={folderId}
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

function RenameFolderForm({
  initialName,
  folderId,
  onCancel,
  onConfirm,
}: {
  initialName: string
  folderId: DesktopAppId
  onCancel: () => void
  onConfirm: (name: string) => void
}) {
  const td = useTranslations('desktop')
  const tm = useTranslations('modal')
  const [name, setName] = useState(initialName)
  const [error, setError] = useState<string | null>(null)
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
      setError(td('renameEmpty'))
      return
    }
    if (isFolderTitleTaken(trimmed, folderId)) {
      setError(td('renameDuplicate'))
      return
    }
    onConfirm(trimmed)
  }

  return (
    <div className='space-y-3'>
      <p className='text-[12px] text-on-chrome'>{td('renameHint')}</p>
      <div>
        <label className='block text-[11px] mb-1' htmlFor='folder-rename-input'>
          {td('renameLabel')}
        </label>
        <Input
          ref={inputRef}
          id='folder-rename-input'
          type='text'
          autoComplete='off'
          value={name}
          onChange={(e) => {
            setName(e.target.value)
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
          {tm('ok')}
        </Button>
      </div>
    </div>
  )
}
