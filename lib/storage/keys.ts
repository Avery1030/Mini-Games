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
  /** 壁纸首屏同步标记 */
  wallpaperBoot: 'desktop-wallpaper-boot',
  /** 记事本偏好（zustand persist） */
  notepad: 'desktop-notepad',
  /** 画图偏好（zustand persist） */
  paint: 'desktop-paint',
  /** K 线图表偏好（zustand persist） */
  klineChart: 'desktop-kline-chart',
  /** 推箱子关卡进度（zustand persist） */
  sokoban: 'desktop-sokoban',
  /** 数独关卡进度（zustand persist） */
  sudoku: 'desktop-sudoku',
  /** 蜘蛛纸牌进行中对局（zustand persist） */
  spider: 'desktop-spider',
  /** 锁屏状态（zustand persist） */
  lock: 'desktop-lock',
  /** 日历按日备注（zustand persist） */
  calendar: 'desktop-calendar',
  /** 动态桌面项（文件夹等） */
  desktopItems: 'desktop-items',
  /** 运行时 IDE 窗口会话（刷新后恢复） */
  ideSessions: 'desktop-ide-sessions',
  /** 运行时 WPS 窗口会话（刷新后恢复） */
  officeSessions: 'desktop-office-sessions',
  /** 运行时资源管理器窗口会话 */
  explorerSessions: 'desktop-explorer-sessions',
  /** VFS 目录快照（zustand persist；文件内容仍在 IndexedDB） */
  vfsCatalog: 'desktop-vfs-catalog',
  /** Win95 Writer / Sheet 虚拟文件柜（zustand persist） */
  office: 'desktop-office',
} as const

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS]

export const STORAGE_KEY_LIST = Object.values(STORAGE_KEYS) as StorageKey[]

export function isStorageKey(value: string): value is StorageKey {
  return (STORAGE_KEY_LIST as string[]).includes(value)
}
