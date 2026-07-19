import path from 'path'

/** 记事本文本目录（项目根 .data/notes） */
export const NOTES_DATA_DIR = path.join(process.cwd(), '.data', 'notes')

/** 笔记索引文件 */
export const NOTES_INDEX_FILE = path.join(NOTES_DATA_DIR, '_index.json')
