import type { DesktopAppId } from '@/config/desktop'
import type { DesktopItemRecord, DesktopResourceKind } from './itemTypes'

export function normalizeItemTitle(title: string): string {
  return title.trim().toLowerCase()
}

export function resolveParentId(parentId?: DesktopAppId | null): DesktopAppId | null {
  return parentId ?? null
}

export function getChildren(
  items: DesktopItemRecord[],
  parentId: DesktopAppId | null,
  opts?: { includeDeleted?: boolean },
): DesktopItemRecord[] {
  const pid = resolveParentId(parentId)
  return items.filter((item) => {
    if (!opts?.includeDeleted && item.isDeleted) return false
    return resolveParentId(item.parentId) === pid
  })
}

/** 同级（同 parent + 同 kind）名称是否占用 */
export function isSiblingTitleTaken(
  items: DesktopItemRecord[],
  kind: DesktopResourceKind,
  title: string,
  parentId: DesktopAppId | null,
  excludeId?: DesktopAppId,
): boolean {
  const key = normalizeItemTitle(title)
  if (!key) return false
  const pid = resolveParentId(parentId)
  return items.some(
    (item) =>
      !item.isDeleted &&
      item.kind === kind &&
      item.id !== excludeId &&
      resolveParentId(item.parentId) === pid &&
      normalizeItemTitle(item.title) === key,
  )
}

export function uniqueSiblingTitle(
  items: DesktopItemRecord[],
  kind: DesktopResourceKind,
  base: string,
  parentId: DesktopAppId | null,
  excludeId?: DesktopAppId,
): string {
  const trimmed = base.trim() || base
  if (!isSiblingTitleTaken(items, kind, trimmed, parentId, excludeId)) return trimmed
  for (let n = 2; n < 1000; n++) {
    const candidate = `${trimmed} (${n})`
    if (!isSiblingTitleTaken(items, kind, candidate, parentId, excludeId)) return candidate
  }
  return `${trimmed} (${Date.now()})`
}

/** 含子树全部后代 id（不含 root 自身） */
export function getDescendantIds(items: DesktopItemRecord[], rootId: DesktopAppId): DesktopAppId[] {
  const byParent = new Map<string, DesktopItemRecord[]>()
  for (const item of items) {
    if (item.isDeleted) continue
    const pid = resolveParentId(item.parentId)
    const key = pid ?? ''
    const list = byParent.get(key) ?? []
    list.push(item)
    byParent.set(key, list)
  }

  const out: DesktopAppId[] = []
  const stack: DesktopAppId[] = [rootId]
  while (stack.length) {
    const id = stack.pop()!
    const children = byParent.get(id) ?? []
    for (const child of children) {
      out.push(child.id)
      stack.push(child.id)
    }
  }
  return out
}

/** 已删除子树的后代（含软删项，按 parentId 链） */
export function getDeletedDescendantIds(
  items: DesktopItemRecord[],
  rootId: DesktopAppId,
): DesktopAppId[] {
  const byParent = new Map<string, DesktopItemRecord[]>()
  for (const item of items) {
    if (!item.isDeleted) continue
    const pid = resolveParentId(item.parentId)
    const key = pid ?? ''
    const list = byParent.get(key) ?? []
    list.push(item)
    byParent.set(key, list)
  }

  const out: DesktopAppId[] = []
  const stack: DesktopAppId[] = [rootId]
  while (stack.length) {
    const id = stack.pop()!
    const children = byParent.get(id) ?? []
    for (const child of children) {
      out.push(child.id)
      stack.push(child.id)
    }
  }
  return out
}

/** id 是否为 ancestorId 的后代（不含自身） */
export function isDescendantOf(
  items: DesktopItemRecord[],
  ancestorId: DesktopAppId,
  id: DesktopAppId,
): boolean {
  if (ancestorId === id) return false
  let current = items.find((i) => i.id === id)
  const guard = new Set<DesktopAppId>()
  while (current?.parentId) {
    if (guard.has(current.id)) break
    guard.add(current.id)
    if (current.parentId === ancestorId) return true
    current = items.find((i) => i.id === current!.parentId)
  }
  return false
}

/**
 * 回收站展示的「根」：已删除，且父级未删或不存在（避免子树刷屏）。
 */
export function getRecycleBinRoots(items: DesktopItemRecord[]): DesktopItemRecord[] {
  const deletedIds = new Set(items.filter((i) => i.isDeleted).map((i) => i.id))
  return items
    .filter((item) => {
      if (!item.isDeleted) return false
      const pid = resolveParentId(item.parentId)
      if (pid == null) return true
      return !deletedIds.has(pid)
    })
    .slice()
    .sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0))
}

/** 桌面根图标：未删除且 parentId 为空 */
export function isDesktopRootItem(item: DesktopItemRecord): boolean {
  return !item.isDeleted && resolveParentId(item.parentId) == null
}
