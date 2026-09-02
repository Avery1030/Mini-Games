import { getBasename, getParentPath, sanitizeFileStem, vfs, type FileNode } from '@/lib/vfs'
import {
  EMPTY_SHEET,
  EMPTY_WRITER,
  OFFICE_CELL_MAX,
  OFFICE_HTML_MAX,
  SheetBodySchema,
  type OfficeFile,
  type OfficeKind,
  type SheetBody,
} from './schema'
import { OFFICE_DIR, officeExt, officeKindFromPath } from './fileTypes'

const MAX_OFFICE_FILES = 200
const DEFAULT_STEM: Record<OfficeKind, string> = { writer: '文档', sheet: '表格' }

export type OfficeFileRecord = OfficeFile & { path: string }

function isOfficeNode(node: FileNode, kind?: OfficeKind): boolean {
  if (node.isDirectory) return false
  const found = officeKindFromPath(node.path)
  return kind ? found === kind : found != null
}

function ensureFileName(raw: string | undefined, kind: OfficeKind): string {
  const ext = `.${officeExt(kind)}`
  const stripped = (raw ?? '').replace(/\.(wps|et)$/i, '')
  const stem = sanitizeFileStem(stripped, DEFAULT_STEM[kind])
  return `${stem}${ext}`
}

function parseWriterHtml(content: unknown): string {
  if (typeof content !== 'string') return EMPTY_WRITER.html
  const trimmed = content.trim()
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as { html?: unknown }
      if (typeof parsed.html === 'string') return parsed.html.slice(0, OFFICE_HTML_MAX)
    } catch {
      /* 当 HTML 原文 */
    }
  }
  return content.slice(0, OFFICE_HTML_MAX) || EMPTY_WRITER.html
}

function parseSheetBody(content: unknown): SheetBody {
  if (typeof content !== 'string') return { ...EMPTY_SHEET, cells: {} }
  try {
    const parsed = SheetBodySchema.safeParse(JSON.parse(content))
    if (!parsed.success) return { ...EMPTY_SHEET, cells: {} }
    const cells: Record<string, string> = {}
    for (const [key, value] of Object.entries(parsed.data.cells)) {
      cells[key] = value.slice(0, OFFICE_CELL_MAX)
    }
    return { ...parsed.data, cells }
  } catch {
    return { ...EMPTY_SHEET, cells: {} }
  }
}

function assertWriterHtml(html: string): string {
  if (html.length > OFFICE_HTML_MAX) throw new Error('文档过大')
  return html
}

function assertSheetBody(sheet: SheetBody): SheetBody {
  const encoded = JSON.stringify(sheet)
  if (encoded.length > OFFICE_HTML_MAX) throw new Error('表格过大')
  return sheet
}

async function toRecord(node: FileNode, content: unknown): Promise<OfficeFileRecord> {
  const kind = officeKindFromPath(node.path)
  if (!kind) throw new Error('不是办公文件')
  return {
    id: node.id,
    name: node.name,
    kind,
    updatedAt: node.updatedAt,
    path: node.path,
    writer: kind === 'writer' ? { html: parseWriterHtml(content) } : undefined,
    sheet: kind === 'sheet' ? parseSheetBody(content) : undefined,
  }
}

async function uniqueName(kind: OfficeKind, preferred?: string): Promise<string> {
  const desired = ensureFileName(preferred, kind)
  if (!preferred) {
    const list = await listOfficeFiles(kind)
    const taken = new Set(list.map((f) => f.name.trim().toLowerCase()))
    const stem = DEFAULT_STEM[kind]
    const ext = `.${officeExt(kind)}`
    for (let n = 1; n < 1000; n++) {
      const name = `${stem}${n}${ext}`
      if (!taken.has(name.toLowerCase())) return name
    }
    return `${stem}${Date.now()}${ext}`
  }
  return desired
}

export async function listOfficeFiles(kind: OfficeKind): Promise<OfficeFileRecord[]> {
  const children = await vfs.readDir(OFFICE_DIR)
  return children
    .filter((n) => isOfficeNode(n, kind))
    .map((node) => ({
      id: node.id,
      name: node.name,
      kind,
      updatedAt: node.updatedAt,
      path: node.path,
      writer: kind === 'writer' ? { ...EMPTY_WRITER } : undefined,
      sheet: kind === 'sheet' ? { ...EMPTY_SHEET, cells: {} } : undefined,
    }))
    .sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function fetchOfficeFile(id: string): Promise<OfficeFileRecord> {
  const { content, node } = await vfs.readFileById(id)
  if (!isOfficeNode(node)) throw new Error('文件不存在')
  return toRecord(node, content)
}

export async function createOfficeFile(
  kind: OfficeKind,
  input?: { name?: string; html?: string; sheet?: SheetBody },
): Promise<OfficeFileRecord> {
  const existing = await vfs.readDir(OFFICE_DIR)
  const count = existing.filter((n) => isOfficeNode(n)).length
  if (count >= MAX_OFFICE_FILES) throw new Error(`文件数量已达上限（${MAX_OFFICE_FILES}）`)

  const name = await uniqueName(kind, input?.name)
  const path = await vfs.allocateUniquePath(OFFICE_DIR, name)
  const mime = kind === 'writer' ? 'text/html' : 'application/json'
  const body =
    kind === 'writer'
      ? assertWriterHtml(input?.html ?? EMPTY_WRITER.html)
      : JSON.stringify(assertSheetBody(input?.sheet ?? { ...EMPTY_SHEET, cells: {} }))
  const node = await vfs.writeFile(path, body, mime)
  return toRecord(node, body)
}

async function renameIfNeeded(node: FileNode, nextName: string, kind: OfficeKind): Promise<FileNode> {
  const desired = ensureFileName(nextName, kind)
  if (getBasename(node.path) === desired) return node
  const nextPath = await vfs.allocateUniquePath(getParentPath(node.path), desired)
  return vfs.renameFile(node.path, nextPath)
}

export async function updateWriterFile(
  id: string,
  patch: { html: string; name?: string },
): Promise<OfficeFileRecord> {
  const existing = await vfs.getNodeById(id)
  if (!existing || !isOfficeNode(existing, 'writer')) throw new Error('文档不存在')
  const html = assertWriterHtml(patch.html)
  const node = patch.name ? await renameIfNeeded(existing, patch.name, 'writer') : existing
  const written = await vfs.writeFile(node.path, html, 'text/html')
  return toRecord(written, html)
}

export async function updateSheetFile(
  id: string,
  patch: { sheet: SheetBody; name?: string },
): Promise<OfficeFileRecord> {
  const existing = await vfs.getNodeById(id)
  if (!existing || !isOfficeNode(existing, 'sheet')) throw new Error('表格不存在')
  const sheet = assertSheetBody(patch.sheet)
  const body = JSON.stringify(sheet)
  const node = patch.name ? await renameIfNeeded(existing, patch.name, 'sheet') : existing
  const written = await vfs.writeFile(node.path, body, 'application/json')
  return toRecord(written, body)
}

/** 移至回收站（与资源管理器一致） */
export async function trashOfficeFile(id: string): Promise<void> {
  const node = await vfs.getNodeById(id)
  if (!node || !isOfficeNode(node)) throw new Error('文件不存在')
  await vfs.trash(node.path)
}

/** 把旧版 office store 里的文件一次性写入 /Documents */
export async function migrateOfficeFilesToVfs(
  files: OfficeFile[],
  lastWriterId: Nullable<string>,
  lastSheetId: Nullable<string>,
): Promise<{ lastWriterId: Nullable<string>; lastSheetId: Nullable<string> }> {
  let nextWriter = lastWriterId
  let nextSheet = lastSheetId
  for (const file of files) {
    try {
      const created = await createOfficeFile(file.kind, {
        name: file.name,
        html: file.writer?.html,
        sheet: file.sheet,
      })
      if (file.id === lastWriterId) nextWriter = created.id
      if (file.id === lastSheetId) nextSheet = created.id
    } catch {
      if (file.id === lastWriterId) nextWriter = null
      if (file.id === lastSheetId) nextSheet = null
    }
  }
  return { lastWriterId: nextWriter, lastSheetId: nextSheet }
}
