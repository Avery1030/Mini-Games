import { fetchRemoteImageBlob } from '@/lib/idb/fetchRemote'
import { contentTypeForExt, extFromMimeOrName, type ImageExt } from '@/lib/idb/imageUtils'
import {
  getBasename,
  getExtension,
  sanitizeFileStem,
  vfs,
  VfsError,
  type FileNode,
} from '@/lib/vfs'
import {
  WALLPAPERS_3D_DIR,
  WALLPAPERS_DIR,
  type WallpaperAsset,
  type WallpaperAssetKind,
} from './types'

const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const MAX_MODEL_BYTES = 30 * 1024 * 1024
const MAX_IMAGES = 40
const MAX_MODELS = 20

const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'])

function fileExt(ext: ImageExt): string {
  return ext === 'jpg' ? 'jpg' : ext
}

function nodeKind(node: FileNode): Nullable<WallpaperAssetKind> {
  if (node.isDirectory) return null
  const ext = getExtension(node.path).toLowerCase()
  if (ext === 'glb' || ext === 'gltf') return 'model'
  if (IMAGE_EXTS.has(ext === 'jpeg' ? 'jpg' : ext)) return 'image'
  return null
}

function toAsset(node: FileNode): Nullable<WallpaperAsset> {
  const kind = nodeKind(node)
  if (!kind) return null
  return {
    id: node.id,
    path: node.path,
    name: getBasename(node.path),
    kind,
    mimeType: node.mimeType,
    size: node.size,
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
  }
}

function assertNotInUse(path: string, activePaths: ReadonlyArray<Nullable<string> | undefined>): void {
  const normalized = path
  for (const active of activePaths) {
    if (active && active === normalized) {
      throw new Error('不能删除正在使用的壁纸')
    }
  }
}

/** 列出 /Wallpapers 下的图片（不含 3d 子目录） */
export async function listWallpaperImages(): Promise<WallpaperAsset[]> {
  const children = await vfs.readDir(WALLPAPERS_DIR)
  return children
    .map(toAsset)
    .filter((a): a is WallpaperAsset => a != null && a.kind === 'image')
    .sort((a, b) => b.createdAt - a.createdAt)
}

/** 列出 /Wallpapers/3d 下的模型 */
export async function listWallpaperModels(): Promise<WallpaperAsset[]> {
  const children = await vfs.readDir(WALLPAPERS_3D_DIR)
  return children
    .map(toAsset)
    .filter((a): a is WallpaperAsset => a != null && a.kind === 'model')
    .sort((a, b) => b.createdAt - a.createdAt)
}

/** 本地上传图片 → /Wallpapers/xxx */
export async function uploadWallpaperImage(file: File): Promise<WallpaperAsset> {
  if (!(file instanceof File) || file.size === 0) throw new Error('请选择图片文件')
  if (!file.type.startsWith('image/') && !/\.(jpe?g|png|gif|webp|bmp)$/i.test(file.name)) {
    throw new Error('仅支持图片文件')
  }
  if (file.size > MAX_IMAGE_BYTES) throw new Error('图片请小于 10MB')

  const existing = await listWallpaperImages()
  if (existing.length >= MAX_IMAGES) throw new Error(`壁纸数量已达上限（${MAX_IMAGES}）`)

  const ext = fileExt(extFromMimeOrName(file.type, file.name))
  const stem = sanitizeFileStem(file.name.replace(/\.[^.]+$/, '') || 'wallpaper')
  const path = await vfs.allocateUniquePath(WALLPAPERS_DIR, `${stem}.${ext}`)
  const buffer = await file.arrayBuffer()
  const mime =
    file.type && file.type.startsWith('image/') ? file.type : contentTypeForExt(extFromMimeOrName(file.type, file.name))
  const node = await vfs.writeFile(path, buffer, mime)
  const asset = toAsset(node)
  if (!asset) throw new Error('上传失败')
  return asset
}

/** 外链图片经代理拉取后写入 VFS */
export async function importWallpaperImageFromUrl(url: string): Promise<WallpaperAsset> {
  const { blob, contentType } = await fetchRemoteImageBlob(url)
  if (blob.size === 0) throw new Error('图片为空')
  if (blob.size > MAX_IMAGE_BYTES) throw new Error('图片请小于 10MB')

  const existing = await listWallpaperImages()
  if (existing.length >= MAX_IMAGES) throw new Error(`壁纸数量已达上限（${MAX_IMAGES}）`)

  let nameHint = 'wallpaper'
  try {
    nameHint = decodeURIComponent(new URL(url).pathname.split('/').pop() || 'wallpaper')
  } catch {
    // ignore
  }
  const ext = fileExt(extFromMimeOrName(contentType ?? blob.type, nameHint))
  const stem = sanitizeFileStem(nameHint.replace(/\.[^.]+$/, '') || 'wallpaper')
  const path = await vfs.allocateUniquePath(WALLPAPERS_DIR, `${stem}.${ext}`)
  const buffer = await blob.arrayBuffer()
  const mime =
    blob.type && blob.type.startsWith('image/')
      ? blob.type
      : contentTypeForExt(extFromMimeOrName(contentType, nameHint))
  const node = await vfs.writeFile(path, buffer, mime)
  const asset = toAsset(node)
  if (!asset) throw new Error('导入失败')
  return asset
}

/** 本地上传 GLB → /Wallpapers/3d/xxx.glb */
export async function uploadWallpaperModel(file: File): Promise<WallpaperAsset> {
  if (!(file instanceof File) || file.size === 0) throw new Error('请选择 3D 模型文件')
  if (!/\.glb$/i.test(file.name) && file.type !== 'model/gltf-binary') {
    throw new Error('仅支持 .glb 文件')
  }
  if (file.size > MAX_MODEL_BYTES) throw new Error('模型请小于 30MB')

  const existing = await listWallpaperModels()
  if (existing.length >= MAX_MODELS) throw new Error(`3D 壁纸数量已达上限（${MAX_MODELS}）`)

  const stem = sanitizeFileStem(file.name.replace(/\.[^.]+$/i, '') || 'model')
  const path = await vfs.allocateUniquePath(WALLPAPERS_3D_DIR, `${stem}.glb`)
  const buffer = await file.arrayBuffer()
  const node = await vfs.writeFile(path, buffer, 'model/gltf-binary')
  const asset = toAsset(node)
  if (!asset) throw new Error('上传失败')
  return asset
}

/**
 * 删除壁纸：移入回收站（vfs.trash），禁止删当前生效项。
 * @param activePaths 当前配置中正在使用的路径（图片 + 3D）
 */
export async function trashWallpaper(
  path: string,
  activePaths: ReadonlyArray<Nullable<string> | undefined>,
): Promise<void> {
  assertNotInUse(path, activePaths)
  try {
    await vfs.trash(path)
  } catch (err) {
    if (err instanceof VfsError && err.code === 'FileNotFound') {
      throw new Error('壁纸不存在')
    }
    throw err
  }
}
