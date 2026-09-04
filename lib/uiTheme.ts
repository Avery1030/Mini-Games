import {
  DEFAULT_CUSTOM_THEME,
  DEFAULT_UI_PALETTE,
  DEFAULT_UI_STYLE,
  UI_PALETTES,
  UI_THEME_VAR_KEYS,
  isThemeHex,
  type CustomUiTheme,
  type UiPaletteId,
  type UiStyleId,
  type UiThemeTokens,
} from '@/config/uiThemes'
import { isServer } from '@/lib/env'

function hexToRgb(hex: string): Nullable<{ r: number; g: number; b: number }> {
  if (!isThemeHex(hex)) return null
  const n = parseInt(hex.slice(1), 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

function rgbToHex(r: number, g: number, b: number): string {
  const h = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
  return `#${h(r)}${h(g)}${h(b)}`
}

function mix(a: string, b: string, t: number): string {
  const A = hexToRgb(a)
  const B = hexToRgb(b)
  if (!A || !B) return a
  return rgbToHex(A.r + (B.r - A.r) * t, A.g + (B.g - A.g) * t, A.b + (B.b - A.b) * t)
}

function luminance(hex: string): number {
  const rgb = hexToRgb(hex)
  if (!rgb) return 0.5
  const lin = [rgb.r, rgb.g, rgb.b].map((v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]
}

function onColor(bg: string): string {
  return luminance(bg) > 0.45 ? '#111111' : '#f5f5f5'
}

function tokensFromCustom(custom: CustomUiTheme): UiThemeTokens {
  const chrome = custom.chrome
  const title = custom.title
  const accent = custom.accent
  const field = custom.field
  const light = mix(chrome, '#ffffff', 0.55)
  const dark = mix(chrome, '#000000', 0.38)
  const on = onColor(chrome)
  return {
    '--chrome-face': chrome,
    '--chrome-face-hover': mix(chrome, '#000000', 0.1),
    '--chrome-face-active': mix(chrome, '#000000', 0.18),
    '--chrome-light': light,
    '--chrome-dark': dark,
    '--accent': accent,
    '--accent-border': mix(accent, '#000000', 0.28),
    '--window-face': chrome,
    '--window-title-active': title,
    '--window-title-inactive': mix(title, chrome, 0.45),
    '--window-title-text': onColor(title),
    '--window-body-bg': chrome,
    '--window-btn-hover': mix(title, '#ffffff', 0.18),
    '--panel-inset': mix(chrome, field, 0.35),
    '--field-bg': field,
    '--status-bar-bg': mix(chrome, dark, 0.08),
    '--status-bar-fg': mix(on, chrome, 0.35),
    '--taskbar-bg': chrome,
    '--taskbar-edge': light,
    '--taskbar-shadow': luminance(chrome) > 0.45 ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.45)',
    '--text-on-chrome': on,
    '--text-muted': mix(on, chrome, 0.4),
    '--scrollbar-face': chrome,
    '--scrollbar-face-hover': mix(chrome, '#ffffff', 0.12),
    '--scrollbar-face-active': mix(chrome, '#000000', 0.16),
    '--scrollbar-track': mix(chrome, dark, 0.12),
    '--scrollbar-edge-light': light,
    '--scrollbar-edge-dark': dark,
    '--titlebar-gradient': `linear-gradient(180deg, ${mix(title, '#ffffff', 0.22)} 0%, ${title} 48%, ${mix(title, '#000000', 0.18)} 100%)`,
  }
}

function writeTokens(root: HTMLElement, tokens: UiThemeTokens) {
  for (const key of UI_THEME_VAR_KEYS) root.style.removeProperty(key)
  for (const [key, value] of Object.entries(tokens)) {
    if (value) root.style.setProperty(key, value)
  }
}

export function resolveThemeSwatch(palette: UiPaletteId, custom: Nullable<CustomUiTheme>): CustomUiTheme {
  if (palette === 'custom' && custom) return custom
  if (palette === 'custom') return DEFAULT_CUSTOM_THEME
  return UI_PALETTES[palette].swatch
}

export function applyUiThemeToDocument(
  style: UiStyleId = DEFAULT_UI_STYLE,
  palette: UiPaletteId = DEFAULT_UI_PALETTE,
  custom: Nullable<CustomUiTheme> = null,
) {
  if (isServer) return
  const root = document.documentElement
  root.setAttribute('data-ui-style', style)

  if (palette === 'custom') {
    writeTokens(root, tokensFromCustom(custom ?? DEFAULT_CUSTOM_THEME))
    return
  }
  if (palette === 'follow') {
    writeTokens(root, {})
    return
  }
  writeTokens(root, UI_PALETTES[palette].tokens)
}

export function clearUiThemeFromDocument() {
  if (isServer) return
  const root = document.documentElement
  root.removeAttribute('data-ui-style')
  writeTokens(root, {})
}
