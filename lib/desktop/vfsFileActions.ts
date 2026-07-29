import { CUSTOM_WALLPAPER_ID } from '@/config/wallpapers'
import { getBasename, vfs } from '@/lib/vfs'
import { isVfsWallpaperPath } from '@/lib/wallpaper/resolve'
import { WALLPAPERS_DIR } from '@/lib/wallpaper/types'
import { useSettingsStore } from '@/store/settings'
import { useDesktopVfsStore } from '@/store/desktopVfs'

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

/** 复制到桌面目录 `/Desktop` */
export async function copyVfsFileToDesktop(filePath: string): Promise<string> {
  const name = getBasename(filePath)
  const dest = await vfs.allocateUniquePath('/Desktop', name)
  await vfs.copyFile(filePath, dest)
  void useDesktopVfsStore.getState().refresh()
  return dest
}
