import { useModalStore } from './store'
import type {
  AlertOptions,
  ConfirmOptions,
  ModalAction,
  OpenModalOptions,
} from './types'

let seq = 0
function nextId() {
  seq += 1
  return `modal-${Date.now()}-${seq}`
}

/**
 * 打开一层自定义 Modal，返回 id；可与其它层叠放。
 */
export function openModal(options: OpenModalOptions): string {
  const id = options.id ?? nextId()
  useModalStore.getState().push({
    ...options,
    id,
    dismissible: options.dismissible ?? true,
    showClose: options.showClose ?? true,
  })
  return id
}

/** 关闭指定层；不传 id 则关闭最上层 */
export function closeModal(id?: string, actionId?: string) {
  const { stack, remove } = useModalStore.getState()
  const target = id ?? stack[stack.length - 1]?.id
  if (!target) return
  remove(target, actionId ? 'action' : 'close', actionId)
}

export function closeAllModals() {
  useModalStore.getState().clear()
}

/**
 * 确认框：Promise&lt;boolean&gt;，确定 true / 取消或关闭 false。
 */
export function confirmModal(options: ConfirmOptions): Promise<boolean> {
  const {
    title,
    message,
    confirmText,
    cancelText,
    dismissible = false,
    onOpen,
    onClose,
  } = options

  return new Promise((resolve) => {
    const actions: ModalAction[] = [
      { id: 'cancel', label: cancelText },
      { id: 'confirm', label: confirmText, primary: true },
    ]

    openModal({
      title,
      content: message,
      actions,
      dismissible,
      showClose: true,
      widthClassName: 'w-[min(360px,calc(100vw-2rem))]',
      onOpen,
      onClose: ({ reason, actionId }) => {
        const ok = reason === 'action' && actionId === 'confirm'
        onClose?.(ok)
        resolve(ok)
      },
    })
  })
}

/**
 * 提示框：只有一个确认按钮。
 */
export function alertModal(options: AlertOptions): Promise<void> {
  const {
    title,
    message,
    okText,
    dismissible = true,
    onOpen,
    onClose,
  } = options

  return new Promise((resolve) => {
    openModal({
      title,
      content: message,
      actions: [{ id: 'ok', label: okText, primary: true }],
      dismissible,
      showClose: true,
      widthClassName: 'w-[min(360px,calc(100vw-2rem))]',
      onOpen,
      onClose: () => {
        onClose?.()
        resolve()
      },
    })
  })
}

/** 便于统一导入的命名空间 */
export const modal = {
  open: openModal,
  close: closeModal,
  closeAll: closeAllModals,
  confirm: confirmModal,
  alert: alertModal,
}
