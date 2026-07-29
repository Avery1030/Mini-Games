export type ImageOrigin = 'vfs' | 'url'

export type ImageItem = {
  id: string
  /** VFS 绝对路径；仅 origin=vfs 时有意义 */
  path: string
  title: string
  filename: string
  contentType: string
  size: number
  origin: ImageOrigin
  /** @deprecated 使用 origin；保留兼容侧栏旧文案映射 */
  source: 'upload' | 'url'
  createdAt: number
  updatedAt: number
  /** 原图（仅主预览使用） */
  url: string
  /** 缩略图（侧栏 / 胶片条） */
  thumbUrl: string
}
