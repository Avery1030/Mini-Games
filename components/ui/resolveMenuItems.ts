import type { ReactNode } from 'react'
import type { ContextMenuItem } from './ContextMenu'

/**
 * 声明式菜单项：用 when / disabled 控制显示与可用性，避免散落的条件展开。
 */
export type MenuItemConfig<Ctx> = {
  id: string
  label: ReactNode | ((ctx: Ctx) => ReactNode)
  /** 默认 true；返回 false 则不渲染该项 */
  when?: (ctx: Ctx) => boolean
  disabled?: boolean | ((ctx: Ctx) => boolean)
  onSelect?: (ctx: Ctx) => void
  children?: MenuItemConfig<Ctx>[]
}

function resolveLabel<Ctx>(label: MenuItemConfig<Ctx>['label'], ctx: Ctx): ReactNode {
  return typeof label === 'function' ? label(ctx) : label
}

function resolveDisabled<Ctx>(
  disabled: MenuItemConfig<Ctx>['disabled'],
  ctx: Ctx,
): boolean | undefined {
  if (disabled === undefined) return undefined
  return typeof disabled === 'function' ? disabled(ctx) : disabled
}

/** 按配置解析出可渲染的 ContextMenuItem 列表 */
export function resolveMenuItems<Ctx>(
  configs: MenuItemConfig<Ctx>[],
  ctx: Ctx,
): ContextMenuItem[] {
  const items: ContextMenuItem[] = []
  for (const config of configs) {
    if (config.when && !config.when(ctx)) continue
    const children = config.children ? resolveMenuItems(config.children, ctx) : undefined
    items.push({
      id: config.id,
      label: resolveLabel(config.label, ctx),
      disabled: resolveDisabled(config.disabled, ctx),
      onSelect: config.onSelect ? () => config.onSelect!(ctx) : undefined,
      children: children && children.length > 0 ? children : undefined,
    })
  }
  return items
}
