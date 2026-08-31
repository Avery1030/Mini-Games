import type { DesktopAppId } from '@/config/desktop'

export type MarqueeRect = {
  left: number
  top: number
  width: number
  height: number
}

export function normalizeMarquee(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): MarqueeRect {
  const left = Math.min(x0, x1)
  const top = Math.min(y0, y1)
  return {
    left,
    top,
    width: Math.abs(x1 - x0),
    height: Math.abs(y1 - y0),
  }
}

export function rectsIntersect(
  a: { left: number; top: number; width: number; height: number },
  b: { left: number; top: number; width: number; height: number },
): boolean {
  return !(
    a.left + a.width < b.left ||
    b.left + b.width < a.left ||
    a.top + a.height < b.top ||
    b.top + b.height < a.top
  )
}

/** 收集与框选矩形相交的 `[data-desktop-icon]` / `[data-fs-item]` id */
export function hitIdsInMarquee(
  rect: MarqueeRect,
  opts: {
    root?: Nullable<ParentNode>
    attr?: string
    allowedIds?: ReadonlySet<DesktopAppId>
  } = {},
): DesktopAppId[] {
  const attr = opts.attr ?? 'data-desktop-icon'
  const root = opts.root ?? document
  const nodes = root.querySelectorAll(`[${attr}]`)
  const hit: DesktopAppId[] = []
  for (const node of nodes) {
    const el = node as HTMLElement
    const id = el.getAttribute(attr) as Nullable<DesktopAppId>
    if (!id) continue
    if (opts.allowedIds && !opts.allowedIds.has(id)) continue
    const r = el.getBoundingClientRect()
    if (
      rectsIntersect(rect, {
        left: r.left,
        top: r.top,
        width: r.width,
        height: r.height,
      })
    ) {
      hit.push(id)
    }
  }
  return hit
}
