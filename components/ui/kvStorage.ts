/**
 * UI 工具包的键值存储注入点。
 * 本应用在 `lib/storage` 启动时注入 appStorage；组件库单独使用时可自行 register。
 */
export type UiKvStorage = {
  getItem: (key: string) => Nullable<string>
  setItem: (key: string, value: string) => void
}

let adapter: Nullable<UiKvStorage> = null

export function registerUiKvStorage(next: UiKvStorage): void {
  adapter = next
}

export function uiKvGet(key: string): Nullable<string> {
  return adapter?.getItem(key) ?? null
}

export function uiKvSet(key: string, value: string): void {
  adapter?.setItem(key, value)
}
