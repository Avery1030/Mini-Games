import path from 'path'

/** 画图文件目录（项目根 .data/drawings） */
export const DRAWINGS_DATA_DIR = path.join(process.cwd(), '.data', 'drawings')

/** 画图索引 */
export const DRAWINGS_INDEX_FILE = path.join(DRAWINGS_DATA_DIR, '_index.json')
