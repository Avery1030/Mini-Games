/** 窗口铬几何：圆角、立体边、标题栏、字体 */

export const UI_STYLE_OPTIONS = ['classic', 'luna', 'aqua', 'flat'] as const
export type UiStyleId = (typeof UI_STYLE_OPTIONS)[number]

export const DEFAULT_UI_STYLE: UiStyleId = 'classic'

export const UI_PALETTE_OPTIONS = ['follow', 'luna', 'olive', 'candy', 'midnight', 'custom'] as const
export type UiPaletteId = (typeof UI_PALETTE_OPTIONS)[number]

export const DEFAULT_UI_PALETTE: UiPaletteId = 'follow'

export interface CustomUiTheme {
  chrome: string
  title: string
  accent: string
  field: string
}

export type UiThemeTokens = Record<string, string>

export interface UiPaletteDef {
  id: Exclude<UiPaletteId, 'custom'>
  /** 设置页色板预览 */
  swatch: CustomUiTheme
  /** 写入 html 的 CSS 变量；follow 为空，沿用 :root / .dark */
  tokens: UiThemeTokens
}

export function isUiStyleId(v: unknown): v is UiStyleId {
  return UI_STYLE_OPTIONS.includes(v as UiStyleId)
}

export function isUiPaletteId(v: unknown): v is UiPaletteId {
  return UI_PALETTE_OPTIONS.includes(v as UiPaletteId)
}

export function normalizeUiStyleId(v: unknown): UiStyleId {
  return isUiStyleId(v) ? v : DEFAULT_UI_STYLE
}

export function normalizeUiPaletteId(v: unknown): UiPaletteId {
  return isUiPaletteId(v) ? v : DEFAULT_UI_PALETTE
}

const HEX = /^#([0-9a-fA-F]{6})$/

export function isThemeHex(v: unknown): v is string {
  return typeof v === 'string' && HEX.test(v.trim())
}

export function normalizeCustomUiTheme(raw: unknown): Nullable<CustomUiTheme> {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (!isThemeHex(o.chrome) || !isThemeHex(o.title) || !isThemeHex(o.accent) || !isThemeHex(o.field)) return null
  return {
    chrome: o.chrome.trim(),
    title: o.title.trim(),
    accent: o.accent.trim(),
    field: o.field.trim(),
  }
}

/** 可被主题覆盖、卸载时需清掉的变量 */
export const UI_THEME_VAR_KEYS = [
  '--chrome-face',
  '--chrome-face-hover',
  '--chrome-face-active',
  '--chrome-light',
  '--chrome-dark',
  '--accent',
  '--accent-border',
  '--window-face',
  '--window-title-active',
  '--window-title-inactive',
  '--window-title-text',
  '--window-body-bg',
  '--window-btn-hover',
  '--panel-inset',
  '--field-bg',
  '--status-bar-bg',
  '--status-bar-fg',
  '--taskbar-bg',
  '--taskbar-edge',
  '--taskbar-shadow',
  '--text-on-chrome',
  '--text-muted',
  '--scrollbar-face',
  '--scrollbar-face-hover',
  '--scrollbar-face-active',
  '--scrollbar-track',
  '--scrollbar-edge-light',
  '--scrollbar-edge-dark',
  '--titlebar-gradient',
] as const

export const UI_PALETTES: Record<Exclude<UiPaletteId, 'custom'>, UiPaletteDef> = {
  follow: {
    id: 'follow',
    swatch: { chrome: '#c0c0c0', title: '#000080', accent: '#f5c542', field: '#ffffff' },
    tokens: {},
  },
  luna: {
    id: 'luna',
    swatch: { chrome: '#ece9d8', title: '#0a246a', accent: '#316ac5', field: '#ffffff' },
    tokens: {
      '--chrome-face': '#ece9d8',
      '--chrome-face-hover': '#dedac8',
      '--chrome-face-active': '#d2cdb8',
      '--chrome-light': '#ffffff',
      '--chrome-dark': '#87888c',
      '--accent': '#316ac5',
      '--accent-border': '#1b4a94',
      '--window-face': '#ece9d8',
      '--window-title-active': '#0a246a',
      '--window-title-inactive': '#808080',
      '--window-title-text': '#ffffff',
      '--window-body-bg': '#ece9d8',
      '--window-btn-hover': '#1660c2',
      '--panel-inset': '#f5f4ec',
      '--field-bg': '#ffffff',
      '--status-bar-bg': '#ece9d8',
      '--status-bar-fg': '#555555',
      '--taskbar-bg': '#ece9d8',
      '--taskbar-edge': '#ffffff',
      '--taskbar-shadow': 'rgba(255,255,255,0.8)',
      '--text-on-chrome': '#111111',
      '--text-muted': '#555555',
      '--scrollbar-face': '#ece9d8',
      '--scrollbar-face-hover': '#f5f4ec',
      '--scrollbar-face-active': '#d2cdb8',
      '--scrollbar-track': '#d4d0c8',
      '--scrollbar-edge-light': '#ffffff',
      '--scrollbar-edge-dark': '#87888c',
      '--titlebar-gradient': 'linear-gradient(180deg, #0a246a 0%, #3a6ea5 48%, #0a246a 100%)',
    },
  },
  olive: {
    id: 'olive',
    swatch: { chrome: '#d4d0c8', title: '#5a6b3f', accent: '#9c9a00', field: '#fffff0' },
    tokens: {
      '--chrome-face': '#d4d0c8',
      '--chrome-face-hover': '#c4c0b4',
      '--chrome-face-active': '#b8b4a8',
      '--chrome-light': '#f4f0e8',
      '--chrome-dark': '#808060',
      '--accent': '#9c9a00',
      '--accent-border': '#6a6800',
      '--window-face': '#d4d0c8',
      '--window-title-active': '#5a6b3f',
      '--window-title-inactive': '#8a8a70',
      '--window-title-text': '#ffffff',
      '--window-body-bg': '#d4d0c8',
      '--window-btn-hover': '#6e824c',
      '--panel-inset': '#ece8dc',
      '--field-bg': '#fffff0',
      '--status-bar-bg': '#d4d0c8',
      '--status-bar-fg': '#4a4a38',
      '--taskbar-bg': '#d4d0c8',
      '--taskbar-edge': '#f4f0e8',
      '--taskbar-shadow': 'rgba(255,255,255,0.75)',
      '--text-on-chrome': '#222211',
      '--text-muted': '#5a5a40',
      '--scrollbar-face': '#d4d0c8',
      '--scrollbar-face-hover': '#e0dcd0',
      '--scrollbar-face-active': '#b8b4a8',
      '--scrollbar-track': '#c8c4b0',
      '--scrollbar-edge-light': '#f4f0e8',
      '--scrollbar-edge-dark': '#808060',
      '--titlebar-gradient': 'linear-gradient(180deg, #6e824c 0%, #5a6b3f 52%, #3f4d2c 100%)',
    },
  },
  candy: {
    id: 'candy',
    swatch: { chrome: '#f3d6e4', title: '#9b1b4a', accent: '#e85a9b', field: '#fff7fb' },
    tokens: {
      '--chrome-face': '#f3d6e4',
      '--chrome-face-hover': '#e8c4d6',
      '--chrome-face-active': '#dcb0c8',
      '--chrome-light': '#fff5fa',
      '--chrome-dark': '#b07090',
      '--accent': '#e85a9b',
      '--accent-border': '#b03068',
      '--window-face': '#f3d6e4',
      '--window-title-active': '#9b1b4a',
      '--window-title-inactive': '#c08098',
      '--window-title-text': '#ffffff',
      '--window-body-bg': '#f3d6e4',
      '--window-btn-hover': '#c42a62',
      '--panel-inset': '#fbeaf2',
      '--field-bg': '#fff7fb',
      '--status-bar-bg': '#f3d6e4',
      '--status-bar-fg': '#6a3048',
      '--taskbar-bg': '#f3d6e4',
      '--taskbar-edge': '#fff5fa',
      '--taskbar-shadow': 'rgba(255,255,255,0.8)',
      '--text-on-chrome': '#3a1020',
      '--text-muted': '#7a4060',
      '--scrollbar-face': '#f3d6e4',
      '--scrollbar-face-hover': '#fbeaf2',
      '--scrollbar-face-active': '#dcb0c8',
      '--scrollbar-track': '#e8c4d6',
      '--scrollbar-edge-light': '#fff5fa',
      '--scrollbar-edge-dark': '#b07090',
      '--titlebar-gradient': 'linear-gradient(180deg, #c42a62 0%, #9b1b4a 50%, #7a1438 100%)',
    },
  },
  midnight: {
    id: 'midnight',
    swatch: { chrome: '#2a3140', title: '#1a2744', accent: '#7eb6ff', field: '#1b1f2a' },
    tokens: {
      '--chrome-face': '#2a3140',
      '--chrome-face-hover': '#353e50',
      '--chrome-face-active': '#404a60',
      '--chrome-light': '#5a6580',
      '--chrome-dark': '#12161f',
      '--accent': '#7eb6ff',
      '--accent-border': '#4a88d0',
      '--window-face': '#2a3140',
      '--window-title-active': '#1a2744',
      '--window-title-inactive': '#3a4458',
      '--window-title-text': '#e8eef8',
      '--window-body-bg': '#2a3140',
      '--window-btn-hover': '#2a4a7a',
      '--panel-inset': '#1e2430',
      '--field-bg': '#1b1f2a',
      '--status-bar-bg': '#232a38',
      '--status-bar-fg': '#9aa8c0',
      '--taskbar-bg': '#232a38',
      '--taskbar-edge': '#5a6580',
      '--taskbar-shadow': 'rgba(0,0,0,0.45)',
      '--text-on-chrome': '#e8eef8',
      '--text-muted': '#9aa8c0',
      '--scrollbar-face': '#3a4458',
      '--scrollbar-face-hover': '#4a556c',
      '--scrollbar-face-active': '#2a3140',
      '--scrollbar-track': '#1e2430',
      '--scrollbar-edge-light': '#5a6580',
      '--scrollbar-edge-dark': '#12161f',
      '--titlebar-gradient': 'linear-gradient(180deg, #2a4a7a 0%, #1a2744 52%, #0e1628 100%)',
    },
  },
}

export const DEFAULT_CUSTOM_THEME: CustomUiTheme = UI_PALETTES.follow.swatch
