export type UiScale = 'sm' | 'md' | 'lg' | 'xl'

/** 文字 / 图标字号倍率（不缩放整页布局） */
export const UI_SCALE_FACTOR: Record<UiScale, number> = {
  sm: 0.85,
  md: 1,
  lg: 1.25,
  xl: 1.5,
}

export const UI_SCALE_OPTIONS: UiScale[] = ['sm', 'md', 'lg', 'xl']

export function isUiScale(value: unknown): value is UiScale {
  return value === 'sm' || value === 'md' || value === 'lg' || value === 'xl'
}

export function resolveUiScaleFactor(scale: UiScale): number {
  return UI_SCALE_FACTOR[scale] ?? 1
}

export function scalePx(base: number, scale: UiScale): number {
  return Math.max(1, Math.round(base * resolveUiScaleFactor(scale)))
}

/**
 * 只写入文字/图标倍率变量，并清掉可能残留的整页 zoom。
 * 实际样式见 globals.css（根字号 + Lucide 尺寸）。
 */
export function applyUiScaleToDocument(scale: UiScale) {
  if (typeof document === 'undefined') return
  const factor = resolveUiScaleFactor(scale)
  const root = document.documentElement
  root.style.setProperty('--ui-text-scale', String(factor))
  root.style.setProperty('--ui-icon-scale', String(factor))
  // 兼容：此前错误地用过 zoom 放大整页
  root.style.removeProperty('zoom')
}

export function clearUiScaleFromDocument() {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.style.removeProperty('--ui-text-scale')
  root.style.removeProperty('--ui-icon-scale')
  root.style.removeProperty('zoom')
}
