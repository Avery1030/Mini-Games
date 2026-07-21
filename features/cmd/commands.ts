import type { DesktopAppId } from '@/config/desktop'
import { WALLPAPERS, type WallpaperId } from '@/config/wallpapers'
import { getChildren, resolveParentId } from '@/lib/desktop/itemsTree'
import type { DesktopItemRecord } from '@/lib/desktop/itemTypes'
import { useDesktopItemsStore } from '@/store/desktopItems'
import { useSettingsStore } from '@/store/settings'
import { useWindowStore } from '@/store/window'
import { useDesktopStore } from '@/store/desktop'

export type CmdLine = {
  id: string
  kind: 'out' | 'err' | 'sys'
  text: string
}

export type CmdRunResult = {
  lines: CmdLine[]
  /** 清屏 */
  clear?: boolean
  /** 更新后的当前目录（folder id；null = 桌面根） */
  cwd?: DesktopAppId | null
}

type CmdContext = {
  cwd: DesktopAppId | null
  t: (key: string, values?: Record<string, string | number>) => string
}

let lineSeq = 0
function line(kind: CmdLine['kind'], text: string): CmdLine {
  lineSeq += 1
  return { id: `cmd-${Date.now()}-${lineSeq}`, kind, text }
}

function out(text: string): CmdLine {
  return line('out', text)
}

function err(text: string): CmdLine {
  return line('err', text)
}

function sys(text: string): CmdLine {
  return line('sys', text)
}

/** 当前路径显示：C:\Desktop\Foo\Bar */
export function formatCmdPath(
  items: DesktopItemRecord[],
  cwd: DesktopAppId | null,
  desktopLabel: string,
): string {
  if (cwd == null) return `C:\\${desktopLabel}`
  const parts: string[] = []
  let current = items.find((i) => i.id === cwd && !i.isDeleted)
  const guard = new Set<DesktopAppId>()
  while (current) {
    if (guard.has(current.id)) break
    guard.add(current.id)
    parts.unshift(current.title)
    const pid = resolveParentId(current.parentId)
    if (pid == null) break
    current = items.find((i) => i.id === pid && !i.isDeleted)
  }
  return `C:\\${desktopLabel}\\${parts.join('\\')}`
}

function listDir(ctx: CmdContext): CmdRunResult {
  const items = useDesktopItemsStore.getState().items
  const children = getChildren(items, ctx.cwd).slice().sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1
    return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })
  })

  const lines: CmdLine[] = [
    out(ctx.t('dirHeader')),
    out(''),
  ]

  if (children.length === 0) {
    lines.push(out(ctx.t('dirEmpty')))
  } else {
    for (const child of children) {
      const tag = child.kind === 'folder' ? '<DIR>' : '     '
      const padded = tag.padEnd(10, ' ')
      lines.push(out(`${padded}${child.title}`))
    }
  }

  lines.push(out(''))
  lines.push(out(ctx.t('dirSummary', { count: children.length })))
  return { lines }
}

function changeDir(ctx: CmdContext, arg: string): CmdRunResult {
  const target = arg.trim()
  if (!target) {
    return {
      lines: [out(formatCmdPath(useDesktopItemsStore.getState().items, ctx.cwd, ctx.t('desktop')))],
    }
  }

  const items = useDesktopItemsStore.getState().items

  if (target === '\\' || target === '/' || /^[cC]:\\?$/.test(target)) {
    return { lines: [], cwd: null }
  }

  // 支持 cd .. 与 cd ..\..
  if (/^(\.\.([/\\]|$))+/.test(target) || target === '..') {
    let cwd = ctx.cwd
    const segments = target.split(/[/\\]/).filter(Boolean)
    for (const seg of segments) {
      if (seg === '..') {
        if (cwd == null) break
        const cur = items.find((i) => i.id === cwd)
        cwd = resolveParentId(cur?.parentId)
      } else {
        return { lines: [err(ctx.t('cdNotFound', { name: target }))] }
      }
    }
    return { lines: [], cwd }
  }

  // 相对路径：支持 a\b 或 a/b
  const segments = target.split(/[/\\]/).filter(Boolean)
  let cwd = ctx.cwd
  for (const seg of segments) {
    if (seg === '.') continue
    if (seg === '..') {
      if (cwd == null) continue
      const cur = items.find((i) => i.id === cwd)
      cwd = resolveParentId(cur?.parentId)
      continue
    }
    const next = getChildren(items, cwd).find(
      (i) => i.kind === 'folder' && i.title.toLowerCase() === seg.toLowerCase(),
    )
    if (!next) {
      return { lines: [err(ctx.t('cdNotFound', { name: target }))] }
    }
    cwd = next.id
  }
  return { lines: [], cwd }
}

function showTime(ctx: CmdContext): CmdRunResult {
  const now = new Date()
  const time = now.toLocaleTimeString(undefined, { hour12: false })
  const date = now.toLocaleDateString(undefined)
  return {
    lines: [
      out(ctx.t('timeNow', { time })),
      out(ctx.t('dateNow', { date })),
    ],
  }
}

function openApp(ctx: CmdContext, id: DesktopAppId, labelKey: string): CmdRunResult {
  useWindowStore.getState().openWindow(id)
  return { lines: [sys(ctx.t(labelKey))] }
}

function cycleWallpaper(ctx: CmdContext): CmdRunResult {
  const { wallpaperId, applyWallpaper } = useSettingsStore.getState()
  const ids = WALLPAPERS.map((w) => w.id)
  const idx = ids.indexOf(wallpaperId as Exclude<WallpaperId, 'custom'>)
  const next = ids[(idx + 1) % ids.length] ?? ids[0]
  applyWallpaper(next)
  const preset = WALLPAPERS.find((w) => w.id === next)
  return {
    lines: [sys(ctx.t('wallpaperChanged', { name: preset?.name ?? next }))],
  }
}

async function syncLayout(ctx: CmdContext): Promise<CmdRunResult> {
  // 无云端 API：触发一次本地 store 读/写感知，模拟「同步」
  await new Promise((r) => setTimeout(r, 600))
  // 触碰 store，确保 hydrate 状态可读
  void useDesktopStore.getState().coordinates
  void useDesktopItemsStore.getState().items
  void useSettingsStore.getState().wallpaperId
  return {
    lines: [
      sys(ctx.t('syncStart')),
      sys(ctx.t('syncDone')),
    ],
  }
}

function help(ctx: CmdContext): CmdRunResult {
  return {
    lines: [
      out(ctx.t('helpTitle')),
      out(''),
      out('  DIR            ' + ctx.t('helpDir')),
      out('  CD [path]      ' + ctx.t('helpCd')),
      out('  CLS            ' + ctx.t('helpCls')),
      out('  TIME           ' + ctx.t('helpTime')),
      out('  NOTEPAD        ' + ctx.t('helpNotepad')),
      out('  TETRIS         ' + ctx.t('helpTetris')),
      out('  WALLPAPER       ' + ctx.t('helpWallpaper')),
      out('  SYNC           ' + ctx.t('helpSync')),
      out('  HELP           ' + ctx.t('helpHelp')),
      out('  EXIT           ' + ctx.t('helpExit')),
    ],
  }
}

/**
 * 执行一行 DOS 风格命令。
 * EXIT 由 UI 处理（关闭窗口）；此处返回特殊 sys 行供 UI 识别。
 */
export async function runCmdCommand(
  rawInput: string,
  ctx: CmdContext,
): Promise<CmdRunResult & { exit?: boolean }> {
  const trimmed = rawInput.trim()
  if (!trimmed) return { lines: [] }

  const space = trimmed.search(/\s/)
  const cmd = (space === -1 ? trimmed : trimmed.slice(0, space)).toLowerCase()
  const arg = space === -1 ? '' : trimmed.slice(space + 1).trim()

  switch (cmd) {
    case 'dir':
    case 'ls':
      return listDir(ctx)
    case 'cd':
    case 'chdir':
      return changeDir(ctx, arg)
    case 'cls':
    case 'clear':
      return { lines: [], clear: true }
    case 'time':
    case 'date':
      return showTime(ctx)
    case 'notepad':
      return openApp(ctx, 'notepad', 'launchedNotepad')
    case 'tetris':
      return openApp(ctx, 'tetris', 'launchedTetris')
    case 'wallpaper':
      return cycleWallpaper(ctx)
    case 'sync':
      return syncLayout(ctx)
    case 'help':
    case '?':
      return help(ctx)
    case 'exit':
      return { lines: [sys(ctx.t('bye'))], exit: true }
    default:
      return { lines: [err(ctx.t('unknown', { cmd }))] }
  }
}
