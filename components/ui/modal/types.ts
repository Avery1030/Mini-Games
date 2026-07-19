import type { ReactNode } from 'react'

export type ModalCloseReason = 'action' | 'dismiss' | 'close'

export type ModalAction = {
  id: string
  /** 省略时由 ModalHost 按 id 填入 ok / cancel 文案 */
  label?: ReactNode
  /** 主按钮（强调） */
  primary?: boolean
  /** 点击后是否自动关闭，默认 true */
  closeOnClick?: boolean
}

export type ModalEntry = {
  id: string
  title?: ReactNode
  content: ReactNode
  actions?: ModalAction[]
  /** 点击遮罩或 Esc 关闭，默认 true */
  dismissible?: boolean
  /** 显示标题栏关闭按钮，默认 true */
  showClose?: boolean
  /** 对话框宽度 class，默认适中 */
  widthClassName?: string
  onOpen?: () => void
  /** reason=action 时附带 actionId */
  onClose?: (payload: { reason: ModalCloseReason; actionId?: string }) => void
}

export type OpenModalOptions = Omit<ModalEntry, 'id'> & {
  id?: string
}

export type ConfirmOptions = {
  title?: ReactNode
  message: ReactNode
  confirmText?: ReactNode
  cancelText?: ReactNode
  /** 危险操作时主按钮仍用 raised，仅文案区分 */
  dismissible?: boolean
  onOpen?: () => void
  onClose?: (confirmed: boolean) => void
}

export type AlertOptions = {
  title?: ReactNode
  message: ReactNode
  okText?: ReactNode
  dismissible?: boolean
  onOpen?: () => void
  onClose?: () => void
}
