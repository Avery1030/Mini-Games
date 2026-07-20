/** 项目内所有 localStorage key（唯一来源） */
export const STORAGE_KEYS = {
  /** next-themes：'light' | 'dark' */
  theme: 'app-theme',
  /** 系统设置（zustand persist） */
  settings: 'desktop-settings',
  /** 窗口状态（zustand persist） */
  windows: 'desktop-windows',
  /** 桌面图标坐标（zustand persist） */
  coordinates: 'desktop-coordinates',
  /** 旧版合一 persist，仅迁移用 */
  legacyDesktop: 'desktop-app-windows',
  /** 壁纸首屏同步标记 */
  wallpaperBoot: 'desktop-wallpaper-boot',
  /** 记事本偏好（zustand persist） */
  notepad: 'desktop-notepad',
  /** 画图偏好（zustand persist） */
  paint: 'desktop-paint',
  /** 锁屏状态（zustand persist） */
  lock: 'desktop-lock',
  /** 日历按日备注（zustand persist） */
  calendar: 'desktop-calendar',
  /** 演示应用本地进度（zustand persist） */
  demoApps: 'desktop-demo-apps',
} as const

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS]

export const STORAGE_KEY_LIST = Object.values(STORAGE_KEYS) as StorageKey[]

export function isStorageKey(value: string): value is StorageKey {
  return (STORAGE_KEY_LIST as string[]).includes(value)
}
