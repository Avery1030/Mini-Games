import type { DesktopItemKind } from '@/config/desktop'
import type { DesktopResourceKind } from './itemTypes'

/** 可落盘用户资源的类型元数据；后续加类型时在此扩展即可 */
export type DesktopFileTypeMeta = {
  /** 含点号，如 `.txt`；文件夹等无后缀的类型不要登记 */
  extension: string
}

/**
 * 按 kind 登记扩展名。未登记的 kind（如 folder）显示时不加后缀。
 */
export const DESKTOP_FILE_TYPE_META: Partial<Record<DesktopResourceKind, DesktopFileTypeMeta>> = {
  textDocument: { extension: '.txt' },
}

export function getItemExtension(kind: DesktopItemKind | DesktopResourceKind): Nullable<string> {
  if (kind === 'app') return null
  return DESKTOP_FILE_TYPE_META[kind as DesktopResourceKind]?.extension ?? null
}

/**
 * 列表 / 图标 / 窗口标题用的显示名：有登记扩展名则追加（避免重复追加）。
 */
export function formatItemDisplayName(
  kind: DesktopItemKind | DesktopResourceKind,
  title: string,
): string {
  const base = title.trim()
  if (!base) return base
  const ext = getItemExtension(kind)
  if (!ext) return base
  if (base.toLowerCase().endsWith(ext.toLowerCase())) return base
  return `${base}${ext}`
}

/**
 * 重命名输入规范化：若用户带上了类型后缀则剥掉，存库只保留主名。
 */
export function parseItemTitleInput(kind: DesktopResourceKind, raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return trimmed
  const ext = getItemExtension(kind)
  if (!ext) return trimmed
  if (trimmed.toLowerCase().endsWith(ext.toLowerCase())) {
    const stripped = trimmed.slice(0, -ext.length).trim()
    return stripped || trimmed
  }
  return trimmed
}
