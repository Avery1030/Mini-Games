export type ImageItem = {
  id: string
  title: string
  filename: string
  contentType: string
  size: number
  source: 'upload' | 'url'
  createdAt: number
  updatedAt: number
  /** 原图（仅主预览使用） */
  url: string
  /** 缩略图（侧栏 / 胶片条） */
  thumbUrl: string
}
