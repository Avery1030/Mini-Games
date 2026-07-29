import type { WallpaperId } from '@/config/wallpapers'
import type { WallpaperFitMode } from '@/lib/wallpaper'

export type SectionId = 'display' | 'appearance' | 'taskbar' | 'data'

export type WallpaperDraft =
  | { kind: 'preset'; id: Exclude<WallpaperId, 'custom'> }
  | { kind: 'image'; path: string }
  | { kind: 'model'; path: string }

export type WallpaperDraftExtras = {
  fit: WallpaperFitMode
  enable3d: boolean
}

export const SETTINGS_SECTIONS: SectionId[] = ['display', 'appearance', 'taskbar', 'data']
