'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button, Input, closeModal, openModal } from '@/components/ui'
import type { DesktopAppId } from '@/config/desktop'
import { isSiblingTitleTaken, resolveParentId } from '@/lib/desktop/itemsTree'
import { parseItemTitleInput } from '@/lib/desktop/fileTypes'
import { useDesktopItemsStore, type DesktopResourceKind } from '@/store/desktopItems'

type PromptResult = string | null

export type PromptRenameDesktopItemOptions = {
  currentName: string
  title: string
  itemId: DesktopAppId
  kind: DesktopResourceKind
  /** 同级父级；缺省时从 store 读取 */
  parentId?: DesktopAppId | null
}

/**
 * 重命名桌面项目（文件夹 / 文本文档）：确认返回新名称，取消/关闭返回 null。
 */
export function promptRenameDesktopItem(options: PromptRenameDesktopItemOptions): Promise<PromptResult> {
  const { currentName, title, itemId, kind, parentId } = options

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
        <RenameItemForm
          initialName={currentName}
          itemId={itemId}
          kind={kind}
          parentId={parentId}
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

function RenameItemForm({
  initialName,
  itemId,
  kind,
  parentId: parentIdProp,
  onCancel,
  onConfirm,
}: {
  initialName: string
  itemId: DesktopAppId
  kind: DesktopResourceKind
  parentId?: DesktopAppId | null
  onCancel: () => void
  onConfirm: (name: string) => void
}) {
  const td = useTranslations('desktop')
  const tm = useTranslations('modal')
  const items = useDesktopItemsStore((s) => s.items)
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
    const trimmed = parseItemTitleInput(kind, name)
    if (!trimmed) {
      setError(td('renameEmpty'))
      return
    }
    const item = items.find((i) => i.id === itemId)
    const parentId =
      parentIdProp !== undefined ? resolveParentId(parentIdProp) : resolveParentId(item?.parentId)
    if (isSiblingTitleTaken(items, kind, trimmed, parentId, itemId)) {
      setError(kind === 'folder' ? td('renameDuplicate') : td('renameDuplicateText'))
      return
    }
    onConfirm(trimmed)
  }

  return (
    <div className='space-y-3'>
      <p className='text-[12px] text-on-chrome'>
        {kind === 'folder' ? td('renameHint') : td('renameHintText')}
      </p>
      <div>
        <label className='block text-[11px] mb-1' htmlFor='desktop-item-rename-input'>
          {td('renameLabel')}
        </label>
        <Input
          ref={inputRef}
          id='desktop-item-rename-input'
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

export function promptRenameVfsFile(options: { currentName: string; title: string }): Promise<string | null> {
  const { currentName, title } = options
  return new Promise((resolve) => {
    let settled = false
    const finish = (value: string | null) => {
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
        <RenameVfsForm
          initialName={currentName}
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

function RenameVfsForm({
  initialName,
  onCancel,
  onConfirm,
}: {
  initialName: string
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
    const dot = initialName.lastIndexOf('.')
    if (dot > 0) el.setSelectionRange(0, dot)
    else el.select()
  }, [initialName])

  const submit = () => {
    const trimmed = name.trim()
    if (!trimmed) {
      setError(td('renameEmpty'))
      return
    }
    onConfirm(trimmed)
  }

  return (
    <div className='space-y-3'>
      <p className='text-[12px] text-on-chrome'>{td('renameHintVfs')}</p>
      <div>
        <label className='block text-[11px] mb-1' htmlFor='desktop-vfs-rename-input'>
          {td('renameLabel')}
        </label>
        <Input
          ref={inputRef}
          id='desktop-vfs-rename-input'
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
