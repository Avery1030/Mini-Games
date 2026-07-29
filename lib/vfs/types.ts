/** 文件内容：文本为 string，二进制为 ArrayBuffer */
export type FileContent = string | ArrayBuffer

/** 文件/目录元信息（对外） */
export interface FileNode {
  id: string
  /** 绝对路径，唯一标识 */
  path: string
  name: string
  /** true=文件夹 false=文件 */
  isDirectory: boolean
  mimeType?: string
  createdAt: number
  updatedAt: number
  /** 文件字节大小，文件夹为 0 */
  size: number
  /**
   * 移入回收站前的原始绝对路径。
   * 仅当节点位于 `/Trash` 下时对外暴露。
   */
  originalPath?: string
  /**
   * 移入回收站的时间戳。
   * 仅当节点位于 `/Trash` 下时对外暴露。
   */
  trashedAt?: number
}

/**
 * 适配器内部存储节点：在 FileNode 基础上增加索引字段。
 * `originalPath` / `trashedAt` 仅 Trash 内条目应写入。
 */
export interface StoredFileNode extends FileNode {
  /** 父目录绝对路径；根节点为 '' */
  parentPath: string
}
