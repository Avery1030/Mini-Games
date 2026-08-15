import { CUSTOM_WALLPAPER_ID } from '@/config/wallpapers'
import type { DesktopCoordinate } from '@/config/desktop'
import { allocateDesktopCoordinate } from '@/lib/desktop/window/createFolder'
import { assertValidName, getBasename, joinPath, vfs } from '@/lib/vfs'
import { isVfsWallpaperPath } from '@/lib/wallpaper/resolve'
import { WALLPAPERS_DIR } from '@/lib/wallpaper/types'
import { useDesktopStore } from '@/store/desktop'
import { isVfsDesktopFileId, useDesktopVfsStore } from '@/store/desktopVfs'
import { useSettingsStore } from '@/store/settings'
import { findIdeWindowByPath } from '@/lib/desktop/window/ideWindows'

const DESKTOP_DIR = '/Desktop'

export function isDesktopVfsPath(path: string): boolean {
  return path === DESKTOP_DIR || path.startsWith(`${DESKTOP_DIR}/`)
}

export function refreshDesktopVfs(): void {
  void useDesktopVfsStore.getState().refresh()
}

/**
 * 将 VFS 图片设为桌面壁纸。
 * 若源不在 `/Wallpapers`，先复制过去再 apply。
 */
export async function setVfsImageAsWallpaper(filePath: string): Promise<string> {
  let wallpaperPath = filePath
  if (!isVfsWallpaperPath(filePath)) {
    const name = getBasename(filePath)
    wallpaperPath = await vfs.allocateUniquePath(WALLPAPERS_DIR, name)
    await vfs.copyFile(filePath, wallpaperPath)
  }
  useSettingsStore.getState().applyWallpaper({
    wallpaperId: CUSTOM_WALLPAPER_ID,
    wallpaperPath,
  })
  return wallpaperPath
}

function placeDesktopIcon(path: string, prefer?: DesktopCoordinate) {
  const store = useDesktopStore.getState()
  if (store.coordinates[path]) return
  const occupied = Object.values(store.coordinates)
  const coord = allocateDesktopCoordinate(occupied, prefer ?? [5, 1])
  store.ensureCoordinate(path, coord)
}

/** 复制到桌面目录 `/Desktop` */
export async function copyVfsFileToDesktop(filePath: string): Promise<string> {
  const name = getBasename(filePath)
  const dest = await vfs.allocateUniquePath(DESKTOP_DIR, name)
  await vfs.copyFile(filePath, dest)
  placeDesktopIcon(dest)
  refreshDesktopVfs()
  return dest
}

/** 把当前编辑内容写到 `/Desktop`（重名则自动加 (1)） */
export async function writeTextToDesktop(
  fileName: string,
  text: string,
  mimeType?: string,
): Promise<string> {
  const dest = await vfs.allocateUniquePath(DESKTOP_DIR, fileName)
  await vfs.writeFile(dest, text, mimeType)
  placeDesktopIcon(dest)
  refreshDesktopVfs()
  return dest
}

/** 桌面上复制一份 VFS 文件，图标落在原文件附近 */
export async function duplicateDesktopVfsFiles(paths: string[]): Promise<string[]> {
  const created: string[] = []
  const store = useDesktopStore.getState()
  const occupied = Object.values(store.coordinates)
  for (const path of paths) {
    if (!isVfsDesktopFileId(path)) continue
    const dest = await vfs.allocateUniquePath(DESKTOP_DIR, getBasename(path))
    await vfs.copyFile(path, dest)
    const prefer = store.coordinates[path] ?? ([5, 1] as DesktopCoordinate)
    const coord = allocateDesktopCoordinate(occupied, prefer)
    store.ensureCoordinate(dest, coord)
    occupied.push(coord)
    created.push(dest)
  }
  if (created.length > 0) refreshDesktopVfs()
  return created
}

/** 重命名桌面 VFS 文件，并迁移图标坐标 / 已打开的 IDE 窗口 */
export async function renameDesktopVfsFile(oldPath: string, newName: string): Promise<string> {
  const name = newName.trim()
  assertValidName(name)
  const dest = joinPath(DESKTOP_DIR, name)
  if (dest === oldPath) return oldPath
  if (await vfs.exists(dest)) {
    throw new Error('duplicate')
  }
  await vfs.renameFile(oldPath, dest)
  const store = useDesktopStore.getState()
  const coord = store.coordinates[oldPath]
  store.removeCoordinate(oldPath)
  if (coord) store.ensureCoordinate(dest, coord)
  const win = findIdeWindowByPath(oldPath)
  win?.setFileMeta(dest, win.dirty)
  refreshDesktopVfs()
  return dest
}
