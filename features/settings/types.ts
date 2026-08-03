import type { WallpaperId } from '@/config/wallpapers'

export type SectionId = 'display' | 'appearance' | 'taskbar' | 'data'

export type WallpaperDraft =
  | { kind: 'preset'; id: Exclude<WallpaperId, 'custom'> }
  | { kind: 'image'; path: string }
  | { kind: 'model'; path: string }

export const SETTINGS_SECTIONS: SectionId[] = ['display', 'appearance', 'taskbar', 'data']
