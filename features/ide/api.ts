import { isVfsError, vfs, type FileContent } from '@/lib/vfs'

export type IdeReadOk = { ok: true; path: string; text: string }
export type IdeReadErr = { ok: false; reason: 'notFound' | 'binary' | 'directory' | 'failed'; message: string }
export type IdeReadResult = IdeReadOk | IdeReadErr

function decodeTextContent(content: FileContent): string | null {
  if (typeof content === 'string') {
    if (content.includes('\0')) return null
    return content
  }
  const bytes = new Uint8Array(content)
  if (bytes.includes(0)) return null
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return null
  }
}

export async function readIdeText(path: string): Promise<IdeReadResult> {
  try {
    const { content, node } = await vfs.readFile(path)
    if (node.isDirectory) {
      return { ok: false, reason: 'directory', message: node.path }
    }
    const text = decodeTextContent(content)
    if (text == null) {
      return { ok: false, reason: 'binary', message: node.path }
    }
    return { ok: true, path: node.path, text }
  } catch (err) {
    if (isVfsError(err) && err.code === 'FileNotFound') {
      return { ok: false, reason: 'notFound', message: path }
    }
    if (isVfsError(err) && err.code === 'IsDirectory') {
      return { ok: false, reason: 'directory', message: path }
    }
    return { ok: false, reason: 'failed', message: err instanceof Error ? err.message : String(err) }
  }
}

export async function writeIdeText(path: string, text: string, mimeType?: string) {
  return vfs.writeFile(path, text, mimeType)
}
