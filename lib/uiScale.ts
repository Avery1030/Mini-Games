export type UiScale = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl'

/**
 * 相对默认档（md）的倍率。
 * 根字号基准见 globals.css（默认 18px，比浏览器 16px 更大）。
 */
export const UI_SCALE_FACTOR: Record<UiScale, number> = {
  xs: 0.8,
  sm: 0.9,
  md: 1,
  lg: 1.15,
  xl: 1.3,
  '2xl': 1.45,
  '3xl': 1.6,
}

export const UI_SCALE_OPTIONS: UiScale[] = ['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl']

/** 设置里展示用的约略百分比（相对 md） */
export function uiScalePercent(scale: UiScale): number {
  return Math.round(UI_SCALE_FACTOR[scale] * 100)
}

export function isUiScale(value: unknown): value is UiScale {
  return (
    value === 'xs' ||
    value === 'sm' ||
    value === 'md' ||
    value === 'lg' ||
    value === 'xl' ||
    value === '2xl' ||
    value === '3xl'
  )
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
  root.style.removeProperty('zoom')
}

export function clearUiScaleFromDocument() {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.style.removeProperty('--ui-text-scale')
  root.style.removeProperty('--ui-icon-scale')
  root.style.removeProperty('zoom')
}
