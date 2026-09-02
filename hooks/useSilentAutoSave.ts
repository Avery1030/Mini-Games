import { useEffect } from 'react'

/**
 * 静默自动保存。`deps` 必须由调用方原样传入，以保持触发时机（不把 run 自动列入依赖）。
 */
export function useSilentAutoSave(
  enabled: boolean,
  delayMs: number,
  run: () => void,
  deps: readonly unknown[],
): void {
  useEffect(() => {
    if (!enabled) return
    const timer = window.setTimeout(run, delayMs)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 保存节奏由调用方 deps 决定
  }, deps)
}
