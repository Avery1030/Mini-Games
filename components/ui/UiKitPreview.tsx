'use client'

import { useState } from 'react'
import { Button } from './Button'
import { Checkbox } from './Checkbox'
import { ContextMenu, type ContextMenuState } from './ContextMenu'
import { Input } from './Input'
import { Panel } from './Panel'
import { Select } from './Select'
import { Switch } from './Switch'
import { Tab } from './Tab'
import { modal } from './modal'
import { toast } from './toast'

export type UiKitDemoId = 'controls' | 'form' | 'surface' | 'overlay'

export type UiKitDemoLabels = {
  ok: string
  pressed: string
  toast: string
  toastMsg: string
  alert: string
  alertMsg: string
  confirm: string
  confirmMsg: string
  input: string
  check: string
  sw: string
  tabA: string
  tabB: string
  menu: string
  copy: string
  paste: string
}

const FALLBACK: UiKitDemoLabels = {
  ok: 'OK',
  pressed: 'Pressed',
  toast: 'Toast',
  toastMsg: 'Toast',
  alert: 'Alert',
  alertMsg: 'Alert',
  confirm: 'Confirm',
  confirmMsg: 'Confirm?',
  input: 'Input',
  check: 'Checkbox',
  sw: 'Switch',
  tabA: 'A',
  tabB: 'B',
  menu: 'Menu',
  copy: 'Copy',
  paste: 'Paste',
}

/**
 * 无业务 Demo：按章节展示本目录控件。
 */
export function UiKitPreview({
  section,
  labels,
}: {
  section: string
  labels?: Partial<UiKitDemoLabels>
}) {
  const L = { ...FALLBACK, ...labels }
  const [checked, setChecked] = useState(true)
  const [on, setOn] = useState(true)
  const [size, setSize] = useState('md')
  const [tab, setTab] = useState('a')
  const [menu, setMenu] = useState<Nullable<ContextMenuState>>(null)

  if (section === 'controls') {
    return (
      <div className='flex flex-wrap gap-1'>
        <Button size='sm'>{L.ok}</Button>
        <Button size='sm' variant='pressed'>
          {L.pressed}
        </Button>
        <Button size='sm' loading>
          {L.ok}
        </Button>
      </div>
    )
  }

  if (section === 'form') {
    return (
      <div className='space-y-2 max-w-xs'>
        <Input size='sm' defaultValue={L.input} aria-label={L.input} />
        <Select
          size='sm'
          value={size}
          options={[
            { value: 'sm', label: 'sm' },
            { value: 'md', label: 'md' },
            { value: 'lg', label: 'lg' },
          ]}
          onValueChange={setSize}
          aria-label='size'
        />
        <Checkbox label={L.check} checked={checked} onChange={(e) => setChecked(e.target.checked)} />
        <Switch label={L.sw} checked={on} onCheckedChange={setOn} />
      </div>
    )
  }

  if (section === 'surface') {
    return (
      <Panel inset className='space-y-2'>
        <div className='flex gap-1'>
          <Tab active={tab === 'a'} onClick={() => setTab('a')}>
            {L.tabA}
          </Tab>
          <Tab active={tab === 'b'} onClick={() => setTab('b')}>
            {L.tabB}
          </Tab>
        </div>
        <p className='text-[11px] text-muted m-0'>{tab === 'a' ? L.tabA : L.tabB}</p>
      </Panel>
    )
  }

  if (section === 'overlay') {
    return (
      <div className='flex flex-wrap gap-1'>
        <Button size='sm' onClick={() => toast.success(L.toastMsg)}>
          {L.toast}
        </Button>
        <Button size='sm' onClick={() => void modal.alert({ message: L.alertMsg })}>
          {L.alert}
        </Button>
        <Button size='sm' onClick={() => void modal.confirm({ message: L.confirmMsg })}>
          {L.confirm}
        </Button>
        <Button
          size='sm'
          onClick={(e) => {
            setMenu({
              x: e.clientX,
              y: e.clientY,
              items: [
                { id: 'copy', label: L.copy, onSelect: () => toast.success(L.copy) },
                { id: 'paste', label: L.paste, onSelect: () => toast.success(L.paste) },
              ],
            })
          }}
        >
          {L.menu}
        </Button>
        <ContextMenu menu={menu} onClose={() => setMenu(null)} />
      </div>
    )
  }

  return null
}
