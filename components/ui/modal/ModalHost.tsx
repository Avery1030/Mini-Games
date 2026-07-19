'use client'

import { useEffect, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { ModalFrame } from './ModalFrame'
import { modalZIndex, useModalStore } from './store'

function resolveActionLabel(
  id: string,
  label: ReactNode | undefined,
  t: (key: string) => string,
): ReactNode {
  if (label != null && label !== '') return label
  if (id === 'confirm' || id === 'ok') return t('ok')
  if (id === 'cancel') return t('cancel')
  return id
}

/**
 * 根级宿主：渲染 Modal 栈。放在 layout / 桌面根节点一次即可。
 */
export function ModalHost() {
  const stack = useModalStore((s) => s.stack)
  const remove = useModalStore((s) => s.remove)
  const t = useTranslations('modal')

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
      // 确认框：Esc 视为取消
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
          label: resolveActionLabel(a.id, a.label, t),
        }))

        return (
          <ModalFrame
            key={entry.id}
            title={entry.title ?? t('title')}
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
