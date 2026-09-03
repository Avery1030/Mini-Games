import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { GAME_APP_IDS } from '@/features/games/ids'
import { STORAGE_KEYS, appStorage } from '@/lib/storage'
import {
  EXE_MIME,
  VFS_PATHS,
  VfsCatalogPersistSchema,
  encodeExeContent,
  fileNodeToItem,
  parseExeContent,
  sortVfsChildren,
  type VfsCatalogPersist,
  type VfsClipboard,
  type VfsItem,
  type VfsItemType,
} from '@/lib/vfs/catalog'
import { subscribeVfsChange } from '@/lib/vfs/events'
import { VfsError, getExtension, getParentPath, joinPath, vfs } from '@/lib/vfs'
import { assertValidName } from '@/lib/vfs/path-utils'
import { EMPTY_SHEET, EMPTY_WRITER } from '@/features/office/schema'
import { getAppByExtension } from '@/lib/desktop/appRegister'

type CreateItemInput = {
  name: string
  extension?: string
  content?: string
  executable?: boolean
  appId?: string
}

type VfsState = {
  items: Record<string, VfsItem>
  clipboard: Nullable<VfsClipboard>
  hydrated: boolean
}

type VfsActions = {
  hydrate: () => Promise<void>
  refresh: () => Promise<void>
  persist: () => void
  getItem: (id: string) => Nullable<VfsItem>
  getByPath: (path: string) => Nullable<VfsItem>
  getChildren: (parentId: Nullable<string>) => VfsItem[]
  findPathById: (id: string) => string
  createItem: (type: VfsItemType, parentId: Nullable<string>, input: CreateItemInput) => Promise<VfsItem>
  deleteItem: (id: string, permanent?: boolean) => Promise<void>
  renameItem: (id: string, nextName: string) => Promise<VfsItem>
  copyItem: (ids: string[]) => void
  cutItem: (ids: string[]) => void
  pasteItem: (parentId: Nullable<string>) => Promise<VfsItem[]>
  moveItem: (id: string, targetParentId: Nullable<string>) => Promise<VfsItem>
  getFileByExtension: (ext: string) => ReturnType<typeof getAppByExtension>
  exportAll: () => Promise<VfsCatalogPersist>
  importAll: (payload: unknown) => Promise<void>
}

export type VfsStore = VfsState & VfsActions

function parentPathOf(item: VfsItem, items: Record<string, VfsItem>): string {
  if (!item.parentId) return '/'
  const parent = items[item.parentId]
  return parent?.path ?? '/'
}

function buildIndex(nodes: Awaited<ReturnType<typeof vfs.listAll>>): Record<string, VfsItem> {
  const byPath = new Map(nodes.map((n) => [n.path, n]))
  const items: Record<string, VfsItem> = {}
  for (const node of nodes) {
    const parentPath = node.path === '/' ? null : getParentPath(node.path)
    const parentId = parentPath ? (byPath.get(parentPath)?.id ?? null) : null
    const executable = node.mimeType === EXE_MIME
    items[node.id] = fileNodeToItem(node, node.path === '/' ? null : parentId, { executable })
  }
  return items
}

function requireItem(items: Record<string, VfsItem>, id: string): VfsItem {
  const item = items[id]
  if (!item) throw new VfsError('FileNotFound', `Not found: ${id}`)
  return item
}

function uniqueChildName(items: Record<string, VfsItem>, parentId: Nullable<string>, name: string): boolean {
  return !Object.values(items).some((it) => it.parentId === parentId && it.name.toLowerCase() === name.toLowerCase())
}

export const useVfsStore = create<VfsStore>()(
  persist(
    (set, get) => ({
      items: {},
      clipboard: null,
      hydrated: false,

      persist: () => {
        /* zustand persist 订阅 state；此方法供业务显式触发 snapshot */
        set((s) => ({ items: s.items }))
      },

      getItem: (id) => get().items[id] ?? null,

      getByPath: (path) => Object.values(get().items).find((it) => it.path === path) ?? null,

      getChildren: (parentId) => {
        const { items } = get()
        const parent = parentId ? items[parentId] : Object.values(items).find((it) => it.path === '/')
        const pid = parentId ?? parent?.id ?? null
        return sortVfsChildren(Object.values(items).filter((it) => it.parentId === pid && it.path !== '/'))
      },

      findPathById: (id) => get().items[id]?.path ?? '/',

      getFileByExtension: (ext) => getAppByExtension(ext),

      refresh: async () => {
        const nodes = await vfs.listAll()
        const items = buildIndex(nodes)
        set({ items })
      },

      hydrate: async () => {
        try {
          await vfs.readDir('/')
          await get().refresh()
          await seedGameExecutables(get)
          await get().refresh()
        } catch {
          set({ items: {} })
          try {
            await vfs.readDir('/')
            await get().refresh()
          } catch {
            /* 保持空树 */
          }
        } finally {
          set({ hydrated: true })
        }
      },

      createItem: async (type, parentId, input) => {
        const { items } = get()
        const parent = parentId ? requireItem(items, parentId) : requireItemByPath(items, '/')
        if (parent.type !== 'folder') throw new VfsError('NotDirectory', parent.path)
        const rawName = input.name.trim()
        assertValidName(rawName)
        if (type === 'folder') {
          if (!uniqueChildName(items, parent.id, rawName)) {
            throw new VfsError('ExistError', rawName)
          }
          const path = await vfs.allocateUniquePath(parent.path, rawName)
          await vfs.mkdir(path)
          await get().refresh()
          const created = get().getByPath(path)
          if (!created) throw new VfsError('FileNotFound', path)
          return created
        }
        const ext = (input.extension ?? getExtension(rawName)).replace(/^\./, '').toLowerCase()
        const stem = ext ? rawName.replace(new RegExp(`\\.${ext}$`, 'i'), '') : rawName
        const fileName = ext ? `${stem}.${ext}` : stem
        assertValidName(fileName)
        if (!uniqueChildName(items, parent.id, fileName)) {
          throw new VfsError('ExistError', fileName)
        }
        const path = await vfs.allocateUniquePath(parent.path, fileName)
        const executable = Boolean(input.executable || ext === 'exe')
        const mime = executable
          ? EXE_MIME
          : ext === 'wps'
            ? 'text/html'
            : ext === 'et' || ext === 'json'
              ? 'application/json'
              : 'text/plain'
        const content =
          input.content ??
          (executable && input.appId
            ? encodeExeContent(input.appId)
            : ext === 'wps'
              ? EMPTY_WRITER.html
              : ext === 'et'
                ? JSON.stringify(EMPTY_SHEET)
                : '')
        await vfs.writeFile(path, content, mime)
        await get().refresh()
        const created = get().getByPath(path)
        if (!created) throw new VfsError('FileNotFound', path)
        return created
      },

      deleteItem: async (id, permanent = false) => {
        const item = requireItem(get().items, id)
        if (item.path === '/' || item.path === VFS_PATHS.trash) {
          throw new VfsError('PermissionError', item.path)
        }
        const inTrash = item.path === VFS_PATHS.trash || item.path.startsWith(`${VFS_PATHS.trash}/`)
        if (permanent || inTrash) await vfs.removeFile(item.path)
        else await vfs.trash(item.path)
        await get().refresh()
      },

      renameItem: async (id, nextName) => {
        const item = requireItem(get().items, id)
        const name = nextName.trim()
        assertValidName(name)
        if (name === item.name) return item
        if (!uniqueChildName(get().items, item.parentId, name)) {
          throw new VfsError('ExistError', name)
        }
        const dest = joinPath(parentPathOf(item, get().items), name)
        await vfs.renameFile(item.path, dest)
        await get().refresh()
        const next = get().getByPath(dest)
        if (!next) throw new VfsError('FileNotFound', dest)
        return next
      },

      copyItem: (ids) => {
        const valid = ids.filter((id) => get().items[id])
        set({ clipboard: valid.length ? { mode: 'copy', ids: valid } : null })
      },

      cutItem: (ids) => {
        const valid = ids.filter((id) => get().items[id])
        set({ clipboard: valid.length ? { mode: 'cut', ids: valid } : null })
      },

      pasteItem: async (parentId) => {
        const clip = get().clipboard
        if (!clip || clip.ids.length === 0) return []
        const parent = parentId ? requireItem(get().items, parentId) : requireItemByPath(get().items, VFS_PATHS.desktop)
        if (parent.type !== 'folder') throw new VfsError('NotDirectory', parent.path)
        const destPaths: string[] = []
        for (const id of clip.ids) {
          const src = get().items[id]
          if (!src) continue
          if (clip.mode === 'cut' && (src.path === parent.path || parent.path.startsWith(`${src.path}/`))) continue
          const dest = await vfs.allocateUniquePath(parent.path, src.name)
          if (clip.mode === 'copy') await vfs.copyFile(src.path, dest)
          else await vfs.moveFile(src.path, dest)
          destPaths.push(dest)
        }
        if (clip.mode === 'cut') set({ clipboard: null })
        await get().refresh()
        return destPaths.map((p) => get().getByPath(p)).filter((it): it is VfsItem => Boolean(it))
      },

      moveItem: async (id, targetParentId) => {
        const item = requireItem(get().items, id)
        const parent = targetParentId ? requireItem(get().items, targetParentId) : requireItemByPath(get().items, '/')
        if (parent.type !== 'folder') throw new VfsError('NotDirectory', parent.path)
        if (parent.path === item.path || parent.path.startsWith(`${item.path}/`)) {
          throw new VfsError('PermissionError', 'Cannot move into itself')
        }
        const dest = await vfs.allocateUniquePath(parent.path, item.name)
        await vfs.moveFile(item.path, dest)
        await get().refresh()
        const next = get().getByPath(dest)
        if (!next) throw new VfsError('FileNotFound', dest)
        return next
      },

      exportAll: async () => {
        await get().refresh()
        const items: VfsItem[] = []
        for (const item of Object.values(get().items)) {
          if (item.type === 'folder') {
            items.push({ ...item, content: '' })
            continue
          }
          try {
            const { content } = await vfs.readFile(item.path)
            const text = typeof content === 'string' ? content : ''
            let appId = item.appId
            if (item.executable && !appId) appId = parseExeContent(text)?.appId
            items.push({ ...item, content: text, appId })
          } catch {
            items.push({ ...item, content: '' })
          }
        }
        return { version: 1 as const, items }
      },

      importAll: async (payload) => {
        const parsed = VfsCatalogPersistSchema.safeParse(payload)
        if (!parsed.success) throw new VfsError('PermissionError', 'Invalid VFS backup')
        const sorted = [...parsed.data.items].sort((a, b) => a.path.length - b.path.length)
        for (const item of sorted) {
          if (item.path === '/') continue
          if (item.type === 'folder') {
            if (!(await vfs.exists(item.path))) await vfs.mkdir(item.path)
            continue
          }
          await vfs.mkdir(getParentPath(item.path)).catch(() => undefined)
          const mime = item.executable ? EXE_MIME : item.mimeType
          await vfs.writeFile(item.path, item.content, mime)
        }
        await get().refresh()
      },
    }),
    {
      name: STORAGE_KEYS.vfsCatalog,
      version: 1,
      storage: createJSONStorage(() => appStorage.createStateStorage()),
      partialize: (s) => ({
        items: Object.fromEntries(Object.entries(s.items).map(([id, it]) => [id, { ...it, content: '' }])),
      }),
      merge: (persisted, current) => {
        if (!persisted || typeof persisted !== 'object') return current
        return current
      },
    },
  ),
)

function requireItemByPath(items: Record<string, VfsItem>, path: string): VfsItem {
  const item = Object.values(items).find((it) => it.path === path)
  if (!item) throw new VfsError('FileNotFound', path)
  return item
}

async function seedGameExecutables(get: () => VfsStore): Promise<void> {
  if (!get().getByPath(VFS_PATHS.games)) {
    await vfs.mkdir(VFS_PATHS.games)
    await get().refresh()
  }
  const parent = get().getByPath(VFS_PATHS.games)
  if (!parent) return
  for (const appId of GAME_APP_IDS) {
    const name = `${appId}.exe`
    const path = joinPath(VFS_PATHS.games, name)
    if (await vfs.exists(path)) continue
    await vfs.writeFile(path, encodeExeContent(appId), EXE_MIME)
  }
  await get().refresh()
  const folder = get().getByPath(VFS_PATHS.games)
  if (!folder) return
  const keep = new Set(GAME_APP_IDS.map((id) => `${id}.exe`.toLowerCase()))
  for (const child of get().getChildren(folder.id)) {
    if (!child.name.toLowerCase().endsWith('.exe')) continue
    if (keep.has(child.name.toLowerCase())) continue
    await vfs.removeFile(child.path)
  }
}

if (typeof window !== 'undefined') {
  subscribeVfsChange(() => {
    void useVfsStore.getState().refresh()
  })
}
