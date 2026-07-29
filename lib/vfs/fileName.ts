/** 业务层写文件时的文件名清理（去掉非法路径字符） */
export function sanitizeFileStem(raw: unknown, fallback = 'Untitled'): string {
  const s = typeof raw === 'string' ? raw.trim().replace(/[\r\n\t]+/g, ' ') : ''
  const cleaned = (s || fallback).replace(/[\\/:*?"<>|]/g, '_').slice(0, 80)
  return cleaned || fallback
}
