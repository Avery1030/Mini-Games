/** 客户端锁屏密码哈希（非服务端安全模型，仅防随手解锁） */

function bytesToHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function hashLockPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(password)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return bytesToHex(digest)
}

export async function verifyLockPassword(password: string, hash: string): Promise<boolean> {
  const next = await hashLockPassword(password)
  return next === hash
}
