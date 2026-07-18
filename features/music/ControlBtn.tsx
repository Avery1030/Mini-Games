'use client'

import { type ReactNode } from 'react'
import { Button } from '@/components/ui'

export function ControlBtn({
  children,
  onClick,
  active,
  label,
}: {
  children: ReactNode
  onClick: () => void
  active?: boolean
  label: string
}) {
  return (
    <Button size='icon' aria-label={label} title={label} active={active} onClick={onClick}>
      {children}
    </Button>
  )
}
