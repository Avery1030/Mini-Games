import { DIFFICULTIES, TOP_RECORDS, type Difficulty, type SpiderTimeRecord } from './types'

export type SpiderRecordsMap = Record<Difficulty, SpiderTimeRecord[]>

export type RecordWinResult = {
  rank: number | null
  records: SpiderTimeRecord[]
  current: SpiderTimeRecord
}

export function emptyRecords(): SpiderRecordsMap {
  return { 1: [], 2: [], 3: [], 4: [] }
}

function isTimeRecord(v: unknown): v is SpiderTimeRecord {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  return (
    typeof o.elapsed === 'number' &&
    Number.isFinite(o.elapsed) &&
    o.elapsed >= 0 &&
    typeof o.moves === 'number' &&
    Number.isFinite(o.moves) &&
    o.moves >= 0 &&
    typeof o.score === 'number' &&
    Number.isFinite(o.score) &&
    typeof o.at === 'number' &&
    Number.isFinite(o.at)
  )
}

/** 用时升序；同分比步数、得分、入榜时间 */
export function compareRecords(a: SpiderTimeRecord, b: SpiderTimeRecord): number {
  if (a.elapsed !== b.elapsed) return a.elapsed - b.elapsed
  if (a.moves !== b.moves) return a.moves - b.moves
  if (a.score !== b.score) return b.score - a.score
  return a.at - b.at
}

export function normalizeRecords(raw: unknown): SpiderRecordsMap {
  const out = emptyRecords()
  if (!raw || typeof raw !== 'object') return out
  const rec = raw as Record<string, unknown>
  for (const d of DIFFICULTIES) {
    const list = rec[String(d)]
    if (!Array.isArray(list)) continue
    out[d] = list.filter(isTimeRecord).sort(compareRecords).slice(0, TOP_RECORDS)
  }
  return out
}

export function insertRecord(list: SpiderTimeRecord[], next: SpiderTimeRecord): RecordWinResult {
  const merged = [...list, next].sort(compareRecords).slice(0, TOP_RECORDS)
  const rankIndex = merged.findIndex((r) => r.at === next.at)
  return {
    rank: rankIndex >= 0 ? rankIndex + 1 : null,
    records: merged,
    current: next,
  }
}
