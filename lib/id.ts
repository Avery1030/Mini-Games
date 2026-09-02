/** 完整 UUID（VFS 节点等） */
export function createUuid(): string {
  return crypto.randomUUID()
}

/**
 * 动态窗口 id 后缀。与原先各 spawn 函数内联逻辑一致：
 * 优先 `randomUUID` 去横线后 8 位，否则 `Date.now` 的 36 进制。
 */
export function createWindowIdSuffix(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID().replace(/-/g, '').slice(0, 8)
    : `${Date.now().toString(36)}`
}
