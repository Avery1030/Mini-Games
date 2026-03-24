/**
 * 桌面应用与图标配置：小游戏/应用入口及桌面图标布局，避免在组件内硬编码。
 * 新增应用时：在 DesktopAppId 与 DESKTOP_APPS 增加一项、在 DESKTOP_ICONS 中需要入口则加 { appId: '新id' }，并在 WindowsDesktop 的 AppWindowContent 中增加对应 contentType 分支。
 */

/** 可打开窗口的应用 id，与任务栏、窗口 id 一致；新增应用时在此补充 */
export type DesktopAppId = 'minesweeper' | 'mario' | 'donation'

export interface DesktopAppConfig {
  id: DesktopAppId
  /** 桌面图标下方文字 */
  label: string
  /** 桌面图标 emoji/字符 */
  icon: string
  /** 窗口标题栏文字 */
  title: string
  /** 窗口宽度（px） */
  width: number
  /** 窗口高度（px） */
  height: number
  /** 内容类型，由桌面组件映射到具体 React 组件 */
  contentType: 'minesweeper' | 'mario' | 'donation'
}

/** 桌面可启动的应用列表（小游戏等），配置窗口与入口展示 */
export const DESKTOP_APPS: readonly DesktopAppConfig[] = [
  {
    id: 'minesweeper',
    label: '扫雷',
    icon: '💣',
    title: '扫雷',
    width: 520,
    height: 520,
    contentType: 'minesweeper',
  },
  {
    id: 'mario',
    label: '超级玛丽',
    icon: '🍄',
    title: '超级玛丽',
    width: 840,
    height: 460,
    contentType: 'mario',
  },
  {
    id: 'donation',
    label: 'Donation',
    icon: '❤️',
    title: 'Donation',
    width: 400,
    height: 320,
    contentType: 'donation',
  },
]

/** 桌面图标项：可为可启动应用（appId）或仅展示的占位图标（label + icon） */
export type DesktopIconItem =
  | { appId: DesktopAppId }
  | { label: string; icon: string }

/** 桌面图标顺序：前 7 个为左列，后 7 个为右列；带 appId 的项点击后打开对应窗口 */
export const DESKTOP_ICONS: readonly DesktopIconItem[] = [
  { label: 'Referral', icon: '📎' },
  { label: 'Bridge', icon: '🔗' },
  { label: 'Claim', icon: '📥' },
  { label: 'Stake', icon: '📊' },
  { label: 'Market', icon: '🛒' },
  { appId: 'mario' },
  { appId: 'minesweeper' },
  { label: 'Governance', icon: '🏛️' },
  { label: 'Foundry', icon: '⚙️' },
  { label: 'Document', icon: '📄' },
  { appId: 'donation' },
  { label: 'Email', icon: '✉️' },
  { label: 'Log', icon: '📋' },
  { label: 'Settings', icon: '🔧' },
] as const

const ICONS_PER_COLUMN = 7

/** 左列图标（第 1～7 个） */
export const DESKTOP_ICONS_LEFT = DESKTOP_ICONS.slice(0, ICONS_PER_COLUMN)

/** 右列图标（第 8～14 个） */
export const DESKTOP_ICONS_RIGHT = DESKTOP_ICONS.slice(ICONS_PER_COLUMN, ICONS_PER_COLUMN * 2)

/** 根据图标配置解析出用于显示的 label 与 icon */
export function getDesktopIconDisplay(
  item: DesktopIconItem,
  apps: readonly DesktopAppConfig[] = DESKTOP_APPS
): { label: string; icon: string } {
  if ('appId' in item) {
    const app = apps.find((a) => a.id === item.appId)
    return app ? { label: app.label, icon: app.icon } : { label: item.appId, icon: '📦' }
  }
  return { label: item.label, icon: item.icon }
}

/** 判断图标项是否为可启动应用 */
export function isDesktopAppIcon(item: DesktopIconItem): item is { appId: DesktopAppId } {
  return 'appId' in item
}
