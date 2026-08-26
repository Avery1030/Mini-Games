'use client'

import { useEffect, type ReactNode } from 'react'
import { ModalFrame } from './ModalFrame'
import { modalZIndex, useModalStore } from './store'

export type ModalHostLabels = {
  ok: string
  cancel: string
  title: string
}

const DEFAULT_LABELS: ModalHostLabels = {
  ok: 'OK',
  cancel: 'Cancel',
  title: 'Message',
}

function resolveActionLabel(
  id: string,
  label: ReactNode | undefined,
  labels: ModalHostLabels,
): ReactNode {
  if (label != null && label !== '') return label
  if (id === 'confirm' || id === 'ok') return labels.ok
  if (id === 'cancel') return labels.cancel
  return id
}

/**
 * 根级宿主：渲染 Modal 栈。放在 layout / 桌面根节点一次即可。
 * 默认按钮文案由 labels 注入，组件不依赖 i18n。
 */
export function ModalHost({ labels = DEFAULT_LABELS }: { labels?: ModalHostLabels }) {
  const stack = useModalStore((s) => s.stack)
  const remove = useModalStore((s) => s.remove)

  useEffect(() => {
    if (stack.length === 0) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const top = useModalStore.getState().stack.at(-1)
      if (!top) return
      e.preventDefault()
      if (top.dismissible !== false) {
        remove(top.id, 'dismiss')
        return
      }
      if (top.actions?.some((a) => a.id === 'cancel')) {
        remove(top.id, 'action', 'cancel')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [stack.length, remove])

  useEffect(() => {
    if (stack.length === 0) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [stack.length])

  if (stack.length === 0) return null

  return (
    <>
      {stack.map((entry, index) => {
        const isTop = index === stack.length - 1
        const actions = entry.actions?.map((a) => ({
          ...a,
          label: resolveActionLabel(a.id, a.label, labels),
        }))

        return (
          <ModalFrame
            key={entry.id}
            title={entry.title ?? labels.title}
            titleId={`${entry.id}-title`}
            actions={actions}
            showClose={entry.showClose !== false}
            widthClassName={entry.widthClassName}
            zIndex={modalZIndex(index)}
            isTop={isTop}
            dismissible={entry.dismissible !== false}
            onAction={(actionId) => {
              const action = entry.actions?.find((a) => a.id === actionId)
              if (action?.closeOnClick === false) return
              remove(entry.id, 'action', actionId)
            }}
            onDismiss={() => remove(entry.id, 'dismiss')}
            onRequestClose={() => {
              if (entry.actions?.some((a) => a.id === 'cancel')) {
                remove(entry.id, 'action', 'cancel')
                return
              }
              remove(entry.id, 'dismiss')
            }}
          >
            {typeof entry.content === 'string' || typeof entry.content === 'number' ? (
              <p>{entry.content}</p>
            ) : (
              entry.content
            )}
          </ModalFrame>
        )
      })}
    </>
  )
}
