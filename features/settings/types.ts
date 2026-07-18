import type { WallpaperId } from '@/config/wallpapers'

export type SectionId = 'display' | 'appearance' | 'taskbar' | 'desktop'

export type WallpaperDraft =
  | { kind: 'preset'; id: Exclude<WallpaperId, 'custom'> }
  | { kind: 'custom'; url: string }

export const SETTINGS_SECTIONS: SectionId[] = ['display', 'appearance', 'taskbar', 'desktop']
