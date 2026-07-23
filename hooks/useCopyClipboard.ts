'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const DEFAULT_DURATION = 2000

/**
 * 复制到剪贴板；成功后短暂置 `isCopied`，超时后自动复位。
 * @param duration 复位延迟（ms），默认 2000；≤0 表示不自动复位
 */
export function useCopyClipboard(duration = DEFAULT_DURATION) {
  const [isCopied, setIsCopied] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current != null) clearTimeout(timerRef.current)
    }
  }, [])

  const copy = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text)
        setIsCopied(true)
        if (timerRef.current != null) clearTimeout(timerRef.current)
        if (duration > 0) {
          timerRef.current = setTimeout(() => {
            setIsCopied(false)
            timerRef.current = null
          }, duration)
        }
        return true
      } catch {
        setIsCopied(false)
        return false
      }
    },
    [duration],
  )

  return { isCopied, copy }
}
