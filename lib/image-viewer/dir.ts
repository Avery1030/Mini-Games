import path from 'path'

/** 图片查看器目录（项目根 .data/images） */
export const IMAGE_VIEWER_DATA_DIR = path.join(process.cwd(), '.data', 'images')

/** 图片索引 */
export const IMAGE_VIEWER_INDEX_FILE = path.join(IMAGE_VIEWER_DATA_DIR, '_index.json')
