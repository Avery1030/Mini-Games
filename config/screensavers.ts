/** 屏保视觉样式（持久化枚举；目前仅烟花） */
export const SCREENSAVER_STYLE_OPTIONS = ['fireworks'] as const
export type ScreensaverStyleId = (typeof SCREENSAVER_STYLE_OPTIONS)[number]

export const DEFAULT_SCREENSAVER_STYLE: ScreensaverStyleId = 'fireworks'

export function isScreensaverStyleId(v: unknown): v is ScreensaverStyleId {
  return SCREENSAVER_STYLE_OPTIONS.includes(v as ScreensaverStyleId)
}

export function normalizeScreensaverStyleId(v: unknown): ScreensaverStyleId {
  return isScreensaverStyleId(v) ? v : DEFAULT_SCREENSAVER_STYLE
}
